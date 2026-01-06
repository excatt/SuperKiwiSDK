# SuperKiwi SDK 개발 가이드

> 비접촉 생체 신호 분석을 위한 완벽한 개발 가이드

## 목차

1. [시작하기](#1-시작하기)
2. [설치 및 설정](#2-설치-및-설정)
3. [핵심 개념](#3-핵심-개념)
4. [API 레퍼런스](#4-api-레퍼런스)
5. [통합 가이드](#5-통합-가이드)
6. [고급 사용법](#6-고급-사용법)
7. [성능 최적화](#7-성능-최적화)
8. [트러블슈팅](#8-트러블슈팅)
9. [베스트 프랙티스](#9-베스트-프랙티스)

---

## 1. 시작하기

### 1.1 SDK 개요

SuperKiwi SDK는 웹캠 영상에서 얼굴을 인식하고, MediaPipe의 468개 랜드마크를 활용하여 다양한 생체 신호를 실시간으로 분석합니다.

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Video Input   │  →   │  MediaPipe Face  │  →   │  SuperKiwiSDK   │
│   (웹캠 프레임)   │      │   Landmarker     │      │   (분석 엔진)    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                                            │
                                                            ▼
                                                   ┌─────────────────┐
                                                   │ SuperKiwiResult │
                                                   │  - heartRate    │
                                                   │  - hrv          │
                                                   │  - blink        │
                                                   │  - gaze         │
                                                   │  - headPose     │
                                                   │  - focusScore   │
                                                   └─────────────────┘
```

### 1.2 주요 기능

| 기능 | 설명 | 정확도 목표 |
|------|------|------------|
| **심박수 (rPPG)** | 피부색 변화를 통한 비접촉 심박수 측정 | ±5 BPM |
| **HRV 분석** | 심박 변이도 분석으로 스트레스 지수 산출 | SDNN, RMSSD, pNN50 |
| **눈 깜빡임** | EAR(Eye Aspect Ratio) 기반 감지 | >95% 정확도 |
| **시선 추적** | 눈동자 위치 및 방향 벡터 추적 | ±5° 오차 |
| **머리 자세** | pitch, yaw, roll 3축 회전 추정 | ±3° 오차 |
| **집중도 점수** | 복합 지표 기반 집중 상태 판단 | 0-100 스케일 |

### 1.3 시스템 요구사항

```yaml
필수:
  - Node.js: >= 18.0.0
  - 브라우저: Chrome 80+, Firefox 75+, Safari 14+, Edge 80+
  - 웹캠: 최소 480p (권장 720p)

권장:
  - GPU 가속 지원 브라우저
  - 안정적인 조명 환경
  - 30fps 이상 프레임레이트
```

---

## 2. 설치 및 설정

### 2.1 npm 설치

```bash
npm install superkiwi-sdk
```

### 2.2 MediaPipe 의존성

SDK는 MediaPipe Face Landmarker를 peer dependency로 사용합니다.

```bash
npm install @mediapipe/tasks-vision
```

### 2.3 기본 설정

#### TypeScript/ES Modules

```typescript
import { SuperKiwiSDK, type SuperKiwiResult } from 'superkiwi-sdk';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// MediaPipe 초기화
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
);

const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    delegate: 'GPU'  // 또는 'CPU'
  },
  runningMode: 'VIDEO',
  numFaces: 1,
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: true
});

// SDK 초기화
const sdk = new SuperKiwiSDK({
  fps: 30,
  rppgBufferSize: 300
});
```

#### CommonJS

```javascript
const { SuperKiwiSDK } = require('superkiwi-sdk');
```

#### 브라우저 (CDN)

```html
<script type="importmap">
{
  "imports": {
    "@mediapipe/tasks-vision": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm"
  }
}
</script>

<script type="module">
  import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

  // SuperKiwiSDK 클래스를 인라인으로 포함하거나 번들된 파일 사용
</script>
```

---

## 3. 핵심 개념

### 3.1 데이터 흐름

```
프레임 수집 → 랜드마크 추출 → 신호 처리 → 분석 → 결과 반환
    │              │              │          │         │
    ▼              ▼              ▼          ▼         ▼
 30fps        468 points     필터링      FFT/통계   SuperKiwiResult
```

### 3.2 랜드마크 인덱스 맵

SDK에서 사용하는 주요 랜드마크 인덱스:

```javascript
const LANDMARKS = {
  // rPPG ROI (이마 영역)
  FOREHEAD: [10, 108, 337, 151],

  // 왼쪽 눈 (EAR 계산용)
  LEFT_EYE: [33, 160, 158, 133, 153, 144],

  // 오른쪽 눈 (EAR 계산용)
  RIGHT_EYE: [362, 385, 387, 263, 373, 380],

  // 홍채 (시선 추적용)
  LEFT_IRIS: [468, 469, 470, 471, 472],
  RIGHT_IRIS: [473, 474, 475, 476, 477],

  // 머리 자세 (6-point 모델)
  HEAD_POSE: {
    NOSE_TIP: 1,
    CHIN: 152,
    LEFT_EYE_CORNER: 33,
    RIGHT_EYE_CORNER: 263,
    LEFT_MOUTH: 61,
    RIGHT_MOUTH: 291
  }
};
```

### 3.3 신호 처리 파이프라인

#### rPPG (Remote Photoplethysmography)

```
Green Channel 추출 → 이동 평균 필터 → 대역 통과 필터 → 피크 검출 → BPM 계산
       │                  │                │              │           │
    이마 ROI          노이즈 제거       0.75-3Hz       R-R 간격    60000/avg
```

#### EAR (Eye Aspect Ratio)

```javascript
// EAR 공식
EAR = (||p2 - p6|| + ||p3 - p5||) / (2 × ||p1 - p4||)

// p1, p4: 눈의 양쪽 끝점 (수평)
// p2, p6: 위쪽 눈꺼풀 점
// p3, p5: 아래쪽 눈꺼풀 점

// 임계값
BLINK_THRESHOLD = 0.25  // EAR < 0.25면 눈 감음으로 판정
```

---

## 4. API 레퍼런스

### 4.1 SuperKiwiSDK 클래스

#### 생성자

```typescript
new SuperKiwiSDK(options?: SuperKiwiSDKOptions)
```

**SuperKiwiSDKOptions:**

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `fps` | number | 30 | 목표 프레임레이트 |
| `rppgBufferSize` | number | 300 | rPPG 신호 버퍼 크기 (프레임 수) |

```typescript
const sdk = new SuperKiwiSDK({
  fps: 30,           // 30fps
  rppgBufferSize: 300  // 10초 @ 30fps
});
```

#### 메서드

##### `process(video: HTMLVideoElement, landmarks: NormalizedLandmark[]): SuperKiwiResult`

비디오 프레임과 랜드마크를 분석하여 생체 신호를 반환합니다.

```typescript
const result = faceLandmarker.detectForVideo(video, timestamp);

if (result.faceLandmarks && result.faceLandmarks.length > 0) {
  const result = sdk.process(video, result.faceLandmarks[0]);
  console.log(result);
}
```

##### `reset(): void`

모든 내부 버퍼와 상태를 초기화합니다.

```typescript
sdk.reset();  // 측정 재시작 시 호출
```

### 4.2 SuperKiwiResult 인터페이스

```typescript
interface SuperKiwiResult {
  faceDetected: boolean;      // 얼굴 감지 여부
  timestamp: number;          // 타임스탬프 (ms)
  heartRate: HeartRateResult; // 심박수 데이터
  hrv: HRVResult | null;      // HRV 데이터 (수집 완료 시)
  blink: BlinkResult;         // 눈 깜빡임 데이터
  gaze: GazeResult;           // 시선 추적 데이터
  headPose: HeadPoseResult;   // 머리 자세 데이터
  focusScore: FocusScoreResult; // 집중도 점수
}
```

### 4.3 세부 결과 타입

#### HeartRateResult

```typescript
interface HeartRateResult {
  bpm: number | null;        // 심박수 (40-200 범위)
  signalQuality: number;     // 신호 품질 (0-1)
  rrInterval: number | null; // R-R 간격 (ms)
  isReady: boolean;          // 측정 준비 완료 여부
}
```

**사용 예시:**

```typescript
const { heartRate } = result;

if (heartRate.isReady && heartRate.bpm !== null) {
  console.log(`심박수: ${heartRate.bpm} BPM`);
  console.log(`신호 품질: ${(heartRate.signalQuality * 100).toFixed(0)}%`);

  if (heartRate.signalQuality < 0.5) {
    console.warn('신호 품질이 낮습니다. 조명을 확인해주세요.');
  }
}
```

#### HRVResult

```typescript
interface HRVResult {
  sdnn: number;        // 표준편차 (ms) - 전체 변동성
  rmssd: number;       // 연속 차이 제곱평균 (ms) - 부교감신경 활성도
  pnn50: number;       // 50ms 이상 차이 비율 (%) - 자율신경 균형
  stressIndex: number; // 스트레스 지수 (0-100)
  timestamp: number;   // 분석 시점
}
```

**해석 가이드:**

| 지표 | 낮음 | 보통 | 높음 | 의미 |
|------|------|------|------|------|
| SDNN | <30ms | 30-50ms | >50ms | 전체 자율신경 활성도 |
| RMSSD | <20ms | 20-40ms | >40ms | 부교감신경(휴식) 활성도 |
| pNN50 | <3% | 3-10% | >10% | 심박 변이 정도 |
| Stress | 0-30 | 30-60 | 60-100 | 스트레스 수준 |

```typescript
if (result.hrv) {
  const { stressIndex } = result.hrv;

  if (stressIndex > 70) {
    console.log('높은 스트레스 상태입니다. 휴식을 권장합니다.');
  } else if (stressIndex < 30) {
    console.log('안정적인 상태입니다.');
  }
}
```

#### BlinkResult

```typescript
interface BlinkResult {
  ear: number;           // 평균 EAR 값 (0-0.5)
  leftEar: number;       // 왼쪽 눈 EAR
  rightEar: number;      // 오른쪽 눈 EAR
  isBlinking: boolean;   // 현재 깜빡임 여부
  blinkCount: number;    // 누적 깜빡임 횟수
  blinkRate: number;     // 분당 깜빡임 횟수 (blinks/min)
}
```

**정상 범위:**

```typescript
// 정상 깜빡임 빈도: 15-20회/분
const { blinkRate } = result.blink;

if (blinkRate < 10) {
  console.warn('깜빡임이 적습니다. 눈의 피로를 유발할 수 있습니다.');
} else if (blinkRate > 25) {
  console.warn('깜빡임이 많습니다. 눈의 불편함이나 피로를 나타낼 수 있습니다.');
}
```

#### GazeResult

```typescript
interface GazeResult {
  center: Point2D;       // 시선 중심점 {x, y} (0-1 정규화)
  vector: {
    x: number;           // 수평 방향 (-1: 왼쪽, 1: 오른쪽)
    y: number;           // 수직 방향 (-1: 위, 1: 아래)
    distance: number;    // 시선 이동 거리
  };
  stability: number;     // 시선 안정성 (0-1)
}

interface Point2D {
  x: number;
  y: number;
}
```

**활용 예시:**

```typescript
const { gaze } = result;

// 시선이 화면 중앙에 있는지 확인
const isCentered =
  Math.abs(gaze.center.x - 0.5) < 0.2 &&
  Math.abs(gaze.center.y - 0.5) < 0.2;

// 시선 안정성으로 집중 여부 판단
if (gaze.stability > 0.7) {
  console.log('시선이 안정적입니다.');
}
```

#### HeadPoseResult

```typescript
interface HeadPoseResult {
  pitch: number;   // 상하 기울기 (도) - 양수: 위, 음수: 아래
  yaw: number;     // 좌우 회전 (도) - 양수: 오른쪽, 음수: 왼쪽
  roll: number;    // 좌우 기울기 (도) - 양수: 시계방향
}
```

**머리 자세 해석:**

```
        pitch (+)
           ↑
           │    yaw (+)
           │   ↗
    ───────┼───────→
          /│
         / │
    yaw (-)│
           ↓
        pitch (-)

roll: 시계방향(+), 반시계방향(-)
```

```typescript
const { headPose } = result;

// 정면을 바라보고 있는지 확인
const isFacingCamera =
  Math.abs(headPose.pitch) < 15 &&
  Math.abs(headPose.yaw) < 15 &&
  Math.abs(headPose.roll) < 10;

if (!isFacingCamera) {
  console.log('카메라를 정면으로 바라봐주세요.');
}
```

#### FocusScoreResult

```typescript
interface FocusScoreResult {
  score: number;       // 종합 집중도 점수 (0-100)
  faceScore: number;   // 얼굴 감지 점수 (0-100)
  gazeScore: number;   // 시선 안정성 점수 (0-100)
  blinkScore: number;  // 깜빡임 패턴 점수 (0-100)
  state: 'focused' | 'distracted' | 'away';  // 집중 상태
}
```

**상태 판정 기준:**

| 상태 | 점수 범위 | 의미 |
|------|----------|------|
| `focused` | 70-100 | 집중하고 있음 |
| `distracted` | 40-69 | 주의가 분산됨 |
| `away` | 0-39 | 자리 비움 또는 화면에서 벗어남 |

---

## 5. 통합 가이드

### 5.1 React 통합

```tsx
// hooks/useSuperKiwi.ts
import { useRef, useState, useCallback, useEffect } from 'react';
import { SuperKiwiSDK, type SuperKiwiResult } from 'superkiwi-sdk';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

interface UseSuperKiwiOptions {
  fps?: number;
  onResult?: (result: SuperKiwiResult) => void;
}

export function useSuperKiwi(options: UseSuperKiwiOptions = {}) {
  const { fps = 30, onResult } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const sdkRef = useRef<SuperKiwiSDK | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationRef = useRef<number>();

  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SuperKiwiResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // 초기화
  const initialize = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1
      });

      sdkRef.current = new SuperKiwiSDK({ fps });

      // 카메라 설정
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsReady(true);
    } catch (err) {
      setError(err as Error);
    }
  }, [fps]);

  // 프레임 처리
  const processFrame = useCallback(() => {
    if (!isRunning || !videoRef.current || !landmarkerRef.current || !sdkRef.current) {
      return;
    }

    const detection = landmarkerRef.current.detectForVideo(
      videoRef.current,
      performance.now()
    );

    if (detection.faceLandmarks?.[0]) {
      const result = sdkRef.current.process(
        videoRef.current,
        detection.faceLandmarks[0]
      );

      setResult(result);
      onResult?.(result);
    }

    animationRef.current = requestAnimationFrame(processFrame);
  }, [isRunning, onResult]);

  // 시작/정지
  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    sdkRef.current?.reset();
    setResult(null);
  }, []);

  // 효과
  useEffect(() => {
    if (isRunning) {
      processFrame();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, processFrame]);

  return {
    videoRef,
    isReady,
    isRunning,
    result,
    error,
    initialize,
    start,
    stop,
    reset
  };
}
```

```tsx
// components/SuperKiwiMonitor.tsx
import { useEffect } from 'react';
import { useSuperKiwi } from '../hooks/useSuperKiwi';

