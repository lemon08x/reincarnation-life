import { BuildingDef, MissionDefinition } from '../core/familyModel';
import { MISSION_STABILIZE_LIFE, MISSION_INDEPENDENT_WORK, MISSION_SHOP_ORDERS } from './missionContent';

export interface FamilyContent {
  familyName: string;
  initialFunds: number;
  eraNames: string[];
  memberRoles: string[];
  memberNamePools: string[][];
  ageSpans: Array<[number, number]>;
  buildings: BuildingDef[];
  missions: MissionDefinition[];
}

export const FAMILY_CONTENT: FamilyContent = {
  familyName: '河岸沈家',
  initialFunds: 4,
  eraNames: ['河镇初年', '河镇安稳之年', '河镇立业之年'],
  memberRoles: ['当家人', '长女', '长子', '孙辈', '重孙辈'],
  memberNamePools: [
    ['沈阿福', '沈阿禾'],
    ['沈秀', '沈芷'],
    ['沈承', '沈松'],
    ['沈望', '沈溪'],
    ['沈川', '沈棠'],
  ],
  ageSpans: [[18, 40], [20, 45], [22, 48], [22, 48], [22, 48]],
  buildings: [
    {
      id: 'security:home',
      category: 'security',
      level: 1,
      name: '修好旧屋',
      cost: 3,
      benefit: '次代基本开销降低，失败后仍有继续生活的条件；不再收到相同的安居任务。',
      requirementText: '',
      order: 1,
    },
    {
      id: 'security:reserve',
      category: 'security',
      level: 2,
      name: '备下过冬储备',
      cost: 5,
      requireAccumulation: 'security:home',
      benefit: '危机事件可动用储备抵补，避免本代损失。',
      requirementText: '需要先修好旧屋。',
      order: 2,
    },
    {
      id: 'asset:basic-tools',
      category: 'asset',
      level: 1,
      name: '购置基础工具',
      cost: 4,
      benefit: '可接修理活，省下租借费；独立做工任务更快入门。',
      requirementText: '',
      order: 3,
    },
    {
      id: 'asset:workshop',
      category: 'asset',
      level: 2,
      name: '建立工作间',
      cost: 4,
      requireAccumulation: 'asset:basic-tools',
      requireEvidence: ['crafted'],
      benefit: '接受订单资格：经营任务解锁，制作成本降低。',
      requirementText: '需要先有基础工具，且家族确有做过手艺的一代。',
      order: 4,
    },
    {
      id: 'education:notes',
      category: 'education',
      level: 1,
      name: '整理家传笔记',
      cost: 3,
      requireEvidence: ['learned'],
      benefit: '学习入口：次代可免费学基础方法，更快入门。',
      requirementText: '需要家族确有学过知识的一代，不能只靠花钱买。',
      order: 5,
    },
    {
      id: 'education:teaching',
      category: 'education',
      level: 2,
      name: '编订家学',
      cost: 7,
      requireAccumulation: 'education:notes',
      benefit: '家学入门：次代学习花费降低，可按家学排工期、对照做错的工序。',
      requirementText: '需要先整理出家传笔记。',
      order: 6,
    },
    {
      id: 'reputation:delivery',
      category: 'reputation',
      level: 1,
      name: '留下可靠交付记录',
      cost: 2,
      requireEvidence: ['delivered'],
      benefit: '引荐资格：商行机会门槛降低，合作任务更稳。',
      requirementText: '需要家族确有按时交付的一代。',
      order: 7,
    },
    {
      id: 'reputation:merchant',
      category: 'reputation',
      level: 2,
      name: '与商行建立往来',
      cost: 5,
      requireAccumulation: 'reputation:delivery',
      benefit: '合作资格：商行机会工钱更厚，可把急货与常工同时排开。',
      requirementText: '需要先留下可靠的交付记录。',
      order: 8,
    },
  ],
  missions: [MISSION_STABILIZE_LIFE, MISSION_INDEPENDENT_WORK, MISSION_SHOP_ORDERS],
};

export function validateFamilyContent(content: FamilyContent): string[] {
  const errors: string[] = [];
  const buildingIds = new Set<string>();
  for (const b of content.buildings) {
    if (buildingIds.has(b.id)) errors.push(`重复建设 ${b.id}`);
    buildingIds.add(b.id);
    if (b.cost <= 0) errors.push(`${b.id} 需要正成本`);
    if (!b.name || !b.benefit) errors.push(`${b.id} 文案缺失`);
    if (b.requireAccumulation && !buildingIds.has(b.requireAccumulation) && !content.buildings.some(x => x.id === b.requireAccumulation)) {
      errors.push(`${b.id} 前置建设不存在：${b.requireAccumulation}`);
    }
  }
  if (content.eraNames.length < 3) errors.push('至少需要三个年代名称');
  if (content.memberNamePools.length < 3) errors.push('至少需要三代姓名池');
  if (content.missions.length < 1) errors.push('至少需要一个任务');
  return errors;
}