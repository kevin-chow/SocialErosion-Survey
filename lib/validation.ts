import type {
  CounterbalanceConfig,
  SharedQuestionConfig,
  StudySettings,
  VignetteCondition,
} from "@/types/study";

const EXPECTED_IDS = Array.from(
  { length: 32 },
  (_, index) => `v${String(index + 1).padStart(2, "0")}`,
);

function requireText(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`${label} must not be empty.`);
  }
}

export function validateStudyConfig(
  settings: StudySettings,
  vignettes: VignetteCondition[],
  questionConfig: SharedQuestionConfig,
  counterbalanceConfig: CounterbalanceConfig,
): void {
  if (settings.totalVignettes !== 32 || vignettes.length !== 32) {
    throw new Error("Study configuration must contain exactly 32 vignettes.");
  }

  if (settings.questionsPerVignette !== 6) {
    throw new Error("questionsPerVignette must equal 6.");
  }

  if (settings.vignettesPerParticipant !== 10) {
    throw new Error("vignettesPerParticipant must equal 10.");
  }

  if (settings.aiVignettesPerParticipant !== 8) {
    throw new Error("aiVignettesPerParticipant must equal 8.");
  }

  const ids = vignettes.map((vignette) => vignette.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Vignette IDs must be unique.");
  }

  if (EXPECTED_IDS.some((id, index) => ids[index] !== id)) {
    throw new Error("Vignette IDs must run in order from v01 through v32.");
  }

  if (
    questionConfig.questions.length !== settings.questionsPerVignette ||
    questionConfig.scale.length < 2
  ) {
    throw new Error(
      "The shared question configuration must contain six questions and a response scale.",
    );
  }

  const expectedColumns = [
    "q1_value_feedback",
    "q2_seek_feedback",
    "q3_incorporate_feedback",
    "q4_comfortable_feedback",
    "q5_express_frustrations",
    "q6_rather_work_without",
  ];
  const responseColumns = questionConfig.questions.map(
    (question) => question.responseColumn,
  );
  if (
    new Set(responseColumns).size !== expectedColumns.length ||
    expectedColumns.some((column, index) => responseColumns[index] !== column)
  ) {
    throw new Error(
      "Question response columns must match the database schema in order.",
    );
  }

  for (const question of questionConfig.questions) {
    requireText(question.id, "Question ID");
    const questionText =
      question.segments?.map((segment) => segment.text).join("") ??
      question.text ??
      "";
    requireText(questionText, `${question.id} text`);
  }
  for (const option of questionConfig.scale) {
    requireText(String(option.value), "Scale value");
    requireText(option.label, "Scale label");
  }

  if (settings.assignmentMode === "counterbalanced") {
    if (
      counterbalanceConfig.plannedParticipants !== 500 ||
      counterbalanceConfig.orders.length !== 500 ||
      counterbalanceConfig.vignettesPerParticipant !==
        settings.aiVignettesPerParticipant
    ) {
      throw new Error(
        "Counterbalance configuration must contain 500 eight-vignette AI orders.",
      );
    }

    const vignetteById = new Map(
      vignettes.map((vignette) => [vignette.id, vignette]),
    );
    const exposures = new Map(ids.map((id) => [id, 0]));
    const positionCounts = new Map(
      ids.map((id) => [
        id,
        Array(settings.aiVignettesPerParticipant).fill(0) as number[],
      ]),
    );

    counterbalanceConfig.orders.forEach((order, orderIndex) => {
      if (
        order.slot !== orderIndex + 1 ||
        order.vignetteIds.length !== settings.aiVignettesPerParticipant ||
        new Set(order.vignetteIds).size !== order.vignetteIds.length
      ) {
        throw new Error(`Counterbalance slot ${orderIndex + 1} is invalid.`);
      }

      const assignedVignettes = order.vignetteIds.map((id, position) => {
        const vignette = vignetteById.get(id);
        if (!vignette) {
          throw new Error(`Counterbalance order contains unknown ID ${id}.`);
        }
        exposures.set(id, (exposures.get(id) ?? 0) + 1);
        positionCounts.get(id)![position] += 1;
        return vignette;
      });

      const taskCounts = new Map<string, number>();
      for (const vignette of assignedVignettes) {
        const taskType = String(vignette.metadata?.task_type);
        taskCounts.set(taskType, (taskCounts.get(taskType) ?? 0) + 1);
      }
      if (
        taskCounts.size !== 4 ||
        [...taskCounts.values()].some((count) => count !== 2)
      ) {
        throw new Error(
          `Counterbalance slot ${order.slot} must include two of each task type.`,
        );
      }

      for (const factor of ["ai_role", "knowledge_type", "impact_level"]) {
        const factorCounts = new Map<string, number>();
        for (const vignette of assignedVignettes) {
          const value = String(vignette.metadata?.[factor]);
          factorCounts.set(value, (factorCounts.get(value) ?? 0) + 1);
        }
        if (
          factorCounts.size !== 2 ||
          [...factorCounts.values()].some((count) => count !== 4)
        ) {
          throw new Error(
            `Counterbalance slot ${order.slot} does not balance ${factor}.`,
          );
        }
      }

      const binaryCodes = new Set(
        assignedVignettes.map((vignette) =>
          ["ai_role", "knowledge_type", "impact_level"]
            .map((factor, index) => {
              const lowLevels = ["supporting", "generic", "personal"];
              return vignette.metadata?.[factor] === lowLevels[index]
                ? "0"
                : "1";
            })
            .join(""),
        ),
      );
      if (binaryCodes.size !== 8) {
        throw new Error(
          `Counterbalance slot ${order.slot} must include all eight binary factor combinations.`,
        );
      }
    });

    for (const id of ids) {
      if (exposures.get(id) !== counterbalanceConfig.exposuresPerVignette) {
        throw new Error(`${id} does not have the expected exposure count.`);
      }
      const counts = positionCounts.get(id)!;
      if (Math.max(...counts) - Math.min(...counts) > 1) {
        throw new Error(`${id} is not balanced across vignette positions.`);
      }
    }
  }

  for (const vignette of vignettes) {
    requireText(vignette.id, "Vignette ID");
    requireText(vignette.slug, `${vignette.id} slug`);
    requireText(vignette.title, `${vignette.id} title`);
    requireText(vignette.body, `${vignette.id} body`);
    requireText(vignette.conditionLabel, `${vignette.id} conditionLabel`);

    const serialized = JSON.stringify(vignette).toLowerCase();
    if (
      serialized.includes("api_token") ||
      serialized.includes("api-key") ||
      serialized.includes("private_key")
    ) {
      throw new Error(`${vignette.id} may contain a secret.`);
    }
  }
}
