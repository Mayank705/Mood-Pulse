import ExcelJS from "exceljs";
import { prisma } from "../db/prisma";
import { EMPLOYMENT_STATUSES, EmploymentStatus, ROLES, Role } from "../types/enums";

export interface RowError {
  row: number;
  message: string;
}

export interface ImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: RowError[];
}

function emptySummary(): ImportSummary {
  return { totalRows: 0, created: 0, updated: 0, skipped: 0, errors: [] };
}

/**
 * Reads the first worksheet of an .xlsx buffer into an array of objects
 * keyed by (trimmed, case-insensitive) header name from row 1. Shared by
 * both the direct file-upload path and the SharePoint sync path, since a
 * workbook downloaded from SharePoint is byte-identical to one uploaded by
 * hand.
 */
export async function readRowsForImport(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const value = cellToString(cell.value);
      if (value !== "") hasValue = true;
      record[header] = value;
    });
    if (hasValue) rows.push(record);
  });

  return rows;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "");
  if (typeof value === "object" && "result" in value) return String((value as { result: unknown }).result ?? "");
  return String(value).trim();
}

function field(record: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
    if (key && record[key]) return record[key].trim();
  }
  return "";
}

// ---------------------------------------------------------------------------
// Departments & Sub-departments
// ---------------------------------------------------------------------------

