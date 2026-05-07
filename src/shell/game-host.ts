export class GameHost {
  private frame: HTMLIFrameElement | null = null;
  private readyCallbacks: Array<() => void> = [];
  private loaded = false;

  constructor() {
    this.frame = document.getElementById('game-frame') as HTMLIFrameElement;
  }

  async loadGame(serverUrl: string): Promise<void> {
    if (!this.frame) return;

    this.loaded = false;

    return new Promise((resolve, reject) => {
      const iframe = this.frame!;

      const onLoad = (): void => {
        iframe.removeEventListener('load', onLoad);
        this.loaded = true;
        // Inject patches after game scripts load
        this.injectPatches();
        // Notify readiness after a short delay to let game init
        setTimeout(() => {
          this.readyCallbacks.forEach((cb) => cb());
          resolve();
        }, 500);
      };

      const onError = (): void => {
        iframe.removeEventListener('error', onError);
        reject(new Error('Game iframe failed to load'));
      };

      iframe.addEventListener('load', onLoad);
      iframe.addEventListener('error', onError);
      iframe.src = serverUrl;
    });
  }

  unload(): void {
    if (this.frame) {
      this.frame.src = 'about:blank';
    }
    this.loaded = false;
    this.readyCallbacks = [];
  }

  onReady(callback: () => void): void {
    if (this.loaded) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  getGameWindow(): Window | null {
    return this.frame?.contentWindow ?? null;
  }

  getGameDocument(): Document | null {
    return this.frame?.contentDocument ?? null;
  }

  private injectPatches(): void {
    const gameWindow = this.getGameWindow();
    if (!gameWindow) return;

    // Inject StorageManager patch
    const storagePatch = this.createStoragePatch();
    this.injectScript(gameWindow, storagePatch);

    // Inject audio patch
    const audioPatch = this.createAudioPatch();
    this.injectScript(gameWindow, audioPatch);
  }

  private injectScript(targetWindow: Window, code: string): void {
    const doc = targetWindow.document;
    const script = doc.createElement('script');
    script.textContent = code;
    doc.head.appendChild(script);
  }

  private createStoragePatch(): string {
    return `
(function() {
  if (typeof StorageManager === 'undefined') return;
  var _saveToWeb = StorageManager.saveToWebStorage;
  var _loadFromWeb = StorageManager.loadFromWebStorage;

  StorageManager.saveToWebStorage = function(savefileId, json) {
    _saveToWeb.call(this, savefileId, json);
    try {
      window.parent.postMessage({
        type: 'rpgmaker-save',
        action: 'save',
        savefileId: savefileId,
        data: json
      }, '*');
    } catch(e) {}
  };

  StorageManager.loadFromWebStorage = function(savefileId) {
    var data = _loadFromWeb.call(this, savefileId);
    if (data) return data;
    try {
      window.parent.postMessage({
        type: 'rpgmaker-load',
        action: 'load',
        savefileId: savefileId
      }, '*');
    } catch(e) {}
    return null;
  };
})();
`;
  }

  private createAudioPatch(): string {
    return `
(function() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  var AudioContextClass = window.AudioContext || window.webkitAudioContext;

  // Handle background/foreground transitions
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      // Resume any suspended audio contexts
      if (typeof Howler !== 'undefined' && Howler.ctx) {
        if (Howler.ctx.state === 'suspended' || Howler.ctx.state === 'interrupted') {
          Howler.ctx.resume().catch(function(){});
        }
      }
    }
  });
})();
`;
  }
}
