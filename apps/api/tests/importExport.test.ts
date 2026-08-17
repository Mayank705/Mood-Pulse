import { beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "../src/db/prisma";
import { importDepartmentsFromBuffer, importEmployeesFromBuffer } from "../src/services/importExport.service";

let organizationId: string;

async function buildWorkbook(headers: string[], rows: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

beforeAll(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.moodResponse.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.subDepartment.deleteMany();
  await prisma.department.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.organization.deleteMany();
  const org = await prisma.organization.create({ data: { name: "Import Test Org", settings: { create: {} } } });
  organizationId = org.id;
});

describe("department/sub-department import", () => {
  it("creates new departments and sub-departments from a workbook", async () => {
    const buffer = await buildWorkbook(
      ["Department", "Sub-department"],
      [
        ["Audit", "Financial Services"],
        ["Audit", "Public Sector"],
        ["Advisory", "Risk Advisory"],
      ]
    );

    const summary = await importDepartmentsFromBuffer(buffer, organizationId);

    expect(summary.totalRows).toBe(3);
    expect(summary.created).toBe(3);
    expect(summary.errors).toHaveLength(0);

    const audit = await prisma.department.findUnique({ where: { organizationId_name: { organizationId, name: "Audit" } } });
    expect(audit).not.toBeNull();
    const subDepts = await prisma.subDepartment.findMany({ where: { departmentId: audit!.id } });
    expect(subDepts.map((s) => s.name).sort()).toEqual(["Financial Services", "Public Sector"]);
  });

  it("is safe to re-import the same workbook without creating duplicates", async () => {
    const buffer = await buildWorkbook(["Department", "Sub-department"], [["Audit", "Financial Services"]]);
    const before = await prisma.department.count();

    const summary = await importDepartmentsFromBuffer(buffer, organizationId);

    expect(summary.created).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(await prisma.department.count()).toBe(before);
  });

  it("reports a row-level error instead of throwing when the BU name is missing", async () => {
    const buffer = await buildWorkbook(["Department", "Sub-department"], [["", "Orphan Sub-department"]]);
    const summary = await importDepartmentsFromBuffer(buffer, organizationId);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].message).toMatch(/BU/);
  });
});

describe("employee import", () => {
  it("creates employees, auto-creating referenced department/sub-department, and resolves manager by email regardless of row order", async () => {
    const buffer = await buildWorkbook(
      ["Employee ID", "Name", "Email", "Department", "Sub-department", "Manager Email", "Job Title", "Role"],
      [
        // Report listed before their manager — must still resolve.
        ["EMP-2001", "Alex Report", "alex.report@test.dev", "Technology", "Platform Engineering", "sam.manager@test.dev", "Analyst", "EMPLOYEE"],
        ["EMP-2000", "Sam Manager", "sam.manager@test.dev", "Technology", "Platform Engineering", "", "Manager", "MANAGER"],
      ]
    );

    const summary = await importEmployeesFromBuffer(buffer, organizationId);

    expect(summary.created).toBe(2);
    expect(summary.errors).toHaveLength(0);

    const report = await prisma.employee.findUnique({ where: { employeeCode: "EMP-2001" }, include: { manager: true, department: true, subDepartment: true } });
    expect(report?.manager?.employeeCode).toBe("EMP-2000");
    expect(report?.department.name).toBe("Technology");
    expect(report?.subDepartment.name).toBe("Platform Engineering");
  });

  it("updates an existing employee on re-import instead of duplicating", async () => {
    const buffer = await buildWorkbook(
      ["Employee ID", "Name", "Email", "Department", "Sub-department", "Job Title"],
      [["EMP-2000", "Samantha Manager", "sam.manager@test.dev", "Technology", "Platform Engineering", "Senior Manager"]]
    );

    const summary = await importEmployeesFromBuffer(buffer, organizationId);
    expect(summary.updated).toBe(1);
    expect(summary.created).toBe(0);

    const employee = await prisma.employee.findUnique({ where: { employeeCode: "EMP-2000" } });
    expect(employee?.name).toBe("Samantha Manager");
    expect(employee?.jobTitle).toBe("Senior Manager");
  });

  it("reports a row-level error for a missing required field without failing the whole import", async () => {
    const buffer = await buildWorkbook(
      ["Employee ID", "Name", "Email", "Department", "Sub-department", "Job Title"],
      [
        ["EMP-2002", "", "missing.name@test.dev", "Technology", "Platform Engineering", "Analyst"],
        ["EMP-2003", "Valid Employee", "valid.employee@test.dev", "Technology", "Platform Engineering", "Analyst"],
      ]
    );

    const summary = await importEmployeesFromBuffer(buffer, organizationId);
    expect(summary.errors).toHaveLength(1);
    expect(summary.created).toBe(1);
    expect(await prisma.employee.findUnique({ where: { employeeCode: "EMP-2003" } })).not.toBeNull();
  });

  it("rejects a row whose email is already used by a different employee code", async () => {
    const buffer = await buildWorkbook(
      ["Employee ID", "Name", "Email", "Department", "Sub-department", "Job Title"],
      [["EMP-9999", "Duplicate Email", "sam.manager@test.dev", "Technology", "Platform Engineering", "Analyst"]]
    );

    const summary = await importEmployeesFromBuffer(buffer, organizationId);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].message).toMatch(/already used/i);
  });
});
