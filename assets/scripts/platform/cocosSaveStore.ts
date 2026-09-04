import { sys } from 'cc';
import { SaveStore } from '../app/gameService';
import { GAME_CONTENT } from '../content/gameContent';
import { GameSave } from '../core/model';
import { migrateGameSave } from '../core/saveMigration';

const STORAGE_KEY = 'reincarnation-life.save.v2';
const LEGACY_STORAGE_KEY = 'reincarnation-life.save.v1';
const BACKUP_STORAGE_KEY = 'reincarnation-life.save.backup';

export class CocosSaveStore implements SaveStore {
  public load(): GameSave | null {
    const currentRaw = sys.localStorage.getItem(STORAGE_KEY);
    const legacyRaw = currentRaw ? null : sys.localStorage.getItem(LEGACY_STORAGE_KEY);
    const raw = currentRaw ?? legacyRaw;
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const migrated = migrateGameSave(parsed, GAME_CONTENT);
      if (!migrated) {
        sys.localStorage.setItem(BACKUP_STORAGE_KEY, raw);
        console.warn('存档结构无法识别，原始内容已备份。');
        return null;
      }
      if (legacyRaw) {
        sys.localStorage.setItem(BACKUP_STORAGE_KEY, legacyRaw);
        sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        sys.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      return migrated;
    } catch (error) {
      sys.localStorage.setItem(BACKUP_STORAGE_KEY, raw);
      console.warn('存档解析失败，原始内容已备份。', error);
      return null;
    }
  }

  public save(value: GameSave): void {
    sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }
}
