import { describe, expect, it } from "vitest";
import { isExcludedPath } from "../src/review/exclusions.js";

describe("isExcludedPath", () => {
  it("excludes low-value generated and build files", () => {
    expect(isExcludedPath("pnpm-lock.yaml")).toBe(true);
    expect(isExcludedPath("backend/build/classes/User.class")).toBe(true);
    expect(isExcludedPath("src/main/generated/com/example/User.java")).toBe(true);
    expect(isExcludedPath("src/main/java/com/example/UserMapperImpl.java")).toBe(true);
    expect(isExcludedPath("src/main/java/com/example/QUser.java")).toBe(true);
  });

  it("keeps Spring source, config, and mapper files reviewable", () => {
    expect(isExcludedPath("src/main/java/com/example/UserService.java")).toBe(false);
    expect(isExcludedPath("src/test/java/com/example/UserServiceTest.java")).toBe(false);
    expect(isExcludedPath("src/main/resources/application.yml")).toBe(false);
    expect(isExcludedPath("src/main/resources/mapper/UserMapper.xml")).toBe(false);
    expect(isExcludedPath("build.gradle")).toBe(false);
    expect(isExcludedPath("pom.xml")).toBe(false);
  });
});
