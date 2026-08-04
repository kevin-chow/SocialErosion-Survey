import { readFileSync, writeFileSync } from "node:fs";

const participantCount = 500;
const vignettesPerParticipant = 8;
const vignettes = JSON.parse(
  readFileSync(new URL("../config/vignettes.json", import.meta.url), "utf8"),
);

const taskTypes = [
  "information-seeking",
  "brainstorming",
  "feedback",
  "validation",
];
const factorKeys = ["ai_role", "knowledge_type", "impact_level"];
const lowLevels = ["supporting", "generic", "personal"];

function binaryCode(vignette) {
  return factorKeys
    .map((key, index) =>
      vignette.metadata[key] === lowLevels[index] ? "0" : "1",
    )
    .join("");
}

const complementaryPairs = [
  ["000", "111"],
  ["001", "110"],
  ["010", "101"],
  ["011", "100"],
];

const byTaskAndCode = new Map(
  vignettes.map((vignette) => [
    `${vignette.metadata.task_type}:${binaryCode(vignette)}`,
    vignette.id,
  ]),
);

function selectedVignettes(slotIndex) {
  return taskTypes.flatMap((taskType, taskIndex) => {
    const pair =
      complementaryPairs[(slotIndex + taskIndex * 2) % complementaryPairs.length];
    return pair.map((code) => {
      const id = byTaskAndCode.get(`${taskType}:${code}`);
      if (!id) throw new Error(`Missing ${taskType}:${code}.`);
      return id;
    });
  });
}

function* permutations(values, prefix = []) {
  if (values.length === 0) {
    yield prefix;
    return;
  }
  for (let index = 0; index < values.length; index += 1) {
    yield* permutations(
      [...values.slice(0, index), ...values.slice(index + 1)],
      [...prefix, values[index]],
    );
  }
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260804);
const positionCounts = Object.fromEntries(
  vignettes.map((vignette) => [
    vignette.id,
    Array(vignettesPerParticipant).fill(0),
  ]),
);

const orders = [];
for (let slotIndex = 0; slotIndex < participantCount; slotIndex += 1) {
  const selected = selectedVignettes(slotIndex);
  let bestOrder;
  let bestCost = Number.POSITIVE_INFINITY;
  let ties = 0;

  for (const candidate of permutations(selected)) {
    const cost = candidate.reduce(
      (sum, id, position) => sum + positionCounts[id][position],
      0,
    );
    if (cost < bestCost) {
      bestCost = cost;
      bestOrder = candidate;
      ties = 1;
    } else if (cost === bestCost) {
      ties += 1;
      if (random() < 1 / ties) bestOrder = candidate;
    }
  }

  bestOrder.forEach((id, position) => {
    positionCounts[id][position] += 1;
  });
  orders.push({ slot: slotIndex + 1, vignetteIds: bestOrder });
}

const exposureCounts = Object.fromEntries(
  vignettes.map((vignette) => [vignette.id, 0]),
);
for (const order of orders) {
  for (const id of order.vignetteIds) exposureCounts[id] += 1;
}

const expectedExposures =
  (participantCount * vignettesPerParticipant) / vignettes.length;
for (const [id, count] of Object.entries(exposureCounts)) {
  if (count !== expectedExposures) {
    throw new Error(
      `${id} has ${count} exposures instead of ${expectedExposures}.`,
    );
  }
  const positions = positionCounts[id];
  if (Math.max(...positions) - Math.min(...positions) > 1) {
    throw new Error(`${id} has unbalanced positions: ${positions.join(", ")}.`);
  }
}

const output = {
  design: "balanced-eight-of-32",
  plannedParticipants: participantCount,
  vignettesPerParticipant,
  exposuresPerVignette: expectedExposures,
  orders,
};

writeFileSync(
  new URL("../config/counterbalance.json", import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`,
);

console.log(
  `Wrote ${orders.length} orders; ${expectedExposures} exposures per vignette.`,
);
