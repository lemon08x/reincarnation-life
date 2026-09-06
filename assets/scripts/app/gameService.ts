import { GAME_CONTENT } from '../content/gameContent';
import { assertValidGameContent } from '../core/contentValidation';
import {
  completeArchive,
  getCausality,
  listCarryCandidates,
  startLife,
  submitRecall,
  submitResponse,
} from '../core/lifeEngine';
import {
  CausalityRecord,
  GameContent,
  GameSave,
  LifeRun,
  RecallStance,
  ReincarnatorProfile,
  SAVE_VERSION,
  Understanding,
  createInitialProfile,
} from '../core/model';
import { parseGameSave } from '../core/saveMigration';

export interface SaveStore {
  load(): GameSave | null;
  save(value: GameSave): void;
}

export type SeedFactory = () => number;

export class GameService {
  private saveData: GameSave;

  public constructor(
    private readonly store: SaveStore,
    private readonly seedFactory: SeedFactory,
    private readonly content: GameContent = GAME_CONTENT,
  ) {
    assertValidGameContent(content);
    const loaded = store.load();
    const parsed = loaded ? parseGameSave(loaded) : null;
    if (parsed) {
      this.saveData = parsed;
    } else {
      this.saveData = {
        version: SAVE_VERSION,
        profile: createInitialProfile(),
        currentRun: null,
      };
      this.persist();
    }
  }

  public getProfile(): ReincarnatorProfile {
    return this.saveData.profile;
  }

  public getCurrentRun(): LifeRun | null {
    return this.saveData.currentRun;
  }

  public getContent(): GameContent {
    return this.content;
  }

  public listCarryCandidates(): Understanding[] {
    return listCarryCandidates(this.saveData.profile);
  }

  public startNewLife(carriedUnderstandingIds: string[] = []): LifeRun {
    this.assertCanStartLife();
    const identitySeed = this.seedFactory();
    const runId = [
      'life',
      identitySeed.toString(36),
      this.saveData.profile.archivedRunIds.length.toString(36),
    ].join('-');
    const run = startLife(
      this.saveData.profile,
      identitySeed,
      runId,
      carriedUnderstandingIds,
      this.content,
    );
    this.saveData = {
      version: SAVE_VERSION,
      profile: this.saveData.profile,
      currentRun: run,
    };
    this.persist();
    return run;
  }

  public submitCurrentResponse(choiceId: string): LifeRun {
    const run = this.getRequiredActiveRun();
    const pending = run.pendingEncounter;
    if (!pending) {
      throw new Error('当前没有等待回应的遭遇。');
    }
    const next = submitResponse(run, pending.instanceId, choiceId, this.content);
    this.setCurrentRun(next);
    return next;
  }

  public submitCurrentRecall(stance: RecallStance): LifeRun {
    const run = this.getRequiredActiveRun();
    const pending = run.pendingRecall;
    if (!pending) {
      throw new Error('当前没有等待回望的时刻。');
    }
    const next = submitRecall(run, pending.instanceId, stance, this.content);
    this.setCurrentRun(next);
    return next;
  }

  public archiveCurrentLife(): LifeRun {
    const run = this.saveData.currentRun;
    if (!run) {
      throw new Error('没有可以收入档案的人生。');
    }
    const result = completeArchive(this.saveData.profile, run);
    this.saveData = {
      version: SAVE_VERSION,
      profile: result.profile,
      currentRun: result.run,
    };
    this.persist();
    return result.run;
  }

  public inspectCausality(id: string): CausalityRecord | null {
    return getCausality(this.saveData.currentRun, this.saveData.profile, id);
  }

  private getRequiredActiveRun(): LifeRun {
    const currentRun = this.saveData.currentRun;
    if (!currentRun || currentRun.status !== 'active') {
      throw new Error('There is no active life.');
    }
    return currentRun;
  }

  private setCurrentRun(run: LifeRun): void {
    this.saveData = {
      ...this.saveData,
      currentRun: run,
    };
    this.persist();
  }

  private assertCanStartLife(): void {
    const currentRun = this.saveData.currentRun;
    if (currentRun?.status === 'active') {
      throw new Error('Finish the active life before starting a new one.');
    }
    if (currentRun?.status === 'awaiting-archive') {
      throw new Error('把这一世收入档案后，才能开启下一世。');
    }
  }

  private persist(): void {
    this.store.save(this.saveData);
  }
}
