import teammatesJson from "@/config/teammates.json";
import { practiceVignettes, studySettings } from "@/lib/studyConfig";

export const teammateNames = teammatesJson.names as string[];
export const teammateConfig = teammatesJson;
export const nonAiVignetteIds = practiceVignettes.map((vignette) => vignette.id);

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

function pickNonAiVignette(
  pid: string,
  seedSuffix: string,
  excludedIds: readonly string[] = [],
): string {
  const options = nonAiVignetteIds.filter((id) => !excludedIds.includes(id));
  const pool = options.length > 0 ? options : nonAiVignetteIds;
  const rng = createRng(hashSeed(`${pid}:${seedSuffix}`));
  return pool[Math.floor(rng() * pool.length)] ?? pool[0];
}

/**
 * Expands the eight counterbalanced AI vignettes into ten main scenarios:
 * 1. non-AI, 2. AI, 3–10. seven AI plus one non-AI at a random slot.
 */
export function buildExpandedScenarioOrder(
  pid: string,
  aiOrder: readonly string[],
): string[] {
  const expectedAiCount = studySettings.aiVignettesPerParticipant;
  const expectedTotal = studySettings.vignettesPerParticipant;

  if (aiOrder.length !== expectedAiCount) {
    throw new Error(
      `Expected ${expectedAiCount} AI vignettes but received ${aiOrder.length}.`,
    );
  }

  const firstNonAi = pickNonAiVignette(pid, "non-ai-1");
  const secondNonAi = pickNonAiVignette(pid, "non-ai-2", [firstNonAi]);
  const slotRng = createRng(hashSeed(`${pid}:non-ai-2-slot`));
  const secondNonAiIndex = 2 + Math.floor(slotRng() * (expectedTotal - 2));

  const order = new Array<string>(expectedTotal);
  order[0] = firstNonAi;
  order[1] = aiOrder[0];

  let aiIndex = 1;
  for (let index = 2; index < expectedTotal; index += 1) {
    if (index === secondNonAiIndex) {
      order[index] = secondNonAi;
    } else {
      order[index] = aiOrder[aiIndex];
      aiIndex += 1;
    }
  }

  return order;
}

export function isNonAiVignetteId(vignetteId: string): boolean {
  return nonAiVignetteIds.includes(vignetteId);
}

export interface ScenarioAssignment {
  vignetteId: string;
  /** -1 or 0 for non-AI; 1–8 for AI scenarios. */
  apiPosition: number;
  isPractice: boolean;
}

/** Maps the ten-scenario display order to database vignette numbers. */
export function buildScenarioAssignments(
  pid: string,
  aiOrder: readonly string[],
): ScenarioAssignment[] {
  const displayOrder = buildExpandedScenarioOrder(pid, aiOrder);
  let aiNumber = 0;
  let nonAiNumber = 0;

  return displayOrder.map((vignetteId) => {
    if (isNonAiVignetteId(vignetteId)) {
      nonAiNumber += 1;
      return {
        vignetteId,
        apiPosition: nonAiNumber === 1 ? -1 : 0,
        isPractice: true,
      };
    }

    aiNumber += 1;
    return {
      vignetteId,
      apiPosition: aiNumber,
      isPractice: false,
    };
  });
}
