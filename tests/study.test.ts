import { describe, expect, it } from "vitest";
import {
  counterbalanceConfig,
  getPracticeVignetteById,
  getVignetteById,
  practiceVignettes,
  questionConfig,
  studySettings,
  vignettes,
} from "@/lib/studyConfig";
import {
  buildResponseRow,
  SubmissionValidationError,
} from "@/lib/submission";
import {
  applyTeammateName,
  buildExpandedScenarioOrder,
  buildShuffledQuestionOrder,
  buildTeammateCycle,
  isNonAiVignetteId,
} from "@/lib/studyRandomization";
import { validateStudyConfig } from "@/lib/validation";

const defaultQuestionOrder = ["q1", "q2", "q3", "q4", "q5", "q6"];

const completeAnswers = {
  q1: "Agree",
  q2: "Strongly agree",
  q3: "Neither agree nor disagree",
  q4: "Disagree",
  q5: "Strongly disagree",
  q6: "Agree",
};

const sampleAiOrder = [
  "v01",
  "v02",
  "v03",
  "v04",
  "v05",
  "v06",
  "v07",
  "v08",
];

describe("study configuration", () => {
  it("passes validation", () => {
    expect(() =>
      validateStudyConfig(
        studySettings,
        vignettes,
        questionConfig,
        counterbalanceConfig,
      ),
    ).not.toThrow();
  });

  it("contains v01 through v32 and six shared questions", () => {
    expect(vignettes).toHaveLength(32);
    expect(vignettes.map((vignette) => vignette.id)).toEqual(
      Array.from(
        { length: 32 },
        (_, index) => `v${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(questionConfig.questions).toHaveLength(6);
    expect(studySettings.vignettesPerParticipant).toBe(10);
    expect(studySettings.aiVignettesPerParticipant).toBe(8);
  });

  it("looks up valid IDs and rejects invalid IDs", () => {
    expect(getVignetteById("v01")?.id).toBe("v01");
    expect(getVignetteById("v32")?.id).toBe("v32");
    expect(getVignetteById("v33")).toBeUndefined();
    expect(practiceVignettes).toHaveLength(4);
    expect(getPracticeVignetteById("p01")?.id).toBe("p01");
    expect(getPracticeVignetteById("v01")).toBeUndefined();
  });
});

describe("expanded scenario order", () => {
  it("always places non-AI first, AI second, and a second non-AI in slots 3–10", () => {
    const order = buildExpandedScenarioOrder("pid-expand-a", sampleAiOrder);

    expect(order).toHaveLength(10);
    expect(isNonAiVignetteId(order[0])).toBe(true);
    expect(order[1]).toBe("v01");
    expect(order.filter((id) => isNonAiVignetteId(id))).toHaveLength(2);
    expect(order.filter((id) => id.startsWith("v"))).toEqual(sampleAiOrder);

    const secondNonAiIndex = order.findIndex(
      (id, index) => index > 1 && isNonAiVignetteId(id),
    );
    expect(secondNonAiIndex).toBeGreaterThanOrEqual(2);
    expect(secondNonAiIndex).toBeLessThanOrEqual(9);
  });

  it("is deterministic for the same participant", () => {
    const first = buildExpandedScenarioOrder("pid-expand-b", sampleAiOrder);
    const second = buildExpandedScenarioOrder("pid-expand-b", sampleAiOrder);
    expect(second).toEqual(first);
  });
});

describe("response rows", () => {
  it("derives factor and vignette fields from server configuration", () => {
    const scenarioOrder = buildExpandedScenarioOrder("pid-row-a", sampleAiOrder);
    const row = buildResponseRow(
      {
        pid: "P1",
        vignetteId: scenarioOrder[1],
        position: 1,
        answers: completeAnswers,
        teammateName: "Taylor",
        questionOrder: defaultQuestionOrder,
        timeSpentMs: 1000,
      },
      scenarioOrder,
    );

    expect(row).toMatchObject({
      pid: "P1",
      vignette_id: "v01",
      vignette_number: 1,
      task_type: "Information Seeking",
      directedness: "Supporting",
      data_access: "OpenAssist",
      visibility: "Individual",
      teammate_name: "Taylor",
      question_order: defaultQuestionOrder,
      q1_value_feedback: "Agree",
      q6_rather_work_without: "Agree",
      time_spent_ms: 1000,
    });
    expect(row.full_vignette_text).toContain("Taylor is working");
    expect(row.full_vignette_text).not.toContain("Sam is working");
  });

  it("rejects missing answers and mismatched vignette positions", () => {
    const scenarioOrder = buildExpandedScenarioOrder("pid-row-b", sampleAiOrder);

    expect(() =>
      buildResponseRow(
        {
          pid: "P1",
          vignetteId: "v02",
          position: 1,
          answers: completeAnswers,
          teammateName: "Taylor",
          questionOrder: defaultQuestionOrder,
          timeSpentMs: 1000,
        },
        scenarioOrder,
      ),
    ).toThrow(SubmissionValidationError);

    expect(() =>
      buildResponseRow(
        {
          pid: "P1",
          vignetteId: scenarioOrder[1],
          position: 1,
          answers: { ...completeAnswers, q6: "" },
          teammateName: "Taylor",
          questionOrder: defaultQuestionOrder,
          timeSpentMs: 1000,
        },
        scenarioOrder,
      ),
    ).toThrow("Every question requires a valid response.");
  });

  it("saves the first non-AI scenario as practice and later non-AI rows as main", () => {
    const scenarioOrder = buildExpandedScenarioOrder("pid-row-c", sampleAiOrder);
    const practiceRow = buildResponseRow(
      {
        pid: "P1",
        vignetteId: scenarioOrder[0],
        position: 0,
        isPractice: true,
        answers: completeAnswers,
        teammateName: "Riley",
        questionOrder: ["q3", "q1", "q2", "q6", "q4", "q5"],
        timeSpentMs: 800,
      },
      scenarioOrder,
    );

    expect(practiceRow).toMatchObject({
      pid: "P1",
      vignette_id: scenarioOrder[0],
      vignette_number: 0,
      is_practice: true,
      directedness: "N/A",
      data_access: "N/A",
      visibility: "N/A",
      teammate_name: "Riley",
      question_order: ["q3", "q1", "q2", "q6", "q4", "q5"],
      q1_value_feedback: "Agree",
      time_spent_ms: 800,
    });

    const secondNonAiIndex = scenarioOrder.findIndex(
      (id, index) => index > 1 && isNonAiVignetteId(id),
    );
    const secondNonAiRow = buildResponseRow(
      {
        pid: "P1",
        vignetteId: scenarioOrder[secondNonAiIndex],
        position: secondNonAiIndex,
        answers: completeAnswers,
        teammateName: "Sam",
        questionOrder: defaultQuestionOrder,
        timeSpentMs: 900,
      },
      scenarioOrder,
    );

    expect(secondNonAiRow).toMatchObject({
      vignette_id: scenarioOrder[secondNonAiIndex],
      vignette_number: secondNonAiIndex,
      is_practice: false,
      directedness: "N/A",
      data_access: "N/A",
      visibility: "N/A",
    });
  });
});

describe("within-participant randomization", () => {
  it("shuffles questions within blocks and may swap block order", () => {
    const order = buildShuffledQuestionOrder("pid-order-a", [
      "q1",
      "q2",
      "q3",
      "q4",
      "q5",
      "q6",
    ]);
    const firstBlock = new Set(order.slice(0, 3));
    const secondBlock = new Set(order.slice(3, 6));
    const isBlock1First = ["q1", "q2", "q3"].every((id) => firstBlock.has(id));
    const isBlock2First = ["q4", "q5", "q6"].every((id) => firstBlock.has(id));

    expect(order).toHaveLength(6);
    expect(new Set(order).size).toBe(6);
    expect(isBlock1First || isBlock2First).toBe(true);
    if (isBlock1First) {
      expect(["q4", "q5", "q6"].every((id) => secondBlock.has(id))).toBe(true);
    } else {
      expect(["q1", "q2", "q3"].every((id) => secondBlock.has(id))).toBe(true);
    }
  });

  it("cycles a shuffled gender-neutral teammate list", () => {
    const cycle = buildTeammateCycle("pid-names-a");
    expect(cycle).toHaveLength(4);
    expect(new Set(cycle)).toEqual(new Set(["Taylor", "Jordan", "Riley", "Sam"]));
    expect(applyTeammateName("Sam is working", "Taylor")).toBe("Taylor is working");
    expect(
      applyTeammateName("You would value {teammatePossessive} feedback.", "Jordan"),
    ).toBe("You would value Jordan’s feedback.");
  });
});
