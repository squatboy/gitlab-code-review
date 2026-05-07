import type { ReviewFinding } from "../types.js";

const acceptedSeverities = new Set(["critical", "major", "minor"]);

export interface FilterResult {
  accepted: ReviewFinding[];
  rejectedCount: number;
}

export function filterFindings(
  findings: ReviewFinding[],
  addedLineMap: Map<string, Set<number>>,
  maxComments: number,
  maxCommentsPerFile: number,
  summaryOnly: boolean
): FilterResult {
  if (summaryOnly) {
    return { accepted: [], rejectedCount: findings.length };
  }

  const accepted: ReviewFinding[] = [];
  const perFile = new Map<string, number>();
  let rejectedCount = 0;

  for (const finding of findings) {
    const commentableLines = addedLineMap.get(finding.path);
    const currentFileCount = perFile.get(finding.path) ?? 0;
    const isCommentable =
      acceptedSeverities.has(finding.severity) &&
      commentableLines?.has(finding.line) === true &&
      accepted.length < maxComments &&
      currentFileCount < maxCommentsPerFile;

    if (!isCommentable) {
      rejectedCount += 1;
      continue;
    }

    accepted.push(finding);
    perFile.set(finding.path, currentFileCount + 1);
  }

  return { accepted, rejectedCount };
}
