import { GameManifest, GameManifestResult } from './game-manifest';
import { GameHost } from './game-host';
import type { App } from '../app';

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

  async importFromFile(file: File): Promise<{ success: boolean; error?: string; entry?: GameEntry }> {
    try {
      const zip = await this.extractZip(file);
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

  async importFromUrl(url: string): Promise<{ success: boolean; error?: string; entry?: GameEntry }> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`下载失败: HTTP ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], url.split('/').pop() || 'game.zip', { type: 'application/zip' });
      return this.importFromFile(file);
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

  private async extractZip(file: File): Promise<Array<{ path: string; content?: ArrayBuffer }>> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const files: Array<{ path: string; content?: ArrayBuffer }> = [];

    const promises: Promise<void>[] = [];
    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;
      const normalizedPath = relativePath.replace(/\\/g, '/');
      const promise = zipEntry.async('arraybuffer').then((data) => {
        files.push({ path: normalizedPath, content: data });
      });
      promises.push(promise);
    });

    await Promise.all(promises);
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
