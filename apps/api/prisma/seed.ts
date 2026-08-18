/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import { MOOD_VALUE, MoodLevel } from "../src/types/enums";

const prisma = new PrismaClient();

// --- deterministic PRNG so demo data is stable across re-seeds -------------
let seedState = 42;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Rohan",
  "Priya", "Ananya", "Diya", "Saanvi", "Aadhya", "Myra", "Anika", "Riya", "Ira", "Kavya",
  "Rahul", "Rajesh", "Suresh", "Amit", "Vikram", "Sanjay", "Manoj", "Ravi", "Deepak", "Nikhil",
  "Neha", "Pooja", "Sunita", "Kiran", "Meera", "Shreya", "Divya", "Nisha", "Swati", "Anjali",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Kumar", "Singh", "Patel", "Rao", "Reddy", "Nair", "Iyer",
  "Mehta", "Shah", "Joshi", "Chopra", "Malhotra", "Kapoor", "Bose", "Menon", "Pillai", "Desai",
];

const DEPARTMENTS: Record<string, string[]> = {
  Audit: ["Financial Services", "Manufacturing", "Public Sector"],
  Advisory: ["Technology Consulting", "Risk Advisory", "Deals"],
  Tax: ["Corporate Tax", "Indirect Tax", "Transfer Pricing"],
  Technology: ["Platform Engineering", "Data & Analytics", "IT Support"],
  "Human Resources": ["Talent Acquisition", "People Operations"],
};

const JOB_TITLES = ["Analyst", "Associate", "Senior Associate", "Consultant", "Senior Consultant"];

const POSITIVE_COMMENTS = ["Great team catch-up yesterday!", "Feeling productive this week.", "Good progress on the client deliverable."];
const LOW_COMMENTS = ["Workload has been heavy lately.", "Bit tired this week.", "Tight deadline is stressful.", ""];
const NEUTRAL_COMMENTS = ["", "", "Usual Monday.", ""];

type Pattern = "stable_positive" | "stable_neutral" | "declining" | "improving" | "repeated_low" | "missing_responses";
const PATTERNS: Pattern[] = ["stable_positive", "stable_neutral", "declining", "improving", "repeated_low", "missing_responses"];

const MOOD_ORDER: MoodLevel[] = ["VERY_HAPPY", "GOOD", "OKAY", "NOT_GREAT", "VERY_LOW"];

/** Picks a mood, biased around a target value (1-5) with some noise, clamped to 1-5. */
function moodNear(target: number): MoodLevel {
  const noisy = Math.round(target + (rand() - 0.5) * 2);
  const clamped = Math.min(5, Math.max(1, noisy));
  return MOOD_ORDER[5 - clamped];
}

function commentFor(mood: MoodLevel): string | null {
  const value = MOOD_VALUE[mood];
  const roll = rand();
  if (value <= 2 && roll < 0.4) return pick(LOW_COMMENTS) || null;
  if (value >= 4 && roll < 0.25) return pick(POSITIVE_COMMENTS);
  if (roll < 0.1) return pick(NEUTRAL_COMMENTS) || null;
  return null;
}

/**
 * Business days (Mon-Fri) for the last `count` calendar days, oldest first,
 * ending yesterday rather than today. Seed data deliberately never includes
 * today's date so every employee's daily check-in is still open right after
 * seeding — this data exists to populate history/trends, not to pre-fill
 * the one response a real person is about to submit themselves.
 */
function businessDays(count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.length < count) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) days.unshift(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days;
}