export function SuperKiwiMonitor() {
  const {
    videoRef,
    isReady,
    isRunning,
    result,
    initialize,
    start,
    stop
  } = useSuperKiwi({
    fps: 30,
    onResult: (r) => console.log('SuperKiwi:', r)
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div>
      <video ref={videoRef} style={{ width: 320, height: 240 }} />

      <div>
        <button onClick={start} disabled={!isReady || isRunning}>
          시작
        </button>
        <button onClick={stop} disabled={!isRunning}>
          정지
        </button>
      </div>

      {result && (
        <div>
          <p>심박수: {result.heartRate.bpm ?? '--'} BPM</p>
          <p>집중도: {result.focusScore.score}</p>
          <p>상태: {result.focusScore.state}</p>
        </div>
      )}
    </div>
  );
}
```

### 5.2 Vue 3 통합

```vue
<!-- composables/useSuperKiwi.ts -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { SuperKiwiSDK, type SuperKiwiResult } from 'superkiwi-sdk';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const videoEl = ref<HTMLVideoElement>();
const result = ref<SuperKiwiResult | null>(null);
const isRunning = ref(false);

let sdk: SuperKiwiSDK;
let landmarker: FaceLandmarker;
let animationId: number;

async function initialize() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );

  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numFaces: 1
  });

  sdk = new SuperKiwiSDK({ fps: 30 });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 }
  });

  if (videoEl.value) {
    videoEl.value.srcObject = stream;
    await videoEl.value.play();
  }
}

