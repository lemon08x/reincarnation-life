import { GameContent } from '../core/model';
import { ENCOUNTERS, TEMPERAMENTS, UNDERSTANDING_SEEDS } from './storyContent';
import { HISTORY_FIGURES, HISTORY_REGIONS } from './historyContent';
import { MARKS } from './markContent';

export const GAME_CONTENT: GameContent = {
  families: [
    {
      id: 'working_home',
      name: '安稳的工薪家庭',
      description: '日子不宽裕，但每个月都有确定的盼头。',
      weight: 4,
      tags: ['stable_home'],
      grantMarks: [{ id: 'means', intensity: 1 }, { id: 'vitality', intensity: 1 }],
      world: {
        setFacts: { household: 'stable' },
        relations: [{ id: 'parents', kind: 'family', label: '家人', closeness: 6 }],
        threads: [{ id: 'family_origin', domain: 'family', label: '原生家庭', intensity: 2 }],
      },
    },
    {
      id: 'bookish_home',
      name: '堆满旧书的家庭',
      description: '家具并不新，书架却总有下一层。',
      weight: 3,
      tags: ['bookish_home'],
      grantMarks: [{ id: 'clarity', intensity: 2 }, { id: 'want', intensity: 1 }],
      world: {
        setFacts: { household: 'books' },
        threads: [
          { id: 'family_origin', domain: 'family', label: '原生家庭', intensity: 1 },
          { id: 'learning_mind', domain: 'learning', label: '家里的书', intensity: 2 },
        ],
      },
    },
    {
      id: 'market_home',
      name: '街角小店之家',
      description: '你从找零和招呼客人中认识了世界。',
      weight: 3,
      tags: ['market_home'],
      grantMarks: [{ id: 'means', intensity: 2 }, { id: 'presence', intensity: 1 }],
      world: {
        setFacts: { household: 'shop' },
        threads: [
          { id: 'family_origin', domain: 'family', label: '原生家庭', intensity: 1 },
          { id: 'career_life', domain: 'career', label: '家里的生意', intensity: 2 },
        ],
      },
    },
    {
      id: 'big_family',
      name: '四代同堂之家',
      description: '饭桌总是很挤，也从来不缺说话的人。',
      weight: 3,
      tags: ['big_family'],
      grantMarks: [{ id: 'presence', intensity: 2 }, { id: 'vitality', intensity: 1 }],
      world: {
        setFacts: { household: 'crowded' },
        relations: [
          { id: 'parents', kind: 'family', label: '家人', closeness: 7 },
          { id: 'kin', kind: 'family', label: '亲戚', closeness: 5 },
        ],
        threads: [{ id: 'family_origin', domain: 'family', label: '原生家庭', intensity: 3 }],
      },
    },
    {
      id: 'traveling_home',
      name: '四处迁居之家',
      description: '每隔几年，你就要重新认识一条街道。',
      weight: 2,
      tags: ['many_hometowns'],
      grantMarks: [{ id: 'presence', intensity: 1 }, { id: 'clarity', intensity: 1 }],
      world: {
        setFacts: { residence: 'moving', household: 'moving' },
        relations: [{ id: 'parents', kind: 'family', label: '家人', closeness: 4 }],
        threads: [
          { id: 'family_origin', domain: 'family', label: '原生家庭', intensity: 1 },
          { id: 'open_road', domain: 'travel', label: '迁居', intensity: 2 },
        ],
      },
    },
  ],
  temperaments: TEMPERAMENTS,
  encounters: ENCOUNTERS,
  understandingSeeds: UNDERSTANDING_SEEDS,
  marks: MARKS,
  regions: HISTORY_REGIONS,
  figures: HISTORY_FIGURES,
};
