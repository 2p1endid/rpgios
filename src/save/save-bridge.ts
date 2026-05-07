/**
 * SaveBridge communicates save data between the game iframe and native plugin.
 * In browser dev mode, it uses localStorage. In Capacitor/iOS, it uses native plugin.
 */
export class SaveBridge {
  private isNative = false;

  constructor() {
    this.isNative = typeof (window as any).Capacitor !== 'undefined';
  }

  async save(gameId: string, slot: number, json: string): Promise<void> {
    if (this.isNative) {
      await this.nativeSave(gameId, slot, json);
    } else {
      this.webFallbackSave(gameId, slot, json);
    }
  }

  async load(gameId: string, slot: number): Promise<string | null> {
    if (this.isNative) {
      return this.nativeLoad(gameId, slot);
    }
    return this.webFallbackLoad(gameId, slot);
  }

  async listSaves(gameId: string): Promise<number[]> {
    if (this.isNative) {
      return this.nativeListSaves(gameId);
    }
    return this.webFallbackListSaves(gameId);
  }

  private async nativeSave(gameId: string, slot: number, json: string): Promise<void> {
    const { SaveDataPlugin } = (window as any).Capacitor.Plugins;
    if (SaveDataPlugin) {
      await SaveDataPlugin.save({ gameId, slot, data: json });
    }
  }

  private async nativeLoad(gameId: string, slot: number): Promise<string | null> {
    const { SaveDataPlugin } = (window as any).Capacitor.Plugins;
    if (SaveDataPlugin) {
      const result = await SaveDataPlugin.load({ gameId, slot });
      return result.data ?? null;
    }
    return null;
  }

  private async nativeListSaves(gameId: string): Promise<number[]> {
    const { SaveDataPlugin } = (window as any).Capacitor.Plugins;
    if (SaveDataPlugin) {
      const result = await SaveDataPlugin.listSlots({ gameId });
      return result.slots ?? [];
    }
    return [];
  }

  private webFallbackSave(gameId: string, slot: number, json: string): void {
    localStorage.setItem(`rpgsave_${gameId}_${slot}`, json);
  }

  private webFallbackLoad(gameId: string, slot: number): string | null {
    return localStorage.getItem(`rpgsave_${gameId}_${slot}`);
  }

  private webFallbackListSaves(gameId: string): number[] {
    const slots: number[] = [];
    const prefix = `rpgsave_${gameId}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const slot = parseInt(key.replace(prefix, ''), 10);
        if (!isNaN(slot)) slots.push(slot);
      }
    }
    return slots.sort((a, b) => a - b);
  }
}
