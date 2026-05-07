import { z } from "zod";

const boolFromEnv = z
  .string()
  .optional()
  .transform((value) => value !== "false");

const forceBoolFromEnv = z
  .string()
  .optional()
  .transform((value) => value === "true");

const envSchema = z.object({
  AI_CODE_REVIEW_GITLAB_TOKEN: z.string().optional(),
  AI_REVIEW_API_KEY: z.string().optional(),
  AI_REVIEW_ENABLED: boolFromEnv,
  AI_REVIEW_FORCE: forceBoolFromEnv,
  AI_REVIEW_LANGUAGE: z.string().default("ko"),
  AI_REVIEW_MODEL: z.string().default("gemini-3.1-flash-lite-preview"),
  AI_REVIEW_MAX_COMMENTS: z.coerce.number().int().positive().default(10),
  AI_REVIEW_MAX_COMMENTS_PER_FILE: z.coerce.number().int().positive().default(3),
  AI_REVIEW_RULE_PACKS: z
    .string()
    .default("spring")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  CI_API_V4_URL: z.string().url().optional(),
  CI_PROJECT_ID: z.string().optional(),
  CI_MERGE_REQUEST_IID: z.string().optional(),
  CI_MERGE_REQUEST_TITLE: z.string().optional(),
  CI_MERGE_REQUEST_SOURCE_PROJECT_ID: z.string().optional(),
  AI_REVIEW_RESULT_PATH: z.string().default("ai-review-result.json")
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}

export function assertRunnableConfig(config: AppConfig): void {
  const missing: string[] = [];

  if (!config.AI_CODE_REVIEW_GITLAB_TOKEN) missing.push("AI_CODE_REVIEW_GITLAB_TOKEN");
  if (!config.AI_REVIEW_API_KEY) missing.push("AI_REVIEW_API_KEY");
  if (!config.CI_API_V4_URL) missing.push("CI_API_V4_URL");
  if (!config.CI_PROJECT_ID) missing.push("CI_PROJECT_ID");
  if (!config.CI_MERGE_REQUEST_IID) missing.push("CI_MERGE_REQUEST_IID");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function isDraftTitle(title?: string): boolean {
  return /^(Draft:|WIP:)/.test(title ?? "");
}

export function isSameProjectMr(config: AppConfig): boolean {
  if (!config.CI_PROJECT_ID || !config.CI_MERGE_REQUEST_SOURCE_PROJECT_ID) return true;
  return config.CI_PROJECT_ID === config.CI_MERGE_REQUEST_SOURCE_PROJECT_ID;
}
