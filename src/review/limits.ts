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

  if (changedFiles >= 100) reasons.push("변경 파일 수가 100개 이상입니다.");
  if (changedLines >= 5000) reasons.push("변경 라인 수가 5,000줄 이상입니다.");
  if (hasOversizedDiff) reasons.push("GitLab이 일부 diff를 too_large/collapsed로 표시했습니다.");
  if (reasons.length > 0) {
    return { mode: "skip", reasons, changedFiles, changedLines };
  }

  if (changedFiles > 50) reasons.push("변경 파일 수가 50개를 초과해 summary-only로 전환합니다.");
  if (changedLines > 2000) reasons.push("변경 라인 수가 2,000줄을 초과해 summary-only로 전환합니다.");

  return {
    mode: reasons.length > 0 ? "summary-only" : "normal",
    reasons,
    changedFiles,
    changedLines
  };
}
