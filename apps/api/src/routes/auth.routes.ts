import { Router } from "express";
import { env } from "../config/env";
import { authenticate } from "../auth/middleware";
import devAuthProvider from "../auth/devAuthProvider";
import { permissionsForRole } from "../rbac/permissions";

const router = Router();

// The dev sign-in endpoints only exist when AUTH_MODE=dev — in production
// (AUTH_MODE=entra) this router contributes nothing but /me, and the app
// bootstraps by rejecting startup if JWT-only dev auth is left enabled
// (see config/env.ts).
if (env.authMode === "dev") {
  router.use("/", devAuthProvider);
}

router.get("/me", authenticate, (req, res) => {
  const user = req.user!;
  res.json({ user, permissions: permissionsForRole(user.role) });
});

export default router;
