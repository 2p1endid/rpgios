interface SaveEntry {
  gameId: string;
  slot: number;
  timestamp: number;
  size: number;
}

export class SaveManager {
  private saves: SaveEntry[] = [];
  private readonly STORAGE_PREFIX = 'rpgsave_';
  private readonly MAX_SAVES_PER_GAME = 20;

  async save(gameId: string, slot: number, data: string): Promise<void> {
    const key = this.makeKey(gameId, slot);
    try {
      localStorage.setItem(key, data);
    } catch {
      // localStorage full, try to evict oldest saves
      await this.evictOldest(gameId);
      try {
        localStorage.setItem(key, data);
      } catch {
        throw new Error('存储空间不足，请删除部分存档');
      }
    }

    const entry: SaveEntry = {
      gameId,
      slot,
      timestamp: Date.now(),
      size: new Blob([data]).size,
    };

    this.saves = this.saves.filter(
      (s) => !(s.gameId === gameId && s.slot === slot),
    );
    this.saves.push(entry);
    this.persistIndex();
  }

  async load(gameId: string, slot: number): Promise<string | null> {
    const key = this.makeKey(gameId, slot);
    return localStorage.getItem(key);
  }

  listSaves(gameId: string): SaveEntry[] {
    return this.saves
      .filter((s) => s.gameId === gameId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async deleteSave(gameId: string, slot: number): Promise<void> {
    const key = this.makeKey(gameId, slot);
    localStorage.removeItem(key);
    this.saves = this.saves.filter(
      (s) => !(s.gameId === gameId && s.slot === slot),
    );
    this.persistIndex();
  }

  async deleteAllForGame(gameId: string): Promise<void> {
    const gameSaves = this.saves.filter((s) => s.gameId === gameId);
    for (const save of gameSaves) {
      localStorage.removeItem(this.makeKey(gameId, save.slot));
    }
    this.saves = this.saves.filter((s) => s.gameId !== gameId);
    this.persistIndex();
  }

  async exportSaves(gameId: string): Promise<string> {
    const gameSaves = this.listSaves(gameId);
    const exportData: Record<string, string> = {};
    for (const save of gameSaves) {
      const data = await this.load(gameId, save.slot);
      if (data) {
        exportData[`slot_${save.slot}`] = data;
      }
    }
    return JSON.stringify(exportData);
  }

  async importSaves(gameId: string, json: string): Promise<number> {
    const data = JSON.parse(json);
    let count = 0;
    for (const [key, value] of Object.entries(data)) {
      const slot = parseInt(key.replace('slot_', ''), 10);
      if (!isNaN(slot)) {
        await this.save(gameId, slot, value as string);
        count++;
      }
    }
    return count;
  }

  private makeKey(gameId: string, slot: number): string {
    return `${this.STORAGE_PREFIX}${gameId}_${slot}`;
  }

  private persistIndex(): void {
    try {
      localStorage.setItem('rpgsave_index', JSON.stringify(this.saves));
    } catch {
      // Ignore
    }
  }

  private async evictOldest(gameId: string): Promise<void> {
    const gameSaves = this.listSaves(gameId);
    if (gameSaves.length > 0) {
      const oldest = gameSaves[gameSaves.length - 1];
      await this.deleteSave(gameId, oldest.slot);
    }
  }
}
