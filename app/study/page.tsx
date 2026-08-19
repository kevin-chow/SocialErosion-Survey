import { StudyError } from "@/components/StudyError";
import { assertValidStudyConfig, questionConfig } from "@/lib/studyConfig";
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

  return <StudyExperience questionConfig={questionConfig} />;
}
