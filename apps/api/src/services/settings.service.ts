import { prisma } from "../db/prisma";
import { env } from "../config/env";

/**
 * There is exactly one Organization in this deployment model (the spec
 * targets a single company); getOrgSettings lazily creates the row with
 * sane defaults on first access so the app works before any admin has
 * visited Settings.
 */
export async function getOrgSettings() {
  let org = await prisma.organization.findFirst({ include: { settings: true } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Demo Organization",
        timezone: env.appTimezone,
        settings: { create: { timezone: env.appTimezone } },
      },
      include: { settings: true },
    });
  }
  if (!org.settings) {
    const settings = await prisma.setting.create({ data: { organizationId: org.id, timezone: org.timezone } });
    return { org, settings };
  }
  return { org, settings: org.settings };
}
