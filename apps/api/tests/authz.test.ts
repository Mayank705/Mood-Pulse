import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { seedFixtures, FixtureSet } from "./fixtures";

const app = createApp();
let fixtures: FixtureSet;

beforeAll(async () => {
  fixtures = await seedFixtures();
});

describe("employee access restrictions", () => {
  it("cannot view the employee directory", async () => {
    const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${fixtures.employeeA.token}`);
    expect(res.status).toBe(403);
  });

  it("cannot view the org dashboard overview", async () => {
    const res = await request(app).get("/api/dashboard/overview").set("Authorization", `Bearer ${fixtures.employeeA.token}`);
    expect(res.status).toBe(403);
  });

  it("cannot view another employee's profile", async () => {
    const res = await request(app).get(`/api/employees/${fixtures.employeeB.id}`).set("Authorization", `Bearer ${fixtures.employeeA.token}`);
    expect(res.status).toBe(403);
  });

  it("can view their own mood history", async () => {
    const res = await request(app)
      .get(`/api/employees/${fixtures.employeeA.id}/mood-history`)
      .set("Authorization", `Bearer ${fixtures.employeeA.token}`);
    expect(res.status).toBe(200);
  });

  it("cannot manage the org hierarchy", async () => {
    const res = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${fixtures.employeeA.token}`)
      .send({ name: "New Department" });
    expect(res.status).toBe(403);
  });

  it("cannot bulk-import departments or employees", async () => {
    const deptRes = await request(app)
      .post("/api/departments/import")
      .set("Authorization", `Bearer ${fixtures.employeeA.token}`);
    expect(deptRes.status).toBe(403);

    const empRes = await request(app)
      .post("/api/employees/import")
      .set("Authorization", `Bearer ${fixtures.employeeA.token}`);
    expect(empRes.status).toBe(403);
  });

  it("cannot deactivate an employee", async () => {
    const res = await request(app)
      .delete(`/api/employees/${fixtures.employeeB.id}`)
      .set("Authorization", `Bearer ${fixtures.employeeA.token}`);
    expect(res.status).toBe(403);
  });
});

describe("manager access restrictions", () => {
  it("can view a direct report's profile", async () => {
    const res = await request(app).get(`/api/employees/${fixtures.employeeA.id}`).set("Authorization", `Bearer ${fixtures.manager.token}`);
    expect(res.status).toBe(200);
  });

  it("cannot view an employee outside their reporting structure", async () => {
    const res = await request(app)
      .get(`/api/employees/${fixtures.outsiderEmployee.id}`)
      .set("Authorization", `Bearer ${fixtures.manager.token}`);
    expect(res.status).toBe(403);
  });

  it("can view their team roster", async () => {
    const res = await request(app).get(`/api/managers/${fixtures.manager.id}/team`).set("Authorization", `Bearer ${fixtures.manager.token}`);
    expect(res.status).toBe(200);
    const ids = res.body.team.map((t: { employee: { id: string } }) => t.employee.id);
    expect(ids).toContain(fixtures.employeeA.id);
    expect(ids).toContain(fixtures.employeeB.id);
    expect(ids).not.toContain(fixtures.outsiderEmployee.id);
  });

  it("cannot view another manager's team analytics", async () => {
    const res = await request(app)
      .get(`/api/managers/${fixtures.superAdmin.id}/team-analytics`)
      .set("Authorization", `Bearer ${fixtures.manager.token}`);
    expect(res.status).toBe(403);
  });

  it("cannot change organization settings", async () => {
    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${fixtures.manager.token}`)
      .send({ mandatory: false });
    expect(res.status).toBe(403);
  });

  it("cannot rename or delete a department", async () => {
    const deptsRes = await request(app).get("/api/departments").set("Authorization", `Bearer ${fixtures.hrAdmin.token}`);
    const someDeptId = deptsRes.body.departments[0].id;

    const renameRes = await request(app)
      .patch(`/api/departments/${someDeptId}`)
      .set("Authorization", `Bearer ${fixtures.manager.token}`)
      .send({ name: "Renamed" });
    expect(renameRes.status).toBe(403);

    const deleteRes = await request(app).delete(`/api/departments/${someDeptId}`).set("Authorization", `Bearer ${fixtures.manager.token}`);
    expect(deleteRes.status).toBe(403);
  });
});

describe("HR admin access", () => {
  it("can view the full employee directory, including employees outside any one manager's team", async () => {
    const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${fixtures.hrAdmin.token}`);
    expect(res.status).toBe(200);
    const ids = res.body.employees.map((e: { id: string }) => e.id);
    expect(ids).toContain(fixtures.outsiderEmployee.id);
  });

  it("can view org-wide dashboard overview", async () => {
    const res = await request(app).get("/api/dashboard/overview").set("Authorization", `Bearer ${fixtures.hrAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.overview).toHaveProperty("totalEmployees");
  });

  it("can export reports", async () => {
    const res = await request(app).get("/api/reports/mood?format=csv").set("Authorization", `Bearer ${fixtures.hrAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
  });

  it("cannot change employee roles (Super Admin only)", async () => {
    const res = await request(app)
      .patch(`/api/employees/${fixtures.employeeA.id}/role`)
      .set("Authorization", `Bearer ${fixtures.hrAdmin.token}`)
      .send({ role: "MANAGER" });
    expect(res.status).toBe(403);
  });

  it("can rename a department and deactivate an employee", async () => {
    const deptsRes = await request(app).get("/api/departments").set("Authorization", `Bearer ${fixtures.hrAdmin.token}`);
    const someDeptId = deptsRes.body.departments[0].id;

    const renameRes = await request(app)
      .patch(`/api/departments/${someDeptId}`)
      .set("Authorization", `Bearer ${fixtures.hrAdmin.token}`)
      .send({ name: "Renamed Department" });
    expect(renameRes.status).toBe(200);
    expect(renameRes.body.department.name).toBe("Renamed Department");

    const deactivateRes = await request(app)
      .delete(`/api/employees/${fixtures.outsiderEmployee.id}`)
      .set("Authorization", `Bearer ${fixtures.hrAdmin.token}`);
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.employee.employmentStatus).toBe("TERMINATED");
  });
});

describe("super admin access", () => {
  it("can change organization settings", async () => {
    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${fixtures.superAdmin.token}`)
      .send({ checkinStartTime: "07:30" });
    expect(res.status).toBe(200);
    expect(res.body.settings.checkinStartTime).toBe("07:30");
  });

  it("can view audit logs", async () => {
    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${fixtures.superAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("logs");
  });

  it("can change an employee's role", async () => {
    const res = await request(app)
      .patch(`/api/employees/${fixtures.employeeA.id}/role`)
      .set("Authorization", `Bearer ${fixtures.superAdmin.token}`)
      .send({ role: "MANAGER" });
    expect(res.status).toBe(200);
    expect(res.body.employee.role).toBe("MANAGER");
  });
});
