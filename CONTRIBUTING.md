# Contributing to SuperKiwi SDK

SuperKiwi SDK에 기여해 주셔서 감사합니다! 이 문서는 프로젝트에 기여하는 방법을 안내합니다.

## 목차

- [행동 강령](#행동-강령)
- [시작하기](#시작하기)
- [개발 환경](#개발-환경)
- [기여 방법](#기여-방법)
- [코드 스타일](#코드-스타일)
- [커밋 메시지](#커밋-메시지)
- [Pull Request](#pull-request)

---

## 행동 강령

이 프로젝트는 모든 참여자가 존중받는 환경을 유지합니다. 건설적인 피드백과 협력적인 태도를 기대합니다.

---

## 시작하기

### 1. 저장소 포크

GitHub에서 이 저장소를 포크합니다.

### 2. 로컬 클론

```bash
git clone https://github.com/YOUR_USERNAME/SuperKiwiSDK.git
cd SuperKiwiSDK
```

### 3. 업스트림 설정

```bash
git remote add upstream https://github.com/excatt/SuperKiwiSDK.git
```

### 4. 브랜치 생성

```bash
git checkout -b feature/your-feature-name
```

---

## 개발 환경

### 필수 요구사항

- Node.js 18.0.0 이상
- npm 9.0.0 이상

### 설치

```bash
npm install
```

### 개발 명령어

```bash
# 개발 모드 (watch)
npm run dev

# 빌드
npm run build

# 타입 체크
npm run typecheck

# 린트
npm run lint
```

### 프로젝트 구조

```
SuperKiwiSDK/
├── src/
│   ├── index.ts          # 진입점
│   ├── SuperKiwiSDK.ts   # 메인 SDK
│   └── fft-js.d.ts       # FFT 타입 정의
├── examples/
│   └── SuperKiwiSDK.example.ts
├── dist/                  # 빌드 결과물
├── .github/
│   └── workflows/        # GitHub Actions
├── package.json
├── tsconfig.json
└── README.md
```

---

## 기여 방법

### 버그 리포트

1. [Issues](https://github.com/excatt/SuperKiwiSDK/issues)에서 기존 이슈 검색
2. 없다면 새 이슈 생성
3. 다음 정보 포함:
   - 버그 설명
   - 재현 단계
   - 예상 동작
   - 실제 동작
   - 환경 정보 (브라우저, OS, Node 버전)

### 기능 제안

1. [Issues](https://github.com/excatt/SuperKiwiSDK/issues)에 Feature Request 생성
2. 다음 정보 포함:
   - 기능 설명
   - 사용 사례
   - 예상 API

### 코드 기여

1. 이슈 생성 또는 기존 이슈에 댓글
2. 포크 및 브랜치 생성
3. 코드 작성
4. 테스트 추가
5. Pull Request 생성

---

## 코드 스타일

### TypeScript

- 명시적 타입 선언 사용
- `any` 타입 사용 지양
- 인터페이스 선호 (type alias 대신)

```typescript
// Good
interface Point3D {
  x: number;
  y: number;
  z: number;
}

// Avoid
type Point3D = { x: any; y: any; z: any };
```

### 네이밍 컨벤션

| 타입 | 스타일 | 예시 |
|------|--------|------|
| 클래스 | PascalCase | `SuperKiwiSDK` |
| 인터페이스 | PascalCase | `HeartRateResult` |
| 함수 | camelCase | `processFrame` |
| 상수 | UPPER_SNAKE | `MAX_HEART_RATE` |
| 파일 | PascalCase | `SuperKiwiSDK.ts` |

### 주석

```typescript
/**
 * 프레임을 처리하고 생체 신호를 분석합니다.
 *
 * @param video - 비디오 엘리먼트
 * @param landmarks - 468개 얼굴 랜드마크 또는 null
 * @param timestamp - 타임스탬프 (ms)
 * @returns 생체 신호 분석 결과
 */
processFrame(
  video: HTMLVideoElement,
  landmarks: Point3D[] | null,
  timestamp?: number
): SuperKiwiResult {
  // ...
}
```

### 포매팅

- 들여쓰기: 2 spaces
- 세미콜론: 필수
- 따옴표: 작은따옴표 선호

---

## 커밋 메시지

[Conventional Commits](https://www.conventionalcommits.org/) 형식을 따릅니다.

### 형식

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type

| Type | 설명 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `style` | 포매팅 (코드 변경 없음) |
| `refactor` | 리팩토링 |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 설정 변경 |

### 예시

```bash
feat(hrv): add frequency domain analysis

- Add LF/HF ratio calculation
- Implement spectral analysis using FFT
- Update HRVResult interface

Closes #42
```

---

## Pull Request

### PR 생성 전 체크리스트

- [ ] 코드 빌드 성공 (`npm run build`)
- [ ] 타입 체크 통과 (`npm run typecheck`)
- [ ] 린트 검사 통과 (`npm run lint`)
- [ ] 문서 업데이트 (필요시)
- [ ] 커밋 메시지 형식 준수

### PR 템플릿

```markdown
## 변경 사항

- 변경 내용 1
- 변경 내용 2

## 관련 이슈

Closes #이슈번호

## 테스트

- [ ] 수동 테스트 완료
- [ ] 브라우저 테스트 (Chrome, Firefox, Safari)

## 스크린샷 (UI 변경 시)

[스크린샷 첨부]
```

### 리뷰 프로세스

1. CI 검사 통과 확인
2. 코드 리뷰 요청
3. 피드백 반영
4. 승인 후 머지

---

## 질문이 있으신가요?

- [GitHub Issues](https://github.com/excatt/SuperKiwiSDK/issues)에 질문 남기기
- 이메일: support@superkiwi.io

감사합니다! 🥝
