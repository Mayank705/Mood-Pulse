import { prisma } from "../db/prisma";
import { calendarDateKey, daysAgo } from "../utils/timezone";
import { categorize, detectEmployeeTrend, MoodPoint, TrendConfig } from "./trend.service";
import { getOrgSettings } from "./settings.service";

function toMoodPoints(responses: { responseDate: Date; moodValue: number }[]): MoodPoint[] {
  return responses
    .slice()
    .sort((a, b) => a.responseDate.getTime() - b.responseDate.getTime())
    .map((r) => ({ responseDate: r.responseDate.toISOString().slice(0, 10), moodValue: r.moodValue }));
}

async function getTrendConfig(): Promise<TrendConfig & { timezone: string }> {
  const { settings } = await getOrgSettings();
  return {
    lowMoodThresholdCount: settings.lowMoodThresholdCount,
    lowMoodWindowDays: settings.lowMoodWindowDays,
    decliningWindowDays: settings.decliningWindowDays,
    timezone: settings.timezone,
  };
}

export async function getEmployeeTrend(employeeId: string, days = 90) {
  const config = await getTrendConfig();
  const since = daysAgo(days, config.timezone);
  const responses = await prisma.moodResponse.findMany({
    where: { employeeId, responseDate: { gte: since } },
    orderBy: { responseDate: "asc" },
    select: { responseDate: true, moodValue: true, mood: true, comment: true, responseTime: true },
  });
  const trend = detectEmployeeTrend(toMoodPoints(responses), config);
  return { trend, history: responses };
}

interface EmployeeIdsFilter {
  employeeIds?: string[];
  departmentId?: string;
  subDepartmentId?: string;
  managerId?: string;
}

async function resolveScopedEmployeeIds(filter: EmployeeIdsFilter): Promise<string[] | undefined> {
  if (filter.employeeIds) return filter.employeeIds;
  if (!filter.departmentId && !filter.subDepartmentId && !filter.managerId) return undefined;

  const employees = await prisma.employee.findMany({
    where: {
      employmentStatus: "ACTIVE",
      ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
      ...(filter.subDepartmentId ? { subDepartmentId: filter.subDepartmentId } : {}),
      ...(filter.managerId ? { managerId: filter.managerId } : {}),
    },
    select: { id: true },
  });
  return employees.map((e) => e.id);
}

export interface OverviewResult {
  totalEmployees: number;
  responsesToday: number;
  responseRate: number;
  positiveResponses: number;
  neutralResponses: number;
  lowResponses: number;
  employeesRequiringAttention: number;
  averageMoodValue: number | null;
  dailyTrend: { date: string; averageMoodValue: number | null; responseCount: number }[];
}

