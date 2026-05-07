import { GameManifest } from './game-manifest';
import { GameHost } from './game-host';
import type { App } from '../app';

export type ProgressCallback = (stage: string, pct: number, detail: string) => void;

interface GameEntry {
  id: string;
  title: string;
  path: string;
  importedAt: number;
  lastPlayed?: number;
}

// Threshold above which native extraction is used (50 MB)
const NATIVE_EXTRACT_THRESHOLD = 50 * 1024 * 1024;

// Check if we're running inside Capacitor (iOS/Android)
function isCapacitor(): boolean {
  return !!(window as any).Capacitor;
}

export class GameLoader {
  private games: GameEntry[] = [];
  private storageKey = 'rpgmaker-games';

  constructor(
    private manifest: GameManifest,
    private host: GameHost,
    private app: App,
  ) {
    this.loadLibrary();
  }

  getGames(): GameEntry[] {
    return this.games;
  }

  async importFromFile(
    file: File,
    onProgress?: ProgressCallback,
  ): Promise<{ success: boolean; error?: string; entry?: GameEntry }> {
    try {
      const gameId = this.generateId(file.name);

      let gamePath: string;
      let title: string;

      // Large files on iOS: use native ZIP extraction
      if (isCapacitor() && file.size > NATIVE_EXTRACT_THRESHOLD) {
        onProgress?.('extract', 0, '使用原生引擎解压...');
        const result = await this.nativeImport(file, gameId, onProgress);
        if (!result.success) return result;
        gamePath = result.path!;
        title = result.title!;
      } else {
        // Small files or browser mode: use JSZip
        onProgress?.('extract', 0, '正在解析...');

        const zipFiles = await this.extractZipJs(file, (pct, name) => {
          onProgress?.('extract', pct, `解压: ${name}`);
        });

        onProgress?.('validate', 90, '正在验证文件...');
        const validation = this.manifest.validate(zipFiles);

        if (!validation.valid) {
          return {
            success: false,
            error: `游戏文件不完整，缺少: ${validation.missingFiles.join(', ')}`,
          };
        }

        title = validation.title || file.name.replace(/\.zip$/i, '');
        gamePath = `/games/${gameId}`;
      }

      const entry: GameEntry = {
        id: gameId,
        title,
        path: gamePath,
        importedAt: Date.now(),
      };

      this.games.push(entry);
      this.saveLibrary();

      return { success: true, entry };
    } catch (err: any) {
      return { success: false, error: err.message || '导入失败' };
    }
  }

