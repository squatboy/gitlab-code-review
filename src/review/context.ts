import { readFile } from "node:fs/promises";
import { isWholeFileContextAllowed } from "./exclusions.js";

const maxFileBytes = 100 * 1024;
const contextRadius = 80;

export async function readBoundedContext(path: string, addedLines: number[]): Promise<string | undefined> {
  try {
    const file = await readFile(path);
    if (file.byteLength > maxFileBytes) return undefined;

    const text = file.toString("utf8");
    if (isWholeFileContextAllowed(path)) return text;
    if (addedLines.length === 0) return undefined;

    const lines = text.split("\n");
    const selected = new Set<number>();

    for (const line of addedLines) {
      const start = Math.max(1, line - contextRadius);
      const end = Math.min(lines.length, line + contextRadius);
      for (let current = start; current <= end; current += 1) {
        selected.add(current);
      }
    }

    return [...selected]
      .sort((a, b) => a - b)
      .map((line) => `${line}: ${lines[line - 1]}`)
      .join("\n");
  } catch {
    return undefined;
  }
}
