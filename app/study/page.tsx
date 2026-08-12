import { StudyError } from "@/components/StudyError";
import {
  assertValidStudyConfig,
  practiceVignettes,
  questionConfig,
  vignettes,
} from "@/lib/studyConfig";
import { StudyExperience } from "./StudyExperience";

export default function StudyPage() {
  try {
    assertValidStudyConfig();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      throw error;
    }
    return <StudyError />;
  }

  return (
    <StudyExperience
      vignettes={vignettes}
      practiceVignettes={practiceVignettes}
      questionConfig={questionConfig}
    />
  );
}
