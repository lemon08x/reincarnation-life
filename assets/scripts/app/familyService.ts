import { FAMILY_CONTENT, FamilyContent } from '../content/familyContent';
import { assertFamilyContent, chooseAndAdvance, startGeneration, progressView } from '../core/missionEngine';
import { applyBuilding, buildChapterSummary, categoryLevel, createFamily, eligibleBuildings, presentStageLabel } from '../core/familyEngine';
import {
  BuildingOption,
  FamilySave,
  FamilySettlement,
  FamilyState,
  GenerationRun,
  createEmptyFamilySave,
} from '../core/familyModel';
import { parseFamilySave } from '../core/familySave';

export interface FamilySaveStore {
  load(): FamilySave | null;
  save(value: FamilySave): void;
}

export type SeedFactory = () => number;

export class FamilyService {
  private saveData: FamilySave;

  public constructor(
    private readonly store: FamilySaveStore,
    private readonly seedFactory: SeedFactory,
    private readonly content: FamilyContent = FAMILY_CONTENT,
  ) {
    assertFamilyContent(content);
    const loaded = store.load();
    const parsed = loaded ? parseFamilySave(loaded) : null;
    if (loaded && !parsed) throw new Error('当前家庭存档无法完整载入，已保留原档。');
    if (parsed) {
      this.saveData = parsed;
    } else {
      this.saveData = createEmptyFamilySave();
      this.persist();
    }
  }

  public hasFamily(): boolean {
    return this.saveData.family !== null;
  }

  // 供 presenter 读取的只读快照（避免 UI 直接改存档）。
  public saveSnapshot(): FamilySave {
    return this.saveData;
  }

  public getFamily(): FamilyState | null {
    return this.saveData.family;
  }

  public getCurrentRun(): GenerationRun | null {
    return this.saveData.currentRun;
  }

  public getLastSettlement(): FamilySettlement | null {
    return this.saveData.lastSettlement;
  }

  public getContent(): FamilyContent {
    return this.content;
  }

  public startFamily(): FamilyState {
    if (this.saveData.family) throw new Error('家里已经有经营的记录了。');
    const family = createFamily(this.content, this.seedFactory());
    this.saveData = { ...this.saveData, family };
    this.persist();
    return family;
  }

  public stageLabel(): string {
    const family = this.saveData.family;
    return family ? presentStageLabel(family) : '起步：维持生活';
  }

  public securityLevel(): number {
    return this.saveData.family ? categoryLevel(this.saveData.family, 'security') : 0;
  }

  public getEligibleBuildings(): BuildingOption[] {
    const family = this.saveData.family;
    if (!family) return [];
    return eligibleBuildings(family, this.content, this.saveData.intermissionBuilt);
  }

  public build(buildingId: string): FamilyState {
    const family = this.saveData.family;
    if (!family) throw new Error('还没有家庭。');
    if (this.saveData.currentRun?.status === 'active') throw new Error('任务进行中，家园暂不建设。');
    if (this.saveData.intermissionBuilt && this.saveData.intermissionBuilt !== buildingId) {
      throw new Error('这一代之间只能完成一项建设。');
    }
    const { family: updated, contribution } = applyBuilding(family, this.content, buildingId, Math.max(1, family.generationCount + 1), this.runIdForContribution());
    void contribution;
    this.saveData = {
      ...this.saveData,
      family: updated,
      intermissionBuilt: buildingId,
    };
    this.persist();
    return updated;
  }

  public startNextGeneration(): GenerationRun {
    const family = this.saveData.family;
    if (!family) throw new Error('还没有家庭。');
    if (this.saveData.currentRun?.status === 'active') throw new Error('这一代还在进行中。');
    const seed = this.seedFactory();
    const generation = family.generationCount + 1;
    const runId = ['family', seed.toString(36), generation.toString(36)].join('-');
    const { family: updated, run } = startGeneration(family, this.content, seed, runId);
    this.saveData = {
      ...this.saveData,
      family: updated,
      currentRun: run,
      lastSettlement: null,
      intermissionBuilt: null,
    };
    this.persist();
    return run;
  }

  public chooseAndAdvance(instanceId: string, optionId: string): GenerationRun {
    const run = this.saveData.currentRun;
    const family = this.saveData.family;
    if (!run || !family) throw new Error('还没有开始这一代。');
    if (run.status === 'settled') return run;
    if (!run.pendingEvent || run.pendingEvent.instanceId !== instanceId) return run;
    if (run.resolvedEventIds.includes(instanceId)) return run;
    const result = chooseAndAdvance(run, family, this.content, instanceId, optionId);
    this.saveData = {
      ...this.saveData,
      family: result.family,
      currentRun: result.run,
      lastSettlement: result.settlement ?? this.saveData.lastSettlement,
      settledRunIds: result.settlement && !this.saveData.settledRunIds.includes(run.id)
        ? [...this.saveData.settledRunIds, run.id]
        : this.saveData.settledRunIds,
    };
    this.persist();
    return result.run;
  }

  public resumeCurrentRun(): GenerationRun | null {
    return this.saveData.currentRun;
  }

  public returnToHome(): void {
    // 结算后保留 currentRun（settled）与 lastSettlement 供展示；不重复结算。
  }

  public progressLine(): string {
    const run = this.saveData.currentRun;
    if (!run) return '';
    return progressView(run);
  }

  public chapterSummary(): ReturnType<typeof buildChapterSummary> {
    const family = this.saveData.family;
    return family ? buildChapterSummary(family, this.content) : null;
  }

  private runIdForContribution(): string {
    return this.saveData.currentRun?.id ?? `home-${this.saveData.family?.generationCount ?? 0}`;
  }

  private persist(): void {
    this.store.save(this.saveData);
  }
}