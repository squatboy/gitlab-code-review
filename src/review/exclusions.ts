const exactFileNames = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Gemfile.lock",
  "poetry.lock",
  "Pipfile.lock",
  "go.sum",
  "mvnw",
  "mvnw.cmd",
  "gradlew",
  "gradlew.bat"
]);

const excludedExtensions = [
  ".lock",
  ".class",
  ".jar",
  ".war",
  ".ear",
  ".min.js",
  ".map",
  ".snap",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".pdf"
];

const excludedSegments = [
  "/dist/",
  "/build/",
  "/target/",
  "/out/",
  "/.next/",
  "/coverage/",
  "/vendor/",
  "/node_modules/",
  "/.gradle/",
  "/gradle/wrapper/",
  "/.mvn/wrapper/",
  "/generated/",
  "/generated-sources/",
  "/generated-test-sources/",
  "/src/generated/",
  "/src/main/generated/",
  "/src/test/generated/"
];

export function isExcludedPath(path: string): boolean {
  const normalized = `/${path.replaceAll("\\", "/")}`;
  const fileName = normalized.split("/").at(-1) ?? normalized;

  if (exactFileNames.has(fileName)) return true;
  if (excludedExtensions.some((ext) => fileName.endsWith(ext))) return true;
  if (excludedSegments.some((segment) => normalized.includes(segment))) return true;
  if (/\.generated\./.test(fileName)) return true;
  if (/Generated\./.test(fileName)) return true;
  if (/MapperImpl\.java$/.test(fileName)) return true;
  if (/^Q[A-Z].*\.java$/.test(fileName)) return true;
  if (/.*_\.java$/.test(fileName)) return true;
  if (/\.pb\.(go|ts)$/.test(fileName)) return true;

  return false;
}

export function isWholeFileContextAllowed(path: string): boolean {
  return /\.(ya?ml|properties|toml|json|xml|sql)$/.test(path) || /(^|\/)Dockerfile$/.test(path);
}
