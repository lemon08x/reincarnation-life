import { GameContent, LifeEventConfig } from './model';

export function validateGameContent(content: GameContent): string[] {
  const errors: string[] = [];
  validateUniqueIds('talent', content.talents.map((item) => item.id), errors);
  validateUniqueIds('family', content.families.map((item) => item.id), errors);
  validateUniqueIds('event', content.events.map((item) => item.id), errors);
  validateUniqueIds('ending', content.endings.map((item) => item.id), errors);
  validateUniqueIds('stage', content.stages.map((item) => item.id), errors);
  validateUniqueIds('legacy', content.legacies.map((item) => item.id), errors);

  const eventIds = new Set(content.events.map((event) => event.id));
  for (const event of content.events) {
    validateEvent(event, eventIds, errors);
  }

  const orderedStages = [...content.stages].sort((left, right) => left.minAge - right.minAge);
  let expectedStageAge = 0;
  for (const stage of orderedStages) {
    if (stage.minAge !== expectedStageAge) {
      errors.push(`Life stage ${stage.id} should start at age ${expectedStageAge}.`);
    }
    if (stage.maxAge < stage.minAge) {
      errors.push(`Life stage ${stage.id} has an invalid age range.`);
    }
    if (stage.focuses.length < 2) {
      errors.push(`Life stage ${stage.id} needs at least two focus choices.`);
    }
    validateUniqueIds(`focus in ${stage.id}`, stage.focuses.map((focus) => focus.id), errors);
    expectedStageAge = stage.maxAge + 1;
  }
  if (expectedStageAge <= 100) {
    errors.push('Life stages do not cover age 100.');
  }

  for (let age = 1; age <= 100; age += 1) {
    const hasFallback = content.events.some((event) => (
      age >= event.minAge
      && age <= event.maxAge
      && !event.condition
      && (event.unlockLevel ?? 1) <= 1
    ));
    if (!hasFallback) {
      errors.push(`No level-one fallback event covers age ${age}.`);
    }
  }

  const genericLevelOneRewards = content.legacies.filter((legacy) => (
    legacy.unlockLevel <= 1 && !legacy.condition
  ));
  if (genericLevelOneRewards.length < 3) {
    errors.push('At least three unconditional rewards must be available at level one.');
  }

  return errors;
}

export function assertValidGameContent(content: GameContent): void {
  const errors = validateGameContent(content);
  if (errors.length > 0) {
    throw new Error(`Invalid game content:\n${errors.join('\n')}`);
  }
}

function validateEvent(
  event: LifeEventConfig,
  eventIds: Set<string>,
  errors: string[],
): void {
  if (event.minAge < 1 || event.maxAge > 100 || event.minAge > event.maxAge) {
    errors.push(`Event ${event.id} has an invalid age range.`);
  }
  if (event.weight < 0) {
    errors.push(`Event ${event.id} has a negative weight.`);
  }
  if (!event.choices) {
    return;
  }
  if (event.choices.length < 2) {
    errors.push(`Decision event ${event.id} needs at least two choices.`);
  }
  validateUniqueIds(`choice in ${event.id}`, event.choices.map((choice) => choice.id), errors);
  for (const choice of event.choices) {
    if (choice.outcomes.length === 0) {
      errors.push(`Choice ${event.id}:${choice.id} needs at least one outcome.`);
    }
    validateUniqueIds(
      `outcome in ${event.id}:${choice.id}`,
      choice.outcomes.map((outcome) => outcome.id),
      errors,
    );
    for (const outcome of choice.outcomes) {
      for (const scheduled of outcome.schedule ?? []) {
        if (!eventIds.has(scheduled.eventId)) {
          errors.push(
            `Outcome ${event.id}:${choice.id}:${outcome.id} schedules unknown event ${scheduled.eventId}.`,
          );
        }
        if (scheduled.afterYears < 1) {
          errors.push(`Scheduled event ${scheduled.eventId} must occur at least one year later.`);
        }
      }
    }
  }
}

function validateUniqueIds(label: string, ids: string[], errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`Duplicate ${label} id: ${id}.`);
    }
    seen.add(id);
  }
}