async function generateMoodHistory(employeeId: string, pattern: Pattern) {
  const days = businessDays(35); // ~5 weeks of workdays, well over the required 30 days
  const entries: { employeeId: string; mood: MoodLevel; moodValue: number; comment: string | null; responseDate: Date; responseTime: Date }[] = [];

  days.forEach((date, idx) => {
    const progress = idx / (days.length - 1); // 0 (oldest) -> 1 (most recent)

    if (pattern === "missing_responses" && rand() < 0.35) return; // simulate a lower response rate

    let target: number;
    switch (pattern) {
      case "stable_positive":
        target = 4.3;
        break;
      case "stable_neutral":
        target = 3.1;
        break;
      case "declining":
        target = 4.4 - progress * 2.4; // starts happy, ends low
        break;
      case "improving":
        target = 2.2 + progress * 2.4; // starts low, ends happy
        break;
      case "repeated_low":
        // generally low, and more consistently low in the most recent stretch
        target = progress > 0.75 ? 1.6 : 2.6;
        break;
      case "missing_responses":
        target = 3.4;
        break;
      default:
        target = 3.5;
    }

    const mood = moodNear(target);
    const submitHour = randInt(7, 10);
    const submitMinute = randInt(0, 59);
    const responseTime = new Date(date);
    responseTime.setUTCHours(submitHour, submitMinute, 0, 0);

    entries.push({
      employeeId,
      mood,
      moodValue: MOOD_VALUE[mood],
      comment: commentFor(mood),
      responseDate: date,
      responseTime,
    });
  });

  if (entries.length > 0) {
    await prisma.moodResponse.createMany({ data: entries });
  }
}

/**
 * --minimal: wipes everything and leaves just an empty org structure plus
 * one Super Admin account (no fake departments, no fake employees, no mood
 * history) — the starting point for bringing in a real organization's data
 * by hand or via Excel/SharePoint import, instead of the demo dataset.
 */
async function seedMinimal() {
  console.log("Resetting to a minimal (real-data-ready) state...");

  await prisma.auditLog.deleteMany();
  await prisma.moodResponse.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.subDepartment.deleteMany();
  await prisma.department.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      name: "Your Organization",
      timezone: "Asia/Kolkata",
      settings: { create: { timezone: "Asia/Kolkata" } },
    },
  });

  // A placeholder BU/Competency to hang the bootstrap Super Admin account
  // on — Employee requires a BU and Competency. Rename these (or move the
  // admin account and delete them) once real BUs exist.
  const department = await prisma.department.create({ data: { name: "Administration", organizationId: org.id } });
  const subDepartment = await prisma.subDepartment.create({ data: { name: "Platform", departmentId: department.id } });

  const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error(
      "SEED_SUPER_ADMIN_EMAIL is not set in apps/api/.env — set it to the real email you'll sign in with, then re-run this."
    );
  }

  await prisma.employee.create({
    data: {
      name: "System Administrator",
      email: adminEmail,
      employeeCode: "EMP-0000",
      departmentId: department.id,
      subDepartmentId: subDepartment.id,
      jobTitle: "Platform Super Admin",
      role: "SUPER_ADMIN",
      employmentStatus: "ACTIVE",
      dateJoined: new Date(),
    },
  });

  console.log(`Ready. Organization "${org.name}" has one Super Admin account and no employees yet.`);
  console.log(`Sign in with: ${adminEmail}`);
  console.log(`Now add your real BUs, Competencies, and employees from the Organization page (manually or via Excel/SharePoint import).`);
}

