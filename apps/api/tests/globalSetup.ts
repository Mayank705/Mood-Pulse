import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const TEST_DB_PATH = join(__dirname, "..", "prisma", "test.db");

export async function setup() {
  for (const p of [TEST_DB_PATH, `${TEST_DB_PATH}-journal`]) {
    if (existsSync(p)) unlinkSync(p);
  }
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: join(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "inherit",
  });
}

export async function teardown() {
  for (const p of [TEST_DB_PATH, `${TEST_DB_PATH}-journal`]) {
    if (existsSync(p)) unlinkSync(p);
  }
}
