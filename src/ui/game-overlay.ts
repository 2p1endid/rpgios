import type { App } from '../app';

export class GameOverlay {
  private el: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private hideTimeout: number | null = null;

  constructor(private app: App) {}

  init(): void {
    this.el = document.getElementById('game-overlay');
    this.titleEl = document.getElementById('overlay-title');

    const btnBack = document.getElementById('btn-back');
    btnBack?.addEventListener('click', () => {
      this.app.returnToLauncher();
    });

    const btnToggle = document.getElementById('btn-toggle-gamepad');
    btnToggle?.addEventListener('click', () => {
      this.app.toggleGamepad();
    });

    const btnSettings = document.getElementById('btn-open-settings');
    btnSettings?.addEventListener('click', () => {
      this.app.settingsPanel.open();
    });

    // Show overlay on tap near top of screen
    document.getElementById('game-view')?.addEventListener('click', (e) => {
      if (e.clientY < 60) {
        this.show();
        this.scheduleAutoHide();
      }
    });
  }

  show(): void {
    this.el?.classList.add('visible');
  }

  hide(): void {
    this.el?.classList.remove('visible');
  }

  setTitle(title: string): void {
    if (this.titleEl) this.titleEl.textContent = title;
  }

  private scheduleAutoHide(): void {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = window.setTimeout(() => this.hide(), 3000);
  }
}
