# GitLab AI Code Review

An AI code review CLI that runs in GitLab Merge Request pipelines.

This project does not run a separate review server. Instead, each GitLab repository runs an MR pipeline job that pulls the Docker image and executes the `ai-code-review` CLI. The CLI reads MR changes through the GitLab API, requests a review from Gemini, and writes an MR summary note and added-line comments back to GitLab.

## Current Validation Baseline

- Validation image: `ghcr.io/squatboy/gitlab-code-review:v0.1.0-rc3`
- Image platforms: `linux/amd64`, `linux/arm64`
- Validation repository: `sth/code-review-test`
- Validation method: same-project internal MR pipeline
- Runner: `runner on k8s`
- Runner tag: `k8s`
- Result artifact: `ai-review-result.json`

Do not use the `latest` tag. Always use a pinned tag in CI.

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
  tags:
    - k8s
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

`tags: [k8s]` is required in the current validation environment because the runner does not accept untagged jobs. It can be removed in environments where a runner accepts untagged jobs.

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
| `AI_REVIEW_LANGUAGE` | `ko` | Review result language. |
| `AI_REVIEW_MODEL` | `gemini-3.1-flash-lite-preview` | Gemini model name. |
| `AI_REVIEW_MAX_COMMENTS` | `10` | Maximum number of line comments per MR. |
| `AI_REVIEW_MAX_COMMENTS_PER_FILE` | `3` | Maximum number of line comments per file. |
| `AI_REVIEW_RULE_PACKS` | `spring` | Rule packs to apply. Comma-separated string. |
| `AI_REVIEW_RESULT_PATH` | `ai-review-result.json` | Result artifact file path. |

## Review Policy

- Run only in MR pipelines.
- Exclude fork MRs.
- Exclude MRs with titles starting with `Draft:` or `WIP:`.
- If a summary note already exists for the same `head_sha`, skip with `duplicate_head_sha`.
- If `AI_REVIEW_FORCE=true`, review the same `head_sha` again.
- Write line comments only on added lines.
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

Notes:

- `v0.1.0-rc1` is the tag that exposed the runner platform issue during the first validation.
- `v0.1.0-rc3` is the first GHCR validation tag.
- If the runner only allows `pull_policy: IfNotPresent`, the previous image may still be used from the node image cache even after repushing the same tag.
- When updating the validation tag, issue a new pinned tag.

## MR Smoke Test

1. Create a feature branch in the test repository.
2. Add only one line to a small file such as `sample.txt`.
3. Create a non-draft MR.
4. Confirm that the `ai-code-review` job is created in the MR pipeline.
5. In the job trace, confirm the Docker image pull and `$ ai-code-review` execution.
6. Confirm that an MR summary note is created.
7. If there are findings, confirm that comments are created only on added lines.
8. Confirm `ai-review-result.json` in the job artifact.

Policy smoke:

1. Retry the same MR pipeline job.
   - Expected result: `skippedReason=duplicate_head_sha`
2. Add `AI_REVIEW_FORCE=true` as a temporary CI variable and retry.
   - Expected result: the same `head_sha` is reviewed with `status=completed`
   - Delete the temporary variable after validation.
3. Change the MR title to `Draft: ...` and try to create an MR pipeline.
   - Expected result: the job is excluded by rules.

## Security Notes

This MVP does not perform separate secret masking before sending data to Gemini.

MR diffs and limited surrounding context may be sent to the Gemini API. Do not apply this job to repositories where such transmission is not allowed.
