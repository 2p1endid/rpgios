import { InputInjector } from './input-injector';

export type GamepadButton = 'up' | 'down' | 'left' | 'right' | 'ok' | 'escape' | 'shift';

interface KeyRepeatState {
  intervalId: number | null;
  initialDelayId: number | null;
}

const KEY_REPEAT_DELAYS: Record<string, { initial: number; repeat: number }> = {
  slow: { initial: 500, repeat: 120 },
  normal: { initial: 400, repeat: 80 },
  fast: { initial: 250, repeat: 40 },
};

export class TouchMapper {
  private activeButtons = new Set<GamepadButton>();
  private repeatStates = new Map<GamepadButton, KeyRepeatState>();
  private repeatConfig = KEY_REPEAT_DELAYS.normal;

  // Directional buttons (for repeat)
  private readonly DIR_BUTTONS: GamepadButton[] = ['up', 'down', 'left', 'right'];

  constructor(private injector: InputInjector) {}

  setRepeatSpeed(speed: 'slow' | 'normal' | 'fast'): void {
    this.repeatConfig = KEY_REPEAT_DELAYS[speed];
  }

  onButtonChange(button: GamepadButton, pressed: boolean): void {
    if (pressed) {
      this.pressButton(button);
    } else {
      this.releaseButton(button);
    }
  }

  private pressButton(button: GamepadButton): void {
    this.activeButtons.add(button);
    this.injectKey(button, 'keydown');

    // Start key repeat for directional buttons
    if (this.DIR_BUTTONS.includes(button)) {
      this.startKeyRepeat(button);
    }
  }

  private releaseButton(button: GamepadButton): void {
    this.activeButtons.delete(button);
    this.injectKey(button, 'keyup');
    this.stopKeyRepeat(button);
  }

  private startKeyRepeat(button: GamepadButton): void {
    this.stopKeyRepeat(button);

    const state: KeyRepeatState = { intervalId: null, initialDelayId: null };

    state.initialDelayId = window.setTimeout(() => {
      if (!this.activeButtons.has(button)) return;
      this.injectKey(button, 'keyup');
      this.injectKey(button, 'keydown');

      state.intervalId = window.setInterval(() => {
        if (!this.activeButtons.has(button)) {
          this.stopKeyRepeat(button);
          return;
        }
        this.injectKey(button, 'keyup');
        this.injectKey(button, 'keydown');
      }, this.repeatConfig.repeat);
    }, this.repeatConfig.initial);

    this.repeatStates.set(button, state);
  }

  private stopKeyRepeat(button: GamepadButton): void {
    const state = this.repeatStates.get(button);
    if (!state) return;

    if (state.initialDelayId !== null) {
      clearTimeout(state.initialDelayId);
    }
    if (state.intervalId !== null) {
      clearInterval(state.intervalId);
    }
    this.repeatStates.delete(button);
  }

  private injectKey(button: GamepadButton, type: 'keydown' | 'keyup'): void {
    const mapping = this.getKeyMapping(button);
    this.injector.inject(type, mapping.keyCode, mapping.key);
  }

  private getKeyMapping(button: GamepadButton): { keyCode: number; key: string } {
    const map: Record<GamepadButton, { keyCode: number; key: string }> = {
      up: { keyCode: 38, key: 'ArrowUp' },
      down: { keyCode: 40, key: 'ArrowDown' },
      left: { keyCode: 37, key: 'ArrowLeft' },
      right: { keyCode: 39, key: 'ArrowRight' },
      ok: { keyCode: 13, key: 'Enter' },
      escape: { keyCode: 27, key: 'Escape' },
      shift: { keyCode: 16, key: 'Shift' },
    };
    return map[button];
  }
}
