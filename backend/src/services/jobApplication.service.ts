import { prisma } from "../lib/prisma.js";
import type { ApplicationSource, ApplicationStatus } from "../generated/prisma/index.js";

export type ListFilters = {
  status?: ApplicationStatus;
  needsReview?: boolean;
  sortBy?: "dateApplied" | "companyName" | "jobTitle" | "status";
  order?: "asc" | "desc";
};

export function listApplications(userId: string, filters: ListFilters) {
  return prisma.jobApplication.findMany({
    where: {
      userId,
      status: filters.status,
      needsReview: filters.needsReview,
    },
    orderBy: { [filters.sortBy ?? "dateApplied"]: filters.order ?? "desc" },
  });
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

export async function updateApplication(userId: string, id: string, input: UpdateApplicationInput) {
  const existing = await prisma.jobApplication.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const statusChanged = input.status !== undefined && input.status !== existing.status;

  return prisma.jobApplication.update({
    where: { id },
    data: {
      ...input,
      ...(statusChanged && {
        statusHistory: { create: { status: input.status!, source: "MANUAL" } },
      }),
    },
    include: { statusHistory: { orderBy: { changedAt: "desc" } } },
  });
}

export async function deleteApplication(userId: string, id: string) {
  const existing = await prisma.jobApplication.findFirst({ where: { id, userId } });
  if (!existing) return false;

  await prisma.jobApplication.delete({ where: { id } });
  return true;
}
