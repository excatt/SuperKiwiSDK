# SuperKiwi SDK - Architecture

이 문서는 SuperKiwi SDK의 내부 아키텍처와 설계 결정을 설명합니다.

## 시스템 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                        SuperKiwiSDK                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ RPPGAnalyzer │  │ BlinkAnalyzer│  │ GazeTracker  │           │
│  │              │  │              │  │              │           │
│  │ - 심박수 측정 │  │ - EAR 계산   │  │ - 시선 방향  │           │
│  │ - 신호 필터링 │  │ - 깜빡임 감지│  │ - 안정성 측정│           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐           │
│  │ HRVAnalyzer  │  │ HeadPose     │  │ FocusScore   │           │
│  │              │  │ Estimator    │  │ Calculator   │           │
│  │ - SDNN/RMSSD │  │              │  │              │           │
│  │ - 스트레스   │  │ - Pitch/Yaw  │  │ - 가중치 계산│           │
│  └──────────────┘  │ - Roll       │  │ - 종합 점수  │           │
│                    └──────────────┘  └──────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ SuperKiwiResult │
                    └─────────────────┘
```

## 모듈 구조

### 1. SuperKiwiSDK (메인 클래스)

SDK의 진입점으로, 모든 분석 모듈을 조율합니다.

```typescript
class SuperKiwiSDK {
  private rppgAnalyzer: RPPGAnalyzer;
  private hrvAnalyzer: HRVAnalyzer;
  private blinkAnalyzer: BlinkAnalyzer;
  private gazeTracker: GazeTracker;
  private headPoseEstimator: HeadPoseEstimator;
  private focusScoreCalculator: FocusScoreCalculator;

  processFrame(video, landmarks, timestamp): SuperKiwiResult;
}
```

**책임:**
- 분석 모듈 초기화 및 관리
- 프레임 단위 분석 조율
- 결과 집계 및 반환

### 2. RPPGAnalyzer

원격 광용적맥파(rPPG)를 통한 심박수 측정을 담당합니다.

```typescript
class RPPGAnalyzer {
  private signalBuffer: number[];
  private timestamps: number[];

  extractROI(video, landmarks): ImageData;
  processSignal(greenChannel: number): void;
  analyzeHeartRate(): HeartRateResult;
}
```

**알고리즘 흐름:**

```
Video Frame
    │
    ▼
┌─────────────────┐
│ ROI 추출        │ ← 이마 영역 (랜드마크 10, 108, 337, 151)
│ (Forehead)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Green Channel   │ ← 혈류 변화에 가장 민감
│ 평균값 추출     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Signal Buffer   │ ← 300 프레임 (10초 @ 30fps)
│ 누적            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Butterworth     │ ← 0.75-3.0 Hz 대역통과
│ Bandpass Filter │   (45-180 BPM 범위)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ FFT 분석        │ ← 주파수 도메인 변환
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Peak Detection  │ ← 최대 피크 주파수 검출
│                 │
└────────┬────────┘
         │
         ▼
    BPM 계산
```

### 3. HRVAnalyzer

심박 변이도(HRV) 분석을 담당합니다.

```typescript
class HRVAnalyzer {
  private rrIntervals: number[];

  addRRInterval(interval: number): void;
  calculateSDNN(): number;
  calculateRMSSD(): number;
  calculatePNN50(): number;
  calculateStressIndex(): number;
}
```

**지표 계산:**

| 지표 | 수식 | 의미 |
|------|------|------|
| SDNN | `√(Σ(RRi - mean)² / (N-1))` | 전체 변동성 |
| RMSSD | `√(Σ(RRi+1 - RRi)² / (N-1))` | 단기 변동성 |
| pNN50 | `(NN50 / N) × 100` | 50ms 이상 변화 비율 |
| Stress | `100 - min(RMSSD, 100)` | 스트레스 수준 |

### 4. BlinkAnalyzer

눈 깜빡임 감지를 담당합니다.

```typescript
class BlinkAnalyzer {
  private earHistory: number[];
  private blinkTimestamps: number[];

  calculateEAR(landmarks): { left: number; right: number };
  detectBlink(ear: number): boolean;
  getBlinkRate(): number;
}
```

**EAR (Eye Aspect Ratio) 계산:**

```
      P2    P3
       \  /
    P1  \/  P4
       /\
      P6  P5

EAR = (||P2-P6|| + ||P3-P5||) / (2 × ||P1-P4||)
```

**랜드마크 인덱스:**

| 눈 | P1 | P2 | P3 | P4 | P5 | P6 |
|----|----|----|----|----|----|----|
| 왼쪽 | 33 | 160 | 158 | 133 | 153 | 144 |
| 오른쪽 | 362 | 385 | 387 | 263 | 373 | 380 |

### 5. GazeTracker

시선 추적을 담당합니다.

```typescript
class GazeTracker {
  private gazeHistory: Point2D[];

