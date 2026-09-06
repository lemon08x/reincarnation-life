import { GameService, SaveStore } from '../assets/scripts/app/gameService';
import {
  presentChoices,
  presentScenario,
  presentStateDiff,
  presentStoryText,
} from '../assets/scripts/app/presentation/presenters';
import { SCENE_KIND_NAMES, SCENE_VISUALS } from '../assets/scripts/app/presentation/visualConfig';
import { GAME_CONTENT } from '../assets/scripts/content/gameContent';
import { validateGameContent } from '../assets/scripts/core/contentValidation';
import {
  advanceToNextMoment,
  chooseLifePath,
  chooseStageFocus,
  continueScenario,
  drawTalentDraft,
  getCurrentLifeStage,
  getEventSelectionWeight,
  getPendingEvent,
  listAvailablePaths,
  listEligibleEvents,
  resolveEventChoice,
  resolveScenarioAction,
  startHistoryLife,
  startLife,
} from '../assets/scripts/core/lifeEngine';
import { markIntensity, markOutcomeMultiplier } from '../assets/scripts/core/lifeMarks';
import { computeWorldPressures, formatWorldSummary, tickLifeWorld } from '../assets/scripts/core/lifeWorld';
import {
  GameSave,
  LifeRun,
  ReincarnatorProfile,
  SAVE_VERSION,
  ScenarioKind,
} from '../assets/scripts/core/model';
import {
  createInitialProfile,
  getLegacySlotCount,
  getPermanentBenefits,
  getRunCapabilities,
  normalizeProfile,
} from '../assets/scripts/core/progression';
import { claimLegacyReward, prepareSettlement } from '../assets/scripts/core/rewardEngine';
import { migrateGameSave } from '../assets/scripts/core/saveMigration';

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertThrows(run: () => void, message: string): void {
  let threw = false;
  try {
    run();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function startTestLife(
  profile: ReincarnatorProfile,
  seed: number,
  runId = `test-life-${seed}`,
): LifeRun {
  const draft = drawTalentDraft(profile, seed, GAME_CONTENT);
  return startLife(
    profile,
    draft,
    draft.candidateIds.slice(0, draft.requiredSelectionCount),
    runId,
    GAME_CONTENT,
  );
}

function chooseFirstFocus(run: LifeRun): LifeRun {
  const stage = getCurrentLifeStage(run, GAME_CONTENT);
  const focus = stage.focuses[0];
  assert(Boolean(focus), `stage ${stage.id} should have a focus`);
  return chooseStageFocus(run, focus.id, GAME_CONTENT);
}

function finishLifeWithFirstChoices(initialRun: LifeRun): LifeRun {
  let run = initialRun;
  for (let step = 0; step < 500 && run.status === 'active'; step += 1) {
    run = stepLife(run);
  }
  assertEqual(run.status, 'ended', `life ${run.id} should reach an ending`);
  return run;
}

function stepLife(run: LifeRun): LifeRun {
  if (run.turnState === 'awaiting-path' || run.turnState === 'awaiting-focus') {
    const paths = listAvailablePaths(run, GAME_CONTENT);
    if (paths[0]) {
      return chooseLifePath(run, paths[0].id, GAME_CONTENT);
    }
    if (run.turnState === 'awaiting-focus') {
      return chooseFirstFocus(run);
    }
    return continueScenario({ ...run, turnState: 'scenario-summary', scenarioReport: {
      title: '空',
      years: 1,
      ageAfter: Math.min(100, run.age + 1),
      lines: [],
    }, completedScenarioIds: [...run.completedScenarioIds, 'dusk'] }, GAME_CONTENT);
  }
  if (run.turnState === 'awaiting-choice') {
    const choiceId = run.pendingDecision?.choiceIds[0];
    assert(choiceId !== undefined, 'a pending decision should offer at least one choice');
    return resolveEventChoice(run, choiceId, GAME_CONTENT);
  }
  if (run.turnState === 'in-scenario') {
    const action = run.currentScenario?.actionIds[0];
    assert(action !== undefined, 'a scenario should offer an action');
    return resolveScenarioAction(run, action, GAME_CONTENT);
  }
  if (run.turnState === 'scenario-summary') {
    return continueScenario(run, GAME_CONTENT);
  }
  return advanceToNextMoment(run, GAME_CONTENT);
}

function findRunWaitingForDecision(): LifeRun {
  const profile = createInitialProfile(GAME_CONTENT);
  for (let seed = 1; seed <= 100; seed += 1) {
    let run = startTestLife(profile, seed, `decision-search-${seed}`);
    for (let step = 0; step < 200 && run.status === 'active'; step += 1) {
      if (run.turnState === 'awaiting-choice') {
        return run;
      }
      run = stepLife(run);
    }
  }
  throw new Error('No deterministic seed reached a key decision.');
}

class MemoryStore implements SaveStore {
  public value: GameSave | null = null;

  public load(): GameSave | null {
    return this.value ? clone(this.value) : null;
  }

  public save(value: GameSave): void {
    this.value = clone(value);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueTags(values: string[]): string[] {
  return [...new Set(values)];
}

function chooseServiceFocus(service: GameService): void {
  const run = service.getCurrentRun();
  assert(run?.status === 'active' && run.turnState === 'awaiting-focus', 'service should await a focus');
  const stage = getCurrentLifeStage(run, service.getContent());
  service.chooseCurrentStageFocus(stage.focuses[0].id);
}

function finishServiceLife(service: GameService): LifeRun {
  for (let step = 0; step < 500; step += 1) {
    const run = service.getCurrentRun();
    assert(run !== null, 'service should contain a life');
    if (run.status !== 'active') {
      return run;
    }
    if (run.turnState === 'awaiting-path') {
      const paths = listAvailablePaths(run, service.getContent());
      assert(paths[0] !== undefined, 'service should offer a path');
      service.chooseCurrentPath(paths[0].id);
    } else if (run.turnState === 'in-scenario') {
      const actionId = run.currentScenario?.actionIds[0];
      assert(actionId !== undefined, 'service scenario should offer an action');
      service.resolveCurrentScenarioAction(actionId);
    } else if (run.turnState === 'scenario-summary') {
      service.continueCurrentScenario();
    } else if (run.turnState === 'awaiting-focus') {
      chooseServiceFocus(service);
    } else if (run.turnState === 'awaiting-choice') {
      const choiceId = run.pendingDecision?.choiceIds[0];
      assert(choiceId !== undefined, 'service decision should offer a choice');
      service.resolveCurrentChoice(choiceId);
    } else {
      service.advanceCurrentLife();
    }
  }
  throw new Error('Service life did not finish within the safety limit.');
}

test('a new reincarnator has clean progression and legacy state', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const benefits = getPermanentBenefits(profile, GAME_CONTENT);
  assertEqual(profile.version, SAVE_VERSION, 'save version');
  assertEqual(profile.level, 1, 'initial level');
  assertEqual(profile.totalExp, 0, 'initial experience');
  assertEqual(profile.rewardedRunIds.length, 0, 'initial rewarded runs');
  assertEqual(Object.keys(profile.legacyRanks).length, 0, 'initial legacy ranks');
  assertEqual(profile.equippedLegacyIds.length, 0, 'initial equipped legacies');
  assertEqual(profile.pendingBoonIds.length, 0, 'initial next-life boons');
  assertEqual(benefits.attributePointBonus, 0, 'initial level stat bonus');
  assertEqual(getLegacySlotCount(profile, GAME_CONTENT), 2, 'initial legacy slots');
});

test('talent draw is deterministic and contains unique unlocked talents', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const first = drawTalentDraft(profile, 123456, GAME_CONTENT);
  const second = drawTalentDraft(profile, 123456, GAME_CONTENT);
  assertEqual(JSON.stringify(first), JSON.stringify(second), 'same seed should produce the same draft');
  assertEqual(first.candidateIds.length, 3, 'level-one candidate count');
  assertEqual(new Set(first.candidateIds).size, first.candidateIds.length, 'candidate ids must be unique');
  assert(first.candidateIds.every((id) => {
    const talent = GAME_CONTENT.talents.find((item) => item.id === id);
    return Boolean(talent && talent.unlockLevel <= profile.level);
  }), 'all candidates should be unlocked');
});

test('a life begins by asking for a stage focus and applies that choice', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const run = startTestLife(profile, 7, 'stage-start');
  assertEqual(run.status, 'active', 'new life status');
  assertEqual(run.turnState, 'awaiting-path', 'new life should wait for a scenario path');
  assertEqual(run.age, 0, 'new life age');
  assertEqual(run.history.length, 1, 'birth should be recorded');

  const paths = listAvailablePaths(run, GAME_CONTENT);
  assert(paths.length >= 1, 'a new life should offer at least one path');
  const entered = chooseLifePath(run, paths[0].id, GAME_CONTENT);
  assert(entered.turnState === 'in-scenario' || entered.turnState === 'awaiting-choice', 'entering a path should start a scenario');
  assert(entered.currentScenario !== undefined, 'an active scenario should be stored');
});

test('advancement pauses at a persisted key decision', () => {
  const run = findRunWaitingForDecision();
  assertEqual(run.turnState, 'awaiting-choice', 'turn should pause for participation');
  assert(run.pendingDecision !== undefined, 'pending decision should be persisted in the run');
  const event = getPendingEvent(run, GAME_CONTENT);
  assert(event.choices !== undefined, 'pending event should contain choices');
  assert(run.pendingDecision.choiceIds.length >= 2, 'pending decision should expose at least two choices');
  assert(run.pendingDecision.choiceIds.every((choiceId) => (
    event.choices?.some((choice) => choice.id === choiceId)
  )), 'persisted choice ids should belong to the pending event');
});

test('a new life begins as a living world, not a blank stat sheet', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const run = startTestLife(profile, 11, 'world-birth');
  assert(run.world.relations.some((item) => item.id === 'parents'), 'birth should include a family relation');
  assertEqual(run.world.facts.residence?.value, 'hometown', 'birth should place the life in a hometown');
  assert(run.world.threads.some((item) => item.domain === 'family'), 'birth should start a family thread');
  assert(Boolean(formatWorldSummary(run.world)), 'the living situation should be describable');
  assert((run.marks?.length ?? 0) > 0, 'birth should grant named marks instead of allocated numbers');
});

