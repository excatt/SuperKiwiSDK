# SuperKiwi SDK

[![npm version](https://img.shields.io/npm/v/superkiwi-sdk.svg)](https://www.npmjs.com/package/superkiwi-sdk)
[![CI](https://github.com/excatt/SuperKiwiSDK/actions/workflows/ci.yml/badge.svg)](https://github.com/excatt/SuperKiwiSDK/actions/workflows/ci.yml)
[![Release](https://github.com/excatt/SuperKiwiSDK/actions/workflows/release.yml/badge.svg)](https://github.com/excatt/SuperKiwiSDK/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

MediaPipe 얼굴 랜드마크를 활용한 **비접촉 생체 신호 분석 SDK**

카메라만으로 심박수, HRV, 집중도 등 다양한 생체 지표를 실시간으로 측정합니다.

---

## 목차

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Examples](#examples)
- [Technical Details](#technical-details)
- [Troubleshooting](#troubleshooting)
- [Browser Support](#browser-support)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| 기능 | 설명 | 정확도 |
|------|------|--------|
| **Heart Rate (rPPG)** | 원격 광용적맥파를 통한 비접촉 심박수 측정 | ±5 BPM |
| **HRV Analysis** | SDNN, RMSSD, pNN50, 스트레스 지수 분석 | 임상급 |
| **Blink Detection** | EAR 알고리즘 기반 눈 깜빡임 감지 | 95%+ |
| **Gaze Tracking** | 시선 방향 및 안정성 추적 | 90%+ |
| **Head Pose** | Pitch, Yaw, Roll 머리 자세 추정 | ±5° |
| **Focus Score** | 종합 집중도 점수 계산 (0-100) | - |
| **Pose Detection** | MediaPipe Pose Landmarker 기반 얼굴 미감지 원인 분석 | 10가지 원인 |

### 주요 특징

- **비접촉 측정**: 웹캠만으로 생체 신호 분석
- **실시간 처리**: 30fps 기준 실시간 분석
- **경량화**: 단일 파일, 최소 의존성 (~18KB gzipped)
- **TypeScript 지원**: 완벽한 타입 정의 제공
- **프레임워크 무관**: React, Vue, Angular, Vanilla JS 모두 지원
- **얼굴 미감지 원인 분석**: 고개 돌림, 숙임, 부재 등 10가지 원인 구분

---

## Installation

### 방법 1: GitHub Release (권장)

[최신 릴리즈](https://github.com/excatt/SuperKiwiSDK/releases/latest)에서 `.tgz` 파일을 다운로드하여 설치:

```bash
# tgz 파일 다운로드 후
npm install ./superkiwi-sdk-2.0.0.tgz
```

### 방법 2: GitHub 직접 설치

```bash
# 최신 버전
npm install github:excatt/SuperKiwiSDK

# 특정 버전
npm install github:excatt/SuperKiwiSDK#v2.0.0
```

### 방법 3: 로컬 빌드

```bash
git clone https://github.com/excatt/SuperKiwiSDK.git
cd SuperKiwiSDK
npm install
npm run build
npm link  # 로컬 프로젝트에서 사용
```

### Peer Dependencies

MediaPipe 얼굴 랜드마크 감지를 위해 필요합니다:

```bash
npm install @mediapipe/tasks-vision
```

---

## Quick Start

### 1. 기본 설정

```typescript
import { SuperKiwiSDK } from 'superkiwi-sdk';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// MediaPipe 초기화
async function initMediaPipe() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  );

  return await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU'  // GPU 가속 (선택사항)
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
}

// SDK 초기화
const sdk = new SuperKiwiSDK({
  fps: 30,
  debug: false
});
```

### 2. 비디오 스트림 설정

```typescript
async function setupCamera(): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user',
      frameRate: { ideal: 30 }
    }
  });

  video.srcObject = stream;
  await video.play();

  return video;
}
```

### 3. 프레임 처리 루프

```typescript
let faceLandmarker: FaceLandmarker;
let video: HTMLVideoElement;

async function init() {
  faceLandmarker = await initMediaPipe();
  video = await setupCamera();

  // 프레임 루프 시작
  requestAnimationFrame(processFrame);
}

function processFrame() {
  const result = faceLandmarker.detectForVideo(video, performance.now());

  // 랜드마크 추출
  const landmarks = result.faceLandmarks[0]?.map(l => ({
    x: l.x,
    y: l.y,
    z: l.z
  })) || null;

  // 생체 신호 분석
  const result = sdk.processFrame(video, landmarks);

  // 결과 활용
  if (result.heartRate) {
    console.log(`Heart Rate: ${result.heartRate.bpm} BPM`);
  }
  console.log(`Focus Score: ${result.focusScore.toFixed(1)}`);

  // 다음 프레임
  requestAnimationFrame(processFrame);
}

init();
```

### 4. 전체 예제

```html
<!DOCTYPE html>
<html>
<head>
  <title>SuperKiwi SuperKiwi Demo</title>
</head>
<body>
  <video id="video" autoplay playsinline></video>
  <div id="stats">
    <p>Heart Rate: <span id="hr">--</span> BPM</p>
    <p>Focus Score: <span id="focus">--</span></p>
    <p>Blink Rate: <span id="blink">--</span>/min</p>
  </div>

  <script type="module">
    import { SuperKiwiSDK } from 'superkiwi-sdk';
    import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

    const sdk = new SuperKiwiSDK();

    // ... 위의 코드 적용
  </script>
</body>
</html>
```

---

## API Reference

### SuperKiwiSDK

메인 SDK 클래스입니다.

#### Constructor

```typescript
const sdk = new SuperKiwiSDK(options?: SuperKiwiSDKOptions);
```

#### SuperKiwiSDKOptions

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `fps` | number | 30 | 카메라 프레임 레이트 |
| `rppgBufferSize` | number | 300 | rPPG 분석 버퍼 크기 (프레임 수) |
| `minHeartRate` | number | 45 | 최소 심박수 (BPM) |
| `maxHeartRate` | number | 180 | 최대 심박수 (BPM) |
| `blinkThreshold` | number | 0.21 | 눈 깜빡임 EAR 임계값 |
| `debug` | boolean | false | 디버그 로그 출력 |
| `bufferPreservationTimeout` | number | 5000 | user_absent 시 버퍼 보존 시간 (ms) |

#### Methods

##### `processFrame(video, landmarks, timestamp?, poseLandmarks?): SuperKiwiResult`

비디오 프레임을 처리하고 생체 신호를 분석합니다.

```typescript
const result = sdk.processFrame(
  video: HTMLVideoElement,    // 비디오 엘리먼트
  landmarks: Point3D[] | null, // 468개 얼굴 랜드마크 또는 null
  timestamp?: number,          // 타임스탬프 (ms), 생략시 Date.now()
  poseLandmarks?: PoseLandmark[] | null  // 포즈 랜드마크 (optional)
);
```

##### `getAverageFocusScore(): number`

세션 시작부터 현재까지의 평균 집중도 점수를 반환합니다.

```typescript
const avgFocus = sdk.getAverageFocusScore(); // 0-100
```

##### `isHRVReady(): boolean`

HRV 분석을 위한 충분한 데이터가 수집되었는지 확인합니다.

```typescript
if (sdk.isHRVReady()) {
  console.log('HRV 데이터 준비 완료');
}
```

##### `reset(): void`

모든 내부 상태와 버퍼를 초기화합니다. 새 세션 시작 시 호출합니다.

```typescript
sdk.reset();
```

##### `SuperKiwiSDK.version: string`

SDK 버전을 반환합니다.

```typescript
console.log(SuperKiwiSDK.version); // "2.0.0"
```

---

### Result Types

#### SuperKiwiResult

모든 생체 신호 분석 결과를 담는 객체입니다.

```typescript
interface SuperKiwiResult {
  heartRate: HeartRateResult | null;  // 심박수 (버퍼 충분할 때)
  hrv: HRVResult | null;              // HRV (30개 이상 RR 간격 시)
  blink: BlinkResult;                 // 눈 깜빡임
  gaze: GazeResult;                   // 시선 추적
  headPose: HeadPoseResult | null;    // 머리 자세
  focusScore: FocusScoreResult;       // 집중도 점수
  timestamp: number;                  // 분석 시각
  poseStatus: PoseStatusResult | null; // 포즈 상태 (poseLandmarks 미제공 시 null)
}
```

#### HeartRateResult

```typescript
interface HeartRateResult {
  bpm: number | null;      // 심박수 (BPM), 측정 전 null
  signalQuality: number;   // 신호 품질 (0-1)
  rrInterval: number | null; // RR 간격 (ms)
  isReady: boolean;        // 측정 준비 상태
}
```

#### HRVResult

```typescript
interface HRVResult {
  sdnn: number;        // RR 간격 표준편차 (ms)
  rmssd: number;       // 연속 RR 간격 차이의 RMS (ms)
  pnn50: number;       // 50ms 이상 차이 비율 (%)
  stressIndex: number; // 스트레스 지수 (0-100, 높을수록 스트레스)
  timestamp: number;   // 측정 시각
}
```

**HRV 지표 해석:**

| 지표 | 정상 범위 | 의미 |
|------|----------|------|
| SDNN | 50-100ms | 전체 변동성, 높을수록 건강 |
| RMSSD | 20-50ms | 부교감신경 활성도 |
| pNN50 | 3-25% | 심박 변동 빈도 |
| Stress Index | 0-30 낮음, 30-60 보통, 60+ 높음 | 스트레스 수준 |

#### BlinkResult

```typescript
interface BlinkResult {
  ear: number;              // 현재 EAR (양쪽 평균)
  leftEar: number;          // 왼쪽 눈 EAR
  rightEar: number;         // 오른쪽 눈 EAR
  isBlinking: boolean;      // 현재 깜빡임 여부
  blinkCount: number;       // 누적 깜빡임 횟수
  blinkRate: number;        // 분당 깜빡임 횟수
  blinkStability: number;   // 깜빡임 패턴 안정성 (0-1)
}
```

**깜빡임 지표 해석:**

| 지표 | 정상 범위 | 의미 |
|------|----------|------|
| blinkRate | 15-20/분 | 정상 깜빡임 빈도 |
| blinkRate < 10 | 집중 상태 | 화면 집중 시 감소 |
| blinkRate > 25 | 피로/건조 | 눈 피로 징후 |

#### GazeResult

```typescript
interface GazeResult {
  direction: { x: number; y: number }; // 시선 방향 (-1 ~ 1)
  stability: number;                    // 시선 안정성 (0-1)
  isLookingAtScreen: boolean;          // 화면 응시 여부
}
```

#### HeadPoseResult

```typescript
interface HeadPoseResult {
  pitch: number;  // 상하 회전 (도), + 위, - 아래
  yaw: number;    // 좌우 회전 (도), + 오른쪽, - 왼쪽
  roll: number;   // 기울기 (도), + 시계방향
}
```

#### FocusScoreResult

```typescript
interface FocusScoreResult {
  score: number;           // 종합 점수 (0-100)
  faceDetected: boolean;   // 얼굴 감지 여부
  gazeStability: number;   // 시선 안정성 기여
  blinkStability: number;  // 깜빡임 안정성 기여
}
```

#### PoseLandmark

```typescript
interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;  // 가시성 (0-1)
  presence: number;     // 존재 확률 (0-1)
}
```

#### FaceOcclusionReason

```typescript
type FaceOcclusionReason =
  | 'none'              // 얼굴 정상 감지
  | 'head_turned'       // 고개 돌림
  | 'looking_down'      // 고개 숙임
  | 'looking_up'        // 고개 들림
  | 'leaning_back'      // 뒤로 기댐
  | 'leaning_forward'   // 앞으로 숙임
  | 'too_close'         // 너무 가까움
  | 'too_far'           // 너무 멀음
  | 'user_absent'       // 사용자 부재
  | 'unknown';          // 원인 불명
```

#### PoseStatusResult

```typescript
interface PoseStatusResult {
  poseDetected: boolean;          // 포즈 감지 여부
  occlusionReason: FaceOcclusionReason; // 얼굴 미감지 원인
  confidence: number;              // 감지 신뢰도 (0-1)
  shouldPreserveBuffers: boolean;  // 버퍼 보존 여부
}
```

---

## Configuration

### 최적 설정 가이드

#### 일반적인 사용

```typescript
const sdk = new SuperKiwiSDK({
  fps: 30,
  rppgBufferSize: 300,  // 10초 버퍼
  debug: false
});
```

#### 고정밀 심박수 측정

```typescript
const sdk = new SuperKiwiSDK({
  fps: 30,
  rppgBufferSize: 450,  // 15초 버퍼 (더 안정적)
  minHeartRate: 40,
  maxHeartRate: 200
});
```

#### 빠른 응답 (낮은 정확도)

```typescript
const sdk = new SuperKiwiSDK({
  fps: 30,
  rppgBufferSize: 150,  // 5초 버퍼
  blinkThreshold: 0.25  // 더 민감한 감지
});
```

---

## Examples

### React 통합

```tsx
import { useEffect, useRef, useState } from 'react';
import { SuperKiwiSDK, SuperKiwiResult } from 'superkiwi-sdk';

function SuperKiwiMonitor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sdkRef = useRef<SuperKiwiSDK>();
  const [data, setData] = useState<SuperKiwiResult | null>(null);

  useEffect(() => {
    sdkRef.current = new SuperKiwiSDK();

    // 초기화 로직...

    return () => {
      sdkRef.current?.reset();
    };
  }, []);

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline />
      {result && (
        <div>
          <p>Heart Rate: {result.heartRate?.bpm ?? '--'} BPM</p>
          <p>Focus: {result.focusScore.score.toFixed(0)}%</p>
        </div>
      )}
    </div>
  );
}
```

### Vue 통합

```vue
<template>
  <div>
    <video ref="video" autoplay playsinline />
    <div v-if="result">
      <p>Heart Rate: {{ result.heartRate?.bpm ?? '--' }} BPM</p>
      <p>Focus: {{ result.focusScore.score.toFixed(0) }}%</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { SuperKiwiSDK } from 'superkiwi-sdk';

const video = ref<HTMLVideoElement>();
const result = ref(null);
const sdk = new SuperKiwiSDK();

onMounted(() => {
  // 초기화 로직...
});

onUnmounted(() => {
  sdk.reset();
});
</script>
```

### 이벤트 기반 모니터링

```typescript
class SuperKiwiMonitor {
  private sdk: SuperKiwiSDK;
  private callbacks: Map<string, Function[]> = new Map();

  constructor() {
    this.sdk = new SuperKiwiSDK();
  }

  on(event: string, callback: Function) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
  }

  private emit(event: string, data: any) {
    this.callbacks.get(event)?.forEach(cb => cb(data));
  }

  processFrame(video: HTMLVideoElement, landmarks: any) {
    const result = this.sdk.processFrame(video, landmarks);

    // 이벤트 발생
    if (result.heartRate?.bpm) {
      this.emit('heartRate', result.heartRate.bpm);
    }

    if (result.blink.isBlinking) {
      this.emit('blink', result.blink);
    }

    if (result.focusScore.score < 50) {
      this.emit('focusLow', result.focusScore);
    }

    return result;
  }
}

// 사용
const monitor = new SuperKiwiMonitor();

monitor.on('heartRate', (bpm) => {
  console.log(`Heart Rate: ${bpm}`);
});

monitor.on('focusLow', (score) => {
  alert('집중도가 낮습니다!');
});
```

더 많은 예시는 [`examples/`](./examples) 디렉토리를 참조하세요.

---

## Technical Details

### rPPG (Remote Photoplethysmography) 알고리즘

카메라로 촬영한 얼굴 영상에서 미세한 피부색 변화를 감지하여 심박수를 측정합니다.

```
비디오 입력 → ROI 추출 → 색상 채널 분리 → 필터링 → FFT → 피크 검출 → BPM
```

**구현 세부사항:**

| 항목 | 값 | 설명 |
|------|-----|------|
| ROI | 이마 영역 | 랜드마크 10, 108, 337, 151 |
| 색상 채널 | Green | 혈류 변화에 가장 민감 |
| 필터 | Butterworth | 0.75-3.0 Hz 대역통과 |
| 분석 | FFT | 주파수 도메인 분석 |
| 범위 | 45-180 BPM | 유효 심박수 범위 |

### HRV (Heart Rate Variability) 분석

심박 간격(RR interval)의 변동을 분석하여 자율신경계 상태를 평가합니다.

**시간 도메인 지표:**

- **SDNN**: 전체 RR 간격의 표준편차
  ```
  SDNN = √(Σ(RRi - RRmean)² / (N-1))
  ```

- **RMSSD**: 연속 RR 간격 차이의 제곱평균제곱근
  ```
  RMSSD = √(Σ(RRi+1 - RRi)² / (N-1))
  ```

- **pNN50**: 50ms 이상 차이나는 연속 RR 간격의 비율
  ```
  pNN50 = (NN50 / N) × 100%
  ```

### 눈 깜빡임 감지 (EAR)

Eye Aspect Ratio 알고리즘으로 눈 깜빡임을 감지합니다.

```
EAR = (||p2-p6|| + ||p3-p5||) / (2 × ||p1-p4||)
```

- 열린 눈: EAR ≈ 0.25-0.35
- 닫힌 눈: EAR < 0.21

### 집중도 점수 계산

```
Focus Score = (얼굴감지 × 0.4) + (시선안정성 × 0.4) + (깜빡임안정성 × 0.2)
```

| 요소 | 가중치 | 설명 |
|------|--------|------|
| 얼굴 감지 | 40% | 얼굴이 프레임 내에 있는지 |
| 시선 안정성 | 40% | 시선이 화면에 고정되어 있는지 |
| 깜빡임 안정성 | 20% | 정상적인 깜빡임 패턴인지 |

---

## Troubleshooting

### 심박수가 측정되지 않음

1. **조명 확인**: 균일한 조명 필요, 역광 피하기
2. **거리 확인**: 카메라와 50-70cm 거리 유지
3. **움직임 최소화**: 측정 중 머리 움직임 자제
4. **버퍼 대기**: 최소 10초(300프레임) 대기 필요

```typescript
// 버퍼 상태 확인
const result = sdk.processFrame(video, landmarks);
if (!result.heartRate?.isReady) {
  console.log('심박수 측정 준비 중...');
}
```

### HRV 데이터가 null

HRV 분석에는 최소 30개의 RR 간격이 필요합니다 (약 30초).

```typescript
if (!sdk.isHRVReady()) {
  console.log('HRV 데이터 수집 중...');
}
```

### 얼굴 감지 실패

1. MediaPipe 초기화 확인
2. 카메라 권한 확인
3. 조명 상태 확인

```typescript
if (!landmarks) {
  console.log('얼굴을 찾을 수 없습니다');
}
```

```typescript
// Pose Landmarker로 원인 파악
if (result.poseStatus) {
  switch (result.poseStatus.occlusionReason) {
    case 'head_turned':
      console.log('고개를 돌리고 있습니다. 정면을 봐주세요.');
      break;
    case 'looking_down':
      console.log('고개를 숙이고 있습니다.');
      break;
    case 'user_absent':
      console.log('사용자가 자리를 비웠습니다.');
      break;
  }
}
```

### 성능 이슈

```typescript
// GPU 가속 활성화
const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    delegate: 'GPU'  // 'CPU' 대신 'GPU'
  },
  // ...
});
```

---

## Browser Support

| 브라우저 | 최소 버전 | WebGL | 카메라 |
|---------|----------|-------|--------|
| Chrome | 80+ | ✅ | ✅ |
| Firefox | 75+ | ✅ | ✅ |
| Safari | 14+ | ✅ | ✅ |
| Edge | 80+ | ✅ | ✅ |
| IE | ❌ | ❌ | ❌ |

**필수 요구사항:**
- HTTPS 또는 localhost (카메라 접근)
- WebGL 지원 (MediaPipe 실행)
- ES2020+ 지원

---

## Contributing

기여를 환영합니다! [CONTRIBUTING.md](./CONTRIBUTING.md)를 참조하세요.

### 개발 환경 설정

```bash
git clone https://github.com/excatt/SuperKiwiSDK.git
cd SuperKiwiSDK
npm install
npm run dev  # 개발 모드 (watch)
```

### 코드 스타일

```bash
npm run lint      # ESLint 검사
npm run typecheck # TypeScript 검사
```

---

## License

MIT License - 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.

---

## Changelog

### v2.0.0 (2026-02-20)

- ✨ **Pose Landmarker 통합**: 얼굴 미감지 원인 분석 (10가지)
- ✨ `PoseAnalyzer` 클래스 추가 (캘리브레이션 기반 자세/거리 판단)
- ✨ `processFrame`에 `poseLandmarks` 파라미터 추가 (후방 호환)
- ✨ `PoseStatusResult` 타입으로 얼굴 미감지 원인 및 신뢰도 제공
- ✨ 버퍼 aging: user_absent 5초 초과 시 stale 데이터 자동 정리
- ✨ `bufferPreservationTimeout` 옵션 추가

### v1.0.0 (2026-01-06)

- 🎉 최초 릴리즈
- ✨ rPPG 심박수 측정
- ✨ HRV 분석 (SDNN, RMSSD, pNN50)
- ✨ 눈 깜빡임 감지
- ✨ 시선 추적
- ✨ 머리 자세 추정
- ✨ 집중도 점수 계산

---

<div align="center">
  <p>Made with ❤️ by LEEBI</p>
  <p>
    <a href="https://github.com/excatt/SuperKiwiSDK/issues">Report Bug</a>
    ·
    <a href="https://github.com/excatt/SuperKiwiSDK/issues">Request Feature</a>
  </p>
</div>