export async function departmentsTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Departments");
  sheet.columns = [
    { header: "Department", key: "department", width: 26 },
    { header: "Sub-department", key: "subDepartment", width: 28 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({ department: "Audit", subDepartment: "Financial Services" });
  sheet.addRow({ department: "Audit", subDepartment: "Public Sector" });
  sheet.addRow({ department: "Advisory", subDepartment: "Risk Advisory" });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function importDepartmentsFromBuffer(buffer: Buffer, organizationId: string): Promise<ImportSummary> {
  const rows = await readRowsForImport(buffer);
  return importDepartmentRows(rows, organizationId);
}

export async function importDepartmentRows(rows: Record<string, string>[], organizationId: string): Promise<ImportSummary> {
  const summary = emptySummary();
  summary.totalRows = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // header is row 1
    const departmentName = field(rows[i], "Department", "Department Name");
    const subDepartmentName = field(rows[i], "Sub-department", "Sub Department", "SubDepartment");

    if (!departmentName) {
      summary.errors.push({ row: rowNumber, message: "Missing Department name" });
      continue;
    }

    try {
      const department = await prisma.department.upsert({
        where: { organizationId_name: { organizationId, name: departmentName } },
        update: {},
        create: { organizationId, name: departmentName },
      });

      if (!subDepartmentName) {
        summary.skipped++; // department-only row — nothing else to do
        continue;
      }

      const existing = await prisma.subDepartment.findUnique({
        where: { departmentId_name: { departmentId: department.id, name: subDepartmentName } },
      });
      await prisma.subDepartment.upsert({
        where: { departmentId_name: { departmentId: department.id, name: subDepartmentName } },
        update: {},
        create: { departmentId: department.id, name: subDepartmentName },
      });
      existing ? summary.skipped++ : summary.created++;
    } catch (err) {
      summary.errors.push({ row: rowNumber, message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export async function employeesTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees");
  sheet.columns = [
    { header: "Employee ID", key: "employeeCode", width: 14 },
    { header: "Name", key: "name", width: 22 },
    { header: "Email", key: "email", width: 28 },
    { header: "Department", key: "department", width: 20 },
    { header: "Sub-department", key: "subDepartment", width: 22 },
    { header: "Manager Email", key: "managerEmail", width: 28 },
    { header: "Job Title", key: "jobTitle", width: 22 },
    { header: "Role", key: "role", width: 14 },
    { header: "Employment Status", key: "employmentStatus", width: 16 },
    { header: "Date Joined", key: "dateJoined", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    employeeCode: "EMP-1001",
    name: "Jane Smith",
    email: "jane.smith@company.com",
    department: "Audit",
    subDepartment: "Financial Services",
    managerEmail: "manager@company.com",
    jobTitle: "Senior Associate",
    role: "EMPLOYEE",
    employmentStatus: "ACTIVE",
    dateJoined: "2024-01-15",
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

interface EmployeeImportRow {
  rowNumber: number;
  employeeCode: string;
  name: string;
  email: string;
  department: string;
  subDepartment: string;
  managerEmail: string;
  jobTitle: string;
  role: string;
  employmentStatus: string;
  dateJoined: string;
}

function toEmployeeRow(record: Record<string, string>, rowNumber: number): EmployeeImportRow {
  return {
    rowNumber,
    employeeCode: field(record, "Employee ID", "Employee Code", "EmployeeCode"),
    name: field(record, "Name", "Employee Name"),
    email: field(record, "Email"),
    department: field(record, "Department"),
    subDepartment: field(record, "Sub-department", "Sub Department", "SubDepartment"),
    managerEmail: field(record, "Manager Email", "ManagerEmail"),
    jobTitle: field(record, "Job Title", "JobTitle", "Title"),
    role: field(record, "Role").toUpperCase(),
    employmentStatus: field(record, "Employment Status", "EmploymentStatus").toUpperCase(),
    dateJoined: field(record, "Date Joined", "DateJoined"),
  };
}

async function resolveDepartmentAndSubDepartment(organizationId: string, departmentName: string, subDepartmentName: string) {
  const department = await prisma.department.upsert({
    where: { organizationId_name: { organizationId, name: departmentName } },
    update: {},
    create: { organizationId, name: departmentName },
  });
  const subDepartment = await prisma.subDepartment.upsert({
    where: { departmentId_name: { departmentId: department.id, name: subDepartmentName } },
    update: {},
    create: { departmentId: department.id, name: subDepartmentName },
  });
  return { department, subDepartment };
}

/**
 * Employee import is two-pass so manager references work regardless of
 * row order in the spreadsheet: pass 1 creates/updates every employee
 * (without touching managerId), pass 2 resolves each row's "Manager Email"
 * against the now-complete set of employees.
 */
export async function importEmployeesFromBuffer(buffer: Buffer, organizationId: string): Promise<ImportSummary> {
  const raw = await readRowsForImport(buffer);
  return importEmployeeRows(raw, organizationId);
}

export async function importEmployeeRows(raw: Record<string, string>[], organizationId: string): Promise<ImportSummary> {
  const summary = emptySummary();
  summary.totalRows = raw.length;
  const rows = raw.map((r, i) => toEmployeeRow(r, i + 2));
  const codeToId = new Map<string, string>();

  for (const row of rows) {
    if (!row.employeeCode || !row.name || !row.email || !row.department || !row.subDepartment || !row.jobTitle) {
      summary.errors.push({
        row: row.rowNumber,
        message: "Missing a required field (Employee ID, Name, Email, Department, Sub-department, or Job Title)",
      });
      continue;
    }

    const role: Role = ROLES.includes(row.role as Role) ? (row.role as Role) : "EMPLOYEE";
    const employmentStatus: EmploymentStatus = EMPLOYMENT_STATUSES.includes(row.employmentStatus as EmploymentStatus)
      ? (row.employmentStatus as EmploymentStatus)
      : "ACTIVE";
    const dateJoined = row.dateJoined ? new Date(row.dateJoined) : new Date();
    if (Number.isNaN(dateJoined.getTime())) {
      summary.errors.push({ row: row.rowNumber, message: `Could not read "Date Joined" value: ${row.dateJoined}` });
      continue;
    }

    try {
      const { department, subDepartment } = await resolveDepartmentAndSubDepartment(organizationId, row.department, row.subDepartment);

      const existing = await prisma.employee.findUnique({ where: { employeeCode: row.employeeCode } });
      const emailOwner = await prisma.employee.findUnique({ where: { email: row.email.toLowerCase() } });
      if (emailOwner && emailOwner.employeeCode !== row.employeeCode) {
        summary.errors.push({ row: row.rowNumber, message: `Email ${row.email} is already used by employee ${emailOwner.employeeCode}` });
        continue;
      }

      const data = {
        name: row.name,
        email: row.email.toLowerCase(),
        departmentId: department.id,
        subDepartmentId: subDepartment.id,
        jobTitle: row.jobTitle,
        role,
        employmentStatus,
        dateJoined,
      };

      const employee = existing
        ? await prisma.employee.update({ where: { id: existing.id }, data })
        : await prisma.employee.create({ data: { ...data, employeeCode: row.employeeCode } });

      codeToId.set(row.employeeCode, employee.id);
      existing ? summary.updated++ : summary.created++;
    } catch (err) {
      summary.errors.push({ row: row.rowNumber, message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  // Pass 2: resolve manager relationships now that every row's employee exists.
  for (const row of rows) {
    if (!row.managerEmail) continue;
    const employeeId = codeToId.get(row.employeeCode);
    if (!employeeId) continue; // this row already failed in pass 1

    const manager = await prisma.employee.findUnique({ where: { email: row.managerEmail.toLowerCase() } });
    if (!manager) {
      summary.errors.push({ row: row.rowNumber, message: `Manager email ${row.managerEmail} does not match any employee` });
      continue;
    }
    if (manager.id === employeeId) {
      summary.errors.push({ row: row.rowNumber, message: "An employee cannot be their own manager" });
      continue;
    }
    await prisma.employee.update({ where: { id: employeeId }, data: { managerId: manager.id } });
  }

  return summary;
}
