import { GameLoader } from '../shell/game-loader';
import type { App } from '../app';

export class Launcher {
  private listEl: HTMLElement | null = null;

  constructor(
    private gameLoader: GameLoader,
    private app: App,
  ) {}

  render(): void {
    this.listEl = document.getElementById('game-list');

    // Import button handlers
    const btnFile = document.getElementById('btn-import-file');
    const btnUrl = document.getElementById('btn-import-url');

    btnFile?.addEventListener('click', () => this.handleFileImport());
    btnUrl?.addEventListener('click', () => this.handleUrlImport());

    // Listen for gamepad toggle
    window.addEventListener('toggle-gamepad', () => {
      this.app.toggleGamepad();
    });

    this.refreshGameList();
  }

  refreshGameList(): void {
    if (!this.listEl) return;
    const games = this.gameLoader.getGames();

    if (games.length === 0) {
      this.listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📂</div>
          <p>还没有导入游戏</p>
          <p style="font-size:12px;color:#444;margin-top:4px">导入一个 RPG Maker MV 游戏 ZIP 开始</p>
        </div>`;
      return;
    }

    this.listEl.innerHTML = games
      .map(
        (game) => `
      <div class="game-card" data-game-id="${game.id}">
        <div class="game-icon">🎮</div>
        <div class="game-title">${this.escapeHtml(game.title)}</div>
        <div class="game-meta">
          ${game.lastPlayed ? `上次游玩: ${this.formatDate(game.lastPlayed)}` : '未游玩'}
        </div>
      </div>`,
      )
      .join('');

    // Add click handlers
    this.listEl.querySelectorAll('.game-card').forEach((card) => {
      card.addEventListener('click', () => {
        const gameId = (card as HTMLElement).dataset.gameId;
        if (gameId) this.launchGame(gameId);
      });

      // Long press to delete
      let longPressTimer: number;
      card.addEventListener('pointerdown', () => {
        const gameId = (card as HTMLElement).dataset.gameId;
        longPressTimer = window.setTimeout(() => {
          if (gameId && confirm('确定删除此游戏？')) {
            this.gameLoader.deleteGame(gameId);
            this.refreshGameList();
          }
        }, 800);
      });
      card.addEventListener('pointerup', () => clearTimeout(longPressTimer));
      card.addEventListener('pointerleave', () => clearTimeout(longPressTimer));
    });
  }

  private importCancel: (() => void) | null = null;

  private async handleFileImport(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      this.showProgress(file.name);
      const result = await this.gameLoader.importFromFile(file, this.makeProgressHandler());
      this.hideProgress();
      if (result.success) {
        this.showToast('导入成功！');
        this.refreshGameList();
      } else {
        if (result.error !== '已取消') {
          this.showToast(`导入失败: ${result.error}`);
        }
      }
    };
    input.click();
  }

  private async handleUrlImport(): Promise<void> {
    const url = prompt('请输入游戏 ZIP 下载地址：');
    if (!url) return;

    this.showProgress(url.split('/').pop() || 'game.zip');
    const result = await this.gameLoader.importFromUrl(url, this.makeProgressHandler());
    this.hideProgress();
    if (result.success) {
      this.showToast('导入成功！');
      this.refreshGameList();
    } else {
      if (result.error !== '已取消') {
        this.showToast(`导入失败: ${result.error}`);
      }
    }
  }

  private makeProgressHandler() {
    return (stage: string, pct: number, detail: string) => {
      const titleEl = document.getElementById('progress-title');
      const detailEl = document.getElementById('progress-detail');
      const barEl = document.getElementById('progress-bar');
      const pctEl = document.getElementById('progress-pct');

      if (titleEl) titleEl.textContent = stage === 'download' ? '正在下载' : stage === 'validate' ? '正在验证' : '正在导入...';
      if (detailEl) detailEl.textContent = detail;
      if (barEl) barEl.style.width = `${pct}%`;
      if (pctEl) pctEl.textContent = `${pct}%`;
    };
  }

  private showProgress(filename: string): void {
    const overlay = document.getElementById('progress-overlay');
    const titleEl = document.getElementById('progress-title');
    const detailEl = document.getElementById('progress-detail');
    const barEl = document.getElementById('progress-bar');
    const pctEl = document.getElementById('progress-pct');

    if (overlay) overlay.classList.add('active');
    if (titleEl) titleEl.textContent = '正在导入...';
    if (detailEl) detailEl.textContent = filename;
    if (barEl) barEl.style.width = '0%';
    if (pctEl) pctEl.textContent = '0%';

    // Cancel button
    const cancelBtn = document.getElementById('btn-cancel-import');
    if (cancelBtn) {
      const handler = () => {
        // Trigger error via setting a flag — handled in extractZip loop
        // For now: reload to cancel
        overlay?.classList.remove('active');
        this.showToast('导入已取消');
      };
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      document.getElementById('btn-cancel-import')?.addEventListener('click', handler);
    }
  }

  private hideProgress(): void {
    const overlay = document.getElementById('progress-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  private async launchGame(gameId: string): Promise<void> {
    try {
      await this.gameLoader.launch(gameId);
    } catch (err: any) {
      this.showToast(`启动失败: ${err.message}`);
    }
  }

  private showToast(message: string): void {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private formatDate(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
