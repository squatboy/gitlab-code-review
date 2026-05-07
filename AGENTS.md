# AGENTS.md

## Project Context
- This project builds a GitLab CI-based AI code review CLI.
- The CLI runs in a central Docker image and is included by GitLab repos through a central CI template.
- The product spec lives in `PLAN.md`; read the relevant section before changing behavior.
- `README.md` is the user-facing project introduction and usage guide.

## Tech Stack
- Runtime: Node.js 22
- Language/package manager: TypeScript + pnpm
- CLI: commander
- Validation: zod
- Tests/lint/format: vitest, ESLint, Prettier

## Core Constraints
- Keep the implementation serverless: no webhook service or external backend.
- Local checkout is only for bounded file context.
- GitLab comments are created as draft notes and submitted with `bulk_publish`.
- AI review must be non-blocking; default CLI exit should remain successful on review failure.
- When build Dockerfile on local, use multi-arch image build

## Review Behavior
- Review only same-project internal MR pipelines.
- Skip fork MRs and Draft/WIP MRs.
- Skip duplicate reviews for the same `head_sha` unless `AI_REVIEW_FORCE=true`.
- Re-check current MR `head_sha` before draft creation and before publish.
- Comment only on added diff lines.
- Do not add deleted-line, context-line, or multi-line comments unless the spec changes.

## Scope Discipline
- Prefer small, surgical changes.
- Do not add provider fallback, OpenAI support, prompt override files, or repo config files unless asked.
- Do not introduce secret scanning/masking unless the spec is explicitly changed.
- Avoid speculative abstractions; add modules only when they isolate testable behavior.
- Keep CI template and Docker image versioning explicit; do not use `latest`.

## Code Guidelines
- Match the existing TypeScript module style.
- Use zod for external input validation.
- Use native `fetch` for GitLab and Gemini HTTP calls unless there is a clear reason to change.
- Keep artifacts free of full source, full prompts, API keys, and raw provider responses.
- Do not commit generated `dist/`, `node_modules/`, or `ai-review-result.json`.

## Verification
- Run `pnpm build` after TypeScript changes.
- Run `pnpm test` after behavior changes.
- Run `pnpm lint` before handing off.
- Docker build verification is useful when `Dockerfile` or packaging changes.
