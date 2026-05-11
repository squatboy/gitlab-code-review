import { describe, expect, it } from "vitest";
import { buildPrompt } from "../src/llm/gemini.js";
import type { ReviewInput } from "../src/types.js";

const baseInput: ReviewInput = {
  projectId: "1",
  mergeRequestIid: "2",
  headSha: "abc123",
  language: "ko",
  rulePacks: ["spring"],
  summaryOnly: false,
  files: [],
  excludedFiles: [],
  limits: []
};

describe("buildPrompt", () => {
  it("includes default and selected rule packs in prompt", () => {
    const prompt = buildPrompt(baseInput);

    expect(prompt).toContain("Apply these rule packs: default, spring.");
    expect(prompt).toContain("Rule pack (default):");
    expect(prompt).toContain("Rule pack (spring):");
  });

  it("requests separate code and review summaries", () => {
    const prompt = buildPrompt(baseInput);

    expect(prompt).toContain("Use codeSummary to summarize what changed in the MR code");
    expect(prompt).toContain("Use summary for review-oriented risk");
  });

  it("defines the unrestricted suggestion block contract", () => {
    const prompt = buildPrompt(baseInput);

    expect(prompt).toContain(
      "Use finding.line as the start line of the issue. Set finding.endLine only when the issue spans multiple contiguous added lines."
    );
    expect(prompt).toContain(
      "If finding.endLine is set, every line from finding.line to finding.endLine must exist in file.addedLines."
    );
    expect(prompt).toContain(
      "For finding.suggestion, return the full replacement code block needed to fix the issue around the reported line."
    );
    expect(prompt).toContain(
      "If finding.endLine is set, finding.suggestion must replace the full range from finding.line to finding.endLine."
    );
    expect(prompt).toContain(
      "Do not limit finding.suggestion to a single line; include all required lines when a block-level change is needed."
    );
    expect(prompt).toContain("Do not include Markdown fences or explanation text in finding.suggestion.");
    expect(prompt).toContain("Omit finding.suggestion when the exact replacement code is uncertain.");
  });

  it("ignores unknown packs in prompt composition", () => {
    const prompt = buildPrompt({
      ...baseInput,
      rulePacks: ["unknown-pack", "react-nextjs"]
    });

    expect(prompt).toContain("Apply these rule packs: default, react-nextjs.");
    expect(prompt).not.toContain("Rule pack (unknown-pack):");
  });
});
