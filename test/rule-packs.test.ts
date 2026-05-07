import { describe, expect, it } from "vitest";
import { buildRulePackPromptLines, resolveRulePacks } from "../src/review/rule-packs.js";

describe("resolveRulePacks", () => {
  it("always applies default and keeps known packs in stable order", () => {
    const result = resolveRulePacks([
      "spring",
      "nestjs",
      "node-express",
      "default",
      "spring",
      "vue-nuxt"
    ]);

    expect(result.appliedRulePacks).toEqual([
      "default",
      "spring",
      "nestjs",
      "node-express",
      "vue-nuxt"
    ]);
    expect(result.unknownRulePacks).toEqual([]);
  });

  it("ignores unknown packs but reports them", () => {
    const result = resolveRulePacks(["go-gin-echo", "unknown-pack", "another-unknown"]);

    expect(result.appliedRulePacks).toEqual(["default", "go-gin-echo"]);
    expect(result.unknownRulePacks).toEqual(["unknown-pack", "another-unknown"]);
  });
});

describe("buildRulePackPromptLines", () => {
  it("builds guidance lines for applied rule packs", () => {
    const lines = buildRulePackPromptLines(["default", "react-nextjs", "nestjs", "go-gin-echo"]);

    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("Rule pack (default):");
    expect(lines[1]).toContain("Rule pack (react-nextjs):");
    expect(lines[2]).toContain("Rule pack (nestjs):");
    expect(lines[3]).toContain("Rule pack (go-gin-echo):");
  });
});
