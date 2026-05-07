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

  private async handleFileImport(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      this.showToast('正在导入...');
      const result = await this.gameLoader.importFromFile(file);
      if (result.success) {
        this.showToast('导入成功！');
        this.refreshGameList();
      } else {
        this.showToast(`导入失败: ${result.error}`);
      }
    };
    input.click();
  }

  private async handleUrlImport(): Promise<void> {
    const url = prompt('请输入游戏 ZIP 下载地址：');
    if (!url) return;

    this.showToast('正在下载并导入...');
    const result = await this.gameLoader.importFromUrl(url);
    if (result.success) {
      this.showToast('导入成功！');
      this.refreshGameList();
    } else {
      this.showToast(`导入失败: ${result.error}`);
    }
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
