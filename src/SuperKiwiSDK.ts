/**
 * SuperKiwi SDK v2.0.0
 *
 * 비접촉 생체 신호 분석 SDK - MediaPipe Face Landmarker 기반
 *
 * 주요 기능:
 * - rPPG 심박수 측정 (Remote Photoplethysmography)
 * - HRV 분석 (SDNN, RMSSD, pNN50)
 * - 눈 깜빡임 감지 (Eye Aspect Ratio)
 * - 시선 안정성 측정
 * - 머리 자세 추정 (Pitch, Yaw, Roll)
 * - 집중도 점수 계산
 *
 * @requires fft-js - FFT 분석용 (npm install fft-js)
 * @requires @mediapipe/tasks-vision - 얼굴 랜드마크 감지용
 *
 * @example
 * ```typescript
 * import { SuperKiwiSDK } from './SuperKiwiSDK';
 *
 * const sdk = new SuperKiwiSDK({ fps: 30 });
 *
 * // MediaPipe에서 얼굴 랜드마크 감지 후
 * const result = sdk.processFrame(videoElement, landmarks, timestamp);
 * console.log(result.focusScore, result.heartRate, result.blink);
 * ```
 */

import { fft } from 'fft-js';

// ============================================================================
// 타입 정의
// ============================================================================

/** 3D 좌표점 */
export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

/** 2D 좌표점 */
export interface Point2D {
  x: number;
  y: number;
}

/** SDK 설정 옵션 */
export interface SuperKiwiSDKOptions {
  /** 카메라 프레임 레이트 (기본값: 30) */
  fps?: number;
  /** rPPG 버퍼 크기 (기본값: 300, 약 10초) */
  rppgBufferSize?: number;
  /** 최소 심박수 BPM (기본값: 45) */
  minHeartRate?: number;
  /** 최대 심박수 BPM (기본값: 180) */
  maxHeartRate?: number;
  /** 눈 깜빡임 EAR 임계값 (기본값: 0.21) */
  blinkThreshold?: number;
  /** 디버그 모드 (기본값: false) */
  debug?: boolean;
}

/** 심박수 측정 결과 */
export interface HeartRateResult {
  /** 심박수 BPM (측정 전이면 null) */
  bpm: number | null;
  /** 신호 품질 (0-1) */
  signalQuality: number;
  /** RR 간격 (ms) */
  rrInterval: number | null;
  /** 버퍼 준비 상태 */
  isReady: boolean;
}

/** HRV 분석 결과 */
export interface HRVResult {
  /** SDNN - RR 간격의 표준편차 (ms) */
  sdnn: number;
  /** RMSSD - 연속 RR 간격 차이의 RMS (ms) */
  rmssd: number;
  /** pNN50 - 50ms 이상 차이나는 간격 비율 (%) */
  pnn50: number;
  /** 스트레스 지수 (0-100, 높을수록 스트레스) */
  stressIndex: number;
  /** 측정 시각 */
  timestamp: number;
}

/** 눈 깜빡임 결과 */
export interface BlinkResult {
  /** 현재 EAR 값 (양쪽 눈 평균) */
  ear: number;
  /** 왼쪽 눈 EAR */
  leftEar: number;
  /** 오른쪽 눈 EAR */
  rightEar: number;
  /** 깜빡임 감지 여부 */
  isBlinking: boolean;
  /** 분당 깜빡임 횟수 */
  blinkRate: number;
  /** 총 깜빡임 횟수 */
  blinkCount: number;
}

/** 시선 추적 결과 */
export interface GazeResult {
  /** 시선 중심점 (정규화된 좌표 0-1) */
  center: Point2D;
  /** 화면 중앙 대비 벡터 */
  vector: { x: number; y: number; distance: number };
  /** 시선 안정성 점수 (0-1, 중앙에 가까울수록 높음) */
  stability: number;
}

/** 머리 자세 결과 */
export interface HeadPoseResult {
  /** 위/아래 각도 (도) */
  pitch: number;
  /** 좌/우 각도 (도) */
  yaw: number;
  /** 기울기 각도 (도) */
  roll: number;
}

