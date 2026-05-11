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
    const lineRange = resolveFindingLineRange(finding);
    const isCommentable =
      acceptedSeverities.has(finding.severity) &&
      lineRange !== undefined &&
      commentableLines !== undefined &&
      isCommentableRange(commentableLines, lineRange.start, lineRange.end) &&
      accepted.length < maxComments &&
      currentFileCount < maxCommentsPerFile;

    if (!isCommentable) {
      rejectedCount += 1;
      continue;
    }

    accepted.push(normalizeFindingRange(finding, lineRange.start, lineRange.end));
    perFile.set(finding.path, currentFileCount + 1);
  }

  return { accepted, rejectedCount };
}

function resolveFindingLineRange(finding: ReviewFinding): { start: number; end: number } | undefined {
  const endLine = finding.endLine ?? finding.line;
  if (endLine < finding.line) return undefined;

  return { start: finding.line, end: endLine };
}

function isCommentableRange(commentableLines: Set<number>, start: number, end: number): boolean {
  for (let line = start; line <= end; line += 1) {
    if (!commentableLines.has(line)) return false;
  }

  return true;
}

function normalizeFindingRange(
  finding: ReviewFinding,
  start: number,
  end: number
): ReviewFinding {
  if (start !== end || finding.endLine === undefined) return finding;
  const normalized = { ...finding };
  delete normalized.endLine;
  return normalized;
}
