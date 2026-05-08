import type { GitLabDiff } from "../types.js";
import { parseGitLabDiff } from "../gitlab/diff.js";

export interface LimitDecision {
  mode: "normal" | "summary-only" | "skip";
  reasons: string[];
  changedFiles: number;
  changedLines: number;
}

export function decideLimits(diffs: GitLabDiff[]): LimitDecision {
  const changedFiles = diffs.length;
  const changedLines = diffs.reduce((sum, diff) => {
    const parsed = parseGitLabDiff(diff);
    return sum + parsed.addedCount + parsed.deletedCount;
  }, 0);

  const reasons: string[] = [];
  const hasOversizedDiff = diffs.some((diff) => diff.too_large || diff.collapsed);

  if (changedFiles >= 100) reasons.push("Changed file count is 100 or more.");
  if (changedLines >= 5000) reasons.push("Changed line count is 5,000 or more.");
  if (hasOversizedDiff) reasons.push("GitLab marked some diffs as too_large/collapsed.");
  if (reasons.length > 0) {
    return { mode: "skip", reasons, changedFiles, changedLines };
  }

  if (changedFiles > 50) reasons.push("Changed file count exceeds 50, switching to summary-only mode.");
  if (changedLines > 2000) reasons.push("Changed line count exceeds 2,000, switching to summary-only mode.");

  return {
    mode: reasons.length > 0 ? "summary-only" : "normal",
    reasons,
    changedFiles,
    changedLines
  };
}
