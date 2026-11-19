import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TeacherSubjectProvider } from './context/TeacherSubjectContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoadingState } from './components/common/LoadingState';

// Layouts
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';

// Public Auth Pages
const LoginPage = React.lazy(() =>
  import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = React.lazy(() =>
  import('./pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);
const ForgotPasswordPage = React.lazy(() =>
  import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const UnauthorizedPage = React.lazy(() =>
  import('./pages/status/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage }))
);
const NotFoundPage = React.lazy(() =>
  import('./pages/status/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

// Student Pages
const StudentOverview = React.lazy(() =>
  import('./pages/student/StudentOverview').then((m) => ({ default: m.StudentOverview }))
);
const StudentProfile = React.lazy(() =>
  import('./pages/student/StudentProfile').then((m) => ({ default: m.StudentProfile }))
);
const StudentSubjects = React.lazy(() =>
  import('./pages/student/StudentSubjects').then((m) => ({ default: m.StudentSubjects }))
);
const StudentRecords = React.lazy(() =>
  import('./pages/student/StudentRecords').then((m) => ({ default: m.StudentRecords }))
);
const StudentPerformance = React.lazy(() =>
  import('./pages/student/StudentPerformance').then((m) => ({ default: m.StudentPerformance }))
);
const StudentPredictions = React.lazy(() =>
  import('./pages/student/StudentPredictions').then((m) => ({ default: m.StudentPredictions }))
);
const StudentProgress = React.lazy(() =>
  import('./pages/student/StudentProgress').then((m) => ({ default: m.StudentProgress }))
);
const StudentRecommendations = React.lazy(() =>
  import('./pages/student/StudentRecommendations').then((m) => ({ default: m.StudentRecommendations }))
);
const StudentAttendance = React.lazy(() =>
  import('./pages/student/StudentAttendance').then((m) => ({ default: m.StudentAttendance }))
);
const StudentNotifications = React.lazy(() =>
  import('./pages/student/StudentNotifications').then((m) => ({ default: m.StudentNotifications }))
);
const StudentFeedback = React.lazy(() =>
  import('./pages/student/StudentFeedback').then((m) => ({ default: m.StudentFeedback }))
);
const StudentSettings = React.lazy(() =>
  import('./pages/student/StudentSettings').then((m) => ({ default: m.StudentSettings }))
);

// Teacher Pages
const TeacherOverview = React.lazy(() =>
  import('./pages/teacher/TeacherOverview').then((m) => ({ default: m.TeacherOverview }))
);
const TeacherSubjects = React.lazy(() =>
  import('./pages/teacher/TeacherSubjects').then((m) => ({ default: m.TeacherSubjects }))
);
const TeacherStudents = React.lazy(() =>
  import('./pages/teacher/TeacherStudents').then((m) => ({ default: m.TeacherStudents }))
);
const TeacherAcademicRecords = React.lazy(() =>
  import('./pages/teacher/TeacherAcademicRecords').then((m) => ({ default: m.TeacherAcademicRecords }))
);
const TeacherPerformance = React.lazy(() =>
  import('./pages/teacher/TeacherPerformance').then((m) => ({ default: m.TeacherPerformance }))
);
const TeacherPredictions = React.lazy(() =>
  import('./pages/teacher/TeacherPredictions').then((m) => ({ default: m.TeacherPredictions }))
);
const TeacherAtRisk = React.lazy(() =>
  import('./pages/teacher/TeacherAtRisk').then((m) => ({ default: m.TeacherAtRisk }))
);
const TeacherAnomalies = React.lazy(() =>
  import('./pages/teacher/TeacherAnomalies').then((m) => ({ default: m.TeacherAnomalies }))
);
const TeacherAttendance = React.lazy(() =>
  import('./pages/teacher/TeacherAttendance').then((m) => ({ default: m.TeacherAttendance }))
);
const TeacherReports = React.lazy(() =>
  import('./pages/teacher/TeacherReports').then((m) => ({ default: m.TeacherReports }))
);
const TeacherNotifications = React.lazy(() =>
  import('./pages/teacher/TeacherNotifications').then((m) => ({ default: m.TeacherNotifications }))
);
const TeacherFeedback = React.lazy(() =>
  import('./pages/teacher/TeacherFeedback').then((m) => ({ default: m.TeacherFeedback }))
);
const TeacherProfile = React.lazy(() =>
  import('./pages/teacher/TeacherProfile').then((m) => ({ default: m.TeacherProfile }))
);
const TeacherSettings = React.lazy(() =>
  import('./pages/teacher/TeacherSettings').then((m) => ({ default: m.TeacherSettings }))
);

// Admin Pages
const AdminOverview = React.lazy(() =>
  import('./pages/admin/AdminOverview').then((m) => ({ default: m.AdminOverview }))
);
const UserManagement = React.lazy(() =>
  import('./pages/admin/UserManagement').then((m) => ({ default: m.UserManagement }))
);
const AdminStudents = React.lazy(() =>
  import('./pages/admin/AdminStudents').then((m) => ({ default: m.AdminStudents }))
);
const AdminTeachers = React.lazy(() =>
  import('./pages/admin/AdminTeachers').then((m) => ({ default: m.AdminTeachers }))
);
const AdminCurriculum = React.lazy(() =>
  import('./pages/admin/AdminCurriculum').then((m) => ({ default: m.AdminCurriculum }))
);
const AdminEnrollments = React.lazy(() =>
  import('./pages/admin/AdminEnrollments').then((m) => ({ default: m.AdminEnrollments }))
);
const TeacherAssignments = React.lazy(() =>
  import('./pages/admin/TeacherAssignments').then((m) => ({ default: m.TeacherAssignments }))
);
const AdminAcademicRecords = React.lazy(() =>
  import('./pages/admin/AdminAcademicRecords').then((m) => ({ default: m.AdminAcademicRecords }))
);
const AdminAnalytics = React.lazy(() =>
  import('./pages/admin/AdminAnalytics').then((m) => ({ default: m.AdminAnalytics }))
);
const AdminPredictions = React.lazy(() =>
  import('./pages/admin/AdminPredictions').then((m) => ({ default: m.AdminPredictions }))
);
const AdminRiskMonitoring = React.lazy(() =>
  import('./pages/admin/AdminRiskMonitoring').then((m) => ({ default: m.AdminRiskMonitoring }))
);
const AdminReports = React.lazy(() =>
  import('./pages/admin/AdminReports').then((m) => ({ default: m.AdminReports }))
);
const AdminDataManagement = React.lazy(() =>
  import('./pages/admin/AdminDataManagement').then((m) => ({ default: m.AdminDataManagement }))
);
const AdminNotifications = React.lazy(() =>
  import('./pages/admin/AdminNotifications').then((m) => ({ default: m.AdminNotifications }))
);
const AdminFeedback = React.lazy(() =>
  import('./pages/admin/AdminFeedback').then((m) => ({ default: m.AdminFeedback }))
);
const SystemLogs = React.lazy(() =>
  import('./pages/admin/SystemLogs').then((m) => ({ default: m.SystemLogs }))
);
const AdminSettings = React.lazy(() =>
  import('./pages/admin/AdminSettings').then((m) => ({ default: m.AdminSettings }))
);

// Analyst Pages
const AnalystOverview = React.lazy(() =>
  import('./pages/analyst/AnalystOverview').then((m) => ({ default: m.AnalystOverview }))
);
const AnalystInstitutional = React.lazy(() =>
  import('./pages/analyst/AnalystInstitutional').then((m) => ({ default: m.AnalystInstitutional }))
);
const AnalystCurriculum = React.lazy(() =>
  import('./pages/analyst/AnalystCurriculum').then((m) => ({ default: m.AnalystCurriculum }))
);
const AnalystTrends = React.lazy(() =>
  import('./pages/analyst/AnalystTrends').then((m) => ({ default: m.AnalystTrends }))
);
const AnalystRisk = React.lazy(() =>
  import('./pages/analyst/AnalystRisk').then((m) => ({ default: m.AnalystRisk }))
);
const AnalystAnomalies = React.lazy(() =>
  import('./pages/analyst/AnalystAnomalies').then((m) => ({ default: m.AnalystAnomalies }))
);
const AnalystDataQuality = React.lazy(() =>
  import('./pages/analyst/AnalystDataQuality').then((m) => ({ default: m.AnalystDataQuality }))
);
const AnalystReports = React.lazy(() =>
  import('./pages/analyst/AnalystReports').then((m) => ({ default: m.AnalystReports }))
);
const AnalystSettings = React.lazy(() =>
  import('./pages/analyst/AnalystSettings').then((m) => ({ default: m.AnalystSettings }))
);

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher" replace />;
  if (user.role === 'analyst') return <Navigate to="/analyst" replace />;
  return <Navigate to="/student" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
              <LoadingState
                title="Initializing EduPredict Workspace..."
                description="Synchronizing secure session and assets."
              />
            </div>
          }
        >
          <Routes>
            {/* Root dynamic redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Public Authentication Layout */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Student Protected Workspace */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/student" element={<StudentOverview />} />
              <Route path="/student/profile" element={<StudentProfile />} />
              <Route path="/student/subjects" element={<StudentSubjects />} />
              <Route path="/student/records" element={<StudentRecords />} />
              <Route path="/student/performance" element={<StudentPerformance />} />
              <Route path="/student/predictions" element={<StudentPredictions />} />
              <Route path="/student/progress" element={<StudentProgress />} />
              <Route path="/student/recommendations" element={<StudentRecommendations />} />
              <Route path="/student/attendance" element={<StudentAttendance />} />
              <Route path="/student/notifications" element={<StudentNotifications />} />
              <Route path="/student/feedback" element={<StudentFeedback />} />
              <Route path="/student/settings" element={<StudentSettings />} />
            </Route>

            {/* Teacher Protected Workspace */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherSubjectProvider>
                    <DashboardLayout />
                  </TeacherSubjectProvider>
                </ProtectedRoute>
              }
            >
              <Route path="/teacher" element={<TeacherOverview />} />
              <Route path="/teacher/subjects" element={<TeacherSubjects />} />
              <Route path="/teacher/students" element={<TeacherStudents />} />
              <Route path="/teacher/academic-records" element={<TeacherAcademicRecords />} />
              <Route path="/teacher/performance" element={<TeacherPerformance />} />
              <Route path="/teacher/predictions" element={<TeacherPredictions />} />
              <Route path="/teacher/at-risk" element={<TeacherAtRisk />} />
              <Route path="/teacher/anomalies" element={<TeacherAnomalies />} />
              <Route path="/teacher/attendance" element={<TeacherAttendance />} />
              <Route path="/teacher/reports" element={<TeacherReports />} />
              <Route path="/teacher/notifications" element={<TeacherNotifications />} />
              <Route path="/teacher/feedback" element={<TeacherFeedback />} />
              <Route path="/teacher/profile" element={<TeacherProfile />} />
              <Route path="/teacher/settings" element={<TeacherSettings />} />
            </Route>

            {/* Administrator Protected Workspace */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/students" element={<AdminStudents />} />
              <Route path="/admin/teachers" element={<AdminTeachers />} />
              <Route path="/admin/curriculum" element={<AdminCurriculum />} />
              <Route path="/admin/enrollments" element={<AdminEnrollments />} />
              <Route path="/admin/assignments" element={<TeacherAssignments />} />
              <Route path="/admin/academic-records" element={<AdminAcademicRecords />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/predictions" element={<AdminPredictions />} />
              <Route path="/admin/risk-monitoring" element={<AdminRiskMonitoring />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/data-management" element={<AdminDataManagement />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/feedback" element={<AdminFeedback />} />
              <Route path="/admin/logs" element={<SystemLogs />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>

            {/* Analyst Protected Workspace */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['analyst']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/analyst" element={<AnalystOverview />} />
              <Route path="/analyst/institutional" element={<AnalystInstitutional />} />
              <Route path="/analyst/curriculum" element={<AnalystCurriculum />} />
              <Route path="/analyst/trends" element={<AnalystTrends />} />
              <Route path="/analyst/risk" element={<AnalystRisk />} />
              <Route path="/analyst/anomalies" element={<AnalystAnomalies />} />
              <Route path="/analyst/data-quality" element={<AnalystDataQuality />} />
              <Route path="/analyst/reports" element={<AnalystReports />} />
              <Route path="/analyst/settings" element={<AnalystSettings />} />
            </Route>

            {/* Status & Fallback Pages */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
