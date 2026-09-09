import { sys } from 'cc';
import { FamilySaveStore } from '../app/familyService';
import { FamilySave } from '../core/familyModel';
import { FAMILY_CURRENT_SAVE_KEY, parseFamilySave } from '../core/familySave';
import { clearObsoleteSaveKeys, StorageAdapter } from '../core/saveMigration';

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

export class CocosFamilySaveStore implements FamilySaveStore {
  private readonly storage = new LocalStorageAdapter();

  public load(): FamilySave | null {
    // 清理旧轮回键时不影响家庭存档键（不在 OBSOLETE_SAVE_KEYS 内）。
    clearObsoleteSaveKeys(this.storage);
    const raw = this.storage.getItem(FAMILY_CURRENT_SAVE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = parseFamilySave(JSON.parse(raw) as unknown);
      if (!parsed) throw new Error('家庭存档字段不完整');
      return parsed;
    } catch {
      throw new Error('家庭存档无法完整载入，原存档已保留。请勿清除应用数据。');
    }
  }

  public save(value: FamilySave): void {
    this.storage.setItem(FAMILY_CURRENT_SAVE_KEY, JSON.stringify(value));
  }
}