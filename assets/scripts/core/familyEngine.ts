import { BuildingOption, BuildingCategory, FamilyAccumulation, FamilyMilestone, FamilyState, FAMILY_MILESTONE_DESCRIPTIONS, FAMILY_SAVE_VERSION } from './familyModel';
import { FamilyContent } from '../content/familyContent';
import { nextRandom } from './random';

// 家庭引擎：建设、继承条件、跨代结算与里程碑。任务推进在 missionEngine。

export function categoryLevel(family: FamilyState, category: BuildingCategory): number {
  return family.accumulations
    .filter(a => a.category === category)
    .reduce((max, a) => Math.max(max, a.level), 0);
}

export function hasAccumulation(family: FamilyState, id: string): boolean {
  return family.accumulations.some(a => a.id === id);
}

export function accumulationByName(family: FamilyState, id: string): FamilyAccumulation | undefined {
  return family.accumulations.find(a => a.id === id);
}

export function computeMilestone(family: FamilyState): FamilyMilestone {
  if (hasAccumulation(family, 'asset:workshop') && categoryLevel(family, 'reputation') >= 1) {
    return 'enterprise';
  }
  if (categoryLevel(family, 'education') >= 1 || categoryLevel(family, 'reputation') >= 1) {
    return 'raise';
  }
  return 'stable-life';
}

// 展示用阶段：未达到任何里程碑时显示「起步：维持生活」。
export function presentStageLabel(family: FamilyState): string {
  const milestone = computeMilestone(family);
  if (milestone === 'enterprise') return '拥有可持续的家业';
  if (milestone === 'raise') return '有条件培养后辈';
  if (categoryLevel(family, 'security') >= 1) return '安稳度日';
  return '起步：维持生活';
}

export function milestoneDescription(milestone: FamilyMilestone): string {
  return FAMILY_MILESTONE_DESCRIPTIONS[milestone];
}

export function eraNameFor(content: FamilyContent, generation: number): string {
  const index = Math.max(0, Math.min(content.eraNames.length - 1, generation - 1));
  return content.eraNames[index];
}

export function memberFor(content: FamilyContent, generation: number, rngState: number): { name: string; role: string; state: number } {
  const pool = content.memberNamePools[Math.min(content.memberNamePools.length - 1, generation - 1)] ?? content.memberNamePools[0];
  const roles = content.memberRoles;
  const role = roles[Math.min(roles.length - 1, generation - 1)] ?? roles[0];
  const step = nextRandom(rngState);
  const name = pool[Math.min(pool.length - 1, Math.floor(step.value * pool.length))];
  return { name, role, state: step.state };
}

export function ageSpanFor(content: FamilyContent, generation: number): [number, number] {
  const spans = content.ageSpans;
  return spans[Math.min(spans.length - 1, generation - 1)] ?? spans[0];
}

export function createFamily(content: FamilyContent, seed: number): FamilyState {
  const step = nextRandom(seed >>> 0 || 1);
  const generation = 1;
  const era = eraNameFor(content, generation);
  return {
    version: FAMILY_SAVE_VERSION,
    id: `family-${(step.state >>> 0).toString(36)}`,
    name: content.familyName,
    era,
    eraIndex: 0,
    generationCount: 0,
    funds: content.initialFunds,
    accumulations: [],
    evidence: [],
    milestone: 'stable-life',
    history: [],
    contributions: [],
  };
}