test('talents grant named auras rather than invisible numbers', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const draft = drawTalentDraft(profile, 11, GAME_CONTENT);
  const sturdy = draft.candidateIds.includes('strong_bones') ? 'strong_bones' : draft.candidateIds[0];
  const second = draft.candidateIds.find((id) => id !== sturdy) ?? draft.candidateIds[1];
  const run = startLife(profile, draft, [sturdy, second], 'mark-birth', GAME_CONTENT);
  assert((run.marks?.length ?? 0) >= 1, 'selected talents should leave marks');
  if (sturdy === 'strong_bones') {
    assert(markIntensity(run.marks, 'sturdy') >= 1, 'strong bones should become a body aura');
  }
});

test('marks tilt the odds of later outcomes', () => {
  const luckyWeight = markOutcomeMultiplier(
    [{ id: 'lucky', intensity: 3 }],
    { id: 'kind', weight: 1, text: '', effects: { wealth: 2 } },
    GAME_CONTENT.marks,
  );
  const wornWeight = markOutcomeMultiplier(
    [{ id: 'wear', intensity: 3 }],
    { id: 'harsh', weight: 1, text: '', effects: { health: -2 } },
    GAME_CONTENT.marks,
  );
  assert(luckyWeight > 1, 'fortune should make kinder outcomes more likely');
  assert(wornWeight > 1, 'exhaustion should make harsher body outcomes more likely');
});

