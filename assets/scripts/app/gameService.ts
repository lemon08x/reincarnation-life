import { GAME_CONTENT } from '../content/gameContent';
import { assertValidGameContent } from '../core/contentValidation';
import {
  advanceToNextMoment,
  chooseLifePath,
  chooseStageFocus,
  continueScenario,
  drawTalentDraft,
  rerollPendingDecision,
  resolveEventChoice,
  resolveScenarioAction,
  startHistoryLife,
  startLife,
} from '../core/lifeEngine';
import {
  GameContent,
  GameSave,
  LegacyConfig,
  LifeRun,
  ReincarnatorProfile,
  SAVE_VERSION,
  TalentDraft,
} from '../core/model';
import { createInitialProfile, getLegacySlotCount } from '../core/progression';
import { claimLegacyReward, prepareSettlement } from '../core/rewardEngine';
import { migrateGameSave } from '../core/saveMigration';

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
    const migrated = loaded ? migrateGameSave(loaded, content) : null;
    this.saveData = migrated ?? {
      version: SAVE_VERSION,
      profile: createInitialProfile(content),
      currentRun: null,
    };

    if (this.saveData.currentRun?.status === 'ended') {
      this.prepareCurrentSettlement(this.saveData.currentRun);
    } else {
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

  public getLegacySlotCount(): number {
    return getLegacySlotCount(this.saveData.profile, this.content);
  }

  public getOwnedLegacies(): LegacyConfig[] {
    return this.content.legacies.filter((legacy) => (
      legacy.persistence === 'permanent'
      && (this.saveData.profile.legacyRanks[legacy.id] ?? 0) > 0
    ));
  }

  public createTalentDraft(): TalentDraft {
    this.assertCanConfigureNextLife();
    return drawTalentDraft(this.saveData.profile, this.seedFactory(), this.content);
  }

  public toggleEquippedLegacy(legacyId: string): ReincarnatorProfile {
    this.assertCanConfigureNextLife();
    const legacy = this.content.legacies.find((item) => item.id === legacyId);
    if (!legacy || legacy.persistence !== 'permanent') {
      throw new Error('Only a permanent legacy can be equipped.');
    }
    if ((this.saveData.profile.legacyRanks[legacyId] ?? 0) <= 0) {
      throw new Error('This legacy has not been collected.');
    }

    const equipped = this.saveData.profile.equippedLegacyIds;
    const nextEquipped = equipped.includes(legacyId)
      ? equipped.filter((item) => item !== legacyId)
      : (() => {
          if (equipped.length >= this.getLegacySlotCount()) {
            throw new Error('No empty legacy slot is available.');
          }
          return [...equipped, legacyId];
        })();
    this.saveData = {
      ...this.saveData,
      profile: {
        ...this.saveData.profile,
        equippedLegacyIds: nextEquipped,
      },
    };
    this.persist();
    return this.saveData.profile;
  }

  public startNewLife(
    draft: TalentDraft,
    selectedTalentIds: string[],
  ): LifeRun {
    this.assertCanConfigureNextLife();

    const identitySeed = this.seedFactory();
    const runId = [
      'life',
      identitySeed.toString(36),
      this.saveData.profile.totalExp.toString(36),
      this.saveData.profile.settledRunIds.length.toString(36),
    ].join('-');
    const run = startLife(
      this.saveData.profile,
      draft,
      selectedTalentIds,
      runId,
      this.content,
    );
    this.saveData = {
      version: SAVE_VERSION,
      profile: {
        ...this.saveData.profile,
        pendingBoonIds: [],
      },
      currentRun: run,
    };
    this.persist();
    return run;
  }

  public startHistoryRun(figureId: string): LifeRun {
    this.assertCanConfigureNextLife();
    const identitySeed = this.seedFactory();
    const runId = [
      'history',
      identitySeed.toString(36),
      figureId,
      this.saveData.profile.settledRunIds.length.toString(36),
    ].join('-');
    const run = startHistoryLife(this.saveData.profile, figureId, runId, this.content);
    this.saveData = {
      version: SAVE_VERSION,
      profile: {
        ...this.saveData.profile,
        pendingBoonIds: [],
      },
      currentRun: run,
    };
    this.persist();
    return run;
  }

  public chooseCurrentPath(scenarioId: string): LifeRun {
    return this.updateActiveRun((run) => chooseLifePath(run, scenarioId, this.content));
  }

  public resolveCurrentScenarioAction(actionId: string): LifeRun {
    const currentRun = this.getRequiredActiveRun();
    const resolved = resolveScenarioAction(currentRun, actionId, this.content);
    if (resolved.status === 'ended') {
      this.prepareCurrentSettlement(resolved);
    } else {
      this.setCurrentRun(resolved);
    }
    return this.saveData.currentRun as LifeRun;
  }

  public continueCurrentScenario(): LifeRun {
    const currentRun = this.getRequiredActiveRun();
    const next = continueScenario(currentRun, this.content);
    if (next.status === 'ended') {
      this.prepareCurrentSettlement(next);
    } else {
      this.setCurrentRun(next);
    }
    return this.saveData.currentRun as LifeRun;
  }

  public chooseCurrentStageFocus(focusId: string): LifeRun {
    return this.updateActiveRun((run) => chooseStageFocus(run, focusId, this.content));
  }

  public advanceCurrentLife(maxPassiveYears?: number): LifeRun {
    const currentRun = this.getRequiredActiveRun();
    const advanced = advanceToNextMoment(currentRun, this.content, maxPassiveYears);
    if (advanced.status === 'ended') {
      this.prepareCurrentSettlement(advanced);
    } else {
      this.setCurrentRun(advanced);
    }
    return this.saveData.currentRun as LifeRun;
  }

  public resolveCurrentChoice(choiceId: string): LifeRun {
    const currentRun = this.getRequiredActiveRun();
    const resolved = resolveEventChoice(currentRun, choiceId, this.content);
    if (resolved.status === 'ended') {
      this.prepareCurrentSettlement(resolved);
    } else {
      this.setCurrentRun(resolved);
    }
    return this.saveData.currentRun as LifeRun;
  }

  public rerollCurrentDecision(): LifeRun {
    return this.updateActiveRun((run) => rerollPendingDecision(run, this.content));
  }

  public claimCurrentReward(rewardId: string): LifeRun {
    const currentRun = this.saveData.currentRun;
    if (!currentRun) {
      throw new Error('There is no completed life to reward.');
    }
    const result = claimLegacyReward(
      this.saveData.profile,
      currentRun,
      rewardId,
      this.content,
    );
    this.saveData = {
      version: SAVE_VERSION,
      profile: result.profile,
      currentRun: result.run,
    };
    this.persist();
    return result.run;
  }

  private updateActiveRun(update: (run: LifeRun) => LifeRun): LifeRun {
    const updated = update(this.getRequiredActiveRun());
    this.setCurrentRun(updated);
    return updated;
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

  private prepareCurrentSettlement(endedRun: LifeRun): void {
    const result = prepareSettlement(this.saveData.profile, endedRun, this.content);
    this.saveData = {
      version: SAVE_VERSION,
      profile: result.profile,
      currentRun: result.run,
    };
    this.persist();
  }

  private assertCanConfigureNextLife(): void {
    const currentRun = this.saveData.currentRun;
    if (currentRun?.status === 'active') {
      throw new Error('Finish the active life before configuring a new one.');
    }
    if (currentRun?.status === 'reward-pending') {
      throw new Error('Choose this life\'s reincarnation reward first.');
    }
  }

  private persist(): void {
    this.store.save(this.saveData);
  }
}
