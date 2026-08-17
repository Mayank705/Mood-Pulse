import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, buildQuery } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import HierarchyFilter from "../components/HierarchyFilter";
import { EmployeeSummary, HierarchyFilterValue } from "../types";

export default function EmployeeDirectory() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<HierarchyFilterValue>({});
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const query = buildQuery({
      departmentId: filter.departmentId,
      subDepartmentId: filter.subDepartmentId,
      managerId: filter.managerId,
      search: search || undefined,
    });
    api
      .get<{ employees: EmployeeSummary[] }>(`/api/employees${query}`, token)
      .then((res) => setEmployees(res.employees))
      .finally(() => setLoading(false));
  }, [token, filter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employee Directory</h1>
          <p className="text-sm text-slate-500">{employees.length} employees in this view.</p>
        </div>
        <div className="flex items-end gap-3">
          <HierarchyFilter value={filter} onChange={setFilter} />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-400">Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50">
              <th className="px-6 py-3 font-medium">Employee</th>
              <th className="px-6 py-3 font-medium">Department</th>
              <th className="px-6 py-3 font-medium">Manager</th>
              <th className="px-6 py-3 font-medium">Title</th>
              <th className="px-6 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {employees.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-6 py-3">
                  <Link to={`/employees/${e.id}`} className="font-medium text-slate-700 hover:text-brand-600">
                    {e.name}
                  </Link>
                  <p className="text-xs text-slate-400">{e.employeeCode}</p>
                </td>
                <td className="px-6 py-3 text-slate-500">
                  {e.department.name} <span className="text-slate-300">/</span> {e.subDepartment.name}
                </td>
                <td className="px-6 py-3 text-slate-500">{e.manager?.name ?? "—"}</td>
                <td className="px-6 py-3 text-slate-500">{e.jobTitle}</td>
                <td className="px-6 py-3">
                  <span className="text-xs font-medium bg-slate-100 text-slate-500 rounded-full px-2.5 py-1">{e.role}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && employees.length === 0 && <p className="text-sm text-slate-400 py-10 text-center">No employees match this filter.</p>}
        {loading && <p className="text-sm text-slate-400 py-10 text-center">Loading…</p>}
      </div>
    </div>
  );
}
