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
      return parseGameSave(JSON.parse(raw) as unknown);
    } catch {
      console.warn('存档无法解析，已保留原文件，未覆盖。');
      return null;
    }
  }

  public save(value: GameSave): void {
    this.storage.setItem(CURRENT_SAVE_KEY, JSON.stringify(value));
  }
}
