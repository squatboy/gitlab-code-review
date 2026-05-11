import { writeFile } from "node:fs/promises";
import { assertRunnableConfig, isDraftTitle, isSameProjectMr, type AppConfig } from "../config.js";
import { GitLabClient } from "../gitlab/client.js";
import { buildAddedLineCodeMap, buildAddedLineMap } from "../gitlab/diff.js";
import { GeminiProvider } from "../llm/gemini.js";
import type { AiReviewResult, DiffPosition, ReviewFinding } from "../types.js";
import { filterFindings } from "./filter.js";
import { formatFindingNote, formatPolicyNote, formatSummaryNote } from "./format.js";
import { buildReviewInput } from "./input.js";
import { decideLimits } from "./limits.js";

export async function runReview(config: AppConfig): Promise<AiReviewResult> {
  const result: AiReviewResult = {
    projectId: config.CI_PROJECT_ID,
    mergeRequestIid: config.CI_MERGE_REQUEST_IID,
    provider: "gemini",
    model: config.AI_REVIEW_MODEL,
    status: "failed",
    reviewedFiles: 0,
    excludedFiles: [],
    acceptedFindings: 0,
    rejectedFindings: 0,
    postedDraftNoteIds: [],
    startedAt: new Date().toISOString(),
    limitsApplied: []
  };

  try {
    await executeReview(config, result);
  } catch (error) {
    result.status = "failed";
    result.error = error instanceof Error ? error.message : String(error);
    console.error(result.error);
  } finally {
    result.finishedAt = new Date().toISOString();
    await writeFile(config.AI_REVIEW_RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
  }

  return result;
}

async function executeReview(config: AppConfig, result: AiReviewResult): Promise<void> {
  if (!config.AI_REVIEW_ENABLED) {
    markSkipped(result, "disabled");
    return;
  }

  if (isDraftTitle(config.CI_MERGE_REQUEST_TITLE)) {
    markSkipped(result, "draft_mr");
    return;
  }

  if (!isSameProjectMr(config)) {
    markSkipped(result, "fork_mr");
    return;
  }

  assertRunnableConfig(config);
  const gitlabToken = config.AI_CODE_REVIEW_GITLAB_TOKEN;
  const geminiApiKey = config.AI_REVIEW_API_KEY;
  const apiBaseUrl = config.CI_API_V4_URL;
  const projectId = config.CI_PROJECT_ID;
  const mergeRequestIid = config.CI_MERGE_REQUEST_IID;

  if (!gitlabToken || !geminiApiKey || !apiBaseUrl || !projectId || !mergeRequestIid) {
    throw new Error("Runnable config assertion failed");
  }

  const gitlab = new GitLabClient(
    apiBaseUrl,
    gitlabToken,
    projectId,
    mergeRequestIid
  );

  const [mr, version] = await Promise.all([gitlab.getMergeRequest(), gitlab.getLatestDiffVersion()]);
  const headSha = version.head_commit_sha || mr.sha;
  result.headSha = headSha;

  if (!config.AI_REVIEW_FORCE && (await gitlab.hasSummaryForHead(headSha))) {
    markSkipped(result, "duplicate_head_sha");
    return;
  }

  const diffs = await gitlab.listDiffs();
  const limitDecision = decideLimits(diffs);
  result.limitsApplied.push(...limitDecision.reasons);

  if (limitDecision.mode === "skip") {
    const draftNoteId = await publishPolicyNote(gitlab, {
      projectId,
      mergeRequestIid,
      headSha,
      reasons: limitDecision.reasons
    });
    result.postedDraftNoteIds = [draftNoteId];
    markSkipped(result, "large_mr");
    return;
  }

  const reviewInput = await buildReviewInput({
    diffs,
    projectId,
    mergeRequestIid,
    headSha,
    language: config.AI_REVIEW_LANGUAGE,
    rulePacks: config.AI_REVIEW_RULE_PACKS,
    summaryOnly: limitDecision.mode === "summary-only",
    limits: limitDecision.reasons
  });

  result.reviewedFiles = reviewInput.files.length;
  result.excludedFiles = reviewInput.excludedFiles;
  for (const limit of reviewInput.limits) {
    if (!result.limitsApplied.includes(limit)) {
      result.limitsApplied.push(limit);
    }
  }

  if (reviewInput.files.length === 0) {
    const draftNoteId = await publishPolicyNote(gitlab, {
      projectId,
      mergeRequestIid,
      headSha,
      reasons: ["리뷰 가능한 변경 파일이 없습니다."]
    });
    result.postedDraftNoteIds = [draftNoteId];
    markSkipped(result, "no_reviewable_files");
    return;
  }

  const provider = new GeminiProvider(geminiApiKey, config.AI_REVIEW_MODEL);
  const response = await provider.review(reviewInput);

  const addedLineMap = buildAddedLineMap(diffs);
  const addedLineCodeMap = buildAddedLineCodeMap(diffs);
  const filterResult = filterFindings(
    response.findings,
    addedLineMap,
    config.AI_REVIEW_MAX_COMMENTS,
    config.AI_REVIEW_MAX_COMMENTS_PER_FILE,
    reviewInput.summaryOnly
  );

  result.acceptedFindings = filterResult.accepted.length;
  result.rejectedFindings = filterResult.rejectedCount;

  await assertNotStale(gitlab, headSha);

  const draftNoteIds = await createDraftNotes({
    gitlab,
    version,
    reviewInput,
    codeSummary: response.codeSummary,
    summary: response.summary,
    findings: filterResult.accepted,
    rejectedFindings: filterResult.rejectedCount,
    addedLineCodeMap
  });
  result.postedDraftNoteIds = draftNoteIds;

  try {
    await assertNotStale(gitlab, headSha);
  } catch (error) {
    await Promise.allSettled(draftNoteIds.map((id) => gitlab.deleteDraftNote(id)));
    result.status = "stale";
    result.skippedReason = "stale_head_sha";
    result.error = error instanceof Error ? error.message : String(error);
    return;
  }

  await gitlab.bulkPublishDraftNotes();
  result.status = "completed";
}

function markSkipped(result: AiReviewResult, reason: string): void {
  result.status = "skipped";
  result.skippedReason = reason;
}

async function assertNotStale(gitlab: GitLabClient, expectedHeadSha: string): Promise<void> {
  const currentHeadSha = await gitlab.getCurrentHeadSha();
  if (currentHeadSha !== expectedHeadSha) {
    throw new Error(`MR head_sha changed from ${expectedHeadSha} to ${currentHeadSha}`);
  }
}

async function publishPolicyNote(
  gitlab: GitLabClient,
  params: {
    projectId: string;
    mergeRequestIid: string;
    headSha: string;
    reasons: string[];
  }
): Promise<number> {
  await assertNotStale(gitlab, params.headSha);
  const draftNoteId = await gitlab.createDraftNote(
    formatPolicyNote({
      ...params,
      status: "Skipped"
    })
  );
  try {
    await assertNotStale(gitlab, params.headSha);
  } catch (error) {
    await gitlab.deleteDraftNote(draftNoteId);
    throw error;
  }
  await gitlab.bulkPublishDraftNotes();
  return draftNoteId;
}

async function createDraftNotes(params: {
  gitlab: GitLabClient;
  version: { base_commit_sha: string; start_commit_sha: string; head_commit_sha: string };
  reviewInput: {
    projectId: string;
    mergeRequestIid: string;
    headSha: string;
    files: { path: string; oldPath: string }[];
    excludedFiles: string[];
    limits: string[];
  };
  codeSummary: string[];
  summary: string[];
  findings: ReviewFinding[];
  rejectedFindings: number;
  addedLineCodeMap: Map<string, Map<number, string>>;
}): Promise<number[]> {
  const draftNoteIds: number[] = [];
  const fileByPath = new Map(params.reviewInput.files.map((file) => [file.path, file]));

  const summaryNote = formatSummaryNote({
    input: {
      ...params.reviewInput,
      language: "",
      rulePacks: [],
      summaryOnly: params.findings.length === 0,
      files: params.reviewInput.files.map((file) => ({
        ...file,
        diff: "",
        addedLines: []
      }))
    },
    codeSummary: params.codeSummary,
    summary: params.summary,
    findings: params.findings,
    rejectedFindings: params.rejectedFindings
  });

  draftNoteIds.push(await params.gitlab.createDraftNote(summaryNote));

  for (const finding of params.findings) {
    const file = fileByPath.get(finding.path);
    if (!file) continue;

    const position: DiffPosition = {
      base_sha: params.version.base_commit_sha,
      start_sha: params.version.start_commit_sha,
      head_sha: params.version.head_commit_sha,
      old_path: file.oldPath,
      new_path: file.path,
      position_type: "text",
      new_line: finding.line
    };
    const lineRange = buildLineRange(finding, params.addedLineCodeMap.get(finding.path));
    if (lineRange) {
      position.line_range = lineRange;
    }

    draftNoteIds.push(
      await params.gitlab.createDraftNote(formatFindingNote(finding, params.reviewInput.headSha), position)
    );
  }

  return draftNoteIds;
}

function buildLineRange(
  finding: ReviewFinding,
  lineCodeByNewLine?: Map<number, string>
): DiffPosition["line_range"] | undefined {
  const endLine = finding.endLine;
  if (endLine === undefined || endLine <= finding.line || !lineCodeByNewLine) return undefined;

  const startLineCode = lineCodeByNewLine.get(finding.line);
  const endLineCode = lineCodeByNewLine.get(endLine);
  if (!startLineCode || !endLineCode) return undefined;

  return {
    start: {
      line_code: startLineCode,
      type: "new",
      new_line: finding.line
    },
    end: {
      line_code: endLineCode,
      type: "new",
      new_line: endLine
    }
  };
}
