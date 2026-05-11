import { z } from "zod";
import type { ReviewInput, ReviewResponse } from "../types.js";
import { buildRulePackPromptLines, resolveRulePacks } from "../review/rule-packs.js";

const findingSchema = z.object({
  path: z.string(),
  line: z.number().int().positive(),
  endLine: z.number().int().positive().optional(),
  severity: z.enum(["critical", "major", "minor", "nit"]),
  title: z.string(),
  body: z.string(),
  suggestion: z.string().optional()
}).refine((finding) => finding.endLine === undefined || finding.endLine >= finding.line, {
  message: "endLine must be greater than or equal to line",
  path: ["endLine"]
});

const reviewResponseSchema = z.object({
  codeSummary: z.array(z.string()).default([]),
  summary: z.array(z.string()).default([]),
  findings: z.array(findingSchema).default([]),
  limitations: z.array(z.string()).optional()
});

const geminiResponseSchema = {
  type: "OBJECT",
  properties: {
    codeSummary: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    summary: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    findings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          path: { type: "STRING" },
          line: { type: "INTEGER" },
          endLine: { type: "INTEGER" },
          severity: {
            type: "STRING",
            enum: ["critical", "major", "minor", "nit"]
          },
          title: { type: "STRING" },
          body: { type: "STRING" },
          suggestion: { type: "STRING" }
        },
        required: ["path", "line", "severity", "title", "body"],
        propertyOrdering: ["path", "line", "endLine", "severity", "title", "body", "suggestion"]
      }
    },
    limitations: {
      type: "ARRAY",
      items: { type: "STRING" }
    }
  },
  required: ["codeSummary", "summary", "findings"],
  propertyOrdering: ["codeSummary", "summary", "findings", "limitations"]
};

export class GeminiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async review(input: ReviewInput): Promise<ReviewResponse> {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`
    );
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: geminiResponseSchema
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText} ${body}`);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!text) {
      throw new Error("Gemini API returned an empty response");
    }

    return reviewResponseSchema.parse(JSON.parse(text));
  }
}

export function buildPrompt(input: ReviewInput): string {
  const { appliedRulePacks } = resolveRulePacks(input.rulePacks);
  const rulePackLines = buildRulePackPromptLines(appliedRulePacks);

  return [
    "You are an AI code reviewer for GitLab Merge Requests.",
    "Return only JSON that matches the provided schema.",
    `Write review output in ${input.language}. Keep code identifiers, paths, API names, and errors unchanged.`,
    "Use codeSummary to summarize what changed in the MR code and what the changed code does.",
    "Use summary for review-oriented risk, behavior, and verification notes.",
    "Only report actionable issues. Do not praise, nitpick, or comment on style preferences.",
    "Allowed severities are critical, major, minor, nit. Do not return nit findings unless the issue is objectively important.",
    "Line findings must point only to added lines listed in each file. If unsure, put the concern in summary instead.",
    "Use finding.line as the start line of the issue. Set finding.endLine only when the issue spans multiple contiguous added lines.",
    "If finding.endLine is set, every line from finding.line to finding.endLine must exist in file.addedLines.",
    "For finding.suggestion, return the full replacement code block needed to fix the issue around the reported line.",
    "If finding.endLine is set, finding.suggestion must replace the full range from finding.line to finding.endLine.",
    "Do not limit finding.suggestion to a single line; include all required lines when a block-level change is needed.",
    "Do not include Markdown fences or explanation text in finding.suggestion.",
    "Omit finding.suggestion when the exact replacement code is uncertain.",
    `Apply these rule packs: ${appliedRulePacks.join(", ")}.`,
    ...rulePackLines,
    input.summaryOnly
      ? "This MR is over the normal line-review limit. Return codeSummary and summary only, and no line findings."
      : "Return at most the most important actionable line findings.",
    "",
    JSON.stringify(input)
  ].join("\n");
}
