export class InputInjector {
  private targetWindow: Window | null = null;

  setTarget(gameWindow: Window): void {
    this.targetWindow = gameWindow;
  }

  inject(type: 'keydown' | 'keyup', keyCode: number, key: string): void {
    const target = this.targetWindow || window;
    const event = new KeyboardEvent(type, {
      keyCode,
      key,
      code: key,
      bubbles: true,
      cancelable: true,
    });
    target.document.dispatchEvent(event);
  }

  injectMouseEvent(
    type: 'mousedown' | 'mouseup' | 'mousemove',
    x: number,
    y: number,
  ): void {
    const target = this.targetWindow || window;
    const event = new MouseEvent(type, {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
      view: target,
    });
    target.document.dispatchEvent(event);
  }
}
