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
import { NON_AI_SCENARIO_COUNT } from "@/lib/studyConstants";
import {
  buildResponseRow,
  SubmissionValidationError,
} from "@/lib/submission";
import {
  applyTeammateName,
  buildExpandedScenarioOrder,
  buildScenarioAssignments,
  buildShuffledQuestionOrder,
  buildTeammateCycle,
  isNonAiVignetteId,
  selectSeededSubset,
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
    expect(NON_AI_SCENARIO_COUNT).toBe(2);
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

  it("maps display positions 0–9 with practice at 0", () => {
    const assignments = buildScenarioAssignments("pid-expand-b", sampleAiOrder);

    expect(assignments).toHaveLength(10);
    expect(assignments[0]).toMatchObject({
      apiPosition: 0,
      isPractice: true,
    });
    expect(assignments[1]).toMatchObject({
      vignetteId: "v01",
      apiPosition: 1,
      isPractice: false,
    });
    expect(assignments.filter((assignment) => assignment.isPractice)).toHaveLength(1);
    expect(assignments.map((assignment) => assignment.apiPosition)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });
});

describe("response rows", () => {
  it("derives factor and vignette fields from server configuration", () => {
    const assignments = buildScenarioAssignments("pid-row-a", sampleAiOrder);
    const firstAi = assignments.find((assignment) => !assignment.isPractice)!;
    const row = buildResponseRow(
      {
        pid: "P1",
        vignetteId: firstAi.vignetteId,
        position: firstAi.apiPosition,
        answers: completeAnswers,
        teammateName: "Taylor",
        questionOrder: defaultQuestionOrder,
        timeSpentMs: 1000,
      },
      sampleAiOrder,
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
        sampleAiOrder,
      ),
    ).toThrow(SubmissionValidationError);

    const assignments = buildScenarioAssignments("pid-row-b", sampleAiOrder);
    const firstAi = assignments.find((assignment) => !assignment.isPractice)!;

    expect(() =>
      buildResponseRow(
        {
          pid: "P1",
          vignetteId: firstAi.vignetteId,
          position: firstAi.apiPosition,
          answers: { ...completeAnswers, q6: "" },
          teammateName: "Taylor",
          questionOrder: defaultQuestionOrder,
          timeSpentMs: 1000,
        },
        sampleAiOrder,
      ),
    ).toThrow("Every question requires a valid response.");
  });

  it("saves the first non-AI scenario as practice and the second as main", () => {
    const assignments = buildScenarioAssignments("pid-row-c", sampleAiOrder);
    const firstNonAi = assignments[0];
    const secondNonAiIndex = assignments.findIndex(
      (assignment, index) => index > 0 && isNonAiVignetteId(assignment.vignetteId),
    );
    const secondNonAi = assignments[secondNonAiIndex];

    const firstNonAiRow = buildResponseRow(
      {
        pid: "pid-row-c",
        vignetteId: firstNonAi.vignetteId,
        position: 0,
        isPractice: true,
        answers: completeAnswers,
        teammateName: "Riley",
        questionOrder: ["q3", "q1", "q2", "q6", "q4", "q5"],
        timeSpentMs: 800,
      },
      sampleAiOrder,
    );

    expect(firstNonAiRow).toMatchObject({
      vignette_id: firstNonAi.vignetteId,
      vignette_number: 0,
      is_practice: true,
      directedness: "N/A",
      data_access: "N/A",
      visibility: "N/A",
    });

    const secondNonAiRow = buildResponseRow(
      {
        pid: "pid-row-c",
        vignetteId: secondNonAi!.vignetteId,
        position: secondNonAi!.apiPosition,
        answers: completeAnswers,
        teammateName: "Sam",
        questionOrder: defaultQuestionOrder,
        timeSpentMs: 900,
      },
      sampleAiOrder,
    );

    expect(secondNonAiRow).toMatchObject({
      vignette_id: secondNonAi!.vignetteId,
      vignette_number: secondNonAi!.apiPosition,
      is_practice: false,
      directedness: "N/A",
      data_access: "N/A",
      visibility: "N/A",
    });
  });
});

describe("within-participant randomization", () => {
  it("selects two distinct, deterministic non-AI scenarios", () => {
    const firstSelection = selectSeededSubset(
      "pid-practice-a:practice",
      practiceVignettes,
      2,
    );
    const repeatedSelection = selectSeededSubset(
      "pid-practice-a:practice",
      practiceVignettes,
      2,
    );

    expect(firstSelection).toHaveLength(2);
    expect(new Set(firstSelection.map((vignette) => vignette.id)).size).toBe(2);
    expect(repeatedSelection.map((vignette) => vignette.id)).toEqual(
      firstSelection.map((vignette) => vignette.id),
    );
  });

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
