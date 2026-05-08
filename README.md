<div align="center">
<br/>
<img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/gitlab.svg" width="120px" alt="">
<br/>

# Gitlab AI Code Review


</div>
<br>
<div align="left">

## About

An AI code review CLI that runs as a Job in GitLab Merge Request pipelines.

This project does not run a separate review server. Instead, each GitLab repository runs an MR pipeline job that pulls the Docker image and executes the `ai-code-review` CLI. The CLI reads MR changes through the GitLab API, requests a review from Gemini, and writes an MR summary note and added-line comments back to GitLab.

> Currently using Gemini 3.1 Flash Lite model - offers a generous free token limit, fast speed, and strong performance among lightweight models.

## Preview

<img width="1767" height="1032" alt="image" src="https://github.com/user-attachments/assets/814dc552-143d-4c41-986c-ceef75d04ae0" />
<br>
<img width="1767" height="1032" alt="image" src="https://github.com/user-attachments/assets/24ed4f08-2ec6-4b39-b72b-ee6a108e3987" />

## Features

- Reads MR metadata, latest diff version, and changed files via GitLab API.
- Maps only commentable **added lines** for inline review comments.
- Adds GitLab suggestion blocks to added-line comments when Gemini returns safe replacement code for the current added line.
- Reads bounded local workspace context around changed files to improve diff understanding.
- Generates a structured review result from Gemini with MR-level **code summary**, actionable line-level findings, and review limitations/notes.
- Creates MR draft notes (summary + line comments).
- Prevents duplicate reviews on the same `head_sha` by default, with optional override via `AI_REVIEW_FORCE=true`.
- Performs stale `head_sha` checks before posting/publishing to avoid outdated comments.
- Handles large MRs with policy-based behavior: normal line review within limits, summary-only mode on soft-limit overflow, and hard skip on hard-limit overflow.
- Filters non-reviewable files (lock/generated/binary/build outputs, etc.) to reduce noise.
- Supports composable **rule packs**: `default` (always applied), `spring`, `node-express`, `react-nextjs`, `python-django-fastapi`, `nestjs`, `go-gin-echo`, `vue-nuxt`.
- Supports comment-volume controls with `AI_REVIEW_MAX_COMMENTS` and `AI_REVIEW_MAX_COMMENTS_PER_FILE`.
- Keeps review non-blocking (`allow_failure: true`) so pipeline progress is not blocked by AI outages.
- Always writes a run artifact (`ai-review-result.json`) for traceability.

## Execution Flow

```text
GitLab Merge Request
        |
        v
MR Pipeline
        |
        v
ai-code-review job
        |
        v
Docker image: ghcr.io/squatboy/gitlab-code-review:<tag>
        |
        v
ai-code-review CLI
        |
        +--> GitLab API: read MR metadata, diff version, and changed files
        |
        +--> Gemini API: generate structured review result
        |
        +--> GitLab API: create draft notes and bulk publish
        |
        +--> save ai-review-result.json artifact
```

Execution path for `script: ai-code-review`:

- `bin.ai-code-review` in `package.json`
- `/usr/local/bin/ai-code-review` inside the Docker image
- Symlink target `/app/dist/cli.js`
- Source entrypoint `src/cli.ts`
- Review execution logic `src/review/runner.ts`

## GitLab CI Setup

Add the following job to `.gitlab-ci.yml` in the target repository.

```yaml
ai-code-review:
  stage: test
  image: ghcr.io/squatboy/gitlab-code-review:v0.1.0-rc3
  variables:
    AI_REVIEW_ENABLED: "true"
    AI_REVIEW_FORCE: "false"
    AI_REVIEW_LANGUAGE: "en"
    AI_REVIEW_MODEL: "gemini-3.1-flash-lite-preview"
    AI_REVIEW_MAX_COMMENTS: "10"
    AI_REVIEW_MAX_COMMENTS_PER_FILE: "3"
    AI_REVIEW_RULE_PACKS: "default"
    AI_REVIEW_RESULT_PATH: "ai-review-result.json"
  allow_failure: true
  script:
    - ai-code-review
  artifacts:
    when: always
    expire_in: 7 days
    paths:
      - ai-review-result.json
  rules:
    - if: '$AI_REVIEW_ENABLED == "false"'
      when: never
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" && $CI_MERGE_REQUEST_SOURCE_PROJECT_ID == $CI_PROJECT_ID && $CI_MERGE_REQUEST_TITLE !~ /^(Draft:|WIP:)/'
      when: on_success
    - when: never
```