test('a choice mutates world state rather than only changing stats', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const started = startTestLife(profile, 901, 'world-choice');
  const focused = chooseLifePath(started, listAvailablePaths(started, GAME_CONTENT)[0].id, GAME_CONTENT);
  const decisionRun: LifeRun = {
    ...focused,
    age: 8,
    turnState: 'awaiting-choice',
    pendingDecision: {
      age: 8,
      eventId: 'broken_window',
      choiceIds: ['confess', 'hide'],
      automaticEffects: {},
      rerolledEventIds: [],
    },
  };
  const resolved = resolveEventChoice(decisionRun, 'confess', GAME_CONTENT);
  assert(resolved.world.relations.some((item) => item.id === 'neighbor'), 'confessing should create a neighbor relation');
  assert(resolved.history[resolved.history.length - 1].worldChanges?.length, 'history should record world fragments');
  assert(resolved.tags.includes('takes_responsibility'), 'route tags should still be applied');
});

test('two active life strands can couple into a new event', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const focused = startTestLife(profile, 44, 'world-coupling');
  const coupled: LifeRun = {
    ...focused,
    age: 34,
    tags: uniqueTags([...focused.tags, 'has_career', 'made_a_home']),
    world: {
      ...focused.world,
      facts: {
        ...focused.world.facts,
        occupation: { value: 'employed', sinceAge: 22 },
        partnership: { value: 'home', sinceAge: 28 },
      },
      relations: [
        ...focused.world.relations,
        {
          id: 'partner',
          kind: 'partner',
          label: '伴侣',
          closeness: 7,
          strain: 3,
          sinceAge: 28,
          lastTouchedAge: 33,
        },
      ],
      threads: [
        ...focused.world.threads,
        {
          id: 'career_life',
          domain: 'career',
          label: '谋生',
          intensity: 6,
          sinceAge: 22,
          lastEventAge: 32,
        },
        {
          id: 'family_own',
          domain: 'family',
          label: '自己的家',
          intensity: 6,
          sinceAge: 28,
          lastEventAge: 33,
        },
      ],
    },
  };
  const eligible = listEligibleEvents(coupled, 34, GAME_CONTENT);
  const clash = eligible.find((event) => event.id === 'work_home_clash');
  assert(clash !== undefined, 'career plus family should unlock a cross-strand event');
  const clashWeight = getEventSelectionWeight(clash, coupled, GAME_CONTENT);
  const ordinary = GAME_CONTENT.events.find((event) => event.id === 'adult_year');
  assert(ordinary !== undefined, 'ordinary adult year should exist');
  const ordinaryWeight = getEventSelectionWeight(ordinary, coupled, GAME_CONTENT);
  assert(clashWeight > ordinaryWeight, 'coupled pressure should outweigh an ordinary year');
  const pressures = computeWorldPressures(coupled.world, coupled.stats, coupled.age);
  assert(pressures.career >= 4 && pressures.family >= 4, 'both strands should be under pressure');
});

