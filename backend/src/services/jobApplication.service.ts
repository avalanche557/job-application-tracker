import { prisma } from "../lib/prisma.js";
import type { ApplicationSource, ApplicationStatus } from "../generated/prisma/index.js";

export type ListFilters = {
  q?: string;
  status?: ApplicationStatus;
  needsReview?: boolean;
  sortBy?: "dateApplied" | "updatedAt" | "companyName" | "jobTitle" | "status";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export async function listApplications(userId: string, filters: ListFilters) {
  const where = {
    userId,
    status: filters.status,
    needsReview: filters.needsReview,
    companyName: filters.q ? { contains: filters.q, mode: "insensitive" as const } : undefined,
  };
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  const [applications, total] = await Promise.all([
    prisma.jobApplication.findMany({
      where,
      orderBy: { [filters.sortBy ?? "dateApplied"]: filters.order ?? "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.jobApplication.count({ where }),
  ]);

  return { applications, total, page, pageSize };
}

export function getApplication(userId: string, id: string) {
  return prisma.jobApplication.findFirst({
    where: { id, userId },
    include: { statusHistory: { orderBy: { changedAt: "desc" } } },
  });
}

export type CreateApplicationInput = {
  companyName: string;
  jobTitle: string;
  status?: ApplicationStatus;
  dateApplied: Date;
  source?: ApplicationSource;
  jobUrl?: string;
  location?: string;
  notes?: string;
  needsReview?: boolean;
};

// Used by the email extraction worker (not exposed over HTTP) to create
// applications, and available for a future manual-entry endpoint if needed.
export async function createApplication(userId: string, input: CreateApplicationInput) {
  const status = input.status ?? "APPLIED";
  return prisma.jobApplication.create({
    data: {
      ...input,
      status,
      userId,
      statusHistory: {
        create: { status, source: input.source ?? "MANUAL" },
      },
    },
  });
}

export type UpdateApplicationInput = Partial<{
  companyName: string;
  jobTitle: string;
  status: ApplicationStatus;
  dateApplied: Date;
  jobUrl: string | null;
  location: string | null;
  notes: string | null;
  needsReview: boolean;
}>;

export async function updateApplication(
  userId: string,
  id: string,
  input: UpdateApplicationInput,
  historySource: ApplicationSource = "MANUAL",
) {
  const existing = await prisma.jobApplication.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const statusChanged = input.status !== undefined && input.status !== existing.status;

  return prisma.jobApplication.update({
    where: { id },
    data: {
      ...input,
      ...(statusChanged && {
        statusHistory: { create: { status: input.status!, source: historySource } },
      }),
    },
    include: { statusHistory: { orderBy: { changedAt: "desc" } } },
  });
}

// Best-effort match for the email pipeline: same user, same company (case-insensitive).
// Picks the most recently touched one if a company has multiple applications on file.
export function findApplicationByCompany(userId: string, companyName: string) {
  return prisma.jobApplication.findFirst({
    where: { userId, companyName: { equals: companyName, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function deleteApplication(userId: string, id: string) {
  const existing = await prisma.jobApplication.findFirst({ where: { id, userId } });
  if (!existing) return false;

  await prisma.jobApplication.delete({ where: { id } });
  return true;
}