export async function getOverview(
  filter: EmployeeIdsFilter & { from?: Date; to?: Date } = {}
): Promise<OverviewResult> {
  const config = await getTrendConfig();
  const scopedIds = await resolveScopedEmployeeIds(filter);

  const employeeWhere = {
    employmentStatus: "ACTIVE",
    ...(scopedIds ? { id: { in: scopedIds } } : {}),
  };
  const totalEmployees = await prisma.employee.count({ where: employeeWhere });

  const today = calendarDateKey(config.timezone);
  const from = filter.from ?? daysAgo(29, config.timezone);
  const to = filter.to ?? today;

  const responseWhere = {
    responseDate: { gte: from, lte: to },
    ...(scopedIds ? { employeeId: { in: scopedIds } } : {}),
  };

  const [todayResponses, rangeResponses] = await Promise.all([
    prisma.moodResponse.count({
      where: { responseDate: today, ...(scopedIds ? { employeeId: { in: scopedIds } } : {}) },
    }),
    prisma.moodResponse.findMany({
      where: responseWhere,
      select: { employeeId: true, moodValue: true, responseDate: true },
    }),
  ]);

  let positive = 0;
  let neutral = 0;
  let low = 0;
  const byDate = new Map<string, { sum: number; count: number }>();
  for (const r of rangeResponses) {
    const cat = categorize(r.moodValue);
    if (cat === "positive") positive++;
    else if (cat === "neutral") neutral++;
    else low++;

    const key = r.responseDate.toISOString().slice(0, 10);
    const bucket = byDate.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += r.moodValue;
    bucket.count += 1;
    byDate.set(key, bucket);
  }

  const dailyTrend = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date,
      averageMoodValue: count > 0 ? Math.round((sum / count) * 100) / 100 : null,
      responseCount: count,
    }));

  const overallAvg =
    rangeResponses.length > 0
      ? Math.round((rangeResponses.reduce((s, r) => s + r.moodValue, 0) / rangeResponses.length) * 100) / 100
      : null;

  // "Employees requiring attention" = distinct employees (within scope)
  // whose recent history trips a REPEATED_LOW or SUDDEN_CHANGE insight.
  const employeeIdsInScope = scopedIds ?? (await prisma.employee.findMany({ where: employeeWhere, select: { id: true } })).map((e) => e.id);
  let attentionCount = 0;
  if (employeeIdsInScope.length > 0) {
    // Batched to keep each query's IN-clause bounded regardless of org size.
    const BATCH_SIZE = 500;
    const grouped = new Map<string, { responseDate: Date; moodValue: number }[]>();
    for (let i = 0; i < employeeIdsInScope.length; i += BATCH_SIZE) {
      const batch = employeeIdsInScope.slice(i, i + BATCH_SIZE);
      const attentionResponses = await prisma.moodResponse.findMany({
        where: { employeeId: { in: batch }, responseDate: { gte: daysAgo(config.decliningWindowDays, config.timezone) } },
        select: { employeeId: true, responseDate: true, moodValue: true },
      });
      for (const r of attentionResponses) {
        const list = grouped.get(r.employeeId) ?? [];
        list.push(r);
        grouped.set(r.employeeId, list);
      }
    }
    for (const [, list] of grouped) {
      const result = detectEmployeeTrend(toMoodPoints(list), config);
      if (result.insights.some((i) => i.code === "REPEATED_LOW" || i.code === "SUDDEN_CHANGE")) {
        attentionCount++;
      }
    }
  }

  const responseRate = totalEmployees > 0 ? Math.round((todayResponses / totalEmployees) * 1000) / 10 : 0;

  return {
    totalEmployees,
    responsesToday: todayResponses,
    responseRate,
    positiveResponses: positive,
    neutralResponses: neutral,
    lowResponses: low,
    employeesRequiringAttention: attentionCount,
    averageMoodValue: overallAvg,
    dailyTrend,
  };
}

export async function getFlaggedEmployees(filter: EmployeeIdsFilter = {}) {
  const config = await getTrendConfig();
  const scopedIds = await resolveScopedEmployeeIds(filter);
  const employeeWhere = { employmentStatus: "ACTIVE", ...(scopedIds ? { id: { in: scopedIds } } : {}) };

  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: { id: true, name: true, employeeCode: true, jobTitle: true, department: { select: { name: true } }, manager: { select: { name: true } } },
  });

  const since = daysAgo(config.decliningWindowDays, config.timezone);
  const responses = await prisma.moodResponse.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) }, responseDate: { gte: since } },
    select: { employeeId: true, responseDate: true, moodValue: true },
  });

  const grouped = new Map<string, { responseDate: Date; moodValue: number }[]>();
  for (const r of responses) {
    const list = grouped.get(r.employeeId) ?? [];
    list.push(r);
    grouped.set(r.employeeId, list);
  }

  return employees
    .map((e) => {
      const result = detectEmployeeTrend(toMoodPoints(grouped.get(e.id) ?? []), config);
      return { employee: e, trend: result };
    })
    .filter((r) => r.trend.insights.length > 0)
    .sort((a, b) => b.trend.insights.length - a.trend.insights.length);
}
