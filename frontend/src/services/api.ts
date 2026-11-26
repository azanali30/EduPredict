import {
  User,
  UserRole,
  SystemLog,
  PredictionRecord,
  PredictionOptions,
  CreatePredictionPayload,
  SubjectItem,
  TeacherSubjectAssignmentItem,
  StudentSubjectEnrollmentItem,
  AnalystOverviewResponse,
  AnalystCurriculumStatsResponse,
  AnomalyRecord,
  AnomalyListResponse,
  AnomalyReviewStatus,
  AnalystAnomalyStats,
  DropoutRecord,
  AdminDropoutOverviewResponse,
  AnalystDropoutOverviewResponse,
  DemandOverviewResponse,
  CourseDemandForecastItem,
} from '../types';

let cachedCsrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      cachedCsrfToken = data.csrf_token || null;
      return cachedCsrfToken || '';
    }
  } catch (err) {
    console.error('Failed to retrieve CSRF token:', err);
  }
  return '';
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  headers.set('Accept', 'application/json');

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach CSRF token on mutating requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const token = await getCsrfToken();
    if (token) {
      headers.set('X-CSRFToken', token);
    }
  }

  const config: RequestInit = {
    ...options,
    method,
    headers,
    credentials: 'include',
  };

  let response: Response;
  try {
    response = await fetch(endpoint, config);
  } catch (netErr: any) {
    const errorObj = new Error(
      'Unable to connect to EduPredict server. Please verify your network connection and ensure the backend is running.'
    ) as any;
    errorObj.status = 503;
    throw errorObj;
  }

  // If CSRF error occurred, refresh token and retry once
  if (response.status === 400 && ['POST', 'PUT', 'DELETE'].includes(method)) {
    const errorClone = response.clone();
    try {
      const errJson = await errorClone.json();
      if (errJson?.message && /csrf/i.test(errJson.message)) {
        cachedCsrfToken = null;
        const freshToken = await getCsrfToken();
        if (freshToken) {
          headers.set('X-CSRFToken', freshToken);
          config.headers = headers;
          response = await fetch(endpoint, config);
        }
      }
    } catch {
      // Ignore JSON parse failure on clone
    }
  }

  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    let errorMessage = responseData?.message || responseData?.error;
    if (!errorMessage) {
      if (response.status === 500) {
        errorMessage = 'Internal Server Error: Backend service encountered an unexpected error. Please check server logs.';
      } else if (response.status === 502 || response.status === 503 || response.status === 504) {
        errorMessage = 'EduPredict backend server is offline or unreachable. Please verify the Flask server is running on port 5000.';
      } else {
        errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      }
    }
    const errorObj = new Error(errorMessage) as any;
    errorObj.status = response.status;
    errorObj.data = responseData;
    throw errorObj;
  }

  return responseData as T;
}