async function main() {
  console.log("Seeding Daily Pulse demo data...");

  await prisma.auditLog.deleteMany();
  await prisma.moodResponse.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.subDepartment.deleteMany();
  await prisma.department.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      name: "Northbridge Advisory Group",
      timezone: "Asia/Kolkata",
      settings: { create: { timezone: "Asia/Kolkata" } },
    },
  });

  let employeeCounter = 1;
  const usedEmails = new Set<string>();
  function nextIdentity() {
    let first = pick(FIRST_NAMES);
    let last = pick(LAST_NAMES);
    let email = `${first.toLowerCase()}.${last.toLowerCase()}@dailypulse.dev`;
    while (usedEmails.has(email)) {
      first = pick(FIRST_NAMES);
      last = pick(LAST_NAMES);
      email = `${first.toLowerCase()}.${last.toLowerCase()}${employeeCounter}@dailypulse.dev`;
    }
    usedEmails.add(email);
    const employeeCode = `EMP-${String(employeeCounter++).padStart(4, "0")}`;
    return { name: `${first} ${last}`, email, employeeCode };
  }

  // Seeded Super Admin — the account you sign in as to see everything.
  const superAdminIdentity = nextIdentity();
  const hrDept = { name: "Human Resources", sub: "People Operations" };

  const allEmployeeIds: string[] = [];
  let patternCursor = 0;

  for (const [deptName, subNames] of Object.entries(DEPARTMENTS)) {
    const department = await prisma.department.create({ data: { name: deptName, organizationId: org.id } });

    for (const subName of subNames) {
      const subDepartment = await prisma.subDepartment.create({ data: { name: subName, departmentId: department.id } });

      // Two manager tiers, mirroring a real SuperCoach / Co-SuperCoach
      // reporting line: the first manager created in each sub-department is
      // the "lead" (Co-SuperCoach) that the other managers (SuperCoaches)
      // report into, so employee detail pages have real Co-SuperCoach data
      // to show rather than every manager topping out at nobody.
      const managerCount = randInt(2, 5);
      const subDeptManagerIds: string[] = [];
      for (let m = 0; m < managerCount; m++) {
        const identity = nextIdentity();
        const isLead = m === 0;
        const manager = await prisma.employee.create({
          data: {
            ...identity,
            departmentId: department.id,
            subDepartmentId: subDepartment.id,
            managerId: isLead ? undefined : subDeptManagerIds[0],
            jobTitle: isLead ? `Head of ${subName}` : "Manager",
            role: "MANAGER",
            employmentStatus: "ACTIVE",
            dateJoined: new Date(Date.now() - randInt(365, 365 * 6) * 86400000),
          },
        });
        subDeptManagerIds.push(manager.id);
        allEmployeeIds.push(manager.id);
        await generateMoodHistory(manager.id, PATTERNS[patternCursor++ % PATTERNS.length]);

        const reportCount = randInt(5, 15);
        for (let e = 0; e < reportCount; e++) {
          const empIdentity = nextIdentity();
          const employee = await prisma.employee.create({
            data: {
              ...empIdentity,
              departmentId: department.id,
              subDepartmentId: subDepartment.id,
              managerId: manager.id,
              jobTitle: pick(JOB_TITLES),
              role: "EMPLOYEE",
              employmentStatus: "ACTIVE",
              dateJoined: new Date(Date.now() - randInt(30, 365 * 5) * 86400000),
            },
          });
          allEmployeeIds.push(employee.id);
          await generateMoodHistory(employee.id, PATTERNS[patternCursor++ % PATTERNS.length]);
        }
      }
    }
  }

  // Attach the Super Admin and two HR Admin demo accounts under HR.
  const hrDepartment = await prisma.department.findFirst({ where: { name: hrDept.name } });
  const hrSubDepartment = await prisma.subDepartment.findFirst({ where: { name: hrDept.sub, departmentId: hrDepartment!.id } });

  await prisma.employee.create({
    data: {
      name: "System Administrator",
      email: process.env.SEED_SUPER_ADMIN_EMAIL ?? superAdminIdentity.email,
      employeeCode: "EMP-0000",
      departmentId: hrDepartment!.id,
      subDepartmentId: hrSubDepartment!.id,
      jobTitle: "Platform Super Admin",
      role: "SUPER_ADMIN",
      employmentStatus: "ACTIVE",
      dateJoined: new Date(Date.now() - 365 * 3 * 86400000),
    },
  });

  const hrAdminIdentity = nextIdentity();
  const hrAdmin = await prisma.employee.create({
    data: {
      ...hrAdminIdentity,
      departmentId: hrDepartment!.id,
      subDepartmentId: hrSubDepartment!.id,
      jobTitle: "HR Business Partner",
      role: "HR_ADMIN",
      employmentStatus: "ACTIVE",
      dateJoined: new Date(Date.now() - 365 * 2 * 86400000),
    },
  });
  await generateMoodHistory(hrAdmin.id, "stable_positive");

  console.log(`Seeded organization "${org.name}" with ${allEmployeeIds.length + 2} employees.`);
  console.log(`Super Admin login: ${process.env.SEED_SUPER_ADMIN_EMAIL ?? superAdminIdentity.email}`);
  console.log(`HR Admin login:    ${hrAdminIdentity.email}`);
}

const entrypoint = process.argv.includes("--minimal") ? seedMinimal : main;

entrypoint()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
