# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SuperKiwi SDK - MediaPipe 얼굴 랜드마크 기반 비접촉 생체 신호 분석 TypeScript SDK. 심박수(rPPG), HRV, 눈 깜빡임, 시선 추적, 머리 자세, 집중도 점수를 실시간 측정한다.

## Build & Development Commands

```bash
npm run build        # tsup으로 CJS + ESM + DTS 빌드 (dist/)
npm run dev          # watch 모드 빌드
npm run typecheck    # tsc --noEmit 타입 검사
npm run lint         # ESLint (src/**/*.ts)
```

테스트 프레임워크는 아직 설정되지 않음. CI는 typecheck + build + dist 출력 파일 검증만 수행.

## Architecture

**단일 소스 파일 구조** - 모든 로직이 `src/SuperKiwiSDK.ts` 하나에 포함됨:

```
src/
├── index.ts           # 재수출 진입점 (export + default export)
├── SuperKiwiSDK.ts    # 메인 SDK 클래스 + 7개 내부 분석기 클래스 + 타입 정의
└── fft-js.d.ts        # fft-js 라이브러리 타입 선언
```

### 내부 분석기 클래스 (SuperKiwiSDK.ts 내 private classes)

| 클래스 | 역할 | 핵심 알고리즘 |
|--------|------|--------------|
| `RPPGAnalyzer` | 심박수 측정 | ROI 추출 → Green 채널 → detrend → bandpass filter → FFT → peak detection |
| `HRVAnalyzer` | 심박 변이도 분석 | RR 간격으로 SDNN, RMSSD, pNN50, stressIndex 계산 |
| `BlinkAnalyzer` | 눈 깜빡임 감지 | EAR(Eye Aspect Ratio) 알고리즘, 상태 전환 기반 감지 |
| `GazeTracker` | 시선 추적 | 양쪽 눈 중심점 평균 → 화면 중앙 대비 안정성 |
| `HeadPoseEstimator` | 머리 자세 추정 | 랜드마크 기반 Pitch/Yaw/Roll 계산 |
| `FocusScoreCalculator` | 집중도 점수 | 얼굴(0.4) + 시선안정성(0.4) + 깜빡임안정성(0.2) 가중합 |
| `PoseAnalyzer` | 얼굴 미감지 원인 분석 | 포즈 랜드마크 → 어깨 간격 캘리브레이션 → 원인 판단 (10가지) |

### 데이터 흐름

`processFrame(video, landmarks, timestamp, poseLandmarks?)` 호출 시:
1. PoseAnalyzer: poseLandmarks 제공 시 포즈 분석 → PoseStatusResult
2. 얼굴 감지 확인 (468개 랜드마크)
3. 얼굴 감지됨: 기존 6개 분석기 실행 + poseStatus 포함
4. 얼굴 미감지 + 포즈 있음: 원인별 분기 (버퍼 유지/정리)
5. RPPGAnalyzer: video에서 ROI 픽셀 추출 → green 채널 버퍼링 → FFT로 BPM 산출
6. HRVAnalyzer: RR 간격 누적 → 20개 이상 시 HRV 지표 계산
7. BlinkAnalyzer: 눈 랜드마크 → EAR 계산 → 임계값 비교
8. GazeTracker: 눈 중심 좌표 → 안정성 점수
9. HeadPoseEstimator: 주요 랜드마크 → 각도 계산
10. FocusScoreCalculator: 위 결과 종합 → 0-1 점수

## Key Constants & MediaPipe Landmark Indices

- `LANDMARKS.FOREHEAD`: [10, 151, 9, 337, 299, 333, 298, 301] - rPPG ROI
- `LANDMARKS.LEFT_EYE`: [33, 7, 163, 144, 145, 153] - EAR 계산용
- `LANDMARKS.RIGHT_EYE`: [263, 249, 390, 373, 374, 380] - EAR 계산용
- rPPG 대역통과 필터: 0.75-3.0 Hz (45-180 BPM)
- FFT 입력: 2의 거듭제곱으로 zero-padding
- 기본 버퍼: 300프레임 (10초 @ 30fps), 80% 이상 채워져야 분석 시작
- `LANDMARKS.POSE.NOSE`: 0 - 포즈 코 인덱스
- `LANDMARKS.POSE.LEFT_SHOULDER`: 11 - 왼쪽 어깨
- `LANDMARKS.POSE.RIGHT_SHOULDER`: 12 - 오른쪽 어깨
- 포즈 캘리브레이션: 30프레임, 어깨 간격 중앙값 baseline
- 버퍼 보존 타임아웃: 기본 5000ms (user_absent 시)

## Dependencies

- **Runtime**: `fft-js` (FFT 연산)
- **Peer**: `@mediapipe/tasks-vision` (optional, 얼굴 랜드마크 감지)
- **Build**: `tsup` (번들러), `typescript`

## Conventions

- Conventional Commits: `feat(scope):`, `fix(scope):`, `refactor:` 등
- 코드 스타일: 2 spaces, 세미콜론 필수, 작은따옴표
- TypeScript strict 모드 (`noImplicitAny`, `strictNullChecks`, `noUnusedLocals` 등)
- 모든 public 타입은 `src/index.ts`에서 재수출

## CI/CD

- **CI** (`.github/workflows/ci.yml`): Node 18/20/22 매트릭스로 typecheck + build
- **Release** (`.github/workflows/release.yml`): `v*` 태그 push 시 npm pack → GitHub Release 생성
