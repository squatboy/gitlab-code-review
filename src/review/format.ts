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
  codeSummary: string[];
  summary: string[];
  findings: ReviewFinding[];
  rejectedFindings: number;
}): string {
  const { input, codeSummary, summary, findings, rejectedFindings } = params;
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

  if (codeSummary.length > 0) {
    lines.push("", "### Code summary", ...codeSummary.map((item) => `- ${item}`));
  }

  if (summary.length > 0) {
    lines.push("", "### Review", ...summary.map((item) => `- ${item}`));
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

  const suggestionBlock = formatSuggestionBlock(finding.suggestion);
  if (suggestionBlock) {
    parts.push("", suggestionBlock);
  }

  return parts.join("\n");
}

export function formatSuggestionBlock(suggestion?: string): string | undefined {
  if (!suggestion) return undefined;

  const normalized = suggestion.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized.trim().length === 0) return undefined;
  if (normalized.includes("```")) return undefined;

  return ["```suggestion:-0+0", normalized, "```"].join("\n");
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
