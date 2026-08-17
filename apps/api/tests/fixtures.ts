import { prisma } from "../src/db/prisma";
import { signAppToken } from "../src/auth/jwt";

export interface FixtureSet {
  superAdmin: { id: string; email: string; token: string };
  hrAdmin: { id: string; email: string; token: string };
  manager: { id: string; email: string; token: string };
  employeeA: { id: string; email: string; token: string }; // reports to manager
  employeeB: { id: string; email: string; token: string }; // reports to manager
  outsiderEmployee: { id: string; email: string; token: string }; // reports to nobody in this tree
  inactiveEmployee: { id: string; email: string };
}

function tokenFor(employee: { id: string; employeeCode: string; email: string; name: string; role: string }) {
  return signAppToken({
    sub: employee.id,
    employeeCode: employee.employeeCode,
    email: employee.email,
    name: employee.name,
    role: employee.role as "EMPLOYEE" | "MANAGER" | "HR_ADMIN" | "SUPER_ADMIN",
  });
}

export async function seedFixtures(): Promise<FixtureSet> {
  await prisma.auditLog.deleteMany();
  await prisma.moodResponse.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.subDepartment.deleteMany();
  await prisma.department.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      name: "Test Org",
      timezone: "Asia/Kolkata",
      // Wide-open window so submission tests aren't time-of-day dependent.
      settings: {
        create: {
          timezone: "Asia/Kolkata",
          checkinStartTime: "00:00",
          checkinEndTime: "23:59",
          mandatory: true,
          allowLateCheckins: true,
          lowMoodThresholdCount: 3,
          lowMoodWindowDays: 7,
          decliningWindowDays: 21,
        },
      },
    },
  });

  const department = await prisma.department.create({ data: { name: "Engineering", organizationId: org.id } });
  const subDepartment = await prisma.subDepartment.create({ data: { name: "Core", departmentId: department.id } });
  const otherDept = await prisma.department.create({ data: { name: "Sales", organizationId: org.id } });
  const otherSub = await prisma.subDepartment.create({ data: { name: "Field Sales", departmentId: otherDept.id } });

  const base = {
    departmentId: department.id,
    subDepartmentId: subDepartment.id,
    dateJoined: new Date("2023-01-01"),
    employmentStatus: "ACTIVE" as const,
  };

  const superAdminRow = await prisma.employee.create({
    data: { ...base, employeeCode: "T-SA", name: "Super Admin", email: "super.admin@test.dev", jobTitle: "Platform Admin", role: "SUPER_ADMIN" },
  });
  const hrAdminRow = await prisma.employee.create({
    data: { ...base, employeeCode: "T-HR", name: "HR Admin", email: "hr.admin@test.dev", jobTitle: "HR Partner", role: "HR_ADMIN" },
  });
  const managerRow = await prisma.employee.create({
    data: { ...base, employeeCode: "T-MGR", name: "Team Manager", email: "manager@test.dev", jobTitle: "Manager", role: "MANAGER" },
  });
  const employeeARow = await prisma.employee.create({
    data: { ...base, employeeCode: "T-EMPA", name: "Employee A", email: "employee.a@test.dev", jobTitle: "Associate", role: "EMPLOYEE", managerId: managerRow.id },
  });
  const employeeBRow = await prisma.employee.create({
    data: { ...base, employeeCode: "T-EMPB", name: "Employee B", email: "employee.b@test.dev", jobTitle: "Associate", role: "EMPLOYEE", managerId: managerRow.id },
  });
  const outsiderRow = await prisma.employee.create({
    data: {
      departmentId: otherDept.id,
      subDepartmentId: otherSub.id,
      dateJoined: new Date("2023-01-01"),
      employmentStatus: "ACTIVE",
      employeeCode: "T-OUT",
      name: "Outsider Employee",
      email: "outsider@test.dev",
      jobTitle: "Associate",
      role: "EMPLOYEE",
    },
  });
  const inactiveRow = await prisma.employee.create({
    data: { ...base, employeeCode: "T-INACT", name: "Former Employee", email: "former@test.dev", jobTitle: "Associate", role: "EMPLOYEE", employmentStatus: "TERMINATED" },
  });

  return {
    superAdmin: { id: superAdminRow.id, email: superAdminRow.email, token: tokenFor(superAdminRow) },
    hrAdmin: { id: hrAdminRow.id, email: hrAdminRow.email, token: tokenFor(hrAdminRow) },
    manager: { id: managerRow.id, email: managerRow.email, token: tokenFor(managerRow) },
    employeeA: { id: employeeARow.id, email: employeeARow.email, token: tokenFor(employeeARow) },
    employeeB: { id: employeeBRow.id, email: employeeBRow.email, token: tokenFor(employeeBRow) },
    outsiderEmployee: { id: outsiderRow.id, email: outsiderRow.email, token: tokenFor(outsiderRow) },
    inactiveEmployee: { id: inactiveRow.id, email: inactiveRow.email },
  };
}