// Concrete API calls
export const api = {
  // Authentication
  register: (payload: { email: string; password: string; full_name: string }) =>
    apiRequest<{ message: string; user: User; status_code: number }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string; remember?: boolean }) =>
    apiRequest<{ message: string; user: User; status_code: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    apiRequest<{ message: string; status_code: number }>('/auth/logout', {
      method: 'POST',
    }),

  // Current User Profile
  getMe: () => apiRequest<{ user: User; status_code: number }>('/api/me'),

  updateProfile: (payload: Record<string, any>) =>
    apiRequest<{ message: string; user: User; status_code: number }>('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changePassword: (payload: { current_password: string; new_password: string }) =>
    apiRequest<{ message: string; status_code: number }>('/api/me/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Students & Teacher Routes
  getStudentDetails: (studentId: string) =>
    apiRequest<{ student: User; status_code: number }>(`/api/students/${studentId}`),

  getTeacherSubjects: () =>
    apiRequest<{ subjects: SubjectItem[]; count: number; status_code: number }>('/api/teacher/subjects'),

  getTeacherStudents: (params?: { subject_id?: string; academic_term?: string }) => {
    const query = new URLSearchParams();
    if (params?.subject_id) query.set('subject_id', params.subject_id);
    if (params?.academic_term) query.set('academic_term', params.academic_term);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<{ students: User[]; count: number; message?: string; status_code: number }>(
      `/api/teacher/students${qs}`
    );
  },

  getStudentSubjects: () =>
    apiRequest<{ subjects: SubjectItem[]; count: number; status_code: number }>('/api/student/subjects'),

  // File Upload API
  uploadFile: async (file: File, category: 'avatar' | 'document' = 'document') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    return apiRequest<{
      message: string;
      file_url: string;
      filename: string;
      original_name: string;
      file_type: string;
      size: number;
      category: string;
      status_code: number;
    }>('/api/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // Admin Routes
  getAdminUsers: (role?: string) => {
    const query = role ? `?role=${encodeURIComponent(role)}` : '';
    return apiRequest<{ users: User[]; count: number; status_code: number }>(`/api/admin/users${query}`);
  },

  adminGetUser: (userId: string) =>
    apiRequest<{ user: User; status_code: number }>(`/api/admin/users/${userId}`),

  adminCreateUser: (payload: {
    full_name: string;
    email: string;
    password: string;
    role: 'student' | 'teacher';
    student_id?: string;
    employee_id?: string;
    department?: string;
    contact_number?: string;
    is_active?: boolean;
    avatar_url?: string;
    must_change_password?: boolean;
    personal_info?: any;
    contact_info?: any;
    guardian_info?: any;
    academic_info?: any;
    professional_info?: any;
    employment_info?: any;
    documents?: any[];
  }) =>
    apiRequest<{ message: string; user: User; status_code: number }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminUpdateUser: (userId: string, data: Partial<User>) =>
    apiRequest<{ message: string; user: User; status_code: number }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  adminUpdateUserStatus: (userId: string, isActive: boolean) =>
    apiRequest<{ message: string; user: User; status_code: number }>(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    }),

  updateUserRole: (userId: string, role: UserRole) =>
    apiRequest<{ message: string; user: User; status_code: number }>(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  createTeacherAssignment: (teacherId: string, studentId: string) =>
    apiRequest<{ message: string; assignment: any; status_code: number }>('/api/admin/assignments', {
      method: 'POST',
      body: JSON.stringify({ teacher_id: teacherId, student_id: studentId }),
    }),

  // Admin Subject & Course Allocation Routes (Phase 6B & 6C)
  adminListSubjects: (activeOnly?: boolean) => {
    const qs = activeOnly !== undefined ? `?active_only=${activeOnly}` : '';
    return apiRequest<{ subjects: SubjectItem[]; count: number; status_code: number }>(`/api/admin/subjects${qs}`);
  },

  adminCreateSubject: (payload: {
    code: string;
    name: string;
    canonical_key: string;
    department?: string;
    description?: string;
    target_scale?: string;
  }) =>
    apiRequest<{ message: string; subject: SubjectItem; status_code: number }>('/api/admin/subjects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminUpdateSubjectStatus: (subjectId: string, isActive: boolean) =>
    apiRequest<{ message: string; subject: SubjectItem; status_code: number }>(`/api/admin/subjects/${subjectId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    }),

  adminListTeacherSubjects: (params?: {
    teacher_id?: string;
    subject_id?: string;
    academic_term?: string;
    status?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.teacher_id) query.set('teacher_id', params.teacher_id);
    if (params?.subject_id) query.set('subject_id', params.subject_id);
    if (params?.academic_term) query.set('academic_term', params.academic_term);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<{ assignments: TeacherSubjectAssignmentItem[]; count: number; status_code: number }>(
      `/api/admin/teacher-subjects${qs}`
    );
  },

  adminAssignTeacherSubject: (payload: {
    teacher_id: string;
    subject_id: string;
    academic_term: string;
  }) =>
    apiRequest<{ message: string; assignment: TeacherSubjectAssignmentItem; status_code: number }>(
      '/api/admin/teacher-subjects',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  adminUpdateTeacherSubjectStatus: (assignmentId: string, status: 'active' | 'inactive') =>
    apiRequest<{ message: string; assignment: TeacherSubjectAssignmentItem; status_code: number }>(
      `/api/admin/teacher-subjects/${assignmentId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }
    ),

  adminListStudentEnrollments: (params?: {
    student_id?: string;
    subject_id?: string;
    academic_term?: string;
    status?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.student_id) query.set('student_id', params.student_id);
    if (params?.subject_id) query.set('subject_id', params.subject_id);
    if (params?.academic_term) query.set('academic_term', params.academic_term);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<{ enrollments: StudentSubjectEnrollmentItem[]; count: number; status_code: number }>(
      `/api/admin/student-enrollments${qs}`
    );
  },

  adminEnrollStudent: (payload: {
    student_id: string;
    subject_id: string;
    academic_term: string;
  }) =>
    apiRequest<{ message: string; enrollment: StudentSubjectEnrollmentItem; status_code: number }>(
      '/api/admin/student-enrollments',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  adminUpdateStudentEnrollmentStatus: (enrollmentId: string, status: 'active' | 'dropped' | 'completed') =>
    apiRequest<{ message: string; enrollment: StudentSubjectEnrollmentItem; status_code: number }>(
      `/api/admin/student-enrollments/${enrollmentId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }
    ),

  getAuditLogs: (limit: number = 50) =>
    apiRequest<{ logs: SystemLog[]; count: number; status_code: number }>(`/api/admin/logs?limit=${limit}`),

  // Diagnostics
  getHealth: () =>
    apiRequest<{ status: string; app: string; database: any }>('/api/health'),

  // Prediction APIs (Phase 5B & 5C)
  getPredictionOptions: () =>
    apiRequest<{ options: PredictionOptions; status_code: number }>('/api/predictions/options'),

  createPrediction: (payload: CreatePredictionPayload) =>
    apiRequest<{ message: string; prediction: PredictionRecord; status_code: number }>(
      '/api/predictions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  listPredictions: (params?: {
    student_id?: string;
    subject?: string;
    milestone?: number;
    limit?: number;
    skip?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.student_id) query.set('student_id', params.student_id);
    if (params?.subject) query.set('subject', params.subject);
    if (params?.milestone !== undefined && params?.milestone !== null) {
      query.set('milestone', params.milestone.toString());
    }
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.skip) query.set('skip', params.skip.toString());
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<{
      predictions: PredictionRecord[];
      total_count: number;
      limit: number;
      skip: number;
      status_code: number;
    }>(`/api/predictions${qs}`);
  },

  getPredictionDetail: (predictionId: string) =>
    apiRequest<{ prediction: PredictionRecord; status_code: number }>(
      `/api/predictions/${predictionId}`
    ),

  // Analyst APIs (Phase 7A & SDC Privacy Safeguards)
  getAnalystOverview: () =>
    apiRequest<AnalystOverviewResponse>('/api/analyst/overview'),

  getAnalystCurriculumStats: () =>
    apiRequest<AnalystCurriculumStatsResponse>('/api/analyst/curriculum-stats'),

  getAnalystDiagnostics: () =>
    apiRequest<{ status: string; role: string; message: string; status_code: number }>(
      '/api/analyst/diagnostics'
    ),

  // Phase 7C: Academic Anomaly Detection & Human Monitoring
  listAnomalies: (params?: {
    page?: number;
    limit?: number;
    subject?: string;
    status?: string;
    severity?: string;
    is_benchmark?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.subject) query.set('subject', params.subject);
    if (params?.status) query.set('status', params.status);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.is_benchmark !== undefined) query.set('is_benchmark', String(params.is_benchmark));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<AnomalyListResponse>(`/api/anomalies${qs}`);
  },

  getAnomalyDetail: (anomalyId: string) =>
    apiRequest<{ anomaly: AnomalyRecord; status_code: number }>(
      `/api/anomalies/${anomalyId}`
    ),

  updateAnomalyStatus: (
    anomalyId: string,
    payload: { status: AnomalyReviewStatus; review_notes?: string }
  ) =>
    apiRequest<{ message: string; anomaly: AnomalyRecord; status_code: number }>(
      `/api/anomalies/${anomalyId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),

  batchEvaluateAnomalies: (subject?: string) => {
    const query = new URLSearchParams();
    if (subject) query.set('subject', subject);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<{
      message: string;
      subject: string;
      records_evaluated: number;
      anomalies_detected: number;
      status_code: number;
    }>(`/api/anomalies/batch-evaluate${qs}`, {
      method: 'POST',
    });
  },

  getAnalystAnomalyStats: () =>
    apiRequest<AnalystAnomalyStats>('/api/analyst/anomalies/stats'),
};

export const dropoutApi = {
  getStudentDropoutRisk: (studentId: string) =>
    apiRequest<{ status_code: number; assessment: DropoutRecord }>(
      `/api/dropout/student/${studentId}`
    ),

  getTeacherDropoutRoster: (page = 1, limit = 50) =>
    apiRequest<{
      status_code: number;
      students: DropoutRecord[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/dropout/teacher/roster?page=${page}&limit=${limit}`),

  getAdminDropoutOverview: () =>
    apiRequest<AdminDropoutOverviewResponse>('/api/dropout/admin/overview'),

  getAnalystDropoutOverview: () =>
    apiRequest<AnalystDropoutOverviewResponse>('/api/dropout/analyst/overview'),

  getModelMetadata: () =>
    apiRequest<{ status_code: number; metadata: any }>('/api/dropout/model-metadata'),

  predictStudentDropout: (payload: {
    student_id: string;
    features?: Record<string, any>;
    academic_term?: string;
    student_name?: string;
  }) =>
    apiRequest<{ status_code: number; assessment: DropoutRecord }>(
      '/api/dropout/predict',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  bulkPredict: (payload: {
    student_ids: string[];
    academic_term?: string;
    subject?: string;
  }) =>
    apiRequest<{
      status_code: number;
      total_requested: number;
      succeeded: number;
      failed: number;
      results: Array<{
        student_id: string;
        status: 'success' | 'error';
        assessment?: DropoutRecord;
        error?: string;
        status_code?: number;
      }>;
    }>('/api/dropout/predict/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getStudentDropoutHistory: (studentId: string, page = 1, limit = 20) =>
    apiRequest<{
      status_code: number;
      student_id: string;
      history: DropoutRecord[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/dropout/student/${studentId}/history?page=${page}&limit=${limit}`),

  getPredictionDetail: (predictionId: string) =>
    apiRequest<{ status_code: number; assessment: DropoutRecord }>(
      `/api/dropout/prediction/${predictionId}`
    ),

  getAdminDropoutRecords: (params?: {
    risk_tier?: string;
    academic_term?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.risk_tier) query.set('risk_tier', params.risk_tier);
    if (params?.academic_term) query.set('academic_term', params.academic_term);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<{
      status_code: number;
      records: DropoutRecord[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/dropout/admin/records${qs}`);
  },

  getAnalystDropoutTrends: () =>
    apiRequest<import('../types').AnalystDropoutTrendsResponse>('/api/dropout/analyst/trends'),
};

export const demandApi = {
  getOverview: (params?: { periods_ahead?: number; forecast_period?: string; department?: string }) => {
    const query = new URLSearchParams();
    if (params?.periods_ahead) query.set('periods_ahead', String(params.periods_ahead));
    if (params?.forecast_period) query.set('forecast_period', params.forecast_period);
    if (params?.department) query.set('department', params.department);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<DemandOverviewResponse>(`/api/demand/overview${qs}`);
  },

  generateForecast: (payload: {
    periods_ahead?: number;
    forecast_period?: string;
    subject_ids?: string[];
  }) =>
    apiRequest<{
      status_code: number;
      message: string;
      forecasts: CourseDemandForecastItem[];
      metadata: any;
    }>('/api/demand/forecast', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getHistory: (page = 1, limit = 20) =>
    apiRequest<{
      status_code: number;
      history: CourseDemandForecastItem[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/demand/history?page=${page}&limit=${limit}`),

  getSubjectForecast: (subjectId: string, periodsAhead = 1) =>
    apiRequest<{ status_code: number; forecast: CourseDemandForecastItem }>(
      `/api/demand/subject/${subjectId}?periods_ahead=${periodsAhead}`
    ),

  getModelMetadata: () =>
    apiRequest<{ status_code: number; methodology: any; latest_run: any }>('/api/demand/model-metadata'),
};

export const evaluationApi = {
  getDropoutEvaluation: () =>
    apiRequest<import('../types').DropoutEvaluationResponse>('/api/models/evaluation/dropout'),

  getDemandEvaluation: () =>
    apiRequest<import('../types').DemandEvaluationResponse>('/api/models/evaluation/demand'),

  listRegistryModels: (modelType?: 'dropout' | 'demand') => {
    const qs = modelType ? `?model_type=${modelType}` : '';
    return apiRequest<{
      status_code: number;
      models: import('../types').ModelRegistryItem[];
      total: number;
    }>(`/api/models/registry${qs}`);
  },

  activateModel: (modelId: string, approvalNotes: string) =>
    apiRequest<{ status_code: number; model: import('../types').ModelRegistryItem }>(
      `/api/models/registry/${modelId}/activate`,
      {
        method: 'POST',
        body: JSON.stringify({ approval_notes: approvalNotes }),
      }
    ),

  deactivateModel: (modelId: string) =>
    apiRequest<{ status_code: number; model: import('../types').ModelRegistryItem }>(
      `/api/models/registry/${modelId}/deactivate`,
      {
        method: 'POST',
      }
    ),
};

export interface StreamEventItem {
  id: string;
  event_id: string;
  event_type: 'attendance_update' | 'assessment_result' | 'lms_activity' | 'progress_update';
  subject_id: string | null;
  subject: string;
  academic_term: string;
  source: string;
  event_timestamp: string;
  received_at: string;
  processed_at: string | null;
  processing_latency_ms: number | null;
  status: 'pending' | 'processed' | 'failed' | 'duplicate';
  retry_count: number;
  error_message: string | null;
  is_out_of_order: boolean;
  has_missing_data: boolean;
  missing_fields: string[];
  is_backfill: boolean;
  prediction_id: string | null;
}

export interface StreamStatusResponse {
  status_code: number;
  metrics: {
    events_received: number;
    events_processed: number;
    events_failed: number;
    events_pending: number;
    out_of_order_events: number;
    incomplete_data_events: number;
    backfill_events: number;
    realtime_events: number;
    average_latency_ms: number | null;
    last_event_at: string | null;
    delivery_guarantee: string;
  };
  reconciliation: {
    realtime_processed: number;
    batch_backfill_processed: number;
    total_unique_processed: number;
    consistent: boolean;
  };
}

export const streamApi = {
  getStatus: () => apiRequest<StreamStatusResponse>('/api/stream/status'),

  listEvents: (params?: { limit?: number; status?: string }) => {
    const query = new URLSearchParams();
    query.set('format', 'json');
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    return apiRequest<{ status_code: number; events: StreamEventItem[]; total: number }>(
      `/api/stream/events?${query.toString()}`
    );
  },

  ingestEvent: (payload: {
    event_id: string;
    event_type: string;
    student_id: string;
    subject: string;
    academic_term: string;
    payload: Record<string, unknown>;
    event_timestamp?: string;
  }) =>
    apiRequest<{ status_code: number; status: string; event: StreamEventItem }>(
      '/api/stream/ingest',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  retryEvent: (eventId: string) =>
    apiRequest<{ status_code: number; status: string; event: StreamEventItem }>(
      `/api/stream/retry/${encodeURIComponent(eventId)}`,
      { method: 'POST' }
    ),
};

export interface BackupSummaryItem {
  backup_id: string;
  created_at: string;
  format_version: string;
  archive_size: number;
  total_documents: number;
  collection_count: number;
  verified: boolean;
  archive_exists: boolean;
}

export interface MonitoringOverviewResponse {
  status_code: number;
  application: {
    name: string;
    version: string;
    environment: string;
    status: string;
    uptime_seconds: number;
    timestamp: string;
  };
  database: {
    connected: boolean;
    status: string;
    latency_ms: number | null;
    server_version: string;
    collection_counts: Record<string, number>;
    total_indexes: number;
    storage_bytes: number | null;
  };
  streaming: {
    events_received: number;
    events_processed: number;
    events_failed: number;
    events_pending: number;
    average_latency_ms: number | null;
  };
  reconciliation: {
    realtime_processed: number;
    batch_backfill_processed: number;
    total_unique_processed: number;
    consistent: boolean;
  };
  backups: {
    total_available: number;
    latest: BackupSummaryItem | null;
  };
  errors: {
    failed_stream_events: number;
    recent_system_errors: number;
  };
}

export const monitoringApi = {
  getOverview: () => apiRequest<MonitoringOverviewResponse>('/api/monitoring/overview'),

  listBackups: () =>
    apiRequest<{ status_code: number; backups: BackupSummaryItem[]; total: number }>(
      '/api/monitoring/backups'
    ),

  createBackup: () =>
    apiRequest<{ status_code: number; backup: BackupSummaryItem }>(
      '/api/monitoring/backups',
      { method: 'POST' }
    ),

  verifyBackup: (backupId: string) =>
    apiRequest<{
      status_code: number;
      verified: boolean;
      backup_id: string;
      total_documents: number;
      collection_count: number;
    }>(`/api/monitoring/backups/${encodeURIComponent(backupId)}/verify`, {
      method: 'POST',
    }),
};


