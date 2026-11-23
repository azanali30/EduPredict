export type UserRole = 'student' | 'teacher' | 'admin' | 'analyst';

export interface PersonalInfo {
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
}

export interface ContactInfo {
  personal_email?: string;
  contact_number?: string;
  alternate_contact_number?: string;
  residential_address?: string;
  city?: string;
  country?: string;
}

export interface GuardianInfo {
  guardian_full_name?: string;
  relationship?: string;
  guardian_contact_number?: string;
  guardian_email?: string;
  emergency_contact_number?: string;
}

export interface AcademicInfo {
  admission_date?: string;
  academic_year?: string;
  academic_term?: string;
  program_course?: string;
  department?: string;
  class_grade?: string;
  previous_institution?: string;
  previous_qualification?: string;
}

export interface ProfessionalInfo {
  department?: string;
  job_title?: string;
  highest_qualification?: string;
  specialization?: string;
  experience_years?: string | number;
  previous_institution?: string;
  bio?: string;
}

export interface EmploymentInfo {
  joining_date?: string;
  employment_type?: string;
  employment_status?: string;
  academic_year?: string;
  internal_notes?: string;
}

export interface UserDocument {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  category: string;
  size?: number;
  uploaded_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  student_id?: string;
  employee_id?: string;
  contact_number?: string;
  department?: string;
  avatar_url?: string;
  must_change_password?: boolean;
  personal_info?: PersonalInfo;
  contact_info?: ContactInfo;
  guardian_info?: GuardianInfo;
  academic_info?: AcademicInfo;
  professional_info?: ProfessionalInfo;
  employment_info?: EmploymentInfo;
  documents?: UserDocument[];
  enrolled_subjects_under_teacher?: string[];
  created_at: string;
  updated_at: string;
}

export interface SubjectItem {
  id: string;
  code: string;
  name: string;
  canonical_key: string;
  department?: string;
  description?: string;
  is_active?: boolean;
  status?: string;
  target_scale?: string;
  academic_term?: string;
  assignment_status?: string;
  enrollment_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherSubjectAssignmentItem {
  id: string;
  teacher_id: string;
  subject_id: string;
  academic_term: string;
  status: 'active' | 'inactive';
  assigned_at: string;
  updated_at?: string;
  teacher_name?: string;
  teacher_email?: string;
  subject_name?: string;
  subject_code?: string;
}

export interface StudentSubjectEnrollmentItem {
  id: string;
  student_id: string;
  subject_id: string;
  academic_term: string;
  status: 'active' | 'dropped' | 'completed';
  enrolled_at: string;
  updated_at?: string;
  student_name?: string;
  student_email?: string;
  subject_name?: string;
  subject_code?: string;
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
  subject_id?: string;
  academic_term?: string;
  milestone: number;
  predicted_marks: number;
  predicted_final_grade?: number;
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
  regression_metrics?: { r2?: number; rmse?: number };
  classification_metrics?: { class_distribution?: Record<string, number> };
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
  academic_term?: string;
}

export interface AnalystOverviewMetrics {
  total_students: number | null;
  total_students_display: string;
  total_students_suppressed: boolean;
  total_teachers: number | null;
  total_teachers_display: string;
  total_teachers_suppressed: boolean;
  total_active_subjects: number;
  total_predictions: number | null;
  total_predictions_display: string;
  total_predictions_suppressed: boolean;
  total_active_enrollments: number | null;
  total_active_enrollments_display: string;
  total_active_enrollments_suppressed: boolean;
}

export interface AnalystCurriculumSubject {
  subject_id: string;
  code: string;
  name: string;
  department: string;
  active_enrollments: number | null;
  active_enrollments_display: string;
  active_enrollments_suppressed: boolean;
  assigned_teachers: number | null;
  assigned_teachers_display: string;
  assigned_teachers_suppressed: boolean;
}

export interface AnalystOverviewResponse {
  status: string;
  scope: string;
  privacy_policy?: {
    cell_suppression_threshold: number;
    rule: string;
  };
  metrics: AnalystOverviewMetrics;
  status_code: number;
}

export interface AnalystCurriculumStatsResponse {
  subjects: AnalystCurriculumSubject[];
  count: number;
  privacy_policy?: {
    cell_suppression_threshold: number;
    rule: string;
  };
  status_code: number;
}

// ==========================================
// Phase 7C: Anomaly Detection & Monitoring
// ==========================================

export type AnomalyReviewStatus = 'Pending Review' | 'Confirmed Anomaly' | 'Dismissed (Benign)';
export type AnomalySeverity = 'High Anomaly' | 'Moderate Anomaly' | 'Low / Typical';

export interface SupportingDeviation {
  feature: string;
  observed_value: any;
  cohort_mean_or_mode: any;
  z_score?: number | null;
  rarity_percentage?: number | null;
  deviation_type: 'z_score' | 'rare_category';
  description: string;
}

export interface AnomalyRecord {
  id: string;
  source_record_id: string;
  student_id?: string | null;
  student_id_ref?: string | null;
  student_name?: string | null;
  subject: string;
  model_version: string;
  milestone: string | number;
  anomaly_score: number;
  cohort_percentile: number;
  is_anomaly: boolean;
  anomaly_severity: AnomalySeverity;
  supporting_deviations: SupportingDeviation[];
  review_status: AnomalyReviewStatus;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  is_benchmark?: boolean;
  dataset_type?: 'benchmark' | 'institutional';
  academic_term?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnomalyListResponse {
  anomalies: AnomalyRecord[];
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  status_code?: number;
}

export interface AnalystAnomalyStats {
  status_code: number;
  total_evaluated_records:
    | {
        count: number | null;
        display: string;
        suppressed: boolean;
      }
    | number;
  total_anomalies: {
    count: number | null;
    display: string;
    suppressed: boolean;
  };
  subject_breakdown: Record<
    string,
    {
      total_records: { count: number | null; display: string; suppressed: boolean };
      anomalies_count: { count: number | null; display: string; suppressed: boolean };
    }
  >;
  severity_breakdown: Record<
    string,
    { count: number | null; display: string; suppressed: boolean }
  >;
  status_breakdown: Record<
    string,
    { count: number | null; display: string; suppressed: boolean }
  >;
  privacy_notice: string;
  generated_at: string;
}