function processFrame() {
  if (!isRunning.value || !videoEl.value) return;

  const detection = landmarker.detectForVideo(videoEl.value, performance.now());

  if (detection.faceLandmarks?.[0]) {
    result.value = sdk.process(videoEl.value, detection.faceLandmarks[0]);
  }

  animationId = requestAnimationFrame(processFrame);
}

function start() {
  isRunning.value = true;
  processFrame();
}

function stop() {
  isRunning.value = false;
  cancelAnimationFrame(animationId);
}

onMounted(initialize);
onUnmounted(stop);
</script>

<template>
  <div>
    <video ref="videoEl" />
    <button @click="start">시작</button>
    <button @click="stop">정지</button>

    <div v-if="result">
      <p>심박수: {{ result.heartRate.bpm ?? '--' }} BPM</p>
      <p>집중도: {{ result.focusScore.score }}</p>
    </div>
  </div>
</template>
```

### 5.3 Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <title>SuperKiwi Monitor</title>
</head>
<body>
  <video id="video" autoplay playsinline></video>
  <div id="results"></div>
  <button id="startBtn">시작</button>

  <script type="module">
    import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
    import { SuperKiwiSDK } from 'superkiwi-sdk';

    class SuperKiwiApp {
      constructor() {
        this.video = document.getElementById('video');
        this.resultsDiv = document.getElementById('results');
        this.isRunning = false;
      }

      async init() {
        // MediaPipe 초기화
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        this.landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1
        });

        // SDK 초기화
        this.sdk = new SuperKiwiSDK({ fps: 30, rppgBufferSize: 300 });

        // 카메라 설정
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }
        });
        this.video.srcObject = stream;
        await this.video.play();

        // 이벤트 리스너
        document.getElementById('startBtn').onclick = () => this.toggle();
      }

      toggle() {
        this.isRunning = !this.isRunning;
        if (this.isRunning) this.processFrame();
      }

      processFrame() {
        if (!this.isRunning) return;

        const detection = this.landmarker.detectForVideo(
          this.video,
          performance.now()
        );

        if (detection.faceLandmarks?.[0]) {
          const result = this.sdk.process(this.video, detection.faceLandmarks[0]);
          this.updateUI(result);
        }

        requestAnimationFrame(() => this.processFrame());
      }

      updateUI(result) {
        this.resultsDiv.innerHTML = `
          <p>심박수: ${result.heartRate.bpm ?? '--'} BPM</p>
          <p>집중도: ${result.focusScore.score}</p>
          <p>상태: ${result.focusScore.state}</p>
        `;
      }
    }

    const app = new SuperKiwiApp();
    app.init();
  </script>
</body>
</html>
```