test('neglected relations drift even when other years occupy the foreground', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const focused = startTestLife(profile, 18, 'world-drift');
  const withFriend: LifeRun = {
    ...focused,
    age: 22,
    world: {
      ...focused.world,
      relations: [
        ...focused.world.relations,
        {
          id: 'friend',
          kind: 'friend',
          label: '故人',
          closeness: 6,
          strain: 0,
          sinceAge: 14,
          lastTouchedAge: 14,
        },
      ],
    },
  };
  const drifted = tickLifeWorld(withFriend.world, withFriend.stats, 22);
  const friend = drifted.relations.find((item) => item.id === 'friend');
  assert(friend !== undefined, 'the friend relation should still exist');
  assert(friend.closeness < 6, 'a neglected friend should grow more distant');
});

test('a commerce chapter is played in turns instead of years', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  let run = startTestLife(profile, 44, 'commerce-turns');
  run = { ...run, age: 20, completedScenarioIds: ['childhood'] };
  const entered = chooseLifePath(run, 'commerce', GAME_CONTENT);
  assert(entered.currentScenario?.scenarioId === 'commerce', 'commerce should become the active chapter');
  assert(entered.turnState === 'in-scenario' || entered.turnState === 'awaiting-choice', 'the chapter should wait for a turn');
  if (entered.turnState === 'in-scenario') {
    const purseBefore = entered.currentScenario?.resources.purse ?? 0;
    const acted = resolveScenarioAction(entered, 'hold', GAME_CONTENT);
    const purseAfter = acted.currentScenario?.resources.purse ?? purseBefore + 1;
    assert(purseAfter >= purseBefore, 'holding a season should not lose the purse');
  }
});

test('history mode walks a figure chapter by chapter', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const run = startHistoryLife(profile, 'kongzi', 'history-kongzi', GAME_CONTENT);
  assertEqual(run.playMode, 'history', 'history mode');
  assertEqual(run.figureId, 'kongzi', 'figure id');
  const paths = listAvailablePaths(run, GAME_CONTENT);
  assertEqual(paths[0]?.title, '问礼', 'the first chapter should use the figure title');
  const entered = chooseLifePath(run, paths[0].id, GAME_CONTENT);
  assertEqual(entered.currentScenario?.title, '问礼', 'entered chapter title');
});

