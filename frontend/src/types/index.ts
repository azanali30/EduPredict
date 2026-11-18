export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicRecord {
  id: string;
  student_id: string;
  term: string;
  attendance_percentage: number;
  study_hours_per_week: number;
  assignment_completion_rate: number;
  quiz_average: number;
  previous_exam_marks: number;
  subject_scores: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  student_id: string;
  assigned_by?: string;
  status: 'active' | 'inactive';
  assigned_at: string;
}

export interface SystemLog {
  _id: string;
  event_type: string;
  details: Record<string, any>;
  user_id?: string;
  actor_id?: string;
  ip_address?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  status_code: number;
}

// Prediction Domain Types (Phase 5B & 5C)
export type PredictionSubject = 'Mathematics' | 'Portuguese Language';
export type PredictionMilestone = 0 | 1 | 2;
export type AcademicRiskStatus = 'High Risk' | 'Moderate Risk' | 'Low Risk / On Track';

export interface EarlyWarningAdvisory {
  title?: string;
  notice?: string;
  false_negative_rate_estimate_pct?: number;
  recommended_action?: string;
  // Optional aliases for backward compatibility
  milestone?: number;
  false_negative_rate_pct?: number;
  warning?: string;
  actionable_guidance?: string;
  false_negatives_count?: number;
  total_failing_count?: number;
  model_type?: string;
}

export interface PredictionFeatureSummaryItem {
  value: any;
  label: string;
  is_estimated_proxy: boolean;
}

export interface PredictionRecord {
  id: string;
  student_id: string;
  created_by: string;
  subject: string;
  milestone: number;
  predicted_marks: number;
  predicted_status: string;
  confidence_scores: Record<string, number>;
  top_confidence: number;
  confidence_type: string;
  uncertainty_warning: boolean;
  uncertainty_message?: string | null;
  early_warning_advisory?: EarlyWarningAdvisory | null;
  features_summary: Record<string, PredictionFeatureSummaryItem>;
  regressor_model: string;
  classifier_model: string;
  created_at: string;
}

export interface MilestoneOption {
  milestone: number;
  name: string;
  description: string;
  feature_count: number;
  features: string[];
  prohibited_features: string[];
  advisory?: string;
}

export interface PredictionOptions {
  supported_subjects: Array<{
    id: string;
    name: string;
    observation_count: number;
    target_scale: string;
  }>;
  milestones: MilestoneOption[];
  estimated_feature_labels: Record<string, string>;
  target_definitions: {
    regression: { variable: string; scale: string };
    classification: {
      variable: string;
      classes: Array<{ name: string; range: string }>;
    };
  };
}

export interface CreatePredictionPayload {
  subject: string;
  milestone: number;
  features: Record<string, any>;
  student_id?: string;
}
