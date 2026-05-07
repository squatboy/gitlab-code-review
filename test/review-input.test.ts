import { describe, expect, it } from "vitest";
import { buildReviewInput } from "../src/review/input.js";

describe("buildReviewInput", () => {
  it("applies default rule pack and reports unknown packs in limits", async () => {
    const input = await buildReviewInput({
      diffs: [],
      projectId: "1",
      mergeRequestIid: "2",
      headSha: "sha",
      language: "ko",
      rulePacks: ["spring", "unknown-pack"],
      summaryOnly: false,
      limits: []
    });

    expect(input.rulePacks).toEqual(["default", "spring"]);
    expect(input.limits).toContain("알 수 없는 rule pack은 무시됨: unknown-pack");
  });
});