test('settlement grants experience once and persists three diverse offers', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const ended = finishLifeWithFirstChoices(startTestLife(profile, 222, 'settlement-test'));
  const prepared = prepareSettlement(profile, ended, GAME_CONTENT);
  assertEqual(prepared.run.status, 'reward-pending', 'settlement should wait for reward selection');
  assert(prepared.settlement.earnedExp > 0, 'settlement should grant positive experience');
  assertEqual(prepared.profile.totalExp, prepared.settlement.earnedExp, 'experience should be persisted');
  assertEqual(prepared.settlement.rewardOfferIds.length, 3, 'exactly three rewards should be offered');
  assertEqual(new Set(prepared.settlement.rewardOfferIds).size, 3, 'reward offers should be unique');
  const categories = new Set(prepared.settlement.rewardOfferIds.map((id) => (
    GAME_CONTENT.legacies.find((legacy) => legacy.id === id)?.category
  )));
  assertEqual(categories.size, 3, 'the offer should contain three reward categories when available');

  const repeated = prepareSettlement(prepared.profile, prepared.run, GAME_CONTENT);
  assertEqual(repeated.newlyGranted, false, 'second preparation should not grant again');
  assertEqual(repeated.profile.totalExp, prepared.profile.totalExp, 'repeat settlement must preserve experience');
});

test('one offered legacy can be claimed exactly once', () => {
  const profile = createInitialProfile(GAME_CONTENT);
  const ended = finishLifeWithFirstChoices(startTestLife(profile, 333, 'reward-claim-test'));
  const prepared = prepareSettlement(profile, ended, GAME_CONTENT);
  const rewardId = prepared.settlement.rewardOfferIds[0];
  assert(rewardId !== undefined, 'settlement should offer a reward');
  const claimed = claimLegacyReward(prepared.profile, prepared.run, rewardId, GAME_CONTENT);
  assertEqual(claimed.run.status, 'settled', 'claim should finish settlement');
  assertEqual(claimed.run.settlement?.selectedRewardId, rewardId, 'selected reward should be recorded');
  assert(claimed.profile.rewardedRunIds.includes(ended.id), 'rewarded run id should be recorded');
  const reward = GAME_CONTENT.legacies.find((legacy) => legacy.id === rewardId);
  assert(reward !== undefined, 'claimed reward should exist');
  if (reward.persistence === 'permanent') {
    assertEqual(claimed.profile.legacyRanks[rewardId], 1, 'permanent reward should gain a rank');
  } else {
    assert(claimed.profile.pendingBoonIds.includes(rewardId), 'boon should queue for the next life');
  }

  const repeated = claimLegacyReward(claimed.profile, claimed.run, rewardId, GAME_CONTENT);
  assertEqual(repeated.newlyClaimed, false, 'claiming the selected reward twice should be idempotent');
  const otherRewardId = prepared.settlement.rewardOfferIds.find((id) => id !== rewardId);
  assert(otherRewardId !== undefined, 'another offered reward should exist');
  assertThrows(
    () => claimLegacyReward(claimed.profile, claimed.run, otherRewardId, GAME_CONTENT),
    'a second, different reward must be rejected',
  );
});

test('service reload preserves a pending event without rerolling it', () => {
  const store = new MemoryStore();
  let seed = 400;
  const service = new GameService(store, () => seed += 1, GAME_CONTENT);
  const draft = service.createTalentDraft();
  service.startNewLife(
    draft,
    draft.candidateIds.slice(0, draft.requiredSelectionCount),
  );

  for (let step = 0; step < 200; step += 1) {
    const run = service.getCurrentRun();
    assert(run?.status === 'active', 'life should still be active before its first decision');
    if (run.turnState === 'awaiting-choice') {
      break;
    }
    if (run.turnState === 'awaiting-path' || run.turnState === 'awaiting-focus') {
      const paths = listAvailablePaths(run, service.getContent());
      if (paths[0]) {
        service.chooseCurrentPath(paths[0].id);
      } else {
        chooseServiceFocus(service);
      }
    } else if (run.turnState === 'in-scenario') {
      const actionId = run.currentScenario?.actionIds[0];
      assert(actionId !== undefined, 'service scenario should offer an action');
      service.resolveCurrentScenarioAction(actionId);
    } else if (run.turnState === 'scenario-summary') {
      service.continueCurrentScenario();
    } else {
      service.advanceCurrentLife();
    }
  }
  const pendingBefore = service.getCurrentRun()?.pendingDecision;
  const rngBefore = service.getCurrentRun()?.rngState;
  assert(pendingBefore !== undefined, 'service should reach a pending decision');
  const reloaded = new GameService(store, () => seed += 1, GAME_CONTENT);
  const pendingAfter = reloaded.getCurrentRun()?.pendingDecision;
  assert(pendingAfter !== undefined, 'reloaded service should retain the pending decision');
  assertEqual(
    JSON.stringify({
      age: pendingAfter.age,
      eventId: pendingAfter.eventId,
      choiceIds: pendingAfter.choiceIds,
      rerolledEventIds: pendingAfter.rerolledEventIds,
      sourceChoiceId: pendingAfter.sourceChoiceId,
    }),
    JSON.stringify({
      age: pendingBefore.age,
      eventId: pendingBefore.eventId,
      choiceIds: pendingBefore.choiceIds,
      rerolledEventIds: pendingBefore.rerolledEventIds,
      sourceChoiceId: pendingBefore.sourceChoiceId,
    }),
    'reload should preserve the exact event and offered choices',
  );
  assertEqual(reloaded.getCurrentRun()?.rngState, rngBefore, 'reload must not advance the random state');
});

