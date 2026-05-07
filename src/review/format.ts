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
    "## 🔎 AI Code Review",
    "",
    `- Target commit: \`${input.headSha}\``,
    "- Review status: Completed",
    `- Reviewed files: ${input.files.length}`,
    `- Line comments: ${findings.length}`,
    `- Excluded files: ${input.excludedFiles.length}`,
    `- Discarded findings: ${rejectedFindings}`
  ];

  if (summary.length > 0) {
    lines.push("", "### Summary", ...summary.map((item) => `- ${item}`));
  }

  if (findings.length > 0) {
    lines.push(
      "",
      "### Key findings",
      ...findings.map((finding) => `- \`${finding.path}:${finding.line}\` ${finding.title}`)
    );
  }

  const limits = [...input.limits];
  if (input.excludedFiles.length > 0) {
    limits.push(`Excluded files: ${input.excludedFiles.slice(0, 20).join(", ")}`);
  }

  if (limits.length > 0) {
    lines.push("", "### Limits", ...limits.map((item) => `- ${item}`));
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
  status: "Skipped" | "Limited review";
  reasons: string[];
}): string {
  return [
    summaryMarker(params.projectId, params.mergeRequestIid, params.headSha),
    "",
    "## AI Code Review",
    "",
    `- Target commit: \`${params.headSha}\``,
    `- Review status: ${params.status}`,
    "",
    "### Reasons",
    ...params.reasons.map((reason) => `- ${reason}`)
  ].join("\n");
}
