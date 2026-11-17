import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';

// Layouts
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';

// Public Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { UnauthorizedPage } from './pages/status/UnauthorizedPage';
import { NotFoundPage } from './pages/status/NotFoundPage';

// Student Pages
import { StudentOverview } from './pages/student/StudentOverview';
import { StudentProfile } from './pages/student/StudentProfile';
import { StudentRecords } from './pages/student/StudentRecords';
import { StudentPredictions } from './pages/student/StudentPredictions';

// Teacher Pages
import { TeacherOverview } from './pages/teacher/TeacherOverview';
import { TeacherStudents } from './pages/teacher/TeacherStudents';

// Admin Pages
import { AdminOverview } from './pages/admin/AdminOverview';
import { UserManagement } from './pages/admin/UserManagement';
import { TeacherAssignments } from './pages/admin/TeacherAssignments';
import { SystemLogs } from './pages/admin/SystemLogs';

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
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