---

## 6. 고급 사용법

### 6.1 Picture-in-Picture (백그라운드 동작)

브라우저 탭이 백그라운드로 전환되면 `requestAnimationFrame`이 중지됩니다. PiP를 사용하면 이 문제를 해결할 수 있습니다.

```javascript
class SuperKiwiAppWithPiP {
  async enablePiP() {
    try {
      await this.video.requestPictureInPicture();
      console.log('PiP 활성화됨 - 백그라운드에서도 분석 계속');
    } catch (error) {
      console.error('PiP 실패:', error);
    }
  }

  async disablePiP() {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }
  }

  setupPiPListeners() {
    this.video.addEventListener('enterpictureinpicture', () => {
      console.log('PiP 모드 진입');
    });

    this.video.addEventListener('leavepictureinpicture', () => {
      console.log('PiP 모드 종료');
    });
  }
}
```

### 6.2 데이터 스트리밍

실시간 데이터를 서버로 전송하는 예시:

```javascript
class SuperKiwiStreamer {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.buffer = [];
    this.flushInterval = 1000; // 1초마다 전송
  }

  start() {
    setInterval(() => this.flush(), this.flushInterval);
  }

  addResult(result) {
    // 필요한 데이터만 추출
    this.buffer.push({
      timestamp: result.timestamp,
      heartRate: result.heartRate.bpm,
      focusScore: result.focusScore.score,
      focusState: result.focusScore.state
    });
  }

  flush() {
    if (this.buffer.length === 0) return;

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'result',
        data: this.buffer
      }));
      this.buffer = [];
    }
  }
}

// 사용
const streamer = new SuperKiwiStreamer('wss://your-server.com/result');
streamer.start();

// processFrame 내에서
const result = sdk.process(video, landmarks);
streamer.addResult(result);
```

