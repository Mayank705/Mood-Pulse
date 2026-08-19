import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import DialogProvider from "./components/DialogProvider";
import Login from "./pages/Login";
import Layout from "./layout/Layout";
import Overview from "./pages/Overview";
import Departments from "./pages/Departments";
import DepartmentDetail from "./pages/DepartmentDetail";
import Team from "./pages/Team";
import EmployeeDirectory from "./pages/EmployeeDirectory";
import EmployeeDetail from "./pages/EmployeeDetail";
import Organization from "./pages/Organization";
import Trends from "./pages/Trends";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import UsersRoles from "./pages/UsersRoles";
import AuditLogs from "./pages/AuditLogs";
import RequirePermission from "./components/RequirePermission";

function Gate() {
  const { status, can, user } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  if (status !== "signed-in") {
    return <Login />;
  }

  // A plain MANAGER has no org-wide analytics permission — their landing
  // page is their own team, not the (blocked) org Overview.
  const landingPath = can("analytics:view_org") ? "overview" : user?.role === "MANAGER" ? "team" : "overview";

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to={landingPath} replace />} />
          <Route
            path="overview"
            element={
              <RequirePermission permission="analytics:view_org">
                <Overview />
              </RequirePermission>
            }
          />
          <Route
            path="departments"
            element={
              <RequirePermission permission="analytics:view_department">
                <Departments />
              </RequirePermission>
            }
          />
          <Route
            path="departments/:id"
            element={
              <RequirePermission permission="analytics:view_department">
                <DepartmentDetail />
              </RequirePermission>
            }
          />
          <Route path="team" element={<Team />} />
          <Route
            path="employees"
            element={
              <RequirePermission permission="employee:view_directory">
                <EmployeeDirectory />
              </RequirePermission>
            }
          />
          <Route path="employees/:id" element={<EmployeeDetail />} />
          <Route
            path="organization"
            element={
              <RequirePermission permission="hierarchy:manage">
                <Organization />
              </RequirePermission>
            }
          />
          <Route
            path="trends"
            element={
              <RequirePermission permission="analytics:view_org">
                <Trends />
              </RequirePermission>
            }
          />
          <Route
            path="reports"
            element={
              <RequirePermission permission="reports:export">
                <Reports />
              </RequirePermission>
            }
          />
          <Route
            path="settings"
            element={
              <RequirePermission permission="settings:manage">
                <Settings />
              </RequirePermission>
            }
          />
          <Route
            path="users"
            element={
              <RequirePermission permission="users:manage">
                <UsersRoles />
              </RequirePermission>
            }
          />
          <Route
            path="audit-logs"
            element={
              <RequirePermission permission="audit:view">
                <AuditLogs />
              </RequirePermission>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <DialogProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </DialogProvider>
  );
}
