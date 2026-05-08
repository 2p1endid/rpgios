import { GameLoader } from './shell/game-loader';
import { GameHost } from './shell/game-host';
import { GameManifest } from './shell/game-manifest';
import { VirtualGamepad } from './input/virtual-gamepad';
import { TouchMapper } from './input/touch-mapper';
import { InputInjector } from './input/input-injector';
import { SaveManager } from './save/save-manager';
import { AudioUnlock } from './audio/audio-unlock';
import { Launcher } from './ui/launcher';
import { GameOverlay } from './ui/game-overlay';
import { SettingsPanel } from './ui/settings-panel';

export class App {
  gameLoader!: GameLoader;
  gameHost!: GameHost;
  gameManifest!: GameManifest;
  virtualGamepad!: VirtualGamepad;
  touchMapper!: TouchMapper;
  inputInjector!: InputInjector;
  saveManager!: SaveManager;
  audioUnlock!: AudioUnlock;
  launcher!: Launcher;
  gameOverlay!: GameOverlay;
  settingsPanel!: SettingsPanel;

  currentGameId: string | null = null;
  gamepadVisible = true;

  init(): void {
    this.gameManifest = new GameManifest();
    this.gameHost = new GameHost();
    this.inputInjector = new InputInjector();
    this.touchMapper = new TouchMapper(this.inputInjector);
    this.virtualGamepad = new VirtualGamepad(this.touchMapper);
    this.saveManager = new SaveManager();
    this.audioUnlock = new AudioUnlock();
    this.gameOverlay = new GameOverlay(this);
    this.settingsPanel = new SettingsPanel(this);
    this.gameLoader = new GameLoader(this.gameManifest, this.gameHost, this);
    this.launcher = new Launcher(this.gameLoader, this);

    this.launcher.render();
    this.virtualGamepad.init();
    this.gameOverlay.init();
    this.settingsPanel.init();
  }

  async launchGame(gameId: string, gamePath: string): Promise<void> {
    this.currentGameId = gameId;
    this.gameOverlay.setTitle(gameId);

    await this.audioUnlock.unlock();

    document.getElementById('launcher')!.classList.add('hidden');
    document.getElementById('game-view')!.classList.add('active');

    // Resolve URL: on iOS use GameServer, on web use path directly
    let serverUrl = gamePath;
    const Capacitor = (window as any).Capacitor;
    if (Capacitor) {
      const { GameServer, Filesystem } = Capacitor.Plugins;
      if (GameServer && Filesystem) {
        const uriResult = await Filesystem.getUri({
          path: gamePath,
          directory: 'DOCUMENTS',
        });
        const fullPath = uriResult.uri.replace('file://', '');
        const result = await GameServer.startServer({ gamePath: fullPath });
        serverUrl = result.url;
      }
    }

    await this.gameHost.loadGame(serverUrl);

    this.virtualGamepad.show();
    this.gameOverlay.show();

    this.gameHost.onReady(() => {
      this.setupGameBridge();
    });
  }

  returnToLauncher(): void {
    this.gameHost.unload();
    this.virtualGamepad.hide();
    this.gameOverlay.hide();
    document.getElementById('game-view')!.classList.remove('active');
    document.getElementById('launcher')!.classList.remove('hidden');

    // Stop GameServer on iOS
    const Capacitor = (window as any).Capacitor;
    if (Capacitor) {
      const { GameServer } = Capacitor.Plugins;
      GameServer?.stopServer?.();
    }

    this.currentGameId = null;
  }

  toggleGamepad(): void {
    this.gamepadVisible = !this.gamepadVisible;
    if (this.gamepadVisible) {
      this.virtualGamepad.show();
    } else {
      this.virtualGamepad.hide();
    }
  }

  private setupGameBridge(): void {
    const gameWindow = this.gameHost.getGameWindow();
    if (!gameWindow) return;

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'rpgmaker-save') {
        const { action, savefileId, data } = event.data;
        if (action === 'save' && this.currentGameId) {
          this.saveManager.save(this.currentGameId, savefileId, data).catch(console.error);
        }
      } else if (event.data?.type === 'rpgmaker-load') {
        const { action, savefileId } = event.data;
        if (action === 'load' && this.currentGameId) {
          this.saveManager.load(this.currentGameId, savefileId).then((data) => {
            gameWindow.postMessage({
              type: 'rpgmaker-load-result',
              savefileId,
              data,
            }, '*');
          }).catch(console.error);
        }
      }
    });
  }

  getGameId(): string | null {
    return this.currentGameId;
  }
}
