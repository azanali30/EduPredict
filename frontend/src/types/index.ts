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
  organization_id?: string | null;
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

// Student Dropout Prediction Types (Phase 8A)
export interface DropoutRecord {
  id: string;
  student_id: string;
  student_name?: string;
  risk_probability: number;
  risk_tier: 'Low' | 'Moderate' | 'High';
  model_version: string;
  key_risk_factors: Array<{ factor: string; detail: string; importance?: string }>;
  protective_factors: Array<{ factor: string; detail: string }>;
  recommendations: string[];
  academic_term: string;
  requires_human_review: boolean;
  disclaimer: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminDropoutOverviewResponse {
  status_code: number;
  total_assessed: number;
  risk_distribution: {
    Low: number;
    Moderate: number;
    High: number;
  };
  recent_high_risk: DropoutRecord[];
  model_metadata: {
    model_version: string;
    base_estimator: string;
    calibration: string;
    test_metrics: Record<string, any>;
  };
}

export interface AnalystDropoutOverviewResponse {
  status_code: number;
  total_assessed: {
    count: number | null;
    display: string;
    suppressed: boolean;
  };
  risk_distribution: Record<
    string,
    {
      count: number | null;
      display: string;
      suppressed: boolean;
    }
  >;
  model_summary: {
    model_version: string;
    roc_auc: number;
    pr_auc: number;
    brier_score: number;
    calibration: string;
  };
  privacy_notice: string;
}

// Course Demand Forecasting Types (Phase 8B)
export interface HistoricalEnrollmentPoint {
  academic_term: string;
  active_count: number;
  completed_count: number;
  dropped_count: number;
  total_count: number;
}

export interface CourseDemandForecastItem {
  id?: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  department: string;
  capacity?: number | null;
  historical_series: HistoricalEnrollmentPoint[];
  terms_observed: number;
  forecast_period: string;
  periods_ahead: number;
  latest_actual_enrollment: number | null;
  predicted_enrollment: number;
  confidence_lower: number | null;
  confidence_upper: number | null;
  confidence_level: string;
  interval_type?: string;
  is_calibrated_confidence_interval?: boolean;
  growth_rate_pct: number | null;
  trend_direction: string;
  demand_tier: string;
  utilization_pct: number | null;
  model_used: string;
  validation_status:
  | 'institutionally_validated'
  | 'walk_forward_evaluated'
  | 'experimental'
  | 'baseline'
  | 'insufficient_data'
  | 'validated';
  data_sufficiency: 'sufficient' | 'baseline_only' | 'insufficient';
  evaluation_metrics: {
    mae?: number | null;
    rmse?: number | null;
    mape?: number | null;
    mape_note?: string;
    directional_accuracy?: number | null;
    validation_splits?: number;
  };
  excluded_models?: Record<string, string>;
  multi_step_forecasts?: Array<{ period: string; predicted_enrollment: number }>;
  disclaimer: string;
  created_at?: string;
}

export interface DemandOverviewResponse {
  status_code: number;
  summary: {
    total_subjects_analyzed: number;
    total_latest_actual_enrollment: number;
    total_predicted_enrollment: number;
    high_demand_count: number;
    low_demand_count: number;
    periods_ahead: number;
    overall_data_sufficiency: 'sufficient' | 'baseline_only' | 'insufficient';
    sufficiency_breakdown: Record<string, number>;
    average_walk_forward_mae: number | null;
    models_used: Record<string, number>;
  };
  forecasts: CourseDemandForecastItem[];
  high_demand_courses: CourseDemandForecastItem[];
  low_demand_courses: CourseDemandForecastItem[];
  department_summary: Array<{
    department: string;
    subject_count: number;
    latest_actual: number;
    predicted_enrollment: number;
    growth_rate_pct: number | null;
  }>;
  historical_timeline: Array<{
    academic_term: string;
    total_enrollment: number;
  }>;
  disclaimer: string;
  generated_at: string;
}

// Phase 8C & 8D: Model Evaluation, Registry, and Integrated Prediction Types
export interface DropoutEvaluationResponse {
  status_code: number;
  domain: string;
  champion_model: string;
  champion_model_version: string;
  validation_status: string;
  local_institutional_validation: boolean;
  benchmark_disclosure: string;
  explainability_disclaimer: string;
  dataset: {
    name: string;
    train_samples: number;
    test_samples: number;
    feature_count: number;
  };
  dataset_fingerprint?: string | null;
  calibrated_champion_metrics: {
    accuracy: number | null;
    precision: number | null;
    recall: number | null;
    f1: number | null;
    roc_auc: number | null;
    pr_auc: number | null;
    brier_score: number | null;
    true_negatives: number;
    false_positives: number;
    false_negatives: number;
    true_positives: number;
    confusion_matrix: number[][];
  };
  candidate_comparison: Array<{
    model_name: string;
    is_champion: boolean;
    cv_mean_roc_auc?: number | null;
    cv_std_roc_auc?: number | null;
    cv_mean_f1?: number | null;
    test_accuracy: number | null;
    test_precision: number | null;
    test_recall: number | null;
    test_f1: number | null;
    test_roc_auc: number | null;
    test_pr_auc: number | null;
    test_brier_score: number | null;
    confusion_matrix?: number[][];
    true_positives?: number;
    true_negatives?: number;
    false_positives?: number;
    false_negatives?: number;
  }>;
  roc_curve: Array<{ fpr: number; tpr: number }>;
  pr_curve: Array<{ recall: number; precision: number }>;
  calibration_curve: Array<{
    mean_predicted: number;
    fraction_positive: number;
  }>;
  expected_calibration_error: number | null;
  feature_contributions: Array<{
    feature: string;
    weight: number;
    abs_weight: number;
    direction: string;
  }>;
  risk_tradeoffs?: Record<string, any>;
  risk_thresholds?: Record<string, any>;
}

export interface DemandEvaluationResponse {
  status_code: number;
  domain: string;
  organization_id: string;
  overall_status: string;
  validation_methodology: string;
  model_comparison: Array<{
    model_name: string;
    subjects_evaluated: number;
    total_validation_splits?: number;
    mean_mae: number | null;
    mean_rmse: number | null;
    mean_mape: number | null;
    status: string;
  }>;
  subject_evaluations: Array<{
    subject_id: string;
    subject_code: string;
    subject_name: string;
    department: string;
    terms_observed: number;
    data_sufficiency: string;
    validation_status: string;
    model_used: string;
    mae: number | null;
    rmse: number | null;
    mape: number | null;
    smape: number | null;
    forecast_bias: number | null;
  }>;
  actual_vs_predicted: Array<{
    subject: string;
    actual: number | null;
    predicted: number;
    mae: number | null;
  }>;
  insufficient_data_notice?: string | null;
}

export interface ModelRegistryItem {
  id: string;
  model_type: 'dropout' | 'demand';
  model_name: string;
  model_version: string;
  algorithm?: string;
  model_status: string;
  deployment_status: string;
  is_active: boolean;
  organization_id?: string | null;
  evaluation_metrics: Record<string, any>;
  dataset_fingerprint?: string | null;
  validation_methodology: string;
  approval_notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AnalystDropoutTrendsResponse {
  status_code: number;
  trends: Array<{
    academic_term: string;
    total_assessed: {
      count: number | null;
      display: string;
      suppressed: boolean;
    };
    risk_distribution: Record<
      string,
      {
        count: number | null;
        display: string;
        suppressed: boolean;
      }
    >;
  }>;
  privacy_notice: string;
  benchmark_disclosure: string;
}

// Phase 12A / 12B Persistent Notifications
export interface NotificationRecord {
  id: string;
  recipient_id: string;
  recipient_role: 'admin' | 'teacher' | 'student' | string;
  subject_id?: string | null;
  subject?: string | null;
  academic_term?: string | null;
  category:
    | 'early_warning'
    | 'dropout_risk'
    | 'anomaly_alert'
    | 'broadcast'
    | 'academic_calendar'
    | 'system'
    | 'feedback_update'
    | string;
  severity: 'info' | 'warning' | 'critical' | 'success' | string;
  title: string;
  message: string;
  is_read: boolean;
  read_at?: string | null;
  provenance?: Record<string, any>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface NotificationListResponse {
  status_code: number;
  notifications: NotificationRecord[];
  total: number;
  unread_count: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Phase 12C Feedback & Support Tickets
export interface FeedbackTicketRecord {
  id: string;
  sender_id: string;
  sender_role: 'student' | 'teacher';
  sender_name: string;
  subject_id?: string | null;
  subject?: string | null;
  academic_term?: string | null;
  category: string;
  title: string;
  message: string;
  share_with_instructor: boolean;
  status: 'Open' | 'Reviewed' | 'Resolved';
  admin_response?: string | null;
  intervention_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FeedbackListResponse {
  status_code: number;
  tickets: FeedbackTicketRecord[];
  summary: {
    total: number;
    open: number;
    reviewed: number;
    resolved: number;
  };
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ==========================================
// Attendance Register Types (Workstream A)
// ==========================================

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export interface AttendanceSessionItem {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  teacher_id: string;
  teacher_name: string;
  academic_term: string;
  session_date: string;
  session_title: string;
  notes?: string | null;
  status: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  attendance_source: 'verified_institutional_register';
}

export interface AttendanceRecordItem {
  id: string;
  session_id: string;
  student_id: string;
  student_name: string;
  student_code?: string | null;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  academic_term: string;
  session_date: string;
  status: AttendanceStatus;
  remarks?: string | null;
  marked_by?: string | null;
  marked_at?: string | null;
  updated_at?: string | null;
  attendance_source: 'verified_institutional_register';
}

export interface AttendanceRosterEntry {
  student_id: string;
  student_name: string;
  student_email: string;
  student_code?: string | null;
  status: AttendanceStatus | null;
  remarks?: string | null;
  record_id?: string | null;
}

export interface AttendanceSubjectSummary {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  academic_term: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  effective_sessions: number;
  attendance_percentage: number | null;
  has_records: boolean;
}

export interface EstimatedMlAttendanceProxy {
  label: string;
  absences: number;
  assumed_sessions: number;
  estimated_attendance_percentage: number;
  subject?: string | null;
  academic_term?: string | null;
  formula: string;
  is_verified_roll_call: boolean;
}

export interface StudentAttendanceResponse {
  status_code: number;
  student_id: string;
  verified_institutional_attendance: {
    label: string;
    overall_attendance_percentage: number | null;
    total_sessions: number;
    effective_sessions: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    excused_count: number;
    has_records: boolean;
    formula: string;
    subject_summaries: AttendanceSubjectSummary[];
  };
  estimated_ml_proxy: EstimatedMlAttendanceProxy | null;
  records: AttendanceRecordItem[];
  total_count: number;
  page: number;
  limit: number;
  disclosure: string;
}

export interface TeacherAttendanceSummaryResponse {
  status_code: number;
  subject_summaries: Array<{
    subject_id: string;
    subject_name: string;
    subject_code: string;
    academic_term: string;
    session_count: number;
    total_marked_entries: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    excused_count: number;
    attendance_percentage: number | null;
  }>;
  overall: {
    total_sessions: number;
    total_marked_entries: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    excused_count: number;
    attendance_percentage: number | null;
    has_records: boolean;
  };
  formula: string;
  disclosure: string;
}

// ==========================================
// Academic Records Types (Workstream A)
// ==========================================

export interface AcademicRecordItem {
  id: string;
  student_id: string | null;
  student_name: string;
  student_email: string;
  student_code?: string | null;
  subject_id?: string | null;
  subject: string;
  term: string;
  g1?: number | null;
  g2?: number | null;
  final_exam_marks?: number | null;
  study_hours_per_week?: number | null;
  assignment_completion_rate?: number | null;
  quiz_average?: number | null;
  previous_exam_marks?: number | null;
  attendance_percentage?: number | null;
  studytime?: number | null;
  failures?: number | null;
  absences?: number | null;
  notes?: string | null;
  source?: string;
  recorded_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AcademicRecordCsvImportSummary {
  total_rows: number;
  successful: number;
  rejected: number;
  duplicate: number;
  created_record_ids: string[];
  errors: Array<{
    row: number;
    status: 'rejected' | 'duplicate';
    reason: string;
  }>;
}

// ==========================================
// Analyst Cohort Trends Types (Workstream A)
// ==========================================

export interface AnalystTermTrendPoint {
  term: string;
  suppressed: boolean;
  display_count: string;
  student_count: number | null;
  institutional_avg_raw20: number | null;
  institutional_avg_percentage: number | null;
  math_avg_raw20: number | null;
  portuguese_avg_raw20: number | null;
  coursework_avg_raw20: number | null;
  attendance_rate_percentage: number | null;
}

export interface AnalystTrendsResponse {
  status_code: number;
  term_trends: AnalystTermTrendPoint[];
  monitored_terms_count: number;
  unsuppressed_terms_count: number;
  institutional_avg_raw20: number | null;
  institutional_avg_percentage: number | null;
  institutional_suppressed: boolean;
  growth_delta_raw20: number | null;
  trend_available: boolean;
  trend_message: string;
  sdc_threshold: number;
}

// ==========================================
// Tableau BI Export Types (Workstream B)
// ==========================================

export interface TableauDatasetCatalogItem {
  dataset: string;
  title: string;
  description: string;
  columns: string[];
  source_collections: string[];
  source_document_counts: Record<string, number>;
}

export interface TableauExportResponse {
  status_code: number;
  metadata: {
    dataset: string;
    title: string;
    exported_at_utc: string;
    exported_by_role: string;
    sdc_enforced: boolean;
    sdc_threshold: number | null;
    contains_pii: boolean;
    source_collections: string[];
    row_count: number;
    format: string;
  };
  columns: string[];
  rows: Array<Record<string, any>>;
}