/** 집중도 점수 결과 */
export interface FocusScoreResult {
  /** 종합 집중도 점수 (0-1) */
  score: number;
  /** 얼굴 감지 점수 (0 또는 1) */
  faceScore: number;
  /** 시선 안정성 점수 (0-1) */
  gazeScore: number;
  /** 깜빡임 안정성 점수 (0-1) */
  blinkScore: number;
  /** 집중 상태 */
  state: 'high' | 'medium' | 'low';
}

/** 프레임 처리 결과 (전체) */
export interface SuperKiwiResult {
  /** 타임스탬프 */
  timestamp: number;
  /** 얼굴 감지 여부 */
  faceDetected: boolean;
  /** 심박수 결과 */
  heartRate: HeartRateResult;
  /** HRV 결과 (데이터 충분할 때만) */
  hrv: HRVResult | null;
  /** 눈 깜빡임 결과 */
  blink: BlinkResult;
  /** 시선 추적 결과 */
  gaze: GazeResult;
  /** 머리 자세 결과 */
  headPose: HeadPoseResult;
  /** 집중도 점수 */
  focusScore: FocusScoreResult;
}

// ============================================================================
// 상수 정의
// ============================================================================

const DEFAULT_OPTIONS: Required<SuperKiwiSDKOptions> = {
  fps: 30,
  rppgBufferSize: 300,
  minHeartRate: 45,
  maxHeartRate: 180,
  blinkThreshold: 0.21,
  debug: false,
};

