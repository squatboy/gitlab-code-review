<div align="center">
<br/>
<img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/gitlab.svg" width="120px" alt="">
<br/>

# Gitlab AI Code Review


</div>
<br>
<div align="left">

## About

GitLab Merge Request pipeline에서 Job으로 실행되는 AI 코드 리뷰.

별도 리뷰 서버를 두지 않고, 각 GitLab repository의 MR pipeline job이 Docker image를 pull한 뒤 `ai-code-review` CLI를 실행한다. CLI는 GitLab API로 MR 변경 내용을 읽고 Gemini에 리뷰를 요청한 뒤, MR summary note와 added line comment를 GitLab에 작성한다.

> 현재 사용중인 모델 : Gemini 3.1 Flash Lite model - 무료 토큰 제한이 높고, 빠르고 경량화 모델 중 성능이 우수함.

## Preview

<img width="1767" height="1032" alt="image" src="https://github.com/user-attachments/assets/814dc552-143d-4c41-986c-ceef75d04ae0" />
<br>
<img width="1767" height="1032" alt="image" src="https://github.com/user-attachments/assets/24ed4f08-2ec6-4b39-b72b-ee6a108e3987" />


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

## GitLab CI 적용

대상 repository의 `.gitlab-ci.yml`에 아래 job을 추가한다.

```yaml
ai-code-review:
  stage: test
  image: ghcr.io/squatboy/gitlab-code-review:v0.1.0-rc3
  variables:
    AI_REVIEW_ENABLED: "true"
    AI_REVIEW_FORCE: "false"
    AI_REVIEW_LANGUAGE: "ko"
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

**runner 설정:**
- `tags` 필드는 선택사항입니다. Runner가 untagged job을 지원하지 않으면 추가하세요.
  ```yaml
  tags:
    - <your-runner-tag>
  ```

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
| `AI_REVIEW_LANGUAGE` | `en` | 리뷰 결과 언어. 한국어는 `ko` 로 선언 |
| `AI_REVIEW_MODEL` | `gemini-3.1-flash-lite-preview` | Gemini 모델명. |
| `AI_REVIEW_MAX_COMMENTS` | `10` | MR 전체 line comment 최대 개수. |
| `AI_REVIEW_MAX_COMMENTS_PER_FILE` | `3` | 파일당 line comment 최대 개수. |
| `AI_REVIEW_RULE_PACKS` | `default` | 적용할 rule pack. comma-separated string. `default`는 항상 적용됨. |
| `AI_REVIEW_RESULT_PATH` | `ai-review-result.json` | 결과 artifact 파일 경로. |

지원 rule pack:

- `default`: 언어/프레임워크 공통 기준(정합성, 보안, 무결성, 회귀 위험)
- `spring`: Spring/JPA/MyBatis/REST 중심 점검
- `node-express`: Node.js/Express API 및 미들웨어 중심 점검
- `react-nextjs`: React/Next.js 렌더링 경계 및 계약 중심 점검
- `python-django-fastapi`: Django/FastAPI ORM·검증·권한 중심 점검
- `nestjs`: NestJS 모듈/DI 경계, guard/interceptor/pipe 흐름, DTO 검증, 권한 점검
- `go-gin-echo`: Go Gin/Echo 컨텍스트 타임아웃·취소, 고루틴 안전성, 검증, API 계약 점검
- `vue-nuxt`: Vue/Nuxt SSR-CSR 경계, hydration 불일치, 라우트 가드/인증 흐름, XSS 위험 점검

동작 정책:

- 알 수 없는 rule pack은 무시하고 리뷰를 계속 진행한다.
- 무시된 pack 이름은 리뷰 summary의 제한 항목에 표시된다.
- 예시: `AI_REVIEW_RULE_PACKS=spring,nestjs,go-gin-echo`

## 현재 리뷰 정책

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
- `v*` tag push: version tag (예: `v0.1.0`)만 push한다.
- `latest` tag는 사용하지 않는다.

**로컬 테스트:**

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/squatboy/gitlab-code-review:<version> \
  --push .
```

manifest 확인:

```bash
docker manifest inspect ghcr.io/squatboy/gitlab-code-review:<version>
```
