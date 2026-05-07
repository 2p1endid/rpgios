import { TouchMapper } from './touch-mapper';

interface DPadButton {
  el: HTMLElement;
  dir: string;
  active: boolean;
}

export class VirtualGamepad {
  private dpad: HTMLElement | null = null;
  private dpadButtons: DPadButton[] = [];
  private gamepadEl: HTMLElement | null = null;
  private visible = false;

  constructor(private mapper: TouchMapper) {}

  init(): void {
    this.gamepadEl = document.getElementById('gamepad');
    this.dpad = document.getElementById('dpad');

    // Set up D-pad buttons
    const dirs = ['up', 'down', 'left', 'right'];
    for (const dir of dirs) {
      const el = document.querySelector(`.dpad-${dir}`) as HTMLElement;
      if (!el) continue;
      const btn: DPadButton = { el, dir, active: false };
      this.dpadButtons.push(btn);

      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.active = true;
        el.classList.add('pressed');
        this.mapper.onButtonChange(dir, true);
      });

      el.addEventListener('pointerup', (e) => {
        e.preventDefault();
        btn.active = false;
        el.classList.remove('pressed');
        this.mapper.onButtonChange(dir, false);
      });

      el.addEventListener('pointerleave', () => {
        if (btn.active) {
          btn.active = false;
          el.classList.remove('pressed');
          this.mapper.onButtonChange(dir, false);
        }
      });
    }

    // Action buttons
    const btnA = document.getElementById('btn-a');
    const btnB = document.getElementById('btn-b');

    if (btnA) {
      btnA.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.mapper.onButtonChange('ok', true);
      });
      btnA.addEventListener('pointerup', (e) => {
        e.preventDefault();
        this.mapper.onButtonChange('ok', false);
      });
    }

    if (btnB) {
      btnB.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.mapper.onButtonChange('escape', true);
      });
      btnB.addEventListener('pointerup', (e) => {
        e.preventDefault();
        this.mapper.onButtonChange('escape', false);
      });
    }

    // Menu button
    const btnMenu = document.getElementById('btn-game-menu');
    if (btnMenu) {
      btnMenu.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.mapper.onButtonChange('escape', true);
        setTimeout(() => this.mapper.onButtonChange('escape', false), 100);
      });
    }

    // Toggle gamepad button
    const btnToggle = document.getElementById('btn-toggle-gamepad');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        // This will be handled by the App
        window.dispatchEvent(new CustomEvent('toggle-gamepad'));
      });
    }

    // Update opacity from settings
    this.updateOpacity(40);
  }

  show(): void {
    this.visible = true;
    this.gamepadEl?.classList.add('active');
  }

  hide(): void {
    this.visible = false;
    this.gamepadEl?.classList.remove('active');
  }

  isVisible(): boolean {
    return this.visible;
  }

  updateOpacity(value: number): void {
    if (this.gamepadEl) {
      const opacity = value / 100;
      this.gamepadEl.style.setProperty('--gamepad-opacity', String(opacity));
      // Apply opacity to dpad zone and buttons
      const dpadZone = this.gamepadEl.querySelector('.dpad-zone') as HTMLElement;
      if (dpadZone) dpadZone.style.opacity = String(opacity * 1.5);

      const actionBtns = this.gamepadEl.querySelectorAll('.action-btn');
      actionBtns.forEach((btn) => {
        (btn as HTMLElement).style.opacity = String(opacity * 1.5);
      });
    }
  }
}
