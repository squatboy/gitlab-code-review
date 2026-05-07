import { describe, expect, it } from "vitest";
import { filterFindings } from "../src/review/filter.js";
import type { ReviewFinding } from "../src/types.js";

const findings: ReviewFinding[] = [
  {
    path: "src/UserService.java",
    line: 10,
    severity: "major",
    title: "권한 검증 누락",
    body: "권한 검증이 없습니다."
  },
  {
    path: "src/UserService.java",
    line: 11,
    severity: "minor",
    title: "테스트 누락",
    body: "변경된 동작에 대한 테스트가 없습니다."
  },
  {
    path: "src/UserService.java",
    line: 12,
    severity: "nit",
    title: "취향 문제",
    body: "취향성 의견입니다."
  },
  {
    path: "src/UserService.java",
    line: 99,
    severity: "major",
    title: "댓글 불가 라인",
    body: "추가된 라인이 아닙니다."
  }
];

describe("filterFindings", () => {
  it("keeps actionable findings only on added lines within limits", () => {
    const addedLineMap = new Map([["src/UserService.java", new Set([10, 11])]]);
    const result = filterFindings(findings, addedLineMap, 10, 3, false);

    expect(result.accepted.map((finding) => finding.line)).toEqual([10, 11]);
    expect(result.rejectedCount).toBe(2);
  });

  it("rejects all line findings in summary-only mode", () => {
    const addedLineMap = new Map([["src/UserService.java", new Set([10, 11])]]);
    const result = filterFindings(findings, addedLineMap, 10, 3, true);

    expect(result.accepted).toEqual([]);
    expect(result.rejectedCount).toBe(4);
  });
});
