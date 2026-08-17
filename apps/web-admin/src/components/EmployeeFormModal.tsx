import { useEffect, useMemo, useState } from "react";
import { api, ApiClientError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { DepartmentNode, EmployeeSummary, Role, ROLE_LABEL } from "../types";

interface Props {
  departments: DepartmentNode[];
  employee?: EmployeeSummary | null; // undefined/null = create mode
  onClose: () => void;
  onSaved: () => void;
}

interface ManagerOption {
  id: string;
  name: string;
  email: string;
}

const ROLES: Role[] = ["EMPLOYEE", "MANAGER", "HR_ADMIN", "SUPER_ADMIN"];

export default function EmployeeFormModal({ departments, employee, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const isEdit = Boolean(employee);

  const [employeeCode, setEmployeeCode] = useState(employee?.employeeCode ?? "");
  const [name, setName] = useState(employee?.name ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [departmentId, setDepartmentId] = useState(employee?.department.id ?? departments[0]?.id ?? "");
  const [subDepartmentId, setSubDepartmentId] = useState(employee?.subDepartment.id ?? "");
  const [jobTitle, setJobTitle] = useState(employee?.jobTitle ?? "");
  const [role, setRole] = useState<Role>(employee?.role ?? "EMPLOYEE");
  const [dateJoined, setDateJoined] = useState(employee?.dateJoined?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));

  const [managerSearch, setManagerSearch] = useState(employee?.manager?.name ?? "");
  const [managerId, setManagerId] = useState<string | undefined>(employee?.manager?.id);
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDept = useMemo(() => departments.find((d) => d.id === departmentId), [departments, departmentId]);

  useEffect(() => {
    if (!subDepartmentId && selectedDept?.subDepartments[0]) {
      setSubDepartmentId(selectedDept.subDepartments[0].id);
    }
  }, [selectedDept, subDepartmentId]);

  useEffect(() => {
    if (managerSearch.trim().length < 2) {
      setManagerOptions([]);
      return;
    }
    const handle = setTimeout(() => {
      api
        .get<{ employees: { id: string; name: string; email: string }[] }>(
          `/api/employees?search=${encodeURIComponent(managerSearch)}`,
          token
        )
        .then((res) => setManagerOptions(res.employees.filter((e) => e.id !== employee?.id)))
        .catch(() => setManagerOptions([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [managerSearch, token, employee?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        employeeCode,
        name,
        email,
        departmentId,
        subDepartmentId,
        managerId,
        jobTitle,
        role,
        dateJoined,
      };
      if (isEdit && employee) {
        await api.put(`/api/employees/${employee.id}`, token, payload);
      } else {
        await api.post("/api/employees", token, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save this employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">{isEdit ? "Edit Employee" : "Add Employee"}</h2>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee ID">
            <input required disabled={isEdit} value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} className="input" />
          </Field>
          <Field label="Job Title">
            <input required value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="input" />
          </Field>
          <Field label="Full name" span2>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </Field>
          <Field label="Email" span2>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          <Field label="BU">
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setSubDepartmentId("");
              }}
              className="input"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Competency">
            <select value={subDepartmentId} onChange={(e) => setSubDepartmentId(e.target.value)} className="input">
              {selectedDept?.subDepartments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date joined">
            <input type="date" value={dateJoined} onChange={(e) => setDateJoined(e.target.value)} className="input" />
          </Field>
          <Field label="SuperCoach" span2>
            <input
              value={managerSearch}
              onChange={(e) => {
                setManagerSearch(e.target.value);
                setManagerId(undefined);
              }}
              placeholder="Search by name or email"
              className="input"
            />
            {managerOptions.length > 0 && (
              <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden">
                {managerOptions.slice(0, 6).map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => {
                      setManagerId(m.id);
                      setManagerSearch(m.name);
                      setManagerOptions([]);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50"
                  >
                    {m.name} <span className="text-slate-400 text-xs">{m.email}</span>
                  </button>
                ))}
              </div>
            )}
          </Field>
        </div>

        {error && <p className="text-sm text-rose-500 mt-4">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500 px-4 py-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-brand-600 text-white px-5 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Employee"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${span2 ? "col-span-2" : ""}`}>
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}
