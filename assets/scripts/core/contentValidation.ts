import {
  EncounterTemplate,
  GameContent,
  LIFE_THEMES,
} from './model';

export function validateGameContent(content: GameContent): string[] {
  const errors: string[] = [];
  validateUniqueIds('family', content.families.map((item) => item.id), errors);
  validateUniqueIds('temperament', content.temperaments.map((item) => item.id), errors);
  validateUniqueIds('encounter', content.encounters.map((item) => item.id), errors);
  validateUniqueIds('understanding', content.understandingSeeds.map((item) => item.id), errors);
  validateUniqueIds('mark', content.marks.map((item) => item.id), errors);
  validateUniqueIds('region', content.regions.map((item) => item.id), errors);
  validateUniqueIds('figure', content.figures.map((item) => item.id), errors);

  if (content.encounters.length !== 30) {
    errors.push(`Expected 30 encounter templates, found ${content.encounters.length}.`);
  }
  if (content.families.length < 3) {
    errors.push('At least three families are required.');
  }
  if (content.temperaments.length < 2) {
    errors.push('At least two temperaments are required.');
  }
  if (content.understandingSeeds.length < 3) {
    errors.push('At least three understanding seeds are required.');
  }

  const encounterIds = new Set(content.encounters.map((item) => item.id));
  const seedIds = new Set(content.understandingSeeds.map((item) => item.id));
  const markIds = new Set(content.marks.map((item) => item.id));

  for (const theme of LIFE_THEMES) {
    const count = content.encounters.filter((item) => item.theme === theme && !item.crossThemes).length;
    if (count !== 8) {
      errors.push(`Theme ${theme} should have 8 dedicated nodes, found ${count}.`);
    }
  }
  for (let chapter = 0; chapter < 4; chapter++) {
    for (const theme of LIFE_THEMES) {
      if (content.encounters.filter(t => t.chapter === chapter && t.theme === theme && !t.crossThemes).length < 2) {
        errors.push(`Chapter ${chapter} must have two independent ${theme} scenes.`);
      }
    }
  }
  const crossovers = content.encounters.filter((item) => (item.crossThemes?.length ?? 0) > 0);
  if (crossovers.length !== 6) {
    errors.push(`Expected 6 crossover encounters, found ${crossovers.length}.`);
  }

  for (const encounter of content.encounters) {
    validateEncounter(encounter, encounterIds, seedIds, errors);
    if (encounter.chapter > 0 && !encounter.questionChoice) errors.push(`${encounter.id} needs a situated question response.`);
    const roles = Array.from(JSON.stringify(encounter).matchAll(/\{(\w+)\}/g)).map(m => m[1]);
    for (const role of roles) if (!encounter.people.some(p => p.role === role)) errors.push(`${encounter.id} has an unbound person: ${role}`);
    for (const choice of encounter.choices) for (const outcome of choice.outcomes) for (const scheduled of outcome.schedule ?? []) {
      const target = content.encounters.find(t => t.id === scheduled.templateId);
      if (target && (target.chapter <= encounter.chapter || encounter.maxAge + scheduled.afterYears > target.maxAge
        || encounter.minAge + scheduled.afterYears + (scheduled.windowYears ?? 8) < target.minAge)) errors.push(`${encounter.id} has an unreachable later callback: ${target.id}`);
    }
  }

  for (const family of content.families) {
    for (const mark of family.grantMarks ?? []) {
      if (!markIds.has(mark.id)) {
        errors.push(`Family ${family.id} grants unknown mark ${mark.id}.`);
      }
    }
    if (family.weight <= 0) {
      errors.push(`Family ${family.id} needs a positive weight.`);
    }
  }
  for (const temperament of content.temperaments) {
    for (const mark of temperament.grantMarks ?? []) {
      if (!markIds.has(mark.id)) {
        errors.push(`Temperament ${temperament.id} grants unknown mark ${mark.id}.`);
      }
    }
  }
  for (const seed of content.understandingSeeds) {
    if (!seed.matureRevised || !seed.matureQuestion) errors.push(`${seed.id} needs an understanding that can grow at the later recall.`);
    if (!seed.initial || !seed.revised || !seed.question) {
      errors.push(`Understanding ${seed.id} needs initial, revised, and question statements.`);
    }
    if (seed.anyFragmentTags.length === 0) {
      errors.push(`Understanding ${seed.id} needs fragment tags.`);
    }
  }
  for (const figure of content.figures) {
    if (!content.regions.some((region) => region.id === figure.region)) {
      errors.push(`Figure ${figure.id} uses unknown region ${figure.region}.`);
    }
  }

  return errors;
}

