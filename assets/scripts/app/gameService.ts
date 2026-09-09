import { GAME_CONTENT } from '../content/gameContent';
import { compactOutcome } from '../content/compactCopy';
import { ABILITIES, ABILITY_NAMES, SKILL_NAMES } from '../core/growthModel';
import { assertValidGameContent } from '../core/contentValidation';
import {
  completeArchive,
  continueAfterResult,
  upgradeActiveRun,
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
    if (loaded && !parsed) throw new Error('当前存档无法完整载入，已保留原档。');
    if (parsed) {
      this.saveData = { ...parsed, currentRun: parsed.currentRun ? upgradeActiveRun(parsed.currentRun, content) : null };
      this.persist();
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

  public submitCurrentResponse(encounterId: string, choiceId: string): LifeRun {
    const run = this.getRequiredActiveRun();
    if (run.resolvedEncounterIds.includes(encounterId)) return run;
    const pending = run.pendingEncounter;
    if (!pending) {
      throw new Error('当前没有等待回应的遭遇。');
    }
    if (pending.instanceId !== encounterId) return run;
    const next = submitResponse(run, encounterId, choiceId, this.content);
    this.setCurrentRun(next);
    return next;
  }

  public chooseAndAdvance(encounterId: string, choiceId: string): LifeRun {
    const run = this.saveData.currentRun;
    if (!run) throw new Error('还没有开始这一世。');
    if (run.status !== 'active' || run.pendingEncounter?.instanceId !== encounterId || run.resolvedEncounterIds.includes(encounterId)) return run;
    const result = submitResponse(run, encounterId, choiceId, this.content);
    return this.commitInteraction(this.advanceResult(result));
  }

  public chooseRecallAndAdvance(recallId: string, stance: RecallStance): LifeRun {
    const run = this.saveData.currentRun;
    if (!run) throw new Error('还没有开始这一世。');
    if (run.status !== 'active' || run.pendingRecall?.instanceId !== recallId || run.resolvedRecallIds.includes(recallId)) return run;
    const option = run.pendingRecall.options.find(o => o.stance === stance);
    const next = submitRecall(run, recallId, stance, this.content);
    const created = next.understandings.find(u => !run.understandings.some(old => old.id === u.id));
    return this.commitInteraction({ ...next, recentFeedback: created ? { sourceId: created.id, text: `你记下了自己的方法：${option?.label ?? created.statement}。`, changes: [run.growth ? '新专长 · 下一次就能试着用上' : '理解已经记入手记'] } : run.recentFeedback });
  }

  public resumeCurrentLife(): LifeRun | null {
    const run = this.saveData.currentRun;
    if (!run) return null;
    if (run.turnState === 'showing-result') return this.commitInteraction(this.advanceResult(run));
    if (run.status === 'awaiting-archive') return this.commitInteraction(run);
    return run;
  }

  private advanceResult(run: LifeRun): LifeRun {
    const result = run.pendingResult;
    if (!result) return run;
    const fragment = run.fragments.find(f => f.id === result.fragmentId);
    const record = run.growth?.records.find(r => r.fragmentId === result.fragmentId);
    const changes = record ? [
      ...ABILITIES.filter(a => record.abilities[a]).map(a => `${ABILITY_NAMES[a]} +${record.abilities[a]}`),
      ...(record.money ? [`家底 ${record.money > 0 ? '+' : ''}${record.money}`] : []),
      ...record.learned.map(s => `学会${SKILL_NAMES[s]}`),
      ...(run.growth?.transitions.filter(t => t.fragmentId === result.fragmentId).map(t => t.identity) ?? []),
      ...(record.usedSpecialtyId ? ['用上了自己的专长'] : []),
    ] : result.changes;
    const feedback = { sourceId: result.fragmentId, text: fragment && run.growth ? compactOutcome(fragment) : result.outcome, changes };
    return { ...continueAfterResult(run, result.instanceId, this.content), recentFeedback: feedback };
  }

  private commitInteraction(run: LifeRun): LifeRun {
    const completed = run.status === 'awaiting-archive' ? completeArchive(this.saveData.profile, run) : { profile: this.saveData.profile, run };
    this.saveData = { ...this.saveData, profile: completed.profile, currentRun: completed.run };
    this.persist();
    return completed.run;
  }

  public submitCurrentRecall(recallId: string, stance: RecallStance): LifeRun {
    const run = this.getRequiredActiveRun();
    if (run.resolvedRecallIds.includes(recallId)) return run;
    const pending = run.pendingRecall;
    if (!pending) {
      throw new Error('当前没有等待回望的时刻。');
    }
    if (pending.instanceId !== recallId) return run;
    const next = submitRecall(run, recallId, stance, this.content);
    this.setCurrentRun(next);
    return next;
  }

  public continueCurrentResult(resultId: string): LifeRun {
    if (this.saveData.currentRun && this.saveData.currentRun.status !== 'active') return this.saveData.currentRun;
    const next = continueAfterResult(this.getRequiredActiveRun(), resultId, this.content);
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
