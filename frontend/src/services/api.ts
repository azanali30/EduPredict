import { User, UserRole, SystemLog } from '../types';

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

  let response = await fetch(endpoint, config);

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
    const errorMessage =
      responseData?.message ||
      responseData?.error ||
      `HTTP Error ${response.status}: ${response.statusText}`;
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

  updateProfile: (payload: { full_name: string }) =>
    apiRequest<{ message: string; user: User; status_code: number }>('/api/me', {
      method: 'PUT',
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

  getTeacherStudents: () =>
    apiRequest<{ students: User[]; count: number; status_code: number }>('/api/teacher/students'),

  // Admin Routes
  getAdminUsers: (role?: string) => {
    const query = role ? `?role=${encodeURIComponent(role)}` : '';
    return apiRequest<{ users: User[]; count: number; status_code: number }>(`/api/admin/users${query}`);
  },

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

  getAuditLogs: (limit: number = 50) =>
    apiRequest<{ logs: SystemLog[]; count: number; status_code: number }>(`/api/admin/logs?limit=${limit}`),

  // Diagnostics
  getHealth: () =>
    apiRequest<{ status: string; app: string; database: any }>('/api/health'),
};