### 6.3 커스텀 집중도 알고리즘

기본 집중도 점수를 커스터마이징:

```javascript
function calculateCustomFocusScore(result) {
  const weights = {
    face: 0.3,      // 얼굴 감지 가중치
    gaze: 0.4,      // 시선 안정성 가중치
    blink: 0.2,     // 깜빡임 패턴 가중치
    headPose: 0.1   // 머리 자세 가중치
  };

  // 얼굴 감지 점수
  const faceScore = result.faceDetected ? 100 : 0;

  // 시선 안정성 점수
  const gazeScore = result.gaze.stability * 100;

  // 깜빡임 점수 (정상 범위: 15-20/분)
  const blinkRate = result.blink.blinkRate;
  let blinkScore = 100;
  if (blinkRate < 10 || blinkRate > 30) {
    blinkScore = 50;
  } else if (blinkRate < 15 || blinkRate > 20) {
    blinkScore = 75;
  }

  // 머리 자세 점수 (정면 기준)
  const { pitch, yaw, roll } = result.headPose;
  const poseDeviation = Math.sqrt(pitch ** 2 + yaw ** 2 + roll ** 2);
  const headPoseScore = Math.max(0, 100 - poseDeviation * 2);

  // 가중 합계
  const totalScore =
    weights.face * faceScore +
    weights.gaze * gazeScore +
    weights.blink * blinkScore +
    weights.headPose * headPoseScore;

  return {
    score: Math.round(totalScore),
    components: { faceScore, gazeScore, blinkScore, headPoseScore }
  };
}
```