// MediaPipe Face Mesh 랜드마크 인덱스
const LANDMARKS = {
  // 이마 영역 (rPPG ROI)
  FOREHEAD: [10, 151, 9, 337, 299, 333, 298, 301],
  // 볼 영역 (rPPG ROI)
  LEFT_CHEEK: [116, 117, 118, 123, 147, 213, 192],
  RIGHT_CHEEK: [345, 346, 347, 352, 376, 433, 416],
  // 왼쪽 눈 (6개 포인트 - EAR 계산용)
  LEFT_EYE: [33, 7, 163, 144, 145, 153],
  // 오른쪽 눈 (6개 포인트 - EAR 계산용)
  RIGHT_EYE: [263, 249, 390, 373, 374, 380],
  // 머리 자세용
  NOSE_TIP: 1,
  CHIN: 152,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  FOREHEAD_TOP: 10,
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/** 두 점 사이의 유클리드 거리 */
function euclideanDistance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/** 배열의 평균값 */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/** 배열의 표준편차 */
function standardDeviation(arr: number[], avg?: number): number {
  if (arr.length < 2) return 0;
  const m = avg ?? mean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

/** 값을 범위 내로 클램프 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// rPPG 심박수 분석기
// ============================================================================

class RPPGAnalyzer {
  private greenBuffer: number[] = [];
  private timestamps: number[] = [];
  private readonly bufferSize: number;
  private readonly minFreq: number;
  private readonly maxFreq: number;
  private readonly fps: number;
  private lastHeartRate: number = 0;
  private signalQuality: number = 0;

  constructor(options: Required<SuperKiwiSDKOptions>) {
    this.bufferSize = options.rppgBufferSize;
    this.fps = options.fps;
    this.minFreq = options.minHeartRate / 60; // Hz
    this.maxFreq = options.maxHeartRate / 60; // Hz
  }

  /**
   * ROI 영역에서 RGB 평균값 추출
   */
  extractROISignal(
    video: HTMLVideoElement,
    landmarks: Point3D[]
  ): { r: number; g: number; b: number } | null {
    if (!landmarks || landmarks.length < 468) return null;

    // ROI 인덱스 수집
    const roiIndices = [
      ...LANDMARKS.FOREHEAD,
      ...LANDMARKS.LEFT_CHEEK,
      ...LANDMARKS.RIGHT_CHEEK,
    ];

    // 바운딩 박스 계산
    const points = roiIndices
      .map((idx) => landmarks[idx])
      .filter((p) => p !== undefined);

    if (points.length === 0) return null;

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0);

      const x = Math.floor(minX * canvas.width);
      const y = Math.floor(minY * canvas.height);
      const width = Math.max(1, Math.floor((maxX - minX) * canvas.width));
      const height = Math.max(1, Math.floor((maxY - minY) * canvas.height));

      const imageData = ctx.getImageData(x, y, width, height);
      const pixels = imageData.data;
      const pixelCount = pixels.length / 4;

      if (pixelCount === 0) return null;

      let r = 0, g = 0, b = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        r += pixels[i];
        g += pixels[i + 1];
        b += pixels[i + 2];
      }

      return {
        r: r / pixelCount,
        g: g / pixelCount,
        b: b / pixelCount,
      };
    } catch {
      return null;
    }
  }

  /**
   * 신호 추가
   */
  addSignal(greenValue: number, timestamp: number): void {
    this.greenBuffer.push(greenValue);
    this.timestamps.push(timestamp);

    if (this.greenBuffer.length > this.bufferSize) {
      this.greenBuffer.shift();
      this.timestamps.shift();
    }
  }

  /**
   * 심박수 계산
   */
  calculateHeartRate(): HeartRateResult {
    if (this.greenBuffer.length < this.bufferSize * 0.8) {
      return {
        bpm: this.lastHeartRate || null,
        signalQuality: 0,
        rrInterval: null,
        isReady: false,
      };
    }

    try {
      // 신호 전처리
      const signal = [...this.greenBuffer];
      const detrended = this.detrend(signal);
      const filtered = this.bandpassFilter(detrended);

      // FFT 분석
      const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(filtered.length)));
      const paddedSignal = [...filtered];
      while (paddedSignal.length < nextPowerOfTwo) {
        paddedSignal.push(0);
      }

      const fftResult = fft(paddedSignal);
      if (!fftResult || !Array.isArray(fftResult)) {
        return this.getDefaultResult();
      }

      // 주파수 스펙트럼에서 피크 찾기
      const magnitudes = fftResult.map((c: number[]) => {
        if (!Array.isArray(c) || c.length < 2) return 0;
        return Math.sqrt(c[0] ** 2 + c[1] ** 2);
      });

      const binSize = this.fps / paddedSignal.length;
      let maxMagnitude = 0;
      let peakFreq = 0;
      let totalPower = 0;

      for (let i = 0; i < magnitudes.length / 2; i++) {
        const freq = i * binSize;
        if (freq >= this.minFreq && freq <= this.maxFreq) {
          totalPower += magnitudes[i];
          if (magnitudes[i] > maxMagnitude) {
            maxMagnitude = magnitudes[i];
            peakFreq = freq;
          }
        }
      }

      if (peakFreq === 0) {
        return this.getDefaultResult();
      }

      const bpm = Math.round(peakFreq * 60);
      const snr = totalPower > 0 ? maxMagnitude / (totalPower - maxMagnitude) : 0;
      this.signalQuality = clamp(snr / 0.5, 0, 1);
      this.lastHeartRate = bpm;

      const rrInterval = 60000 / bpm;

      return {
        bpm,
        signalQuality: this.signalQuality,
        rrInterval,
        isReady: true,
      };
    } catch {
      return this.getDefaultResult();
    }
  }

  private getDefaultResult(): HeartRateResult {
    return {
      bpm: this.lastHeartRate || null,
      signalQuality: 0,
      rrInterval: null,
      isReady: this.greenBuffer.length >= this.bufferSize * 0.8,
    };
  }

  /** 선형 디트렌딩 */
  private detrend(signal: number[]): number[] {
    const n = signal.length;
    if (n < 2) return signal;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += signal[i];
      sumXY += i * signal[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return signal.map((value, i) => value - (slope * i + intercept));
  }

  /** 밴드패스 필터 (하이패스 + 로우패스) */
  private bandpassFilter(signal: number[]): number[] {
    // 하이패스 필터
    const RC_high = 1 / (2 * Math.PI * this.minFreq);
    const dt = 1 / this.fps;
    const alpha_high = RC_high / (RC_high + dt);

    const highpassed: number[] = [signal[0]];
    for (let i = 1; i < signal.length; i++) {
      highpassed.push(alpha_high * (highpassed[i - 1] + signal[i] - signal[i - 1]));
    }

    // 로우패스 필터
    const RC_low = 1 / (2 * Math.PI * this.maxFreq);
    const alpha_low = dt / (RC_low + dt);

    const lowpassed: number[] = [highpassed[0]];
    for (let i = 1; i < highpassed.length; i++) {
      lowpassed.push(lowpassed[i - 1] + alpha_low * (highpassed[i] - lowpassed[i - 1]));
    }

    return lowpassed;
  }

  reset(): void {
    this.greenBuffer = [];
    this.timestamps = [];
    this.lastHeartRate = 0;
    this.signalQuality = 0;
  }
}

