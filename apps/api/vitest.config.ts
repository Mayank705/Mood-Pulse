import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    // Single sqlite file shared across the run — keep file execution
    // sequential to avoid SQLite write-lock contention between test files.
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db",
      AUTH_MODE: "dev",
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-key-not-for-production-use",
      CORS_ORIGINS: "http://localhost:5173",
      APP_TIMEZONE: "Asia/Kolkata",
    },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
