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
  buildShuffledQuestionOrder,
  buildTeammateCycle,
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

describe("response rows", () => {
  it("derives factor and vignette fields from server configuration", () => {
    const row = buildResponseRow(
      {
        pid: "P1",
        vignetteId: "v01",
        position: 1,
        answers: completeAnswers,
        teammateName: "Taylor",
        questionOrder: defaultQuestionOrder,
        timeSpentMs: 1000,
      },
      ["v01"],
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
        ["v01"],
      ),
    ).toThrow(SubmissionValidationError);

    expect(() =>
      buildResponseRow(
        {
          pid: "P1",
          vignetteId: "v01",
          position: 1,
          answers: { ...completeAnswers, q6: "" },
          teammateName: "Taylor",
          questionOrder: defaultQuestionOrder,
          timeSpentMs: 1000,
        },
        ["v01"],
      ),
    ).toThrow("Every question requires a valid response.");
  });

  it("saves initial non-AI scenarios at either reserved position", () => {
    const row = buildResponseRow(
      {
        pid: "P1",
        vignetteId: "p01",
        position: 0,
        isPractice: true,
        answers: completeAnswers,
        teammateName: "Riley",
        questionOrder: ["q3", "q1", "q2", "q6", "q4", "q5"],
        timeSpentMs: 800,
      },
      ["v01"],
    );

    expect(row).toMatchObject({
      pid: "P1",
      vignette_id: "p01",
      vignette_number: 0,
      is_practice: true,
      task_type: "Information Seeking",
      directedness: "N/A",
      data_access: "N/A",
      visibility: "N/A",
      teammate_name: "Riley",
      question_order: ["q3", "q1", "q2", "q6", "q4", "q5"],
      q1_value_feedback: "Agree",
      time_spent_ms: 800,
    });

    const firstNonAiRow = buildResponseRow(
      {
        pid: "P1",
        vignetteId: "p02",
        position: -1,
        isPractice: true,
        answers: completeAnswers,
        teammateName: "Jordan",
        questionOrder: defaultQuestionOrder,
        timeSpentMs: 900,
      },
      ["v01"],
    );
    expect(firstNonAiRow).toMatchObject({
      vignette_id: "p02",
      vignette_number: -1,
      is_practice: true,
      task_type: "Brainstorming",
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
