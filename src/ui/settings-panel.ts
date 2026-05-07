import type { App } from '../app';

interface Settings {
  scaleMode: 'fit' | 'fill' | 'original';
  gamepadOpacity: number;
  keyRepeatSpeed: 'slow' | 'normal' | 'fast';
}

const DEFAULT_SETTINGS: Settings = {
  scaleMode: 'fit',
  gamepadOpacity: 40,
  keyRepeatSpeed: 'normal',
};

export class SettingsPanel {
  private el: HTMLElement | null = null;
  private settings: Settings;

  constructor(private app: App) {
    this.settings = this.loadSettings();
  }

  init(): void {
    this.el = document.getElementById('settings-panel');

    const closeBtn = document.getElementById('btn-close-settings');
    closeBtn?.addEventListener('click', () => this.close());

    // Scale mode
    const scaleSelect = document.getElementById('setting-scale-mode') as HTMLSelectElement;
    scaleSelect?.addEventListener('change', () => {
      this.settings.scaleMode = scaleSelect.value as Settings['scaleMode'];
      this.saveSettings();
      this.applyScaleMode();
    });

    // Gamepad opacity
    const opacityInput = document.getElementById('setting-gamepad-opacity') as HTMLInputElement;
    opacityInput?.addEventListener('input', () => {
      this.settings.gamepadOpacity = parseInt(opacityInput.value, 10);
      this.saveSettings();
      this.app.virtualGamepad.updateOpacity(this.settings.gamepadOpacity);
    });

    // Key repeat speed
    const repeatSelect = document.getElementById('setting-key-repeat') as HTMLSelectElement;
    repeatSelect?.addEventListener('change', () => {
      this.settings.keyRepeatSpeed = repeatSelect.value as Settings['keyRepeatSpeed'];
      this.saveSettings();
      this.app.touchMapper.setRepeatSpeed(this.settings.keyRepeatSpeed);
    });

    // Load values into UI
    if (scaleSelect) scaleSelect.value = this.settings.scaleMode;
    if (opacityInput) opacityInput.value = String(this.settings.gamepadOpacity);
    if (repeatSelect) repeatSelect.value = this.settings.keyRepeatSpeed;

    // Apply initial
    this.applyScaleMode();
    this.app.virtualGamepad.updateOpacity(this.settings.gamepadOpacity);
    this.app.touchMapper.setRepeatSpeed(this.settings.keyRepeatSpeed);
  }

  open(): void {
    this.el?.classList.add('open');
  }

  close(): void {
    this.el?.classList.remove('open');
  }

  getSettings(): Settings {
    return { ...this.settings };
  }

  private applyScaleMode(): void {
    const frame = document.getElementById('game-frame') as HTMLIFrameElement;
    if (!frame) return;

    frame.style.objectFit = 'contain';
    switch (this.settings.scaleMode) {
      case 'fill':
        frame.style.objectFit = 'cover';
        break;
      case 'original':
        frame.style.width = '816px';
        frame.style.height = '624px';
        frame.style.maxWidth = '100%';
        frame.style.maxHeight = '100%';
        frame.style.objectFit = 'none';
        break;
      case 'fit':
      default:
        frame.style.objectFit = 'contain';
        frame.style.width = '100%';
        frame.style.height = '100%';
        break;
    }
  }

  private loadSettings(): Settings {
    try {
      const raw = localStorage.getItem('rpgmaker-settings');
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // Ignore
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('rpgmaker-settings', JSON.stringify(this.settings));
    } catch {
      // Ignore
    }
  }
}
