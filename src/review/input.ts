import type { GitLabDiff, ReviewFileInput, ReviewInput } from "../types.js";
import { parseGitLabDiff } from "../gitlab/diff.js";
import { readBoundedContext } from "./context.js";
import { isExcludedPath } from "./exclusions.js";

const maxTotalInputBytes = 1024 * 1024;
const maxFileInputBytes = 100 * 1024;

export async function buildReviewInput(params: {
  diffs: GitLabDiff[];
  projectId: string;
  mergeRequestIid: string;
  headSha: string;
  language: string;
  rulePacks: string[];
  summaryOnly: boolean;
  limits: string[];
}): Promise<ReviewInput> {
  const files: ReviewFileInput[] = [];
  const excludedFiles: string[] = [];
  let totalBytes = 0;

  for (const diff of params.diffs) {
    const parsed = parseGitLabDiff(diff);
    const path = parsed.path;

    if (isExcludedPath(path)) {
      excludedFiles.push(path);
      continue;
    }

    const context = await readBoundedContext(path, parsed.addedLines);
    const fileInput: ReviewFileInput = {
      path,
      oldPath: parsed.oldPath,
      diff: truncateByBytes(diff.diff, maxFileInputBytes),
      addedLines: parsed.addedLines,
      context
    };

    const bytes = Buffer.byteLength(JSON.stringify(fileInput));
    if (bytes > maxFileInputBytes || totalBytes + bytes > maxTotalInputBytes) {
      excludedFiles.push(path);
      continue;
    }

    files.push(fileInput);
    totalBytes += bytes;
  }

  const limits = [...params.limits];
  if (totalBytes >= maxTotalInputBytes) {
    limits.push("LLM 입력이 1MB 제한에 도달했습니다.");
  }

  return {
    projectId: params.projectId,
    mergeRequestIid: params.mergeRequestIid,
    headSha: params.headSha,
    language: params.language,
    rulePacks: params.rulePacks,
    summaryOnly: params.summaryOnly,
    files,
    excludedFiles,
    limits
  };
}

function truncateByBytes(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value) <= maxBytes) return value;
  return `${Buffer.from(value).subarray(0, maxBytes).toString("utf8")}\n...[truncated]`;
}