### 6.4 데이터 기록 및 분석

세션 데이터를 기록하고 분석:

```javascript
class SuperKiwiRecorder {
  constructor() {
    this.records = [];
    this.startTime = null;
  }

  startSession() {
    this.records = [];
    this.startTime = Date.now();
  }

  record(result) {
    this.records.push({
      elapsed: Date.now() - this.startTime,
      ...result
    });
  }

  getSessionStats() {
    if (this.records.length === 0) return null;

    const heartRates = this.records
      .map(r => r.heartRate.bpm)
      .filter(bpm => bpm !== null);

    const focusScores = this.records.map(r => r.focusScore.score);

    const focusStates = this.records.map(r => r.focusScore.state);
    const focusedTime = focusStates.filter(s => s === 'focused').length;
    const totalTime = focusStates.length;

    return {
      duration: Date.now() - this.startTime,
      heartRate: {
        avg: average(heartRates),
        min: Math.min(...heartRates),
        max: Math.max(...heartRates)
      },
      focusScore: {
        avg: average(focusScores),
        min: Math.min(...focusScores),
        max: Math.max(...focusScores)
      },
      focusRatio: focusedTime / totalTime,
      totalBlinks: this.records[this.records.length - 1]?.blink.blinkCount ?? 0
    };
  }

  exportCSV() {
    const headers = ['elapsed', 'bpm', 'focusScore', 'focusState', 'blinkCount'];
    const rows = this.records.map(r => [
      r.elapsed,
      r.heartRate.bpm ?? '',
      r.focusScore.score,
      r.focusScore.state,
      r.blink.blinkCount
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
```

---

## 7. 성능 최적화

### 7.1 프레임레이트 조절

```javascript
// 적응형 프레임레이트
class AdaptiveFPS {
  constructor(targetFps = 30) {
    this.targetFps = targetFps;
    this.frameInterval = 1000 / targetFps;
    this.lastFrameTime = 0;
  }

  shouldProcessFrame(timestamp) {
    const elapsed = timestamp - this.lastFrameTime;

    if (elapsed >= this.frameInterval) {
      this.lastFrameTime = timestamp;
      return true;
    }
    return false;
  }

  // CPU 사용량에 따라 FPS 조절
  adjustFPS(cpuUsage) {
    if (cpuUsage > 80) {
      this.targetFps = Math.max(15, this.targetFps - 5);
    } else if (cpuUsage < 50 && this.targetFps < 30) {
      this.targetFps = Math.min(30, this.targetFps + 5);
    }
    this.frameInterval = 1000 / this.targetFps;
  }
}
```

### 7.2 메모리 관리

```javascript
// 정기적인 가비지 컬렉션 유도
class MemoryManager {
  constructor(maxRecords = 1000) {
    this.maxRecords = maxRecords;
  }

  trimRecords(records) {
    if (records.length > this.maxRecords) {
      return records.slice(-this.maxRecords);
    }
    return records;
  }

  // 사용하지 않는 리소스 정리
  cleanup(sdk) {
    sdk.reset();

    // ImageData 캐시 정리
    if (this.imageDataCache) {
      this.imageDataCache = null;
    }
  }
}
```

