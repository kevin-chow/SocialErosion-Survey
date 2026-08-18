import teammatesJson from "@/config/teammates.json";

export const teammateNames = teammatesJson.names as string[];
export const teammateConfig = teammatesJson;

export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed: number) {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(rng() * (index + 1));
    [items[index], items[swapWith]] = [items[swapWith], items[index]];
  }
  return items;
}

export function selectSeededSubset<T>(
  seedInput: string,
  options: readonly T[],
  count: number,
): T[] {
  const rng = createRng(hashSeed(seedInput));
  const remaining = [...options];
  const selected: T[] = [];

  while (selected.length < count && remaining.length > 0) {
    const selectedIndex = Math.floor(rng() * remaining.length);
    selected.push(remaining.splice(selectedIndex, 1)[0]);
  }

  return selected;
}

export function buildShuffledQuestionOrder(
  pid: string,
  questionIds: readonly string[],
): string[] {
  if (questionIds.length !== 6) {
    return [...questionIds];
  }

  const rng = createRng(hashSeed(`${pid}:questions`));
  const block1 = shuffleInPlace(questionIds.slice(0, 3), rng);
  const block2 = shuffleInPlace(questionIds.slice(3, 6), rng);
  return rng() < 0.5 ? [...block1, ...block2] : [...block2, ...block1];
}

export function buildTeammateCycle(
  pid: string,
  names: readonly string[] = teammateNames,
): string[] {
  const rng = createRng(hashSeed(`${pid}:teammates`));
  return shuffleInPlace([...names], rng);
}

export function teammateForStep(
  cycle: readonly string[],
  stepIndex: number,
): string {
  return cycle[stepIndex % cycle.length] ?? teammateNames[0];
}

export function applyTeammateName(text: string, name: string): string {
  return text
    .replaceAll("{teammatePossessive}", `${name}’s`)
    .replaceAll("{teammate}", name)
    .replaceAll("Sam’s", `${name}’s`)
    .replaceAll("Sam's", `${name}'s`)
    .replaceAll("Sam", name);
}
