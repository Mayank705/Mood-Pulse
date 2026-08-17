import { useEffect, useState } from "react";
import { api, buildQuery } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { EmployeeSummary, Role, ROLE_LABEL } from "../types";

const ROLES: Role[] = ["EMPLOYEE", "MANAGER", "HR_ADMIN", "SUPER_ADMIN"];

export default function UsersRoles() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ employees: EmployeeSummary[] }>(`/api/employees${buildQuery({ search: search || undefined })}`, token)
      .then((r) => setEmployees(r.employees));
  }, [token, search]);

  async function changeRole(id: string, role: Role) {
    setPendingId(id);
    try {
      await api.patch(`/api/employees/${id}/role`, token, { role });
      setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, role } : e)));
      setSavedId(id);
      setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 2000);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Users & Roles</h1>
          <p className="text-sm text-slate-500">Grant SuperCoach, HR/Admin, or Super Admin access. Employee is the default for everyone else.</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50">
              <th className="px-6 py-3 font-medium">Employee</th>
              <th className="px-6 py-3 font-medium">BU</th>
              <th className="px-6 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="px-6 py-3">
                  <p className="font-medium text-slate-700">{e.name}</p>
                  <p className="text-xs text-slate-400">{e.email}</p>
                </td>
                <td className="px-6 py-3 text-slate-500">{e.department.name}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={e.role}
                      disabled={pendingId === e.id}
                      onChange={(ev) => changeRole(e.id, ev.target.value as Role)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-200"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    {savedId === e.id && <span className="text-xs text-emerald-600">Saved</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
