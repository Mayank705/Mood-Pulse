import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { DepartmentNode } from "../types";
import ImportPanel from "../components/ImportPanel";
import SharePointSyncPanel from "../components/SharePointSyncPanel";
import { useDialog } from "../components/DialogProvider";

type Tab = "structure" | "employees";

export default function Organization() {
  const [tab, setTab] = useState<Tab>("structure");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Organization</h1>
        <p className="text-sm text-slate-500">Manage BUs, Competencies, and how employee records get into Daily Pulse.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            { key: "structure", label: "BUs & Competencies" },
            { key: "employees", label: "Employees" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-brand-600 text-brand-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "structure" ? <StructureTab /> : <EmployeesTab />}
    </div>
  );
}

function StructureTab() {
  const { token } = useAuth();
  const { confirm, prompt } = useDialog();
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDeptName, setNewDeptName] = useState("");
  const [newSubName, setNewSubName] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    api
      .get<{ departments: DepartmentNode[] }>("/api/departments", token)
      .then((res) => setDepartments(res.departments))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [token]);

  async function addDepartment() {
    if (!newDeptName.trim()) return;
    setError(null);
    try {
      await api.post("/api/departments", token, { name: newDeptName.trim() });
      setNewDeptName("");
      reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't add BU");
    }
  }

  async function renameDepartment(id: string, currentName: string) {
    const name = await prompt({ title: "Rename BU", initialValue: currentName });
    if (!name || name === currentName) return;
    try {
      await api.patch(`/api/departments/${id}`, token, { name });
      reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't rename BU");
    }
  }

  async function deleteDepartment(id: string) {
    const ok = await confirm({
      title: "Delete this BU?",
      message: "Only possible if it has no Competencies or employees left.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/departments/${id}`, token);
      reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't delete BU");
    }
  }

  async function addSubDepartment(departmentId: string) {
    const name = (newSubName[departmentId] ?? "").trim();
    if (!name) return;
    setError(null);
    try {
      await api.post(`/api/departments/${departmentId}/sub-departments`, token, { name });
      setNewSubName({ ...newSubName, [departmentId]: "" });
      reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't add Competency");
    }
  }

  async function renameSubDepartment(departmentId: string, subId: string, currentName: string) {
    const name = await prompt({ title: "Rename Competency", initialValue: currentName });
    if (!name || name === currentName) return;
    try {
      await api.patch(`/api/departments/${departmentId}/sub-departments/${subId}`, token, { name });
      reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't rename Competency");
    }
  }

  async function deleteSubDepartment(departmentId: string, subId: string) {
    const ok = await confirm({
      title: "Delete this Competency?",
      message: "Only possible if it has no employees left.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/departments/${departmentId}/sub-departments/${subId}`, token);
      reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't delete Competency");
    }
  }

  return (
    <div className="space-y-6 mt-2">
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Structure</h3>
          <div className="flex gap-2">
            <input
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDepartment()}
              placeholder="New BU name"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <button onClick={addDepartment} className="rounded-full bg-brand-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-brand-700">
              + Add BU
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-rose-500 mb-3">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="space-y-4">
            {departments.map((dept) => (
              <div key={dept.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-slate-700">{dept.name}</span>
                  <div className="flex gap-3">
                    <button onClick={() => renameDepartment(dept.id, dept.name)} className="text-xs font-semibold text-brand-600 hover:underline">
                      Rename
                    </button>
                    <button onClick={() => deleteDepartment(dept.id)} className="text-xs font-semibold text-rose-500 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>

                <div className="pl-4 border-l-2 border-slate-100 space-y-1.5">
                  {dept.subDepartments.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-slate-600">{sub.name}</span>
                      <div className="flex gap-3">
                        <button onClick={() => renameSubDepartment(dept.id, sub.id, sub.name)} className="text-xs text-brand-600 hover:underline">
                          Rename
                        </button>
                        <button onClick={() => deleteSubDepartment(dept.id, sub.id)} className="text-xs text-rose-500 hover:underline">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <input
                      value={newSubName[dept.id] ?? ""}
                      onChange={(e) => setNewSubName({ ...newSubName, [dept.id]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && addSubDepartment(dept.id)}
                      placeholder="New Competency name"
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs flex-1 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                    <button
                      onClick={() => addSubDepartment(dept.id)}
                      className="text-xs font-semibold text-brand-600 hover:underline whitespace-nowrap"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {departments.length === 0 && <p className="text-sm text-slate-400">No BUs yet — add one above.</p>}
          </div>
        )}
      </div>

      <ImportPanel
        title="Bulk import / update from Excel"
        description="Upload a spreadsheet listing BU / Competency pairs. Existing names are left untouched — safe to re-run."
        templatePath="/api/departments/import/template"
        templateFilename="bus-template.xlsx"
        importPath="/api/departments/import"
        exportPath="/api/departments/export"
        exportFilename="bus-current.xlsx"
        exportLabel="Export current BUs (.xlsx)"
        onImported={reload}
      />

      <SharePointSyncPanel syncPath="/api/departments/import/sharepoint" filePathHint="General/BUs.xlsx" onSynced={reload} />
    </div>
  );
}

function EmployeesTab() {
  return (
    <div className="space-y-6 mt-2">
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Adding or editing one employee at a time</h3>
        <p className="text-xs text-slate-400 mb-3">
          Use the <Link to="/employees" className="text-brand-600 font-semibold hover:underline">Employee Directory</Link> to add a
          single employee, edit their details, or deactivate someone who has left.
        </p>
      </div>

      <ImportPanel
        title="Bulk import / update from Excel"
        description="Upload a spreadsheet of employees. Existing employees (matched by Employee ID) are updated, not duplicated; new BUs/Competencies referenced by name are created automatically."
        templatePath="/api/employees/import/template"
        templateFilename="employees-template.xlsx"
        importPath="/api/employees/import"
        exportPath="/api/employees/export"
        exportFilename="employees-current.xlsx"
        exportLabel="Export current employees (.xlsx)"
      />

      <SharePointSyncPanel syncPath="/api/employees/import/sharepoint" filePathHint="General/Employees.xlsx" />
    </div>
  );
}
