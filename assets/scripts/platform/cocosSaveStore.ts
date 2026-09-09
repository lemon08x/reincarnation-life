import { sys } from 'cc';
import { SaveStore } from '../app/gameService';
import { GameSave } from '../core/model';
import {
  CURRENT_SAVE_KEY,
  StorageAdapter,
  clearObsoleteSaveKeys,
  parseGameSave,
} from '../core/saveMigration';

class LocalStorageAdapter implements StorageAdapter {
  public getItem(key: string): string | null {
    return sys.localStorage.getItem(key);
  }

  public setItem(key: string, value: string): void {
    sys.localStorage.setItem(key, value);
  }

  public removeItem(key: string): void {
    sys.localStorage.removeItem(key);
  }
}

export class CocosSaveStore implements SaveStore {
  private readonly storage = new LocalStorageAdapter();

  public load(): GameSave | null {
    clearObsoleteSaveKeys(this.storage);
    const raw = this.storage.getItem(CURRENT_SAVE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = parseGameSave(JSON.parse(raw) as unknown);
      if (!parsed) throw new Error('存档字段不完整');
      return parsed;
    } catch {
      throw new Error('存档无法完整载入，原存档已保留。请勿清除应用数据。');
    }
  }

  public save(value: GameSave): void {
    this.storage.setItem(CURRENT_SAVE_KEY, JSON.stringify(value));
  }
}
