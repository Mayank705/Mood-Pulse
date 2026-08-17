import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/auth.routes";
import moodResponseRoutes from "./routes/moodResponses.routes";
import employeeRoutes from "./routes/employees.routes";
import departmentRoutes from "./routes/departments.routes";
import managerRoutes from "./routes/managers.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import reportRoutes from "./routes/reports.routes";
import settingsRoutes from "./routes/settings.routes";
import auditLogRoutes from "./routes/auditLogs.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "100kb" }));
  if (env.nodeEnv !== "test") {
    app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  }

  // Generous general limiter plus a tighter one on auth to blunt
  // credential/account enumeration attempts against the login endpoint.
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }));
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/mood-responses", moodResponseRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/departments", departmentRoutes);
  app.use("/api/managers", managerRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/audit-logs", auditLogRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
