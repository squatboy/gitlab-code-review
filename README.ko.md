# GitLab AI Code Review

GitLab Merge Request pipeline에서 실행되는 AI 코드 리뷰 CLI.

별도 리뷰 서버를 두지 않고, 각 GitLab repository의 MR pipeline job이 Docker image를 pull한 뒤 `ai-code-review` CLI를 실행한다. CLI는 GitLab API로 MR 변경 내용을 읽고 Gemini에 리뷰를 요청한 뒤, MR summary note와 added line comment를 GitLab에 작성한다.

## 현재 검증 기준

- 검증용 image: `ghcr.io/squatboy/gitlab-code-review:v0.1.0-rc3`
- image platform: `linux/amd64`, `linux/arm64`
- 검증 repository: `sth/code-review-test`
- 검증 방식: 같은 project 내부 MR pipeline
- 실행 runner: `runner on k8s`
- runner tag: `k8s`
- 결과 artifact: `ai-review-result.json`

`latest` tag는 사용하지 않는다. CI에서는 항상 고정 tag를 사용한다.

## 동작 흐름

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
        +--> GitLab API: MR 정보, diff version, 변경 파일 조회
        |
        +--> Gemini API: structured review result 생성
        |
        +--> GitLab API: draft note 생성 후 bulk publish
        |
        +--> ai-review-result.json artifact 저장
```

`script: ai-code-review`가 실행하는 경로:

- `package.json`의 `bin.ai-code-review`
- Docker image 내부 `/usr/local/bin/ai-code-review`
- symlink 대상 `/app/dist/cli.js`
- 소스 entrypoint `src/cli.ts`
- 리뷰 실행 로직 `src/review/runner.ts`

## GitLab CI 적용

대상 repository의 `.gitlab-ci.yml`에 아래 job을 추가한다.

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

`tags: [k8s]`는 현재 검증 환경의 runner가 untagged job을 받지 않기 때문에 필요하다. 다른 환경에서 untagged job을 받을 수 있는 runner를 쓰면 제거할 수 있다.

## GitLab CI Variables

Group level variable로 등록하는 것을 기본으로 한다.

```text
AI_CODE_REVIEW_GITLAB_TOKEN
AI_REVIEW_API_KEY
```

`AI_CODE_REVIEW_GITLAB_TOKEN`:

- 권장: GitLab Group Access Token
- 대안: 전용 bot 계정의 Personal Access Token
- 권한: 대상 project에 Developer 이상
- scope: `api`
- 용도:
  - MR 읽기
  - MR discussion/note 조회
  - draft note 생성
  - draft note bulk publish
- 같은 project 내부 MR pipeline에서 사용하려면 protected variable로 두지 않는다.

`AI_REVIEW_API_KEY`:

- Gemini API key 원문
- GitLab CI variable에서는 masked/hidden 설정 권장

## 설정값

| Variable | Default | 설명 |
| --- | --- | --- |
| `AI_REVIEW_ENABLED` | `true` | `false`면 job 내부에서 리뷰를 스킵한다. |
| `AI_REVIEW_FORCE` | `false` | `true`면 같은 `head_sha`도 다시 리뷰한다. |
| `AI_REVIEW_LANGUAGE` | `ko` | 리뷰 결과 언어. |
| `AI_REVIEW_MODEL` | `gemini-3.1-flash-lite-preview` | Gemini 모델명. |
| `AI_REVIEW_MAX_COMMENTS` | `10` | MR 전체 line comment 최대 개수. |
| `AI_REVIEW_MAX_COMMENTS_PER_FILE` | `3` | 파일당 line comment 최대 개수. |
| `AI_REVIEW_RULE_PACKS` | `spring` | 적용할 rule pack. comma-separated string. |
| `AI_REVIEW_RESULT_PATH` | `ai-review-result.json` | 결과 artifact 파일 경로. |

## 리뷰 정책

- MR pipeline에서만 실행한다.
- fork MR은 제외한다.
- `Draft:` 또는 `WIP:` 제목의 MR은 제외한다.
- 같은 `head_sha`에 이미 summary note가 있으면 `duplicate_head_sha`로 스킵한다.
- `AI_REVIEW_FORCE=true`면 같은 `head_sha`도 다시 리뷰한다.
- line comment는 added line에만 작성한다.
- 삭제 line, context line, multi-line range에는 comment하지 않는다.
- AI 리뷰 실패는 pipeline을 막지 않는다.
- 실행 결과는 항상 `ai-review-result.json` artifact로 남긴다.

## Local Development

의존성 설치:

```bash
pnpm install
```

빌드:

```bash
pnpm build
```

테스트:

```bash
pnpm test
```

lint:

```bash
pnpm lint
```

로컬 non-network smoke:

```bash
AI_REVIEW_ENABLED=false pnpm dev
```

기대 결과:

- CLI가 실행된다.
- `ai-review-result.json`이 생성된다.
- status가 `skipped`로 기록된다.

## Docker Image Build

GitHub Actions workflow는 quality check 통과 후 GHCR에 multi-arch image를 publish한다.

- Pull request: `pnpm build`, `pnpm test`, `pnpm lint`, Docker build 검증만 실행하고 push하지 않는다.
- `main` push: `ghcr.io/squatboy/gitlab-code-review:sha-<short_sha>`를 push한다.
- `v*` tag push: `ghcr.io/squatboy/gitlab-code-review:v0.1.0-rc3` 같은 version tag만 push한다.
- `latest`는 사용하지 않는다.

현재 검증 image는 필요할 때만 수동으로 multi-arch build/push한다.

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/squatboy/gitlab-code-review:v0.1.0-rc3 \
  --push .
```

manifest 확인:

```bash
docker manifest inspect ghcr.io/squatboy/gitlab-code-review:v0.1.0-rc3
```

주의:

- `v0.1.0-rc1`은 최초 검증 중 runner platform 문제를 드러낸 tag다.
- `v0.1.0-rc3`은 첫 GHCR 검증 tag다.
- runner가 `pull_policy: IfNotPresent`만 허용하면 같은 tag 재push 후에도 노드 image cache 때문에 이전 image가 사용될 수 있다.
- 검증 tag를 갱신할 때는 새 고정 tag를 발급한다.

## MR Smoke Test

1. 테스트 repository에서 feature branch를 만든다.
2. `sample.txt` 같은 작은 파일에 한 줄만 추가한다.
3. Draft가 아닌 MR을 생성한다.
4. MR pipeline에서 `ai-code-review` job이 생성되는지 확인한다.
5. job trace에서 Docker image pull과 `$ ai-code-review` 실행을 확인한다.
6. MR summary note가 생성되는지 확인한다.
7. finding이 있으면 added line에만 comment가 달리는지 확인한다.
8. job artifact에서 `ai-review-result.json`을 확인한다.

정책 smoke:

1. 같은 MR pipeline job을 retry한다.
   - 기대 결과: `skippedReason=duplicate_head_sha`
2. `AI_REVIEW_FORCE=true`를 임시 CI variable로 넣고 retry한다.
   - 기대 결과: 같은 `head_sha`도 `status=completed`
   - 검증 후 임시 variable은 삭제한다.
3. MR 제목을 `Draft: ...`로 바꾼 뒤 MR pipeline 생성을 시도한다.
   - 기대 결과: rules에 의해 job이 제외된다.

## 보안 주의

이 MVP는 Gemini로 보내기 전 별도 secret masking을 수행하지 않는다.

MR diff와 제한된 주변 context가 Gemini API로 전송될 수 있다. 해당 전송이 허용되지 않는 repository에는 이 job을 적용하지 않는다.
