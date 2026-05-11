import { describe, expect, it } from "vitest";
import { buildAddedLineCodeMap, parseGitLabDiff } from "../src/gitlab/diff.js";

describe("parseGitLabDiff", () => {
  it("maps only added lines as commentable new lines", () => {
    const parsed = parseGitLabDiff({
      old_path: "src/UserService.java",
      new_path: "src/UserService.java",
      diff: [
        "@@ -10,4 +10,5 @@ public class UserService {",
        " unchanged();",
        "-oldCall();",
        "+newCall();",
        "+anotherCall();",
        " done();"
      ].join("\n")
    });

    expect(parsed.addedLines).toEqual([11, 12]);
    expect(parsed.addedCount).toBe(2);
    expect(parsed.deletedCount).toBe(1);
    expect(parsed.addedLineCodes.get(11)).toMatch(/^[a-f0-9]{40}_0_11$/);
    expect(parsed.addedLineCodes.get(12)).toMatch(/^[a-f0-9]{40}_0_12$/);
  });

  it("builds added-line line_code lookup by file path", () => {
    const map = buildAddedLineCodeMap([
      {
        old_path: "src/UserService.java",
        new_path: "src/UserService.java",
        diff: [
          "@@ -10,4 +10,5 @@ public class UserService {",
          " unchanged();",
          "-oldCall();",
          "+newCall();",
          "+anotherCall();",
          " done();"
        ].join("\n")
      }
    ]);

    const fileMap = map.get("src/UserService.java");
    expect(fileMap?.get(11)).toMatch(/^[a-f0-9]{40}_0_11$/);
    expect(fileMap?.get(12)).toMatch(/^[a-f0-9]{40}_0_12$/);
  });
});
