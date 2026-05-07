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

  it("ignores unknown packs in prompt composition", () => {
    const prompt = buildPrompt({
      ...baseInput,
      rulePacks: ["unknown-pack", "react-nextjs"]
    });

    expect(prompt).toContain("Apply these rule packs: default, react-nextjs.");
    expect(prompt).not.toContain("Rule pack (unknown-pack):");
  });
});
