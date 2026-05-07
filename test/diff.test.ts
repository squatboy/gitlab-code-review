import { describe, expect, it } from "vitest";
import { parseGitLabDiff } from "../src/gitlab/diff.js";

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
  });
});
