const rulePackGuidelines = {
  default:
    "Focus on correctness, security, data integrity, error handling, and regression risk. Prioritize issues that can break runtime behavior or production operations.",
  spring:
    "Prioritize transaction boundaries, JPA/MyBatis query correctness, REST API contract consistency, authorization checks, sensitive logging, runtime configuration safety, and missing tests around changed behavior.",
  "node-express":
    "Prioritize async error propagation, middleware ordering, request validation, auth/session/cookie security, SQL/NoSQL injection risk, and API response contract mismatches.",
  "react-nextjs":
    "Prioritize server/client boundary issues, hydration and rendering mismatches, unsafe data fetching or caching behavior, XSS exposure, route/API contract mismatches, and missing tests for changed flows.",
  "python-django-fastapi":
    "Prioritize ORM query correctness, transaction handling, serializer/schema validation, auth/permission enforcement, async/sync misuse, insecure defaults, and API contract regressions.",
  nestjs:
    "Prioritize module boundary and dependency-injection correctness, guard/interceptor/pipe ordering, DTO validation and transformation safety, auth/permission checks, and API contract regressions.",
  "go-gin-echo":
    "Prioritize context cancellation and timeout handling, error propagation, goroutine and shared-state safety, input validation, SQL/NoSQL injection risk, and HTTP contract mismatches.",
  "vue-nuxt":
    "Prioritize SSR/CSR boundary correctness, hydration mismatches, unsafe HTML rendering and XSS exposure, composable state leakage, route middleware/auth guard logic, and data-fetching contract regressions."
} as const satisfies Record<string, string>;

type RulePackName = keyof typeof rulePackGuidelines;

export const supportedRulePacks = Object.keys(rulePackGuidelines) as RulePackName[];

export function resolveRulePacks(rulePacks: string[]): {
  appliedRulePacks: RulePackName[];
  unknownRulePacks: string[];
} {
  const seenKnown = new Set<RulePackName>();
  const seenUnknown = new Set<string>();
  const selectedKnown: RulePackName[] = [];
  const unknownRulePacks: string[] = [];

  for (const rawRulePack of rulePacks) {
    const normalized = normalizeRulePack(rawRulePack);
    if (!normalized) continue;

    if (normalized in rulePackGuidelines) {
      const knownRulePack = normalized as RulePackName;
      if (!seenKnown.has(knownRulePack)) {
        seenKnown.add(knownRulePack);
        selectedKnown.push(knownRulePack);
      }
      continue;
    }

    if (!seenUnknown.has(normalized)) {
      seenUnknown.add(normalized);
      unknownRulePacks.push(normalized);
    }
  }

  const appliedRulePacks: RulePackName[] = [
    "default",
    ...selectedKnown.filter((item) => item !== "default")
  ];
  return { appliedRulePacks, unknownRulePacks };
}

export function buildRulePackPromptLines(rulePacks: string[]): string[] {
  const { appliedRulePacks } = resolveRulePacks(rulePacks);
  return appliedRulePacks.map((rulePack) => `Rule pack (${rulePack}): ${rulePackGuidelines[rulePack]}`);
}

function normalizeRulePack(value: string): string {
  return value.trim().toLowerCase();
}
