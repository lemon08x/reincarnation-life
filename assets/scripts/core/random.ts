export interface RandomStep {
  state: number;
  value: number;
}

const UINT32_RANGE = 0x1_0000_0000;

export function normalizeSeed(seed: number): number {
  const normalized = Number.isFinite(seed) ? seed >>> 0 : 1;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

export function nextRandom(state: number): RandomStep {
  const nextState = (Math.imul(normalizeSeed(state), 1664525) + 1013904223) >>> 0;
  return {
    state: nextState,
    value: nextState / UINT32_RANGE,
  };
}

export function pickWeighted<T>(
  items: readonly T[],
  state: number,
  getWeight: (item: T) => number,
): { item: T; state: number } {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty collection.');
  }

  const positiveWeights = items.map((item) => Math.max(0, getWeight(item)));
  const totalWeight = positiveWeights.reduce((sum, weight) => sum + weight, 0);
  const step = nextRandom(state);

  if (totalWeight <= 0) {
    const index = Math.min(items.length - 1, Math.floor(step.value * items.length));
    return { item: items[index], state: step.state };
  }

  let cursor = step.value * totalWeight;
  for (let index = 0; index < items.length; index += 1) {
    cursor -= positiveWeights[index];
    if (cursor < 0) {
      return { item: items[index], state: step.state };
    }
  }

  return { item: items[items.length - 1], state: step.state };
}

export function sampleUnique<T>(
  items: readonly T[],
  count: number,
  state: number,
): { items: T[]; state: number } {
  const pool = [...items];
  const result: T[] = [];
  let nextState = normalizeSeed(state);

  while (result.length < count && pool.length > 0) {
    const step = nextRandom(nextState);
    nextState = step.state;
    const index = Math.min(pool.length - 1, Math.floor(step.value * pool.length));
    result.push(pool.splice(index, 1)[0]);
  }

  return { items: result, state: nextState };
}