  calculateGazeDirection(landmarks): Point2D;
  calculateStability(): number;
  isLookingAtScreen(): boolean;
}
```

**시선 방향 계산:**

```
홍채 위치 = (왼쪽 홍채 + 오른쪽 홍채) / 2
눈 중심 = (왼쪽 눈 중심 + 오른쪽 눈 중심) / 2
시선 방향 = 홍채 위치 - 눈 중심 (정규화)
```

### 6. HeadPoseEstimator

머리 자세 추정을 담당합니다.

```typescript
class HeadPoseEstimator {
  estimatePose(landmarks): HeadPoseResult;
}
```

**주요 랜드마크:**

| 부위 | 인덱스 | 용도 |
|------|--------|------|
| 코끝 | 1 | 중심점 |
| 턱 | 152 | 수직 기준 |
| 왼쪽 눈 끝 | 33 | 수평 기준 |
| 오른쪽 눈 끝 | 263 | 수평 기준 |
| 이마 | 10 | 상단 기준 |

### 7. FocusScoreCalculator

집중도 점수를 계산합니다.

```typescript
class FocusScoreCalculator {
  private scoreHistory: number[];

  calculateScore(
    faceDetected: boolean,
    gazeStability: number,
    blinkStability: number
  ): FocusScoreResult;
}
```

**가중치:**

```
Focus Score = (얼굴감지 × 0.4) + (시선안정성 × 0.4) + (깜빡임안정성 × 0.2)
```

## 데이터 흐름

### 프레임 처리 흐름

```
┌──────────────────────────────────────────────────────────────────┐
│                         processFrame()                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Input: video, landmarks, timestamp                               │
│                                                                   │
│  ┌─────────────┐                                                  │
│  │ landmarks   │──────┬──────┬──────┬──────┐                     │
│  │ null check  │      │      │      │      │                     │
│  └─────────────┘      │      │      │      │                     │
│                       ▼      ▼      ▼      ▼                     │
│                   ┌──────┐┌──────┐┌──────┐┌──────┐               │
│                   │Blink ││ Gaze ││ Head ││Focus │               │
│                   │Analyz││Track ││ Pose ││Score │               │
│                   └──┬───┘└──┬───┘└──┬───┘└──┬───┘               │
│                      │       │       │       │                    │
│  ┌─────────────┐     │       │       │       │                    │
│  │ video       │     │       │       │       │                    │
│  │ + landmarks │─────┼───────┼───────┼───────┤                    │
│  └─────────────┘     │       │       │       │                    │
│        │             │       │       │       │                    │
│        ▼             │       │       │       │                    │
│  ┌───────────┐       │       │       │       │                    │
│  │   rPPG    │       │       │       │       │                    │
│  │  Analyzer │       │       │       │       │                    │
│  └─────┬─────┘       │       │       │       │                    │
│        │             │       │       │       │                    │
│        ▼             │       │       │       │                    │
│  ┌───────────┐       │       │       │       │                    │
│  │    HRV    │       │       │       │       │                    │
│  │  Analyzer │       │       │       │       │                    │
│  └─────┬─────┘       │       │       │       │                    │
│        │             │       │       │       │                    │
│        └─────────────┴───────┴───────┴───────┘                    │
│                              │                                    │
│                              ▼                                    │
│                    ┌─────────────────┐                            │
│                    │ SuperKiwiResult │                            │
│                    └─────────────────┘                            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## 신호 처리

### Butterworth 필터

rPPG 신호 처리에 사용되는 2차 Butterworth 대역통과 필터입니다.

```typescript
// 필터 파라미터
const lowCutoff = 0.75;   // Hz (45 BPM)
const highCutoff = 3.0;   // Hz (180 BPM)
const sampleRate = 30;    // fps
const order = 2;          // 2차 필터

// 전달 함수
H(s) = 1 / (1 + (s/ωc)^2n)
```

### FFT 분석

필터링된 신호에서 심박수를 추출합니다.

```typescript
// FFT 파라미터
const windowSize = 256;   // 2^8 (FFT 효율)
const overlapRatio = 0.5; // 50% 오버랩

// 주파수 해상도
Δf = sampleRate / windowSize = 30 / 256 ≈ 0.117 Hz
```

## 메모리 관리

### 버퍼 크기

| 버퍼 | 크기 | 메모리 | 용도 |
|------|------|--------|------|
| rPPG Signal | 300 | ~2.4 KB | 심박수 분석 |
| RR Intervals | 100 | ~0.8 KB | HRV 분석 |
| EAR History | 30 | ~0.24 KB | 깜빡임 패턴 |
| Gaze History | 30 | ~0.48 KB | 시선 안정성 |
| Focus History | 100 | ~0.8 KB | 평균 점수 |