> `tags: ` option is required in the environment where the gitlab runner not accepting untagged jobs. 

## GitLab CI Variables

Register these variables as group-level variables by default.

```text
AI_CODE_REVIEW_GITLAB_TOKEN
AI_REVIEW_API_KEY
```

`AI_CODE_REVIEW_GITLAB_TOKEN`:

- Recommended: GitLab Group Access Token
- Alternative: Personal Access Token from a dedicated bot account
- Role: Developer or higher in the target project
- Scope: `api`
- Purpose:
  - Read MRs
  - Read MR discussions/notes
  - Create draft notes
  - Bulk publish draft notes
- Do not mark it as a protected variable if it must be available to same-project internal MR pipelines.

`AI_REVIEW_API_KEY`:

- Raw Gemini API key
- Recommended GitLab CI variable settings: masked/hidden

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `AI_REVIEW_ENABLED` | `true` | If `false`, the job skips the review internally. |
| `AI_REVIEW_FORCE` | `false` | If `true`, the same `head_sha` is reviewed again. |
| `AI_REVIEW_LANGUAGE` | `en` | Review result language. |
| `AI_REVIEW_MODEL` | `gemini-3.1-flash-lite-preview` | Gemini model name. |
| `AI_REVIEW_MAX_COMMENTS` | `10` | Maximum number of line comments per MR. |
| `AI_REVIEW_MAX_COMMENTS_PER_FILE` | `3` | Maximum number of line comments per file. |
| `AI_REVIEW_RULE_PACKS` | `default` | Rule packs to apply. Comma-separated string. `default` is always applied. |
| `AI_REVIEW_RESULT_PATH` | `ai-review-result.json` | Result artifact file path. |

Supported rule packs:

- `default`: universal baseline for correctness, security, integrity, and regression risk.
- `spring`: Spring/JPA/MyBatis/REST-focused checks.
- `node-express`: Node.js/Express API and middleware-focused checks.
- `react-nextjs`: React/Next.js rendering, boundary, and API contract checks.
- `python-django-fastapi`: Python Django/FastAPI ORM, validation, and auth checks.
- `nestjs`: NestJS module/DI boundaries, guard/interceptor/pipe flow, DTO validation, and auth checks.
- `go-gin-echo`: Go Gin/Echo context timeout/cancellation, goroutine safety, validation, and API contract checks.
- `vue-nuxt`: Vue/Nuxt SSR-CSR boundary, hydration mismatch, route guard/auth flow, and XSS risk checks.

Notes:

- Unknown rule packs are ignored and the review continues.
- Ignored rule packs are reported in the review summary limitations.
- Example: `AI_REVIEW_RULE_PACKS=spring,nestjs,go-gin-echo`

## Current Review Policy

- Run only in MR pipelines.
- Exclude fork MRs.
- Exclude MRs with titles starting with `Draft:` or `WIP:`.
- If a summary note already exists for the same `head_sha`, skip with `duplicate_head_sha`.
- If `AI_REVIEW_FORCE=true`, review the same `head_sha` again.
- Write line comments only on added lines.
- Attach suggestions only to added-line comments when exact replacement code is available for the current added line.
- Suggestion replacement code may contain multiple lines, but multi-line source range replacement is out of scope.
- Do not comment on deleted lines, context lines, or multi-line ranges.
- Do not block the pipeline when AI review fails.
- Always write the execution result to the `ai-review-result.json` artifact.

## Local Development

Install dependencies:

```bash
pnpm install
```

Build:

```bash
pnpm build
```

Test:

```bash
pnpm test
```

Lint:

```bash
pnpm lint
```

Local non-network smoke:

```bash
AI_REVIEW_ENABLED=false pnpm dev
```

Expected result:

- The CLI runs.
- `ai-review-result.json` is created.
- The status is recorded as `skipped`.

## Docker Image Build

The GitHub Actions workflow publishes multi-arch images to GHCR after quality checks pass.

- Pull requests: run `pnpm build`, `pnpm test`, `pnpm lint`, and Docker build validation without pushing.
- `main` push: push `ghcr.io/squatboy/gitlab-code-review:sha-<short_sha>`.
- `v*` tag push: push only the matching version tag, such as `ghcr.io/squatboy/gitlab-code-review:v0.1.0-rc3`.
- `latest` is not used.

Build and push the current validation image manually only when needed.

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/squatboy/gitlab-code-review:v0.1.0-rc3 \
  --push .
```

Check the manifest:

```bash
docker manifest inspect ghcr.io/squatboy/gitlab-code-review:v0.1.0-rc3
```
