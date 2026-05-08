export type Severity = "critical" | "major" | "minor" | "nit";

export interface ReviewFinding {
  path: string;
  line: number;
  severity: Severity;
  title: string;
  body: string;
  suggestion?: string;
}

export interface ReviewResponse {
  codeSummary: string[];
  summary: string[];
  findings: ReviewFinding[];
  limitations?: string[];
}

export interface ReviewFileInput {
  path: string;
  oldPath: string;
  diff: string;
  addedLines: number[];
  context?: string;
}

export interface ReviewInput {
  projectId: string;
  mergeRequestIid: string;
  headSha: string;
  language: string;
  rulePacks: string[];
  summaryOnly: boolean;
  files: ReviewFileInput[];
  excludedFiles: string[];
  limits: string[];
}

export interface AiReviewResult {
  projectId?: string;
  mergeRequestIid?: string;
  headSha?: string;
  provider: "gemini";
  model?: string;
  status: "completed" | "skipped" | "failed" | "stale";
  skippedReason?: string;
  error?: string;
  reviewedFiles: number;
  excludedFiles: string[];
  acceptedFindings: number;
  rejectedFindings: number;
  postedDraftNoteIds: number[];
  startedAt: string;
  finishedAt?: string;
  limitsApplied: string[];
}

export interface DiffVersion {
  id: number;
  base_commit_sha: string;
  start_commit_sha: string;
  head_commit_sha: string;
  created_at?: string;
}

export interface MergeRequest {
  iid: number;
  title: string;
  sha: string;
  source_project_id: number;
  target_project_id: number;
}

export interface GitLabDiff {
  old_path: string;
  new_path: string;
  diff: string;
  new_file?: boolean;
  renamed_file?: boolean;
  deleted_file?: boolean;
  too_large?: boolean;
  collapsed?: boolean;
}

export interface DiffPosition {
  base_sha: string;
  start_sha: string;
  head_sha: string;
  old_path: string;
  new_path: string;
  position_type: "text";
  new_line: number;
}
