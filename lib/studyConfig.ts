import counterbalanceJson from "@/config/counterbalance.json";
import practiceVignettesJson from "@/config/practiceVignettes.json";
import questionsJson from "@/config/questions.json";
import studyJson from "@/config/study.json";
import teammatesJson from "@/config/teammates.json";
import vignettesJson from "@/config/vignettes.json";
import type {
  CounterbalanceConfig,
  SharedQuestionConfig,
  StudySettings,
  VignetteCondition,
} from "@/types/study";
import { validateStudyConfig } from "@/lib/validation";

export const counterbalanceConfig =
  counterbalanceJson as CounterbalanceConfig;
export const questionConfig = questionsJson as SharedQuestionConfig;
export const studySettings = studyJson as StudySettings;
export const vignettes = vignettesJson as VignetteCondition[];
export const practiceVignettes =
  practiceVignettesJson as VignetteCondition[];
export const teammateConfig = teammatesJson;

export function assertValidStudyConfig(): void {
  validateStudyConfig(
    studySettings,
    vignettes,
    questionConfig,
    counterbalanceConfig,
  );
}

if (process.env.NODE_ENV === "development") {
  assertValidStudyConfig();
}

export function getVignetteById(
  vignetteId: string,
): VignetteCondition | undefined {
  return vignettes.find((vignette) => vignette.id === vignetteId);
}

export function getPracticeVignetteById(
  vignetteId: string,
): VignetteCondition | undefined {
  return practiceVignettes.find((vignette) => vignette.id === vignetteId);
}

export function getScenarioById(
  vignetteId: string,
): VignetteCondition | undefined {
  return getVignetteById(vignetteId) ?? getPracticeVignetteById(vignetteId);
}