export function eligibleBuildings(
  family: FamilyState,
  content: FamilyContent,
  intermissionBuilt: string | null,
  limit = 3,
): BuildingOption[] {
  const result: BuildingOption[] = [];
  const evaluated: Array<{ def: FamilyContent['buildings'][number]; option: BuildingOption }> = [];
  for (const def of content.buildings) {
    if (hasAccumulation(family, def.id)) continue; // 已建成
    const reasons: string[] = [];
    if (def.requireAccumulation && !hasAccumulation(family, def.requireAccumulation)) {
      reasons.push(def.requirementText || `需要先有${content.buildings.find(b => b.id === def.requireAccumulation)?.name ?? def.requireAccumulation}。`);
    }
    if (def.requireEvidence) {
      const have = def.requireEvidence.every(e => family.evidence.some(ev => ev.id === e));
      if (!have) reasons.push(def.requirementText || '需要家族确有相应经历的一代。');
    }
    evaluated.push({
      def,
      option: {
        id: def.id,
        category: def.category,
        name: def.name,
        cost: def.cost,
        benefit: def.benefit,
        available: reasons.length === 0,
        unavailableReason: reasons.length ? reasons.join('') : undefined,
        affordable: family.funds >= def.cost,
        intermissionUsed: intermissionBuilt !== null,
      },
    });
  }
  // 已可用的优先展示，其余按内容顺序露出下一项；最多展示 limit 个。
  const sorted = [...evaluated].sort((a, b) => {
    const aScore = a.option.available ? 0 : 1;
    const bScore = b.option.available ? 0 : 1;
    if (aScore !== bScore) return aScore - bScore;
    return a.def.order - b.def.order;
  });
  for (const item of sorted) {
    if (result.length >= limit) break;
    result.push(item.option);
  }
  return result;
}

export function applyBuilding(
  family: FamilyState,
  content: FamilyContent,
  buildingId: string,
  generation: number,
  runId: string,
): { family: FamilyState; contribution: FamilyState['contributions'][number] } {
  const def = content.buildings.find(b => b.id === buildingId);
  if (!def) throw new Error(`未知的建设：${buildingId}`);
  if (hasAccumulation(family, def.id)) throw new Error(`家里已经有${def.name}。`);
  if (family.funds < def.cost) throw new Error(`家庭资金不足，需要 ${def.cost} 两。`);
  if (def.requireAccumulation && !hasAccumulation(family, def.requireAccumulation)) throw new Error(def.requirementText || '前置建设未完成。');
  if (def.requireEvidence) {
    const missing = def.requireEvidence.filter(e => !family.evidence.some(ev => ev.id === e));
    if (missing.length) throw new Error(def.requirementText || '缺少相应的家族经历。');
  }
  const source = { generation, text: `第${generationName(generation)}代：${def.name}` };
  const accumulation: FamilyAccumulation = {
    id: def.id,
    category: def.category,
    level: def.level,
    name: def.name,
    benefit: def.benefit,
    source,
  };
  const contribution = {
    id: `contrib-${runId}-${def.id}`,
    generation,
    text: source.text,
    kind: def.category,
    runId,
  };
  return {
    family: {
      ...family,
      funds: family.funds - def.cost,
      accumulations: [...family.accumulations, accumulation],
      contributions: [...family.contributions, contribution],
      milestone: computeMilestone({ ...family, accumulations: [...family.accumulations, accumulation] }),
    },
    contribution,
  };
}

export function generationName(generation: number): string {
  const names = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (generation <= 10) return names[generation - 1];
  return String(generation);
}

export interface ChapterSummary {
  title: string;
  stage: string;
  lines: string[];
  nextStep: string;
}

export function buildChapterSummary(family: FamilyState, content: FamilyContent): ChapterSummary | null {
  if (family.generationCount < 3) return null;
  const contributions = family.contributions.map(c => c.text);
  const changes = family.accumulations.map(a => `家里留下了${a.name}：${a.benefit}`);
  const stage = presentStageLabel(family);
  const milestone = computeMilestone(family);
  const nextStep = milestone === 'enterprise'
    ? '家业已成，可以继续经营、扩大商行往来，也可以把家学传得更远。'
    : milestone === 'raise'
      ? '下一段是积累生产资产与商行往来，走向可持续的家业。'
      : categoryLevel(family, 'security') >= 1
        ? '下一段是培养后辈的学习条件，积累可信的名声。'
        : '先把生活安稳下来：修屋、储备，再考虑工具与学习。';
  return {
    title: `${content.familyName}的第三代之后`,
    stage,
    lines: [
      ...(contributions.length ? [`三代留下的贡献：${contributions.join('；')}`] : ['三代留下的贡献还不多，家里的日子仍在打底。']),
      ...(changes.length ? changes : ['家园还没有明显的改变。']),
      `家族阶段：${stage}。`,
    ],
    nextStep,
  };
}