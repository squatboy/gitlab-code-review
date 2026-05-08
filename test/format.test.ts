import { describe, expect, it } from "vitest";
import { formatSummaryNote } from "../src/review/format.js";
import type { ReviewInput } from "../src/types.js";

const input: ReviewInput = {
  projectId: "1",
  mergeRequestIid: "2",
  headSha: "abc123",
  language: "ko",
  rulePacks: ["default"],
  summaryOnly: false,
  files: [
    {
      path: "src/app.ts",
      oldPath: "src/app.ts",
      diff: "",
      addedLines: [10]
    }
  ],
  excludedFiles: [],
  limits: []
};

describe("formatSummaryNote", () => {
  it("renders code summary, review summary, and key findings", () => {
    const note = formatSummaryNote({
      input,
      codeSummary: ["Adds validation before saving users."],
      summary: ["Missing tests for the new validation path."],
      findings: [
        {
          path: "src/app.ts",
          line: 10,
          severity: "major",
          title: "Validation error is not handled",
          body: "The new validation branch can throw before the API response is created."
        }
      ],
      rejectedFindings: 0
    });

    expect(note).toContain("### Code summary\n- Adds validation before saving users.");
    expect(note).toContain("### Review\n- Missing tests for the new validation path.");
    expect(note).toContain("### Key findings\n- `src/app.ts:10` Validation error is not handled");
  });
});