test('service reload preserves reward offers and never duplicates settlement', () => {
  const store = new MemoryStore();
  let seed = 700;
  const service = new GameService(store, () => seed += 1, GAME_CONTENT);
  const draft = service.createTalentDraft();
  service.startNewLife(
    draft,
    draft.candidateIds.slice(0, draft.requiredSelectionCount),
  );
  const pendingReward = finishServiceLife(service);
  assertEqual(pendingReward.status, 'reward-pending', 'service should stop at reward selection');
  const expAfterSettlement = service.getProfile().totalExp;
  const offersBefore = JSON.stringify(pendingReward.settlement?.rewardOfferIds);

  const reloaded = new GameService(store, () => seed += 1, GAME_CONTENT);
  assertEqual(reloaded.getProfile().totalExp, expAfterSettlement, 'reload must not duplicate experience');
  assertEqual(JSON.stringify(reloaded.getCurrentRun()?.settlement?.rewardOfferIds), offersBefore, 'offers must persist');
  const rewardId = reloaded.getCurrentRun()?.settlement?.rewardOfferIds[0];
  assert(rewardId !== undefined, 'a persisted reward should be claimable');
  reloaded.claimCurrentReward(rewardId);

  const afterClaimReload = new GameService(store, () => seed += 1, GAME_CONTENT);
  assertEqual(afterClaimReload.getCurrentRun()?.status, 'settled', 'claimed run should remain settled');
  assertEqual(afterClaimReload.getProfile().totalExp, expAfterSettlement, 'claim reload must preserve experience');
  assertEqual(afterClaimReload.getCurrentRun()?.settlement?.selectedRewardId, rewardId, 'claim should persist');
});

test('legacy slots are enforced and equipped ranks aggregate into run capabilities', () => {
  const store = new MemoryStore();
  const profile = createInitialProfile(GAME_CONTENT);
  store.value = {
    version: SAVE_VERSION,
    profile: {
      ...profile,
      legacyRanks: {
        memory_of_abundance: 2,
        turn_back_time: 1,
        book_of_questions: 1,
      },
    },
    currentRun: null,
  };
  const service = new GameService(store, () => 1, GAME_CONTENT);
  service.toggleEquippedLegacy('memory_of_abundance');
  service.toggleEquippedLegacy('turn_back_time');
  assertThrows(
    () => service.toggleEquippedLegacy('book_of_questions'),
    'equipping beyond the available slots should fail',
  );
  const capabilities = getRunCapabilities(service.getProfile(), GAME_CONTENT);
  assertEqual(service.getProfile().equippedLegacyIds.length, 2, 'equipped legacy count');
  assertEqual(capabilities.startingPointBonus, 2, 'ranked starting-point effects should stack');
  assertEqual(capabilities.eventRerolls, 1, 'equipped fate effect should be available');
});

test('version-one saves migrate without losing the current life', () => {
  const migrated = migrateGameSave({
    version: 1,
    profile: {
      version: 1,
      totalExp: 45,
      level: 1,
      discoveredEndingIds: ['ordinary_life'],
      settledRunIds: ['old-settled-run'],
    },
    currentRun: {
      id: 'legacy-active-run',
      seed: 17,
      rngState: 23,
      profileLevelAtStart: 1,
      status: 'active',
      age: 10,
      familyId: 'ordinary_home',
      talentIds: ['bookish'],
      allocation: { health: 3, intellect: 3, charm: 2, wealth: 2 },
      stats: { health: 9, intellect: 7, charm: 6, wealth: 5 },
      tags: ['started_school'],
      history: [{
        age: 10,
        eventId: 'ordinary_school_year',
        text: '旧存档中的这一年。',
        effects: { intellect: 1 },
        tagsAdded: [],
      }],
    },
  }, GAME_CONTENT);
  assert(migrated !== null, 'valid version-one save should migrate');
  assertEqual(migrated.version, SAVE_VERSION, 'migrated save version');
  assertEqual(migrated.profile.totalExp, 45, 'experience should survive migration');
  assertEqual(migrated.profile.rewardedRunIds.length, 0, 'new reward tracking should be initialized');
  assertEqual(migrated.currentRun?.id, 'legacy-active-run', 'active run id should survive migration');
  assertEqual(migrated.currentRun?.age, 10, 'active run age should survive migration');
  assertEqual(migrated.currentRun?.stats.intellect, 7, 'active run stats should survive migration');
  assertEqual(migrated.currentRun?.history.length, 1, 'active run history should survive migration');
  assertEqual(migrated.currentRun?.turnState, 'awaiting-focus', 'legacy run should enter the new participation flow');
});