### 7.3 GPU 가속 활용

```javascript
// MediaPipe GPU 가속 설정
const landmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: '...',
    delegate: 'GPU'  // GPU 가속 활성화
  },
  runningMode: 'VIDEO',
  numFaces: 1
});

// GPU 사용 불가 시 CPU 폴백
async function createLandmarker(vision) {
  try {
    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1
    });
  } catch (gpuError) {
    console.warn('GPU 가속 불가, CPU 모드로 전환:', gpuError);
    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1
    });
  }
}
```

### 7.4 네트워크 최적화

```javascript
// 모델 프리로딩
async function preloadModels() {
  const modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  // Service Worker 캐싱
  if ('caches' in window) {
    const cache = await caches.open('mediapipe-models-v1');
    await cache.add(modelUrl);
  }
}

// 지연 로딩
let landmarkerPromise = null;

function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = initializeLandmarker();
  }
  return landmarkerPromise;
}
```

---

## 8. 트러블슈팅

### 8.1 일반적인 문제

#### 카메라 접근 거부

```javascript
async function requestCameraPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    return { success: true, stream };
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      return {
        success: false,
        error: '카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.'
      };
    } else if (error.name === 'NotFoundError') {
      return {
        success: false,
        error: '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.'
      };
    }
    return { success: false, error: error.message };
  }
}
```

#### 심박수가 측정되지 않음

```javascript
function diagnoseHeartRateIssue(result) {
  const { heartRate } = result;

  if (!result.faceDetected) {
    return '얼굴이 감지되지 않습니다. 카메라를 정면으로 바라봐주세요.';
  }

  if (heartRate.signalQuality < 0.3) {
    return '신호 품질이 낮습니다. 조명을 밝게 하고, 얼굴이 화면에 크게 나오도록 해주세요.';
  }

  if (!heartRate.isReady) {
    return '데이터 수집 중입니다. 10초 정도 기다려주세요.';
  }

  if (heartRate.bpm === null) {
    return '측정 중 오류가 발생했습니다. 움직임을 최소화해주세요.';
  }

  return null;
}
```

#### 낮은 FPS

```javascript
function diagnoseLowFPS(currentFps, targetFps) {
  if (currentFps < targetFps * 0.5) {
    const suggestions = [
      '브라우저 하드웨어 가속을 활성화하세요',
      '다른 탭이나 프로그램을 닫아주세요',
      '카메라 해상도를 낮춰보세요 (640x480 권장)',
      'GPU 드라이버를 업데이트해보세요'
    ];
    return suggestions;
  }
  return [];
}
```

### 8.2 브라우저별 이슈

| 브라우저 | 알려진 이슈 | 해결 방법 |
|----------|------------|-----------|
| Safari | PiP API 제한 | `webkitSetPresentationMode` 사용 |
| Firefox | WebGL 성능 | `dom.webgpu.enabled` 플래그 활성화 |
| Edge | MediaPipe WASM | `chrome://flags`에서 WebAssembly 최적화 |
| Mobile Chrome | 메모리 제한 | 해상도 480p로 제한, 버퍼 크기 축소 |

### 8.3 디버깅 모드

```javascript
class SuperKiwiDebugger {
  constructor(sdk) {
    this.sdk = sdk;
    this.logs = [];
  }

  enable() {
    // 성능 측정
    this.startTime = performance.now();
    this.frameCount = 0;

    // 원본 process 메서드 래핑
    const originalProcess = this.sdk.process.bind(this.sdk);

    this.sdk.process = (video, landmarks) => {
      const frameStart = performance.now();
      const result = originalProcess(video, landmarks);
      const frameTime = performance.now() - frameStart;

      this.frameCount++;
      this.logs.push({
        frame: this.frameCount,
        processTime: frameTime,
        result: JSON.parse(JSON.stringify(result))
      });

      // 콘솔에 주기적 출력
      if (this.frameCount % 30 === 0) {
        console.log(`Frame ${this.frameCount}: ${frameTime.toFixed(2)}ms`);
      }

      return result;
    };
  }

  getStats() {
    const processTimes = this.logs.map(l => l.processTime);
    return {
      totalFrames: this.frameCount,
      avgProcessTime: average(processTimes),
      maxProcessTime: Math.max(...processTimes),
      minProcessTime: Math.min(...processTimes),
      fps: this.frameCount / ((performance.now() - this.startTime) / 1000)
    };
  }

  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
}
```

