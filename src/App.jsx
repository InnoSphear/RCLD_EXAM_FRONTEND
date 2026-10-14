import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import StudentLayout from './components/StudentLayout';

import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';

import AdminDashboard from './pages/admin/AdminDashboard';
import Semesters from './pages/admin/Semesters';
import Students from './pages/admin/Students';
import StudentImport from './pages/admin/StudentImport';
import Staff from './pages/admin/Staff';
import Questions from './pages/admin/Questions';
import QuestionImport from './pages/admin/QuestionImport';
import Exams from './pages/admin/Exams';
import ExamEditor from './pages/admin/ExamEditor';
import ExamMonitor from './pages/admin/ExamMonitor';
import Results from './pages/admin/Results';
import AuditLogs from './pages/admin/AuditLogs';

import StudentDashboard from './pages/student/Dashboard';
import StudentExams from './pages/student/Exams';
import ExamPlayer from './pages/student/ExamPlayer';
import StudentResults from './pages/student/Results';
import Profile from './pages/student/Profile';

const ADMIN_ROLES = ['superadmin', 'admin', 'subadmin'];

const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="semesters" element={<Semesters />} />
            <Route path="students" element={<Students />} />
            <Route path="students/import" element={<StudentImport />} />
            <Route path="staff" element={<Staff />} />
            <Route path="questions" element={<Questions />} />
            <Route path="questions/import" element={<QuestionImport />} />
            <Route path="exams" element={<Exams />} />
            <Route path="exams/new" element={<ExamEditor />} />
            <Route path="exams/:id/edit" element={<ExamEditor />} />
            <Route path="exams/:id/monitor" element={<ExamMonitor />} />
            <Route path="results" element={<Results />} />
            <Route path="audit-logs" element={<AuditLogs />} />
          </Route>

          <Route
            path="/student"
            element={
              <ProtectedRoute roles={['student', 'superadmin', 'admin']}>
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StudentDashboard />} />
            <Route path="exams" element={<StudentExams />} />
            <Route path="exam/:attemptId" element={<ExamPlayer />} />
            <Route path="results" element={<StudentResults />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
