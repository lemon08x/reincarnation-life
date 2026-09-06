import { GameService, SaveStore } from '../assets/scripts/app/gameService';
import {
  presentEncounter,
  presentHome,
  presentStoryText,
  routePlayPage,
} from '../assets/scripts/app/presentation/presenters';
import { GAME_CONTENT } from '../assets/scripts/content/gameContent';
import { validateGameContent } from '../assets/scripts/core/contentValidation';
import {
  causalityHasCycle,
  completeArchive,
  createInitialProfile,
  getCausality,
  startLife,
  submitRecall,
  submitResponse,
} from '../assets/scripts/core/lifeEngine';
import {
  GameSave,
  LifeRun,
  PendingOption,
  RecallStance,
  SAVE_VERSION,
} from '../assets/scripts/core/model';
import { nextRandom, normalizeSeed, pickWeighted } from '../assets/scripts/core/random';
import {
  CURRENT_SAVE_KEY,
  OBSOLETE_SAVE_KEYS,
  StorageAdapter,
  clearObsoleteSaveKeys,
  parseGameSave,
} from '../assets/scripts/core/saveMigration';

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class MemoryStore implements SaveStore, StorageAdapter {
  public slots: Record<string, string> = {};

  public getItem(key: string): string | null {
    return this.slots[key] ?? null;
  }

  public setItem(key: string, value: string): void {
    this.slots[key] = value;
  }

  public removeItem(key: string): void {
    delete this.slots[key];
  }

  public load(): GameSave | null {
    clearObsoleteSaveKeys(this);
    const raw = this.getItem(CURRENT_SAVE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return parseGameSave(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }

  public save(value: GameSave): void {
    this.setItem(CURRENT_SAVE_KEY, JSON.stringify(value));
  }
}

function pickOption(options: PendingOption[], style: number, points: number): PendingOption {
  const affordable = options.filter((item) => item.enabled && item.cost <= points);
  assert(affordable.length > 0, 'an encounter should keep at least one affordable option');
  if (style % 3 === 1) {
    return [...affordable].sort((left, right) => right.cost - left.cost)[0];
  }
  if (style % 3 === 2) {
    return affordable[Math.min(1, affordable.length - 1)];
  }
  return affordable.find((item) => item.cost === 0) ?? affordable[0];
}

function stanceFor(style: number): RecallStance {
  return style % 3 === 0 ? 'hold' : style % 3 === 1 ? 'revise' : 'question';
}

function playToEnd(initial: LifeRun, style: number): LifeRun {
  let run = initial;
  for (let step = 0; step < 40 && run.status === 'active'; step += 1) {
    if (run.pendingEncounter) {
      const option = pickOption(run.pendingEncounter.options, style, run.lifePoints);
      run = submitResponse(run, run.pendingEncounter.instanceId, option.choiceId, GAME_CONTENT);
    } else if (run.pendingRecall) {
      run = submitRecall(run, run.pendingRecall.instanceId, stanceFor(style), GAME_CONTENT);
    } else {
      break;
    }
  }
  return run;
}

function startSeed(seed: number, carry: string[] = [], runId = `life-${seed}`): LifeRun {
  return startLife(createInitialProfile(), seed, runId, carry, GAME_CONTENT);
}

test('content: 24 templates, free options, consequences, and references', () => {
  const errors = validateGameContent(GAME_CONTENT);
  assertEqual(errors.join('\n'), '', 'game content should be valid');
  assertEqual(GAME_CONTENT.encounters.length, 24, 'there should be 24 encounter templates');
});

test('random: same seed yields the same sequence', () => {
  const first = nextRandom(normalizeSeed(42));
  const second = nextRandom(normalizeSeed(42));
  assertEqual(first.value, second.value, 'random values should match');
  const items = [{ id: 'a', w: 1 }, { id: 'b', w: 3 }, { id: 'c', w: 2 }];
  const left = pickWeighted(items, 99, (item) => item.w);
  const right = pickWeighted(items, 99, (item) => item.w);
  assertEqual(left.item.id, right.item.id, 'weighted picks should match');
});

test('experiences change later responses and keep real sources', () => {
  let laterConfessed: LifeRun | null = null;
  let laterHidden: LifeRun | null = null;
  for (let seed = 1; seed <= 400; seed += 1) {
    const opening = startSeed(seed, [], `src-${seed}`);
    if (opening.pendingEncounter?.templateId !== 'trust_broken_cup') {
      continue;
    }
    const confessed = submitResponse(clone(opening), opening.pendingEncounter.instanceId, 'confess', GAME_CONTENT);
    const hidden = submitResponse(clone(opening), opening.pendingEncounter.instanceId, 'hide', GAME_CONTENT);
    const left = playUntilTemplate(confessed, 'trust_friend_trouble');
    const right = playUntilTemplate(hidden, 'trust_friend_trouble');
    if (left && right) {
      laterConfessed = left;
      laterHidden = right;
      break;
    }
  }
  assert(laterConfessed && laterHidden, 'should find a seed where both responses later face the same friend-trouble encounter');
  const confessTell = laterConfessed.pendingEncounter?.options.find((item) => item.choiceId === 'tell');
  const hideTell = laterHidden.pendingEncounter?.options.find((item) => item.choiceId === 'tell');
  assert(confessTell && hideTell, 'both lives should still offer telling adults');
  assert(confessTell.cost === 0, 'a life that already spoke up should not pay to tell again');
  assert(hideTell.cost >= 1, 'a life that hid should pay 1 point to break the habit');
  assert(Boolean(hideTell.supportReason), 'the paid option should name a real past');
  const source = getCausality(laterHidden, createInitialProfile(), laterHidden.fragments[0].id);
  assert(source, 'the evoked past should be a real fragment');
  assert(source?.people.some((person) => person.id === 'parents'), 'the childhood fragment should keep the real person');
});

test('different responses produce different later consequences', () => {
  const confessed = findOpeningChoice('trust_broken_cup', 'confess');
  const hidden = findOpeningChoice('trust_broken_cup', 'hide');
  assert(confessed.tags.includes('truth-punished'), 'confessing should leave a punished-for-truth mark');
  assert(hidden.tags.includes('hid-and-safe'), 'hiding should leave a hid-and-safe mark');
  const parentConfessed = confessed.world.relations.find((item) => item.id === 'parents');
  const parentHidden = hidden.world.relations.find((item) => item.id === 'parents');
  assert(parentConfessed && parentHidden, 'both lives keep family');
  assert(parentConfessed.closeness !== parentHidden.closeness || parentConfessed.strain !== parentHidden.strain, 'family relations should diverge');
});

test('understandings can grow without overwriting old facts', () => {
  const started = findOpeningChoice('trust_broken_cup', 'confess');
  let run = playUntilRecall(started);
  assert(run.pendingRecall, 'a life should recall after three responses');
  const before = run.fragments.map((item) => item.whatHappened);
  const facts = run.fragments.map((item) => item.id);
  run = submitRecall(run, run.pendingRecall!.instanceId, 'revise', GAME_CONTENT);
  const revised = run.understandings.filter((item) => item.createdInRunId === run.id);
  assert(revised.length >= 1, 'revise should create an understanding version');
  assertEqual(revised[revised.length - 1].stance, 'revise', 'the new version should be a revision');
  assertEqual(run.fragments.filter((item) => item.runId === run.id).map((item) => item.whatHappened).join('|'), before.join('|'), 'old facts stay');
  assertEqual(run.fragments.filter((item) => item.runId === run.id).map((item) => item.id).join('|'), facts.join('|'), 'fragment identities stay');
  const later = playUntilTemplate(run, 'trust_share_blame') ?? playUntilTemplate(run, 'trust_workplace');
  if (later?.pendingEncounter) {
    const share = later.pendingEncounter.options.find((item) => item.choiceId === 'share' || item.choiceId === 'admit');
    assert(share, 'later trust encounters should still be reachable');
    assert(share.cost === 0 || share.supportReason, 'revised understanding should affect later responses or name why they cost');
  }
});

test('life points: zero can continue, overspend is rejected, repeats are idempotent', () => {
  let run: LifeRun | null = null;
  for (let seed = 1; seed <= 500; seed += 1) {
    const drained = drainToZero(startSeed(seed, [], `zero-${seed}`));
    if (drained.lifePoints === 0 && (drained.pendingEncounter || drained.pendingRecall)) {
      run = drained;
      break;
    }
  }
  assert(run, 'should reach a moment with zero life points');
  if (run.pendingEncounter) {
    const free = run.pendingEncounter.options.filter((item) => item.cost === 0 && item.enabled);
    assert(free.length >= 2, 'zero-point lives still have free options');
    const paid = run.pendingEncounter.options.find((item) => item.cost > run.lifePoints);
    if (paid) {
      assertEqual(paid.enabled, false, 'unaffordable options are disabled');
      assertThrows(() => submitResponse(run as LifeRun, run!.pendingEncounter!.instanceId, paid.choiceId, GAME_CONTENT), 'overspend must throw');
      assertEqual(run.lifePoints, 0, 'failed overspend does not spend points');
    }
    const instanceId = run.pendingEncounter.instanceId;
    const choiceId = free[0].choiceId;
    const next = submitResponse(run, instanceId, choiceId, GAME_CONTENT);
    const again = submitResponse(next, instanceId, choiceId, GAME_CONTENT);
    assertEqual(again.lifePoints, next.lifePoints, 'repeat submit does not spend again');
    assertEqual(again.fragments.length, next.fragments.length, 'repeat submit does not add fragments');
  } else {
    assert(run.pendingRecall, 'zero points can still reach a recall');
    const next = submitRecall(run, run.pendingRecall.instanceId, 'question', GAME_CONTENT);
    assert(next.lifePoints >= run.lifePoints, 'recall still works at zero points');
  }

  let recalling = playUntilRecall(startSeed(11));
  assert(recalling.pendingRecall, 'should reach a recall');
  const recallId = recalling.pendingRecall!.instanceId;
  const points = recalling.lifePoints;
  recalling = submitRecall(recalling, recallId, 'hold', GAME_CONTENT);
  const gained = recalling.lifePoints;
  assert(gained >= points, 'recall grants a point up to the cap');
  const twice = submitRecall(recalling, recallId, 'hold', GAME_CONTENT);
  assertEqual(twice.lifePoints, gained, 'repeat recall does not grant again');
  assertEqual(twice.recallCount, recalling.recallCount, 'repeat recall does not count twice');
});

test('archive retry does not duplicate discoveries', () => {
  const ended = playToEnd(startSeed(21), 0);
  assert(ended.status === 'awaiting-archive' || ended.status === 'settled', 'a simulated life should close');
  const first = completeArchive(createInitialProfile(), ended);
  const second = completeArchive(first.profile, first.run);
  assertEqual(second.profile.archivedRunIds.length, 1, 'one life is archived once');
  const keys = second.profile.discoveries.map((item) => item.contentKey).sort().join(',');
  const again = second.profile.discoveries.map((item) => item.contentKey).sort().join(',');
  assertEqual(keys, again, 'discovery keys stay stable');
  assertEqual(second.profile.fragments.filter((item) => item.runId === ended.id).length, ended.fragments.filter((item) => item.runId === ended.id).length, 'fragments are not copied twice');
});

test('causality resolves, pending reload is stable, merged sources stay distinct', () => {
  const run = playUntilRecall(findOpeningChoice('trust_broken_cup', 'confess'));
  assertEqual(causalityHasCycle(run, createInitialProfile()), false, 'fragment graph should not cycle');
  for (const fragment of run.fragments.filter((item) => item.runId === run.id)) {
    const record = getCausality(run, createInitialProfile(), fragment.id);
    assert(record, `fragment ${fragment.id} should be readable`);
    for (const person of record!.people) {
      assert(fragment.people.some((item) => item.relationId === person.id), 'causality people match the fragment');
    }
  }
  const snapshot = parseGameSave({
    version: SAVE_VERSION,
    profile: createInitialProfile(),
    currentRun: clone(run),
  });
  assert(snapshot?.currentRun, 'pending recall should reload');
  assertEqual(snapshot!.currentRun!.pendingRecall?.instanceId, run.pendingRecall?.instanceId, 'reload keeps recall id');
  assertEqual(snapshot!.currentRun!.rngState, run.rngState, 'reload keeps rng');
  assertEqual(snapshot!.currentRun!.lifePoints, run.lifePoints, 'reload keeps points');

  const ended = playToEnd(run, 1);
  const archived = completeArchive(createInitialProfile(), ended);
  const secondLife = playToEnd(startLife(archived.profile, 88, 'life-b', archived.profile.understandings.slice(0, 1).map((item) => item.id), GAME_CONTENT), 2);
  const merged = completeArchive(archived.profile, secondLife);
  for (const discovery of merged.profile.discoveries) {
    const runs = new Set(discovery.sources.map((item) => item.runId));
    if (runs.size > 1) {
      const peopleByRun = new Map<string, string>();
      for (const source of discovery.sources) {
        peopleByRun.set(`${source.runId}:${source.fragmentId}`, source.personLabels.join(','));
      }
      assert(peopleByRun.size === discovery.sources.length, 'merged discoveries keep per-life source identities');
    }
  }
});

test('three lives can carry understanding without a level gate', () => {
  let profile = createInitialProfile();
  const statements: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const carry = profile.understandings.slice(0, 2).map((item) => item.id);
    let run = startLife(profile, 30 + index * 17, `chain-${index}`, carry, GAME_CONTENT);
    if (carry.length > 0) {
      assert(run.carriedUnderstandingIds.length === carry.length, 'carried ids are accepted');
      assert(run.lifePoints === 2, 'carrying understanding does not raise life points');
      assert(run.tags.some((tag) => tag.startsWith('carried:')), 'carried understanding is visible to later responses');
    }
    run = playToEnd(run, index);
    const archived = completeArchive(profile, run);
    profile = archived.profile;
    if (run.understandings[0]) {
      statements.push(run.understandings[run.understandings.length - 1].statement);
    }
  }
  assertEqual(profile.archivedRunIds.length, 3, 'three lives archive');
  assert(profile.understandings.length > 0, 'understandings accumulate');
  assert(statements.length > 0, 'each life can form meaning without grinding a level');
});

test('1000 deterministic lives close without dead ends or repeated templates', () => {
  let recalls = 0;
  for (let seed = 1; seed <= 1000; seed += 1) {
    const run = playToEnd(startSeed(seed, [], `sim-${seed}`), seed);
    assert(run.status === 'awaiting-archive', `seed ${seed} should close for archive`);
    const own = run.fragments.filter((item) => item.runId === run.id);
    assert(own.length >= 6 && own.length <= 8, `seed ${seed} should have 6-8 encounters, got ${own.length}`);
    assertEqual(new Set(own.map((item) => item.templateId)).size, own.length, `seed ${seed} repeated a template`);
    assert(run.recallCount === 2, `seed ${seed} should recall twice`);
    assert(run.closing, `seed ${seed} needs a closing`);
    if (run.scheduled.some((item) => !run.usedTemplateIds.includes(item.templateId))) {
      assert((run.closing?.unfulfilled.length ?? 0) > 0, `seed ${seed} must explain unfulfilled consequences`);
    }
    recalls += run.recallCount;
  }
  assert(recalls === 2000, 'every life recalls twice');
});

test('obsolete save keys are cleared, other data and valid v3 remain', () => {
  const store = new MemoryStore();
  store.setItem('reincarnation-life.save.v1', '{"old":1}');
  store.setItem('reincarnation-life.save.v2', '{"old":2}');
  store.setItem('reincarnation-life.save.backup', '{"old":3}');
  store.setItem('other-app.save', 'keep-me');
  const first = new GameService(store, () => 11);
  for (const key of OBSOLETE_SAVE_KEYS) {
    assertEqual(store.getItem(key), null, `${key} should be removed`);
  }
  assertEqual(store.getItem('other-app.save'), 'keep-me', 'unrelated storage stays');
  first.startNewLife([]);
  const pending = first.getCurrentRun()?.pendingEncounter;
  assert(pending, 'a new life should freeze an encounter');
  const v3 = store.getItem(CURRENT_SAVE_KEY);
  assert(v3, 'v3 save should exist');
  const second = new GameService(store, () => 99);
  const reloaded = second.getCurrentRun();
  assertEqual(reloaded?.pendingEncounter?.instanceId, pending?.instanceId, 'second boot continues the same pending encounter');
  assertEqual(reloaded?.pendingEncounter?.options.map((item) => `${item.choiceId}:${item.cost}`).join(','), pending?.options.map((item) => `${item.choiceId}:${item.cost}`).join(','), 'reload does not change prices');
  const beforeInspect = reloaded!.rngState;
  second.inspectCausality(reloaded!.fragments[0]?.id ?? pending!.instanceId);
  assertEqual(second.getCurrentRun()?.rngState, beforeInspect, 'inspecting causality does not change rng');
});

test('presentation: options, disabled costs, expandable copy, and routing', () => {
  const run = startSeed(5);
  assertEqual(routePlayPage(run), 'encounter', 'an opening life routes to the encounter page');
  const view = presentEncounter(run, GAME_CONTENT, null);
  assertEqual(view.options.length, run.pendingEncounter?.options.length, 'presenter keeps every option');
  assert(view.options.filter((item) => item.cost === 0).length >= 2, 'presenter shows free options');
  const story = presentStoryText('这是一段足够长的叙述，用来确认展开全文的入口会出现在界面上，而不是把字越缩越小。', 20);
  assertEqual(story.expandable, true, 'long copy is expandable');
  const home = presentHome(createInitialProfile(), null);
  assertEqual(home.runStatus, 'none', 'empty profile is ready to start');
});

test('application commands lock duplicate archive and start rules', () => {
  const store = new MemoryStore();
  let n = 3;
  const service = new GameService(store, () => {
    n += 1;
    return n;
  });
  service.startNewLife([]);
  assertThrows(() => service.startNewLife([]), 'cannot start while a life is active');
  let guard = 0;
  while (service.getCurrentRun()?.status === 'active' && guard < 40) {
    const current = service.getCurrentRun();
    if (current?.pendingEncounter) {
      const option = pickOption(current.pendingEncounter.options, 0, current.lifePoints);
      service.submitCurrentResponse(option.choiceId);
    } else if (current?.pendingRecall) {
      service.submitCurrentRecall('question');
    } else {
      break;
    }
    guard += 1;
  }
  assertEqual(service.getCurrentRun()?.status, 'awaiting-archive', 'service reaches archive');
  service.archiveCurrentLife();
  service.archiveCurrentLife();
  assertEqual(service.getProfile().archivedRunIds.length, 1, 'service archive is idempotent');
});

function findOpeningChoice(templateId: string, choiceId: string): LifeRun {
  for (let seed = 1; seed <= 300; seed += 1) {
    const run = startSeed(seed, [], `open-${templateId}-${seed}`);
    if (run.pendingEncounter?.templateId === templateId) {
      return submitResponse(run, run.pendingEncounter.instanceId, choiceId, GAME_CONTENT);
    }
  }
  throw new Error(`No seed opened ${templateId}`);
}

function playUntilTemplate(run: LifeRun, templateId: string): LifeRun | null {
  let current = run;
  for (let step = 0; step < 24 && current.status === 'active'; step += 1) {
    if (current.pendingEncounter?.templateId === templateId) {
      return current;
    }
    if (current.pendingEncounter) {
      const option = pickOption(current.pendingEncounter.options, 0, current.lifePoints);
      current = submitResponse(current, current.pendingEncounter.instanceId, option.choiceId, GAME_CONTENT);
    } else if (current.pendingRecall) {
      current = submitRecall(current, current.pendingRecall.instanceId, 'revise', GAME_CONTENT);
    } else {
      break;
    }
  }
  return current.pendingEncounter?.templateId === templateId ? current : null;
}

function playUntilRecall(run: LifeRun): LifeRun {
  let current = run;
  for (let step = 0; step < 16 && current.status === 'active'; step += 1) {
    if (current.pendingRecall) {
      return current;
    }
    if (current.pendingEncounter) {
      const option = pickOption(current.pendingEncounter.options, 0, current.lifePoints);
      current = submitResponse(current, current.pendingEncounter.instanceId, option.choiceId, GAME_CONTENT);
    }
  }
  throw new Error('Did not reach a recall');
}

function drainToZero(run: LifeRun): LifeRun {
  let current = run;
  for (let step = 0; step < 24 && current.status === 'active'; step += 1) {
    if (current.lifePoints === 0 && (current.pendingEncounter || current.pendingRecall)) {
      return current;
    }
    if (current.pendingEncounter) {
      const paid = [...current.pendingEncounter.options]
        .filter((item) => item.enabled && item.cost > 0 && item.cost <= current.lifePoints)
        .sort((left, right) => right.cost - left.cost)[0];
      const free = current.pendingEncounter.options.find((item) => item.enabled && item.cost === 0);
      const choice = paid ?? free;
      if (!choice) {
        break;
      }
      current = submitResponse(current, current.pendingEncounter.instanceId, choice.choiceId, GAME_CONTENT);
      continue;
    }
    if (current.pendingRecall) {
      current = submitRecall(current, current.pendingRecall.instanceId, 'hold', GAME_CONTENT);
    }
  }
  return current;
}

function runAll(): void {
  let failed = 0;
  for (const item of tests) {
    try {
      item.run();
      console.log(`ok  ${item.name}`);
    } catch (error) {
      failed += 1;
      console.error(`fail  ${item.name}`);
      console.error(error);
    }
  }
  console.log(`${tests.length - failed}/${tests.length} passed`);
  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
}

runAll();
