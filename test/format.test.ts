import { describe, expect, it } from "vitest";
import { formatFindingNote, formatSummaryNote } from "../src/review/format.js";
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

describe("formatFindingNote", () => {
  it("renders a GitLab suggestion block for a replacement suggestion", () => {
    const note = formatFindingNote(
      {
        path: "src/app.ts",
        line: 10,
        severity: "major",
        title: "Return the computed value",
        body: "The changed line returns the wrong value.",
        suggestion: "return computed;"
      },
      "abc123"
    );

    expect(note).toContain("```suggestion:-0+0\nreturn computed;\n```");
  });

  it("renders multi-line replacement code in a GitLab suggestion block", () => {
    const note = formatFindingNote(
      {
        path: "src/app.ts",
        line: 10,
        severity: "major",
        title: "Validate before returning",
        body: "The changed line can return invalid data.",
        suggestion: "if (!computed) {\n  throw new Error(\"computed is required\");\n}\nreturn computed;"
      },
      "abc123"
    );

    expect(note).toContain(
      [
        "```suggestion:-0+0",
        "if (!computed) {",
        "  throw new Error(\"computed is required\");",
        "}",
        "return computed;",
        "```"
      ].join("\n")
    );
  });

  it("keeps leading indentation in suggestion blocks", () => {
    const note = formatFindingNote(
      {
        path: "src/app.ts",
        line: 10,
        severity: "major",
        title: "Return the computed value",
        body: "The changed line returns the wrong value.",
        suggestion: "  return computed;"
      },
      "abc123"
    );

    expect(note).toContain("```suggestion:-0+0\n  return computed;\n```");
  });

  it("preserves indentation, internal blank lines, and normalizes CRLF in multi-line suggestions", () => {
    const note = formatFindingNote(
      {
        path: "src/app.ts",
        line: 10,
        severity: "major",
        title: "Return the computed value",
        body: "The changed line returns the wrong value.",
        suggestion: "  if (!computed) {\r\n    return fallback;\r\n  }\r\n\r\n  return computed;"
      },
      "abc123"
    );

    expect(note).toContain(
      [
        "```suggestion:-0+0",
        "  if (!computed) {",
        "    return fallback;",
        "  }",
        "",
        "  return computed;",
        "```"
      ].join("\n")
    );
  });

  it("does not render empty, whitespace-only, or fenced suggestions", () => {
    const findings = ["", "   ", "```ts\nreturn computed;\n```"].map((suggestion) =>
      formatFindingNote(
        {
          path: "src/app.ts",
          line: 10,
          severity: "major",
          title: "Return the computed value",
          body: "The changed line returns the wrong value.",
          suggestion
        },
        "abc123"
      )
    );

    for (const note of findings) {
      expect(note).not.toContain("```suggestion:-0+0");
      expect(note).toContain("The changed line returns the wrong value.");
    }
  });
});
