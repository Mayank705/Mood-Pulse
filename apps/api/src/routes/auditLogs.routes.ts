import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../auth/middleware";
import { requirePermission } from "../rbac/authorize";
import { PERMISSIONS } from "../rbac/permissions";
import { prisma } from "../db/prisma";

const router = Router();
router.use(authenticate);

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().optional(),
  actorId: z.string().optional(),
});

router.get("/", requirePermission(PERMISSIONS.AUDIT_VIEW), async (req, res, next) => {
  try {
    const query = listQuery.parse(req.query);
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { name: true, employeeCode: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    res.json({ total, page: query.page, pageSize: query.pageSize, logs });
  } catch (err) {
    next(err);
  }
});

export default router;