export function assertValidGameContent(content: GameContent): void {
  const errors = validateGameContent(content);
  if (errors.length > 0) {
    throw new Error(`Invalid game content:\n${errors.join('\n')}`);
  }
}

function validateEncounter(
  encounter: EncounterTemplate,
  encounterIds: Set<string>,
  seedIds: Set<string>,
  errors: string[],
): void {
  if (!Number.isInteger(encounter.chapter) || encounter.chapter < 0 || encounter.chapter > 3) errors.push(`Invalid chapter: ${encounter.id}`);
  if (encounter.minAge > encounter.maxAge) {
    errors.push(`Encounter ${encounter.id} has an invalid age range.`);
  }
  if (encounter.years < 1) {
    errors.push(`Encounter ${encounter.id} should skip at least one year.`);
  }
  if (encounter.choices.length < 2 || encounter.choices.length > 4) {
    errors.push(`Encounter ${encounter.id} must offer 2-4 choices.`);
  }
  const free = encounter.choices.filter((choice) => choice.costKind === 'free');
  if (free.length < 2) {
    errors.push(`Encounter ${encounter.id} needs at least two free choices.`);
  }
  validateUniqueIds(`choice in ${encounter.id}`, encounter.choices.map((item) => item.id), errors);
  if (encounter.people.length === 0) {
    errors.push(`Encounter ${encounter.id} needs person bindings.`);
  }

  for (const choice of [...encounter.choices, ...(encounter.questionChoice ? [encounter.questionChoice] : [])]) {
    if (choice.outcomes.length < 1) {
      errors.push(`Choice ${encounter.id}/${choice.id} needs an outcome.`);
    }
    if (choice.fragmentTags.length === 0) {
      errors.push(`Choice ${encounter.id}/${choice.id} needs fragment tags.`);
    }
    if (choice.support?.understandingIds) {
      for (const id of choice.support.understandingIds) {
        if (!seedIds.has(id)) {
          errors.push(`Choice ${encounter.id}/${choice.id} references unknown understanding ${id}.`);
        }
      }
    }
    for (const outcome of choice.outcomes) {
      if (!hasConsequence(outcome.world) || !outcome.later) {
        errors.push(`Outcome ${encounter.id}/${choice.id}/${outcome.id} must change the world and name a later consequence.`);
      }
      if (outcome.weight <= 0) {
        errors.push(`Outcome ${encounter.id}/${choice.id}/${outcome.id} needs a positive weight.`);
      }
      for (const scheduled of outcome.schedule ?? []) {
        if (!encounterIds.has(scheduled.templateId)) {
          errors.push(`Outcome ${encounter.id}/${choice.id}/${outcome.id} schedules unknown ${scheduled.templateId}.`);
        }
        if (scheduled.templateId === encounter.id) {
          errors.push(`Outcome ${encounter.id}/${choice.id}/${outcome.id} cannot schedule itself.`);
        }
      }
    }
  }
}

function hasConsequence(world: EncounterTemplate['choices'][number]['outcomes'][number]['world']): boolean {
  return Boolean(
    (world.addTags && world.addTags.length > 0)
    || (world.setFacts && Object.keys(world.setFacts).length > 0)
    || (world.clearFacts && world.clearFacts.length > 0)
    || (world.relations && world.relations.length > 0)
    || (world.threads && world.threads.length > 0)
    || (world.marks && world.marks.length > 0),
  );
}

function validateUniqueIds(label: string, ids: string[], errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) {
      errors.push(`${label} contains an empty id.`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`Duplicate ${label} id: ${id}.`);
    }
    seen.add(id);
  }
}
