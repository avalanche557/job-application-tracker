export type ApplicationStatus = "APPLIED" | "INTERVIEWING" | "OFFER" | "REJECTED" | "GHOSTED";
export type ApplicationSource = "MANUAL" | "EMAIL";

export type StatusHistoryEntry = {
  id: string;
  applicationId: string;
  status: ApplicationStatus;
  changedAt: string;
  source: ApplicationSource;
};

export type JobApplication = {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  status: ApplicationStatus;
  dateApplied: string;
  source: ApplicationSource;
  jobUrl: string | null;
  location: string | null;
  notes: string | null;
  needsReview: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JobApplicationDetail = JobApplication & {
  statusHistory: StatusHistoryEntry[];
};

export type User = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  location: string | null;
  createdAt: string;
};

export type EmailAccount = {
  id: string;
  provider: "GMAIL";
  email: string;
  createdAt: string;
  lastSyncedAt: string | null;
  disconnectedAt: string | null;
};