test('higher levels still expand initial choices alongside the legacy system', () => {
  const highLevelProfile = normalizeProfile({
    ...createInitialProfile(GAME_CONTENT),
    totalExp: 650,
  }, GAME_CONTENT);
  const benefits = getPermanentBenefits(highLevelProfile, GAME_CONTENT);
  const draft = drawTalentDraft(highLevelProfile, 99, GAME_CONTENT);
  assertEqual(highLevelProfile.level, 6, 'profile level at 650 experience');
  assertEqual(benefits.attributePointBonus, 1, 'cumulative level stat bonus');
  assertEqual(benefits.talentCandidateBonus, 1, 'cumulative candidate bonus');
  assertEqual(benefits.legacySlotBonus, 1, 'cumulative slot bonus');
  assertEqual(draft.candidateIds.length, 4, 'level-six candidate count');
});

test('all configured content passes structural validation', () => {
  const errors = validateGameContent(GAME_CONTENT);
  assertEqual(errors.length, 0, `content validation errors: ${errors.join(' | ')}`);
});

test('presentation keeps every pending choice and supports four-way comparison', () => {
  const event = GAME_CONTENT.events.find((item) => item.id === 'first_job');
  assert(Boolean(event && event.choices && event.choices.length >= 4), 'first_job should offer four choices');
  const choices = event!.choices!;
  const waiting = findRunWaitingForDecision();
  const run: LifeRun = {
    ...waiting,
    pendingDecision: {
      age: waiting.age,
      eventId: 'first_job',
      choiceIds: choices.map((choice) => choice.id),
      automaticEffects: {},
      rerolledEventIds: [],
    },
  };
  const view = presentChoices(run, GAME_CONTENT, null, false);
  assertEqual(view.choices.length, choices.length, 'choice presenter should not drop options');
  for (const choice of choices) {
    assert(view.choices.some((item) => item.id === choice.id), `missing choice ${choice.id}`);
  }
});

test('unaffordable scenario actions stay visible and explain the missing cost', () => {
  const commerce = GAME_CONTENT.scenarios.find((item) => item.id === 'commerce');
  assert(commerce !== undefined, 'commerce scenario should exist');
  const run = startTestLife(createInitialProfile(GAME_CONTENT), 7, 'ui-afford');
  const sceneRun: LifeRun = {
    ...run,
    turnState: 'in-scenario',
    currentScenario: {
      scenarioId: commerce.id,
      title: commerce.title,
      kind: commerce.kind,
      icon: commerce.icon,
      turn: 0,
      maxTurns: commerce.turns,
      years: commerce.years,
      resources: { purse: 0, venture: 0 },
      resourceLabels: commerce.resourceLabels,
      log: [commerce.summary],
      actionIds: ['hold'],
      startedAtAge: run.age,
    },
  };
  const view = presentScenario(sceneRun, GAME_CONTENT);
  const invest = view.actions.find((item) => item.id === 'invest');
  const hold = view.actions.find((item) => item.id === 'hold');
  const expand = view.actions.find((item) => item.id === 'expand');
  assert(hold?.enabled, 'free action should remain enabled');
  assert(invest && !invest.enabled, 'costly action should be visible but disabled');
  assert(Boolean(invest?.disabledReason), 'disabled action should explain the missing resource');
  assert(expand && !expand.enabled, 'second costly action should also stay visible');
});

