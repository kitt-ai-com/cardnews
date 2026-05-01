import type { CardStatus } from "../schemas/card-status";

export type JobId = string;

export interface Job {
  jobId: JobId;
  cardId: string;
  createdAt: string;
}

export interface JobState {
  jobId: JobId;
  cardId: string;
  status: CardStatus;
  updatedAt: string;
}

export interface Unsubscribe {
  (): void;
}

export interface JobStore {
  enqueue(job: Job): Promise<JobId>;
  update(jobId: JobId, patch: Partial<JobState>): Promise<void>;
  get(jobId: JobId): Promise<JobState | null>;
  subscribe(jobId: JobId, fn: (state: JobState) => void): Unsubscribe;
}