---

## 9. 베스트 프랙티스

### 9.1 환경 설정 체크리스트

```markdown
## 개발 환경
- [ ] Node.js 18+ 설치
- [ ] TypeScript 설정 (권장)
- [ ] ESLint + Prettier 설정

## 테스트 환경
- [ ] 웹캠 연결 및 정상 동작 확인
- [ ] 충분한 조명 (200+ lux)
- [ ] HTTPS 환경 (로컬 개발 시 localhost 예외)

## 프로덕션 환경
- [ ] CDN 모델 파일 캐싱
- [ ] 에러 모니터링 (Sentry 등)
- [ ] 사용자 권한 안내 UI
```

### 9.2 코드 품질

```typescript
// 타입 안전성
import type { SuperKiwiResult, HeartRateResult } from 'superkiwi-sdk';

function processHeartRate(hr: HeartRateResult): string {
  if (!hr.isReady) return '측정 준비 중...';
  if (hr.bpm === null) return '측정 실패';
  return `${hr.bpm} BPM`;
}

// 에러 핸들링
async function safeProcess(sdk: SuperKiwiSDK, video: HTMLVideoElement, landmarks: any[]) {
  try {
    return sdk.process(video, landmarks);
  } catch (error) {
    console.error('처리 오류:', error);
    return null;
  }
}

// 리소스 정리
function cleanup(stream: MediaStream, sdk: SuperKiwiSDK) {
  // 카메라 스트림 정리
  stream.getTracks().forEach(track => track.stop());

  // SDK 리셋
  sdk.reset();
}
```

### 9.3 사용자 경험

```javascript
// 진행 상태 표시
function showProgress(result) {
  const progress = calculateProgress(result);

  return {
    percentage: progress,
    message: getProgressMessage(progress),
    isReady: progress >= 100
  };
}

function calculateProgress(result) {
  let progress = 0;

  // 얼굴 감지 (30%)
  if (result.faceDetected) progress += 30;

  // 신호 품질 (40%)
  progress += result.heartRate.signalQuality * 40;

  // 측정 준비 (30%)
  if (result.heartRate.isReady) progress += 30;

  return Math.min(100, Math.round(progress));
}

function getProgressMessage(progress) {
  if (progress < 30) return '얼굴을 카메라에 맞춰주세요';
  if (progress < 70) return '신호 수집 중...';
  if (progress < 100) return '거의 완료되었습니다';
  return '측정 준비 완료!';
}
```

### 9.4 접근성

```javascript
// 스크린 리더 지원
function announceResult(result) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';

  if (result.heartRate.bpm) {
    announcement.textContent = `현재 심박수 ${result.heartRate.bpm} BPM`;
  }

  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

// 키보드 네비게이션
function setupKeyboardControls(app) {
  document.addEventListener('keydown', (e) => {
    switch(e.key) {
      case ' ':  // 스페이스바
        e.preventDefault();
        app.toggleRunning();
        break;
      case 'r':  // R키
        app.reset();
        break;
      case 'p':  // P키
        app.togglePiP();
        break;
    }
  });
}
```

---

## 부록

### A. 용어 사전

| 용어 | 설명 |
|------|------|
| **rPPG** | Remote Photoplethysmography. 원격 광용적맥파. 카메라로 피부색 변화를 감지하여 심박수를 측정하는 기술 |
| **HRV** | Heart Rate Variability. 심박 변이도. R-R 간격의 변화를 분석하여 자율신경계 상태를 파악 |
| **EAR** | Eye Aspect Ratio. 눈 가로세로 비율. 눈 깜빡임 감지에 사용되는 지표 |
| **ROI** | Region of Interest. 관심 영역. rPPG 측정 시 이마 부분을 지정 |
| **Landmark** | 얼굴의 특정 지점. MediaPipe는 468개의 3D 랜드마크 제공 |

### B. 참고 자료

- [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
- [rPPG 논문: Remote Heart Rate Measurement](https://arxiv.org/abs/2007.07430)
- [EAR 논문: Real-Time Eye Blink Detection](http://vision.fe.uni-lj.si/cvww2016/proceedings/papers/05.pdf)

### C. 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2026-01-06
**문의**: [GitHub Issues](https://github.com/excatt/SuperKiwiSDK/issues)