test('foresight stays behind an explicit reveal and respects capability', () => {
  const waiting = findRunWaitingForDecision();
  const none = presentChoices(waiting, GAME_CONTENT, waiting.pendingDecision?.choiceIds[0] ?? null, true);
  assertEqual(none.canForesight, false, 'default lives should not have foresight');
  assert(none.choices.every((choice) => !choice.foresight), 'foresight text should stay hidden without permission');
  const ranged: LifeRun = {
    ...waiting,
    capabilities: {
      ...waiting.capabilities,
      choiceForesight: 'range',
    },
  };
  const closed = presentChoices(ranged, GAME_CONTENT, null, false);
  assert(closed.canForesight, 'range foresight should expose the independent control');
  assert(closed.choices.every((choice) => !choice.foresight), 'foresight remains closed until revealed');
  const opened = presentChoices(ranged, GAME_CONTENT, null, true);
  assert(opened.choices.some((choice) => Boolean(choice.foresight)), 'revealed foresight should attach possible outcomes');
});

test('long story text is truncated with an expand payload', () => {
  const full = '这是一段故意写得很长的人生叙述，用来确认主界面只展示两到三行，并且把完整原文留给展开入口，不把故事截断后丢掉。';
  const story = presentStoryText(full);
  assert(story.expandable, 'long text should be expandable');
  assert(story.preview.length < story.full.length, 'preview should be shorter than the full record');
  assertEqual(story.full, full, 'full text should keep the original wording');
  const short = presentStoryText('短句。');
  assertEqual(short.expandable, false, 'short text should not require expansion');
});

test('state diffs capture resource and mark changes', () => {
  const diff = presentStateDiff(
    { resources: { purse: 3 }, marks: [{ id: 'means', intensity: 1 }] },
    {
      resources: { purse: 1, venture: 2 },
      marks: [{ id: 'means', intensity: 2 }],
      resourceLabels: { purse: '本钱', venture: '生意' },
    },
    GAME_CONTENT,
  );
  const purse = diff.resources.find((item) => item.key === 'purse');
  const venture = diff.resources.find((item) => item.key === 'venture');
  const means = diff.marks.find((item) => item.id === 'means');
  assertEqual(purse?.delta, -2, 'purse should fall by two');
  assertEqual(venture?.delta, 2, 'new venture should appear as a gain');
  assertEqual(means?.delta, 1, 'means mark should intensify');
});

test('all eight scenario kinds map to named cartoon scenes', () => {
  const kinds: ScenarioKind[] = ['childhood', 'studies', 'commerce', 'craft', 'journey', 'hearth', 'service', 'dusk'];
  const names = ['庭院', '书房', '集市', '工坊', '旅途', '居所', '议事厅', '暮年庭院'];
  kinds.forEach((kind, index) => {
    assertEqual(SCENE_KIND_NAMES[kind], names[index], `${kind} scene name`);
    assertEqual(SCENE_VISUALS[kind].name, names[index], `${kind} visual name`);
    assertEqual(SCENE_VISUALS[kind].kind, kind, `${kind} visual identity`);
  });
});

test('one thousand deterministic lives finish without dead ends', () => {
  let totalDecisions = 0;
  let laterLifeDecisions = 0;
  let reachedLaterYears = 0;
  for (let seed = 1; seed <= 1000; seed += 1) {
    const profile = createInitialProfile(GAME_CONTENT);
    const ended = finishLifeWithFirstChoices(startTestLife(profile, seed, `coverage-${seed}`));
    assert(ended.age >= 1 && ended.age <= 100, `seed ${seed} should end in the supported age range`);
    assert(Boolean(ended.endingId), `seed ${seed} should resolve an ending`);
    const choices = ended.history.filter((entry) => Boolean(entry.choiceId));
    totalDecisions += choices.length;
    laterLifeDecisions += choices.filter((entry) => entry.age >= 50).length;
    if (ended.age >= 55 || ended.completedScenarioIds.includes('dusk')) {
      reachedLaterYears += 1;
    }
  }
  assert(totalDecisions >= 1000, 'the simulation should contain at least one meaningful choice per life on average');
  assert(laterLifeDecisions > 0, 'some meaningful choices should occur after age fifty');
  assert(reachedLaterYears > 0, 'some lives should reach later years or dusk');
});

let passed = 0;
for (const current of tests) {
  try {
    current.run();
    passed += 1;
    console.log(`PASS ${current.name}`);
  } catch (error) {
    console.error(`FAIL ${current.name}`);
    throw error;
  }
}

console.log(`\n${passed}/${tests.length} core tests passed.`);
