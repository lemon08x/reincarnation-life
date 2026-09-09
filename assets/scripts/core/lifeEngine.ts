// Stable application API: old lives finish under their original rules; new lives use growth rules.
import * as legacy from './legacyLifeEngine';
import { startGrowthLife, submitGrowthResponse, continueGrowthResult, submitGrowthRecall } from './growthEngine';
import { GROWTH_RULES_VERSION } from './growthModel';
import { GameContent, LifeRun, RecallStance, ReincarnatorProfile } from './model';

export { completeArchive, getCausality, listCarryCandidates, causalityHasCycle, formatWorldSummary, formatMarkList, createInitialProfile, findChoice } from './legacyLifeEngine';

export function startLife(profile: ReincarnatorProfile, seed: number, runId: string, carried: string[], content: GameContent): LifeRun {
  return startGrowthLife(profile, seed, runId, carried, content);
}
export function submitResponse(run: LifeRun, id: string, choice: string, content: GameContent): LifeRun {
  return run.growth ? submitGrowthResponse(run, id, choice) : legacy.submitResponse(run, id, choice, content);
}
export function continueAfterResult(run: LifeRun, id: string, content: GameContent): LifeRun {
  return run.growth ? continueGrowthResult(run, id) : legacy.continueAfterResult(run, id, content);
}
export function submitRecall(run: LifeRun, id: string, stance: RecallStance, content: GameContent): LifeRun {
  return run.growth ? submitGrowthRecall(run, id, stance) : legacy.submitRecall(run, id, stance, content);
}
export function upgradeActiveRun(run: LifeRun, content: GameContent): LifeRun {
  if (run.rulesVersion >= GROWTH_RULES_VERSION) {
    if (!run.growth) throw new Error('成长存档缺少角色数据，已停止载入以保留原档。');
    return run;
  }
  return legacy.upgradeActiveRun(run, content);
}
