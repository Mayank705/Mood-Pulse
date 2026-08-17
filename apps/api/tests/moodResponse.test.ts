import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { seedFixtures, FixtureSet } from "./fixtures";
import { calendarDateKey } from "../src/utils/timezone";

const app = createApp();
let fixtures: FixtureSet;

beforeAll(async () => {
  fixtures = await seedFixtures();
});

describe("authentication", () => {
  it("rejects requests with no bearer token", async () => {
    const res = await request(app).get("/api/mood-responses/today");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a garbage token", async () => {
    const res = await request(app).get("/api/mood-responses/today").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("rejects a token for an inactive (terminated) employee via dev-login", async () => {
    const res = await request(app).post("/api/auth/dev-login").send({ email: fixtures.inactiveEmployee.email });
    expect(res.status).toBe(401);
  });

  it("issues a valid token for an active employee via dev-login", async () => {
    const res = await request(app).post("/api/auth/dev-login").send({ email: fixtures.employeeA.email });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
});

describe("mood check-in — once-per-day and duplicate submission", () => {
  it("shows no submission for today before the employee checks in", async () => {
    const res = await request(app).get("/api/mood-responses/today").set("Authorization", `Bearer ${fixtures.employeeA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.alreadySubmitted).toBe(false);
  });

  it("rejects an invalid mood value", async () => {
    const res = await request(app)
      .post("/api/mood-responses")
      .set("Authorization", `Bearer ${fixtures.employeeA.token}`)
      .send({ mood: "SUPER_HAPPY" });
    expect(res.status).toBe(400);
  });

  it("accepts a valid submission without a comment (comment is optional)", async () => {
    const res = await request(app)
      .post("/api/mood-responses")
      .set("Authorization", `Bearer ${fixtures.employeeA.token}`)
      .send({ mood: "GOOD" });
    expect(res.status).toBe(201);
  });

  it("now reports the day as already submitted", async () => {
    const res = await request(app).get("/api/mood-responses/today").set("Authorization", `Bearer ${fixtures.employeeA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.alreadySubmitted).toBe(true);
  });

  it("rejects a second submission the same day with 409", async () => {
    const res = await request(app)
      .post("/api/mood-responses")
      .set("Authorization", `Bearer ${fixtures.employeeA.token}`)
      .send({ mood: "VERY_LOW", comment: "trying again" });
    expect(res.status).toBe(409);
  });

  it("never exposes numeric mood values on the submission response", async () => {
    const res = await request(app)
      .post("/api/mood-responses")
      .set("Authorization", `Bearer ${fixtures.employeeB.token}`)
      .send({ mood: "OKAY" });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/moodValue/);
  });

  it("enforces the once-per-employee-per-day rule at the database level, not just in application code", async () => {
    const today = calendarDateKey("Asia/Kolkata");
    await expect(
      prisma.moodResponse.create({
        data: {
          employeeId: fixtures.employeeA.id,
          mood: "VERY_HAPPY",
          moodValue: 5,
          responseDate: today,
          responseTime: new Date(),
        },
      })
    ).rejects.toThrow();
  });

  it("accepts a comment at the 500 character limit", async () => {
    const res = await request(app)
      .post("/api/mood-responses")
      .set("Authorization", `Bearer ${fixtures.outsiderEmployee.token}`)
      .send({ mood: "OKAY", comment: "x".repeat(500) });
    expect(res.status).toBe(201);
  });

  it("rejects a comment beyond the 500 character limit", async () => {
    const res = await request(app)
      .post("/api/mood-responses")
      .set("Authorization", `Bearer ${fixtures.hrAdmin.token}`)
      .send({ mood: "OKAY", comment: "x".repeat(501) });
    expect(res.status).toBe(400);
  });
});