  async importFromUrl(
    url: string,
    onProgress?: ProgressCallback,
  ): Promise<{ success: boolean; error?: string; entry?: GameEntry }> {
    try {
      onProgress?.('download', 0, '正在下载...');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`下载失败: HTTP ${response.status}`);

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      // Stream download with progress
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) {
          const pct = Math.round((received / total) * 50);
          onProgress?.('download', pct,
            `下载中 ${this.formatSize(received)} / ${this.formatSize(total)}`);
        }
      }

      const blob = new Blob(chunks as BlobPart[]);
      const file = new File([blob], url.split('/').pop() || 'game.zip',
        { type: 'application/zip' });
      return this.importFromFile(file, onProgress);
    } catch (err: any) {
      return { success: false, error: err.message || 'URL 导入失败' };
    }
  }

  async launch(gameId: string): Promise<void> {
    const entry = this.games.find((g) => g.id === gameId);
    if (!entry) throw new Error(`游戏未找到: ${gameId}`);

    entry.lastPlayed = Date.now();
    this.saveLibrary();

    await this.app.launchGame(gameId, entry.path);
  }

  deleteGame(gameId: string): void {
    this.games = this.games.filter((g) => g.id !== gameId);
    this.saveLibrary();
  }

  // ---- Native import (iOS: SSZipArchive stream extraction) ----

  private async nativeImport(
    file: File,
    gameId: string,
    onProgress?: ProgressCallback,
  ): Promise<{ success: boolean; error?: string; path?: string; title?: string }> {
    const { Filesystem } = (window as any).Capacitor.Plugins;
    const { ZipExtractor } = (window as any).Capacitor.Plugins;

    if (!Filesystem || !ZipExtractor) {
      return { success: false, error: '原生插件未加载，请在小文件模式或 iOS 设备上导入' };
    }

    // Step 1: Write ZIP to Documents directory (native filesystem)
    onProgress?.('extract', 5, '复制文件到本地...');
    const arrayBuf = await file.arrayBuffer();
    const base64 = this.arrayBufferToBase64(arrayBuf);

    const writeResult = await Filesystem.writeFile({
      path: `imports/${gameId}.zip`,
      data: base64,
      directory: 'DOCUMENTS',
      recursive: true,
    });

    // Step 2: Get the destination extraction path
    const destResult = await ZipExtractor.getExtractedPath({ gameId });
    const destDir: string = destResult.path;

    // Step 3: Listen for progress events
    let lastPct = 5;
    ZipExtractor.addListener?.('progress', null, (data: any) => {
      const pct = 5 + Math.round((data.pct / 100) * 75);
      if (pct !== lastPct) {
        lastPct = pct;
        onProgress?.('extract', pct,
          `解压 ${data.current || ''} (${data.entryNumber}/${data.total})`);
      }
    });

    // Step 4: Run native extraction
    const zipPath = writeResult.uri.replace('file://', '');
    await ZipExtractor.extract({ zipPath, destDir });

    // Step 5: Validate extracted files
    onProgress?.('validate', 85, '正在验证文件...');
    const { opendir } = Filesystem;
    // Recursively list files in destDir to validate
    const fileList = await this.listDirRecursive(destDir, '');
    const validation = this.manifest.validate(fileList.map(f => ({ path: f })));

    if (!validation.valid) {
      return {
        success: false,
        error: `游戏文件不完整，缺少: ${validation.missingFiles.join(', ')}`,
      };
    }

    const title = validation.title || '';
    onProgress?.('done', 100, '导入完成');

    return { success: true, path: destDir, title };
  }

  private async listDirRecursive(
    baseDir: string,
    subDir: string,
  ): Promise<string[]> {
    const { Filesystem } = (window as any).Capacitor.Plugins;
    const result: string[] = [];
    try {
      const dirPath = subDir ? `${baseDir}/${subDir}` : baseDir;
      const list = await Filesystem.readdir({ path: dirPath });
      for (const item of list.files) {
        const fullPath = subDir ? `${subDir}/${item.name}` : item.name;
        if (item.type === 'directory') {
          const children = await this.listDirRecursive(baseDir, fullPath);
          result.push(...children);
        } else {
          result.push(fullPath);
        }
      }
    } catch {
      // Skip unreadable directories
    }
    return result;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  // ---- JSZip extraction (browser / small files) ----

  private async extractZipJs(
    file: File,
    onEntry?: (pct: number, name: string) => void,
  ): Promise<Array<{ path: string; content?: ArrayBuffer }>> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const files: Array<{ path: string; content?: ArrayBuffer }> = [];

    const entries: Array<{ name: string; entry: any }> = [];
    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir) {
        entries.push({
          name: relativePath.replace(/\\/g, '/'),
          entry: zipEntry,
        });
      }
    });

    const total = entries.length;
    let completed = 0;

    for (const { name, entry } of entries) {
      const data = await entry.async('arraybuffer');
      files.push({ path: name, content: data });
      completed++;
      onEntry?.(Math.round((completed / total) * 100), name);
    }

    return files;
  }

  // ---- Utilities ----

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  private generateId(filename: string): string {
    const base = filename.replace(/\.zip$/i, '')
      .replace(/[^a-zA-Z0-9\x00-\x9f\-_]/g, '_');
    return `${base}-${Date.now()}`;
  }

  private loadLibrary(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) this.games = JSON.parse(raw);
    } catch {
      this.games = [];
    }
  }

  private saveLibrary(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.games));
    } catch { /* storage full */ }
  }
}
