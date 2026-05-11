import { createHash } from "node:crypto";
import type { GitLabDiff } from "../types.js";

export interface ParsedDiff {
  path: string;
  oldPath: string;
  addedLines: number[];
  addedLineCodes: Map<number, string>;
  addedCount: number;
  deletedCount: number;
}

const hunkHeaderPattern = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseGitLabDiff(diff: GitLabDiff): ParsedDiff {
  const addedLines: number[] = [];
  const addedLineCodes = new Map<number, string>();
  const filePathHash = createHash("sha1").update(diff.new_path).digest("hex");
  let newLine = 0;
  let inHunk = false;
  let addedCount = 0;
  let deletedCount = 0;

  for (const line of diff.diff.split("\n")) {
    const hunk = hunkHeaderPattern.exec(line);
    if (hunk) {
      newLine = Number(hunk[2]);
      inHunk = true;
      continue;
    }

    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }

    if (line.startsWith("+")) {
      addedLines.push(newLine);
      addedLineCodes.set(newLine, formatLineCode(filePathHash, undefined, newLine));
      newLine += 1;
      addedCount += 1;
      continue;
    }

    if (line.startsWith("-")) {
      deletedCount += 1;
      continue;
    }

    if (inHunk && (line.startsWith(" ") || line === "\\ No newline at end of file")) {
      newLine += 1;
    }
  }

  return {
    path: diff.new_path,
    oldPath: diff.old_path,
    addedLines,
    addedLineCodes,
    addedCount,
    deletedCount
  };
}

export function buildAddedLineMap(diffs: GitLabDiff[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();

  for (const diff of diffs) {
    const parsed = parseGitLabDiff(diff);
    map.set(parsed.path, new Set(parsed.addedLines));
  }

  return map;
}

export function buildAddedLineCodeMap(diffs: GitLabDiff[]): Map<string, Map<number, string>> {
  const map = new Map<string, Map<number, string>>();

  for (const diff of diffs) {
    const parsed = parseGitLabDiff(diff);
    map.set(parsed.path, parsed.addedLineCodes);
  }

  return map;
}

function formatLineCode(filePathHash: string, oldLine?: number, newLine?: number): string {
  return `${filePathHash}_${oldLine ?? 0}_${newLine ?? 0}`;
}
