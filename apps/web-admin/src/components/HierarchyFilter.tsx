import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { DepartmentNode, HierarchyFilterValue } from "../types";

interface Props {
  value: HierarchyFilterValue;
  onChange: (value: HierarchyFilterValue) => void;
}

/** BU -> Competency -> SuperCoach cascading filter, used across the Overview, BUs, and Employee Directory screens. */
export default function HierarchyFilter({ value, onChange }: Props) {
  const { token } = useAuth();
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);

  useEffect(() => {
    api
      .get<{ departments: DepartmentNode[] }>("/api/departments", token)
      .then((res) => setDepartments(res.departments))
      .catch(() => setDepartments([]));
  }, [token]);

  const selectedDept = departments.find((d) => d.id === value.departmentId);
  const selectedSub = selectedDept?.subDepartments.find((s) => s.id === value.subDepartmentId);

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        label="BU"
        value={value.departmentId ?? ""}
        onChange={(v) => onChange({ departmentId: v || undefined })}
        options={[{ value: "", label: "All BUs" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
      />
      <Select
        label="Competency"
        value={value.subDepartmentId ?? ""}
        disabled={!selectedDept}
        onChange={(v) => onChange({ ...value, subDepartmentId: v || undefined, managerId: undefined })}
        options={[
          { value: "", label: "All Competencies" },
          ...(selectedDept?.subDepartments.map((s) => ({ value: s.id, label: s.name })) ?? []),
        ]}
      />
      <Select
        label="SuperCoach"
        value={value.managerId ?? ""}
        disabled={!selectedSub}
        onChange={(v) => onChange({ ...value, managerId: v || undefined })}
        options={[{ value: "", label: "All SuperCoaches" }, ...(selectedSub?.employees.map((m) => ({ value: m.id, label: m.name })) ?? [])]}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-200 min-w-[160px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