// ============================================================================
// HRV 분석기
// ============================================================================

class HRVAnalyzer {
  private rrIntervals: number[] = [];
  private readonly minIntervals = 20;
  private readonly maxIntervals = 300;

  /**
   * RR 간격 추가
   */
  addRRInterval(rrInterval: number): void {
    if (rrInterval <= 0 || rrInterval > 3000) return; // 유효성 검사

    this.rrIntervals.push(rrInterval);
    if (this.rrIntervals.length > this.maxIntervals) {
      this.rrIntervals.shift();
    }
  }

  /**
   * HRV 계산
   */
  calculateHRV(): HRVResult | null {
    if (this.rrIntervals.length < this.minIntervals) {
      return null;
    }

    const intervals = [...this.rrIntervals];
    const n = intervals.length;

    // SDNN (Standard Deviation of NN intervals)
    const meanRR = mean(intervals);
    const sdnn = standardDeviation(intervals, meanRR);

    // RMSSD (Root Mean Square of Successive Differences)
    const successiveDiffs: number[] = [];
    for (let i = 1; i < n; i++) {
      successiveDiffs.push(Math.pow(intervals[i] - intervals[i - 1], 2));
    }
    const rmssd = Math.sqrt(mean(successiveDiffs));

    // pNN50 (Percentage of successive intervals > 50ms)
    let nn50Count = 0;
    for (let i = 1; i < n; i++) {
      if (Math.abs(intervals[i] - intervals[i - 1]) > 50) {
        nn50Count++;
      }
    }
    const pnn50 = (nn50Count / (n - 1)) * 100;

    // 스트레스 지수 (SDNN과 RMSSD가 낮을수록 스트레스 높음)
    const stressIndex = clamp(100 - (sdnn + rmssd) / 2, 0, 100);

    return {
      sdnn: Math.round(sdnn * 10) / 10,
      rmssd: Math.round(rmssd * 10) / 10,
      pnn50: Math.round(pnn50 * 10) / 10,
      stressIndex: Math.round(stressIndex),
      timestamp: Date.now(),
    };
  }

  isReady(): boolean {
    return this.rrIntervals.length >= this.minIntervals;
  }

  reset(): void {
    this.rrIntervals = [];
  }
}

// ============================================================================
// 눈 깜빡임 분석기
// ============================================================================

class BlinkAnalyzer {
  private blinkHistory: number[] = [];
  private lastBlinkTime: number = 0;
  private blinkCount: number = 0;
  private wasBlinking: boolean = false;
  private readonly blinkThreshold: number;
  private readonly minBlinkInterval = 150; // ms
  private readonly windowSize = 60000; // 60초

  constructor(blinkThreshold: number) {
    this.blinkThreshold = blinkThreshold;
  }

  /**
   * EAR (Eye Aspect Ratio) 계산
   */
  calculateEAR(eyeLandmarks: Point2D[]): number {
    if (eyeLandmarks.length < 6) return 1.0;

    // 수직 거리
    const vertical1 = euclideanDistance(eyeLandmarks[1], eyeLandmarks[5]);
    const vertical2 = euclideanDistance(eyeLandmarks[2], eyeLandmarks[4]);
    // 수평 거리
    const horizontal = euclideanDistance(eyeLandmarks[0], eyeLandmarks[3]);

    if (horizontal === 0) return 1.0;
    return (vertical1 + vertical2) / (2.0 * horizontal);
  }

