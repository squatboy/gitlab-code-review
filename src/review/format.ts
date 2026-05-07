import type { ReviewFinding, ReviewInput } from "../types.js";

export function summaryMarker(projectId: string, mrIid: string, headSha: string): string {
  return `<!-- ai-code-review:summary project_id=${projectId} mr_iid=${mrIid} head_sha=${headSha} -->`;
}

export function findingMarker(finding: ReviewFinding, headSha: string): string {
  const fingerprint = `${finding.path}:${finding.line}:${finding.severity}:${finding.title}`;
  return `<!-- ai-code-review:finding fingerprint=${Buffer.from(fingerprint).toString("base64url")} head_sha=${headSha} -->`;
}

export function formatSummaryNote(params: {
  input: ReviewInput;
  summary: string[];
  findings: ReviewFinding[];
  rejectedFindings: number;
}): string {
  const { input, summary, findings, rejectedFindings } = params;
  const lines = [
    summaryMarker(input.projectId, input.mergeRequestIid, input.headSha),
    "",
    "## AI Code Review",
    "",
    `- 대상 커밋: \`${input.headSha}\``,
    `- 리뷰 상태: 완료`,
    `- 리뷰 파일: ${input.files.length}개`,
    `- 라인 코멘트: ${findings.length}개`,
    `- 제외 파일: ${input.excludedFiles.length}개`,
    `- 버린 finding: ${rejectedFindings}개`
  ];

  if (summary.length > 0) {
    lines.push("", "### 요약", ...summary.map((item) => `- ${item}`));
  }

  if (findings.length > 0) {
    lines.push(
      "",
      "### 주요 지적",
      ...findings.map((finding) => `- \`${finding.path}:${finding.line}\` ${finding.title}`)
    );
  }

  const limits = [...input.limits];
  if (input.excludedFiles.length > 0) {
    limits.push(`제외 파일: ${input.excludedFiles.slice(0, 20).join(", ")}`);
  }

  if (limits.length > 0) {
    lines.push("", "### 제한", ...limits.map((item) => `- ${item}`));
  }

  return lines.join("\n");
}

export function formatFindingNote(finding: ReviewFinding, headSha: string): string {
  const parts = [
    findingMarker(finding, headSha),
    "",
    `**${finding.title}**`,
    "",
    finding.body
  ];

  if (finding.suggestion) {
    parts.push("", finding.suggestion);
  }

  return parts.join("\n");
}

export function formatPolicyNote(params: {
  projectId: string;
  mergeRequestIid: string;
  headSha: string;
  status: "스킵" | "제한 리뷰";
  reasons: string[];
}): string {
  return [
    summaryMarker(params.projectId, params.mergeRequestIid, params.headSha),
    "",
    "## AI Code Review",
    "",
    `- 대상 커밋: \`${params.headSha}\``,
    `- 리뷰 상태: ${params.status}`,
    "",
    "### 사유",
    ...params.reasons.map((reason) => `- ${reason}`)
  ].join("\n");
}
