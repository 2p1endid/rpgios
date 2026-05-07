import { GameManifest, GameManifestResult } from './game-manifest';
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
    let cancelled = false;
    const checkCancel = () => { if (cancelled) throw new Error('已取消'); };

    try {
      checkCancel();
      onProgress?.('extract', 0, `正在解析 ${file.name}...`);

      const zip = await this.extractZip(file, (pct, name) => {
        checkCancel();
        onProgress?.('extract', pct, `解压: ${name}`);
      }, checkCancel);

      checkCancel();
      onProgress?.('validate', 90, '正在验证文件...');
      const validation = this.manifest.validate(zip);

      if (!validation.valid) {
        return {
          success: false,
          error: `游戏文件不完整，缺少: ${validation.missingFiles.join(', ')}`,
        };
      }

      const gameId = this.generateId(file.name);
      const title = validation.title || file.name.replace(/\.zip$/i, '');

      // Store files in memory for the session (in production, extracted to disk via native plugin)
      const gamePath = this.buildLocalPath(gameId, zip);

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
          const pct = Math.round((received / total) * 50); // download = 0-50%
          onProgress?.('download', pct, `下载中 ${this.formatSize(received)} / ${this.formatSize(total)}`);
        }
      }

      const blob = new Blob(chunks as BlobPart[]);
      const file = new File([blob], url.split('/').pop() || 'game.zip', { type: 'application/zip' });
      return this.importFromFile(file, onProgress);
    } catch (err: any) {
      return { success: false, error: err.message || 'URL 导入失败' };
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  private async extractZip(
    file: File,
    onEntry?: (pct: number, name: string) => void,
    checkCancel?: () => void,
  ): Promise<Array<{ path: string; content?: ArrayBuffer }>> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const files: Array<{ path: string; content?: ArrayBuffer }> = [];

    // Collect all entries first
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

    // Process one by one for accurate progress
    for (const { name, entry } of entries) {
      checkCancel?.();
      const data = await entry.async('arraybuffer');
      files.push({ path: name, content: data });
      completed++;
      onEntry?.(Math.round((completed / total) * 100), name);
    }

    return files;
  }

  private buildLocalPath(gameId: string, _files: Array<{ path: string; content?: ArrayBuffer }>): string {
    // In browser dev mode, store files in an in-memory Blob URL
    // In production (Capacitor), this will be the GCDWebServer path
    return `/games/${gameId}`;
  }

  private generateId(filename: string): string {
    const base = filename.replace(/\.zip$/i, '').replace(/[^a-zA-Z0-9一-鿿\-_]/g, '_');
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
    } catch {
      // Storage full - would warn user in production
    }
  }
}