  /**
   * 프레임 처리
   */
  process(
    landmarks: Point3D[],
    timestamp: number
  ): BlinkResult {
    // 눈 랜드마크 추출
    const leftEye = LANDMARKS.LEFT_EYE.map((idx) => ({
      x: landmarks[idx]?.x ?? 0,
      y: landmarks[idx]?.y ?? 0,
    }));
    const rightEye = LANDMARKS.RIGHT_EYE.map((idx) => ({
      x: landmarks[idx]?.x ?? 0,
      y: landmarks[idx]?.y ?? 0,
    }));

    const leftEar = this.calculateEAR(leftEye);
    const rightEar = this.calculateEAR(rightEye);
    const avgEar = (leftEar + rightEar) / 2;

    const isBlinking = avgEar < this.blinkThreshold;

    // 깜빡임 감지 (상태 전환)
    if (isBlinking && !this.wasBlinking) {
      const timeSinceLastBlink = timestamp - this.lastBlinkTime;
      if (timeSinceLastBlink >= this.minBlinkInterval) {
        this.blinkCount++;
        this.blinkHistory.push(timestamp);
        this.lastBlinkTime = timestamp;

        // 윈도우 외 데이터 제거
        const cutoff = timestamp - this.windowSize;
        this.blinkHistory = this.blinkHistory.filter((t) => t > cutoff);
      }
    }
    this.wasBlinking = isBlinking;

    // 분당 깜빡임 계산
    const blinkRate = this.calculateBlinkRate(timestamp);

    return {
      ear: avgEar,
      leftEar,
      rightEar,
      isBlinking,
      blinkRate,
      blinkCount: this.blinkCount,
    };
  }

  private calculateBlinkRate(now: number): number {
    if (this.blinkHistory.length === 0) return 0;

    const cutoff = now - this.windowSize;
    const recentBlinks = this.blinkHistory.filter((t) => t > cutoff);

    if (recentBlinks.length < 2) {
      if (recentBlinks.length === 1) {
        const elapsed = (now - recentBlinks[0]) / 1000;
        if (elapsed < 1) return 0;
        return (1 / elapsed) * 60;
      }
      return 0;
    }

    const timeSpan = (recentBlinks[recentBlinks.length - 1] - recentBlinks[0]) / 1000;
    if (timeSpan === 0) return 0;
    return (recentBlinks.length / timeSpan) * 60;
  }

  reset(): void {
    this.blinkHistory = [];
    this.lastBlinkTime = 0;
    this.blinkCount = 0;
    this.wasBlinking = false;
  }
}

// ============================================================================
// 시선 추적기
// ============================================================================

class GazeTracker {
  /**
   * 눈 중심점 계산
   */
  calculateEyeCenter(eyeLandmarks: Point3D[]): Point2D {
    if (eyeLandmarks.length === 0) return { x: 0.5, y: 0.5 };

    const sumX = eyeLandmarks.reduce((sum, p) => sum + p.x, 0);
    const sumY = eyeLandmarks.reduce((sum, p) => sum + p.y, 0);

    return {
      x: sumX / eyeLandmarks.length,
      y: sumY / eyeLandmarks.length,
    };
  }

  /**
   * 시선 분석
   */
  analyze(landmarks: Point3D[]): GazeResult {
    const leftEye = LANDMARKS.LEFT_EYE.map((idx) => landmarks[idx]).filter(Boolean);
    const rightEye = LANDMARKS.RIGHT_EYE.map((idx) => landmarks[idx]).filter(Boolean);

    const leftCenter = this.calculateEyeCenter(leftEye);
    const rightCenter = this.calculateEyeCenter(rightEye);

    const center: Point2D = {
      x: (leftCenter.x + rightCenter.x) / 2,
      y: (leftCenter.y + rightCenter.y) / 2,
    };

    // 화면 중앙(0.5, 0.5) 대비 벡터
    const screenCenter = { x: 0.5, y: 0.5 };
    const dx = center.x - screenCenter.x;
    const dy = center.y - screenCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 안정성 점수 (중앙에 가까울수록 높음)
    const maxDistance = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5); // ~0.707
    const stability = clamp(1 - distance / maxDistance, 0, 1);

    return {
      center,
      vector: { x: dx, y: dy, distance },
      stability,
    };
  }
}

// ============================================================================
// 머리 자세 추정기
// ============================================================================