### 순환 버퍼

메모리 효율을 위해 순환 버퍼를 사용합니다.

```typescript
class CircularBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private size: number = 0;

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.buffer.length;
    this.size = Math.min(this.size + 1, this.buffer.length);
  }
}
```

## 성능 최적화

### 1. Canvas 재사용

ROI 추출 시 Canvas를 재사용하여 메모리 할당을 최소화합니다.

```typescript
private canvas: HTMLCanvasElement;
private ctx: CanvasRenderingContext2D;

// 한 번만 생성
constructor() {
  this.canvas = document.createElement('canvas');
  this.ctx = this.canvas.getContext('2d')!;
}
```

### 2. 조건부 분석

얼굴이 감지되지 않으면 무거운 연산을 건너뜁니다.

```typescript
processFrame(video, landmarks) {
  if (!landmarks) {
    return this.getDefaultResult();
  }
  // 분석 진행...
}
```

### 3. 임계값 기반 업데이트

HRV는 새 RR 간격이 추가될 때만 재계산합니다.

```typescript
if (newRRInterval && this.rrIntervals.length >= 30) {
  this.hrvResult = this.calculateHRV();
}
```

## 에러 처리

### 입력 검증

```typescript
processFrame(video, landmarks, timestamp) {
  // 비디오 검증
  if (!video || video.readyState < 2) {
    throw new Error('Video not ready');
  }

  // 랜드마크 검증 (null 허용)
  if (landmarks && landmarks.length !== 468) {
    console.warn('Invalid landmark count');
    landmarks = null;
  }

  // 타임스탬프 기본값
  timestamp = timestamp ?? Date.now();
}
```

### 신호 품질 검증

```typescript
analyzeHeartRate() {
  const signal = this.getFilteredSignal();

  // 신호 품질 검사
  const snr = this.calculateSNR(signal);
  if (snr < SNR_THRESHOLD) {
    return { bpm: null, signalQuality: snr, isReady: false };
  }

  // BPM 범위 검증
  const bpm = this.extractBPM(signal);
  if (bpm < this.minBPM || bpm > this.maxBPM) {
    return { bpm: null, signalQuality: snr * 0.5, isReady: true };
  }

  return { bpm, signalQuality: snr, isReady: true };
}
```

## 확장 포인트

### 커스텀 분석기 추가

```typescript
interface SuperKiwiAnalyzer {
  process(video: HTMLVideoElement, landmarks: Point3D[]): any;
  reset(): void;
}

class CustomAnalyzer implements SuperKiwiAnalyzer {
  process(video, landmarks) {
    // 커스텀 분석 로직
  }

  reset() {
    // 상태 초기화
  }
}
```

### 플러그인 시스템 (향후 계획)

```typescript
interface SuperKiwiPlugin {
  name: string;
  version: string;
  init(sdk: SuperKiwiSDK): void;
  onFrame(result: SuperKiwiResult): void;
}

sdk.use(new EmotionDetectionPlugin());
sdk.use(new FatigueAnalysisPlugin());
```

## 테스트 전략

### 단위 테스트

각 분석기 모듈을 독립적으로 테스트합니다.

```typescript
describe('BlinkAnalyzer', () => {
  it('should detect blink when EAR drops below threshold', () => {
    const analyzer = new BlinkAnalyzer({ threshold: 0.21 });

    analyzer.update(0.3);  // 눈 열림
    analyzer.update(0.15); // 눈 감김
    analyzer.update(0.3);  // 눈 열림

    expect(analyzer.getBlinkCount()).toBe(1);
  });
});
```

### 통합 테스트

실제 비디오 데이터로 SDK 전체를 테스트합니다.

```typescript
describe('SuperKiwiSDK Integration', () => {
  it('should produce valid results after warmup period', async () => {
    const sdk = new SuperKiwiSDK();
    const video = await loadTestVideo('test_face.mp4');

    // 워밍업 (300 프레임)
    for (let i = 0; i < 300; i++) {
      await processNextFrame(sdk, video);
    }

    const result = sdk.processFrame(video, mockLandmarks);

    expect(result.heartRate).not.toBeNull();
    expect(result.heartRate.bpm).toBeGreaterThan(45);
    expect(result.heartRate.bpm).toBeLessThan(180);
  });
});
```

---

## 참고 자료

- [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
- [rPPG: Remote Photoplethysmography](https://en.wikipedia.org/wiki/Photoplethysmogram)
- [Heart Rate Variability Standards](https://www.hrv4training.com/blog/heart-rate-variability-a-primer)
- [Eye Aspect Ratio](https://www.pyimagesearch.com/2017/04/24/eye-blink-detection-opencv-python-dlib/)
