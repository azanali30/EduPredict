import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoadingState } from './components/common/LoadingState';

// Layouts
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';

// Public Pages (Code-split with React.lazy)
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

// Student Pages (Code-split with React.lazy)
const StudentOverview = React.lazy(() =>
  import('./pages/student/StudentOverview').then((m) => ({ default: m.StudentOverview }))
);
const StudentProfile = React.lazy(() =>
  import('./pages/student/StudentProfile').then((m) => ({ default: m.StudentProfile }))
);
const StudentRecords = React.lazy(() =>
  import('./pages/student/StudentRecords').then((m) => ({ default: m.StudentRecords }))
);
const StudentPredictions = React.lazy(() =>
  import('./pages/student/StudentPredictions').then((m) => ({ default: m.StudentPredictions }))
);

// Teacher Pages (Code-split with React.lazy)
const TeacherOverview = React.lazy(() =>
  import('./pages/teacher/TeacherOverview').then((m) => ({ default: m.TeacherOverview }))
);
const TeacherStudents = React.lazy(() =>
  import('./pages/teacher/TeacherStudents').then((m) => ({ default: m.TeacherStudents }))
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
const TeacherReports = React.lazy(() =>
  import('./pages/teacher/TeacherReports').then((m) => ({ default: m.TeacherReports }))
);
const TeacherProfile = React.lazy(() =>
  import('./pages/teacher/TeacherProfile').then((m) => ({ default: m.TeacherProfile }))
);
const TeacherSettings = React.lazy(() =>
  import('./pages/teacher/TeacherSettings').then((m) => ({ default: m.TeacherSettings }))
);

// Admin Pages (Code-split with React.lazy)
const AdminOverview = React.lazy(() =>
  import('./pages/admin/AdminOverview').then((m) => ({ default: m.AdminOverview }))
);
const UserManagement = React.lazy(() =>
  import('./pages/admin/UserManagement').then((m) => ({ default: m.UserManagement }))
);
const TeacherAssignments = React.lazy(() =>
  import('./pages/admin/TeacherAssignments').then((m) => ({ default: m.TeacherAssignments }))
);
const SystemLogs = React.lazy(() =>
  import('./pages/admin/SystemLogs').then((m) => ({ default: m.SystemLogs }))
);

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher" replace />;
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
              <Route path="/student/records" element={<StudentRecords />} />
              <Route path="/student/predictions" element={<StudentPredictions />} />
            </Route>

            {/* Teacher Protected Workspace */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/teacher" element={<TeacherOverview />} />
              <Route path="/teacher/students" element={<TeacherStudents />} />
              <Route path="/teacher/performance" element={<TeacherPerformance />} />
              <Route path="/teacher/predictions" element={<TeacherPredictions />} />
              <Route path="/teacher/at-risk" element={<TeacherAtRisk />} />
              <Route path="/teacher/reports" element={<TeacherReports />} />
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
              <Route path="/admin/assignments" element={<TeacherAssignments />} />
              <Route path="/admin/logs" element={<SystemLogs />} />
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