class HeadPoseEstimator {
  /**
   * 머리 자세 계산
   */
  estimate(landmarks: Point3D[]): HeadPoseResult {
    if (!landmarks || landmarks.length < 468) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    const nose = landmarks[LANDMARKS.NOSE_TIP];
    const chin = landmarks[LANDMARKS.CHIN];
    const leftEye = landmarks[LANDMARKS.LEFT_EYE_OUTER];
    const rightEye = landmarks[LANDMARKS.RIGHT_EYE_OUTER];
    const forehead = landmarks[LANDMARKS.FOREHEAD_TOP];

    if (!nose || !chin || !leftEye || !rightEye || !forehead) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // 눈 중심
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
    };

    // Yaw (좌우 회전)
    const yaw = Math.atan2(nose.x - eyeCenter.x, 0.5) * (180 / Math.PI);

    // Pitch (위아래 회전)
    const faceHeight = forehead.y - chin.y;
    const pitch = Math.atan2(nose.y - eyeCenter.y, Math.abs(faceHeight)) * (180 / Math.PI);

    // Roll (기울기)
    const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    return {
      pitch: Math.round(pitch),
      yaw: Math.round(yaw),
      roll: Math.round(roll),
    };
  }
}

// ============================================================================
// 집중도 점수 계산기
// ============================================================================

class FocusScoreCalculator {
  private scoreHistory: { score: number; timestamp: number }[] = [];
  private readonly windowSize = 60000; // 60초

  /**
   * 깜빡임 안정성 점수 계산
   */
  calculateBlinkStability(blinkRate: number): number {
    const optimalRate = 17.5; // 분당 최적 깜빡임
    const tolerance = 5;

    if (blinkRate === 0) return 0;

    const deviation = Math.abs(blinkRate - optimalRate);
    if (deviation <= tolerance) return 1.0;

    const normalizedDeviation = Math.min(deviation / (optimalRate * 2), 1.0);
    return Math.max(0, 1 - normalizedDeviation);
  }

  /**
   * 집중도 점수 계산
   */
  calculate(
    faceDetected: boolean,
    gazeStability: number,
    blinkRate: number,
    timestamp: number
  ): FocusScoreResult {
    const faceScore = faceDetected ? 1 : 0;
    const gazeScore = gazeStability;
    const blinkScore = this.calculateBlinkStability(blinkRate);

    // 가중 합산: 얼굴 40% + 시선 40% + 깜빡임 20%
    const score = clamp(
      faceScore * 0.4 + gazeScore * 0.4 + blinkScore * 0.2,
      0,
      1
    );

    // 히스토리 업데이트
    this.scoreHistory.push({ score, timestamp });
    const cutoff = timestamp - this.windowSize;
    this.scoreHistory = this.scoreHistory.filter((s) => s.timestamp > cutoff);

    // 상태 결정
    let state: 'high' | 'medium' | 'low';
    if (score >= 0.7) state = 'high';
    else if (score >= 0.3) state = 'medium';
    else state = 'low';

    return {
      score: Math.round(score * 100) / 100,
      faceScore,
      gazeScore: Math.round(gazeScore * 100) / 100,
      blinkScore: Math.round(blinkScore * 100) / 100,
      state,
    };
  }

  /**
   * 평균 집중도 점수
   */
  getAverageScore(): number {
    if (this.scoreHistory.length === 0) return 0;
    return mean(this.scoreHistory.map((s) => s.score));
  }

  reset(): void {
    this.scoreHistory = [];
  }
}

// ============================================================================
// 메인 SDK 클래스
// ============================================================================

/**
 * SuperKiwi SDK
 *
 * 생체 신호 분석을 위한 통합 SDK
 */
export class SuperKiwiSDK {
  private options: Required<SuperKiwiSDKOptions>;
  private rppgAnalyzer: RPPGAnalyzer;
  private hrvAnalyzer: HRVAnalyzer;
  private blinkAnalyzer: BlinkAnalyzer;
  private gazeTracker: GazeTracker;
  private headPoseEstimator: HeadPoseEstimator;
  private focusCalculator: FocusScoreCalculator;
  private lastHRV: HRVResult | null = null;

  constructor(options: SuperKiwiSDKOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.rppgAnalyzer = new RPPGAnalyzer(this.options);
    this.hrvAnalyzer = new HRVAnalyzer();
    this.blinkAnalyzer = new BlinkAnalyzer(this.options.blinkThreshold);
    this.gazeTracker = new GazeTracker();
    this.headPoseEstimator = new HeadPoseEstimator();
    this.focusCalculator = new FocusScoreCalculator();

    if (this.options.debug) {
      console.log('[SuperKiwiSDK] Initialized with options:', this.options);
    }
  }

