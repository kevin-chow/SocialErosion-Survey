export type AssignmentMode =
  | "query-param"
  | "random"
  | "all"
  | "counterbalanced";

export interface QuestionOption {
  value: string | number;
  label: string;
}

export interface VignetteTag {
  factor: string;
  value: string;
  label: string;
  icon: string;
}

export interface VignetteCondition {
  id: string;
  slug: string;
  title: string;
  body: string;
  conditionLabel: string;
  assist?: "OpenAssist" | "CorpAssist";
  tags?: VignetteTag[];
  metadata?: Record<string, string | number | boolean>;
}

export type ResponseColumn =
  | "q1_value_feedback"
  | "q2_seek_feedback"
  | "q3_incorporate_feedback"
  | "q4_comfortable_feedback"
  | "q5_express_frustrations"
  | "q6_rather_work_without";

export interface QuestionSegment {
  text: string;
  bold?: boolean;
}

export interface SharedQuestion {
  id: string;
  responseColumn: ResponseColumn;
  text?: string;
  segments?: QuestionSegment[];
  required: boolean;
}

export interface SharedQuestionConfig {
  instruction?: string;
  scale: QuestionOption[];
  questions: SharedQuestion[];
}

export interface CounterbalanceOrder {
  slot: number;
  vignetteIds: string[];
}

export interface CounterbalanceConfig {
  design: string;
  plannedParticipants: number;
  vignettesPerParticipant: number;
  exposuresPerVignette: number;
  orders: CounterbalanceOrder[];
}

export interface StudySettings {
  assignmentMode: AssignmentMode;
  totalVignettes: number;
  vignettesPerParticipant: number;
  questionsPerVignette: number;
}