  /**
   * 비디오 프레임 처리
   *
   * @param video - HTML Video 요소
   * @param landmarks - MediaPipe 얼굴 랜드마크 (468개)
   * @param timestamp - 타임스탬프 (ms)
   * @returns 생체 측정 결과
   */
  processFrame(
    video: HTMLVideoElement,
    landmarks: Point3D[] | null,
    timestamp: number = Date.now()
  ): SuperKiwiResult {
    const faceDetected = landmarks !== null && landmarks.length >= 468;

    // 기본 결과 (얼굴 미감지 시)
    if (!faceDetected || !landmarks) {
      return this.getEmptyResult(timestamp);
    }

    // 1. rPPG 심박수 측정
    const rgb = this.rppgAnalyzer.extractROISignal(video, landmarks);
    if (rgb) {
      this.rppgAnalyzer.addSignal(rgb.g, timestamp);
    }
    const heartRate = this.rppgAnalyzer.calculateHeartRate();

    // 2. HRV 분석
    if (heartRate.rrInterval && heartRate.rrInterval > 0) {
      this.hrvAnalyzer.addRRInterval(heartRate.rrInterval);
    }
    const hrv = this.hrvAnalyzer.calculateHRV();
    if (hrv) {
      this.lastHRV = hrv;
    }

    // 3. 눈 깜빡임 분석
    const blink = this.blinkAnalyzer.process(landmarks, timestamp);

    // 4. 시선 추적
    const gaze = this.gazeTracker.analyze(landmarks);

    // 5. 머리 자세
    const headPose = this.headPoseEstimator.estimate(landmarks);

    // 6. 집중도 점수
    const focusScore = this.focusCalculator.calculate(
      faceDetected,
      gaze.stability,
      blink.blinkRate,
      timestamp
    );

    return {
      timestamp,
      faceDetected,
      heartRate,
      hrv: this.lastHRV,
      blink,
      gaze,
      headPose,
      focusScore,
    };
  }

  /**
   * 빈 결과 반환 (얼굴 미감지 시)
   */
  private getEmptyResult(timestamp: number): SuperKiwiResult {
    return {
      timestamp,
      faceDetected: false,
      heartRate: {
        bpm: null,
        signalQuality: 0,
        rrInterval: null,
        isReady: false,
      },
      hrv: this.lastHRV,
      blink: {
        ear: 0,
        leftEar: 0,
        rightEar: 0,
        isBlinking: false,
        blinkRate: 0,
        blinkCount: 0,
      },
      gaze: {
        center: { x: 0.5, y: 0.5 },
        vector: { x: 0, y: 0, distance: 0 },
        stability: 0,
      },
      headPose: { pitch: 0, yaw: 0, roll: 0 },
      focusScore: {
        score: 0,
        faceScore: 0,
        gazeScore: 0,
        blinkScore: 0,
        state: 'low',
      },
    };
  }

  /**
   * 현재 평균 집중도 점수 조회
   */
  getAverageFocusScore(): number {
    return this.focusCalculator.getAverageScore();
  }

  /**
   * HRV 준비 상태 확인
   */
  isHRVReady(): boolean {
    return this.hrvAnalyzer.isReady();
  }

  /**
   * 모든 분석기 초기화
   */
  reset(): void {
    this.rppgAnalyzer.reset();
    this.hrvAnalyzer.reset();
    this.blinkAnalyzer.reset();
    this.focusCalculator.reset();
    this.lastHRV = null;

    if (this.options.debug) {
      console.log('[SuperKiwiSDK] Reset all analyzers');
    }
  }

  /**
   * SDK 버전 정보
   */
  static get version(): string {
    return '1.0.0';
  }

  /**
   * SDK 정보
   */
  static get info(): { name: string; version: string; description: string } {
    return {
      name: 'SuperKiwi SDK',
      version: '1.0.0',
      description: '비접촉 생체 신호 분석 SDK - 심박수, HRV, 눈 깜빡임, 시선, 집중도 측정',
    };
  }
}

// 기본 내보내기
export default SuperKiwiSDK;
