/**
 * SuperKiwi SDK - 사용 예시
 *
 * 이 파일은 SuperKiwiSDK의 사용 방법을 보여주는 예제입니다.
 * 실제 프로젝트에서 참고하여 사용하세요.
 *
 * 필수 의존성:
 * - npm install fft-js
 * - npm install @mediapipe/tasks-vision
 */

import { SuperKiwiSDK, SuperKiwiResult, SuperKiwiSDKOptions } from './SuperKiwiSDK';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ============================================================================
// 예제 1: 기본 사용법
// ============================================================================

async function basicExample() {
  console.log('=== 기본 사용 예제 ===\n');

  // 1. SDK 초기화
  const sdk = new SuperKiwiSDK({
    fps: 30,
    blinkThreshold: 0.21,
    debug: true,
  });

  console.log('SDK 버전:', SuperKiwiSDK.version);
  console.log('SDK 정보:', SuperKiwiSDK.info);

  // 2. MediaPipe FaceLandmarker 초기화
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
  );

  const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU',
    },
    outputFaceBlendshapes: false,
    runningMode: 'VIDEO',
    numFaces: 1,
  });

  console.log('MediaPipe FaceLandmarker 초기화 완료\n');

  // 3. 비디오 요소 가져오기
  const video = document.getElementById('webcam') as HTMLVideoElement;

  // 4. 프레임 처리 루프
  function processFrame() {
    if (video.readyState >= 2) {
      const timestamp = performance.now();
      const results = faceLandmarker.detectForVideo(video, timestamp);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        // SDK로 생체 신호 분석
        const result = sdk.processFrame(
          video,
          results.faceLandmarks[0],
          Date.now()
        );

        // 결과 출력
        displayResults(result);
      }
    }

    requestAnimationFrame(processFrame);
  }

  // 5. 시작
  processFrame();
}

// ============================================================================
// 예제 2: React 컴포넌트에서 사용
// ============================================================================

/**
 * React 컴포넌트 예제 (의사 코드)
 *
 * ```tsx
 * import { useEffect, useRef, useState } from 'react';
 * import { SuperKiwiSDK, SuperKiwiResult } from './SuperKiwiSDK';
 * import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
 *
 * function SuperKiwiMonitor() {
 *   const videoRef = useRef<HTMLVideoElement>(null);
 *   const sdkRef = useRef<SuperKiwiSDK | null>(null);
 *   const landmarkerRef = useRef<FaceLandmarker | null>(null);
 *   const [result, setResult] = useState<SuperKiwiResult | null>(null);
 *
 *   useEffect(() => {
 *     // SDK 초기화
 *     sdkRef.current = new SuperKiwiSDK({ fps: 30 });
 *
 *     // MediaPipe 초기화
 *     async function initMediaPipe() {
 *       const vision = await FilesetResolver.forVisionTasks(
 *         'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
 *       );
 *       landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
 *         baseOptions: {
 *           modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
 *           delegate: 'GPU',
 *         },
 *         runningMode: 'VIDEO',
 *         numFaces: 1,
 *       });
 *     }
 *
 *     initMediaPipe();
 *
 *     return () => {
 *       sdkRef.current?.reset();
 *     };
 *   }, []);
 *
 *   useEffect(() => {
 *     let animationId: number;
 *
 *     function processFrame() {
 *       const video = videoRef.current;
 *       const sdk = sdkRef.current;
 *       const landmarker = landmarkerRef.current;
 *
 *       if (video && sdk && landmarker && video.readyState >= 2) {
 *         const results = landmarker.detectForVideo(video, performance.now());
 *
 *         if (results.faceLandmarks?.[0]) {
 *           const result = sdk.processFrame(
 *             video,
 *             results.faceLandmarks[0],
 *             Date.now()
 *           );
 *           setResult(result);
 *         }
 *       }
 *
 *       animationId = requestAnimationFrame(processFrame);
 *     }
 *
 *     processFrame();
 *     return () => cancelAnimationFrame(animationId);
 *   }, []);
 *
 *   return (
 *     <div>
 *       <video ref={videoRef} autoPlay playsInline />
 *       {result && (
 *         <div>
 *           <p>심박수: {result.heartRate.bpm ?? '--'} BPM</p>
 *           <p>집중도: {Math.round(result.focusScore.score * 100)}%</p>
 *           <p>깜빡임: {result.blink.blinkRate.toFixed(1)}/분</p>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */

// ============================================================================
// 예제 3: 커스텀 옵션으로 초기화
// ============================================================================

function customOptionsExample() {
  console.log('=== 커스텀 옵션 예제 ===\n');

  // 모든 옵션 지정
  const options: SuperKiwiSDKOptions = {
    fps: 60, // 60fps 카메라 사용 시
    rppgBufferSize: 600, // 더 긴 버퍼 (10초 → 20초)
    minHeartRate: 40, // 최소 심박수 낮춤
    maxHeartRate: 200, // 최대 심박수 높임 (운동 시)
    blinkThreshold: 0.18, // 더 민감한 깜빡임 감지
    debug: true, // 디버그 로그 활성화
  };

  const sdk = new SuperKiwiSDK(options);
  console.log('커스텀 옵션으로 SDK 초기화 완료\n');

  return sdk;
}

// ============================================================================
// 예제 4: 결과 처리 및 UI 업데이트
// ============================================================================

function displayResults(result: SuperKiwiResult) {
  // 얼굴 감지 상태
  console.log('얼굴 감지:', result.faceDetected ? '✅' : '❌');

  // 심박수
  if (result.heartRate.isReady) {
    console.log(`심박수: ${result.heartRate.bpm} BPM (품질: ${(result.heartRate.signalQuality * 100).toFixed(0)}%)`);
  } else {
    console.log('심박수: 측정 중...');
  }

  // HRV
  if (result.hrv) {
    console.log(`HRV - SDNN: ${result.hrv.sdnn}ms, RMSSD: ${result.hrv.rmssd}ms, pNN50: ${result.hrv.pnn50}%`);
    console.log(`스트레스 지수: ${result.hrv.stressIndex}/100`);
  }

  // 눈 깜빡임
  console.log(`깜빡임 - EAR: ${result.blink.ear.toFixed(3)}, 분당: ${result.blink.blinkRate.toFixed(1)}회, 총: ${result.blink.blinkCount}회`);

  // 시선
  console.log(`시선 안정성: ${(result.gaze.stability * 100).toFixed(0)}%`);

  // 머리 자세
  console.log(`머리 자세 - Pitch: ${result.headPose.pitch}°, Yaw: ${result.headPose.yaw}°, Roll: ${result.headPose.roll}°`);

  // 집중도
  console.log(`집중도: ${(result.focusScore.score * 100).toFixed(0)}% (${result.focusScore.state})`);
  console.log('---');
}

// ============================================================================
// 예제 5: 특정 기능만 사용
// ============================================================================

function partialUsageExample() {
  console.log('=== 특정 기능만 사용 예제 ===\n');

  const sdk = new SuperKiwiSDK();

  // 가상의 랜드마크 데이터 (실제로는 MediaPipe에서 가져옴)
  const mockLandmarks = Array(468).fill({ x: 0.5, y: 0.5, z: 0 });

  // 비디오 없이 랜드마크만으로 분석 (심박수 제외)
  // 참고: 심박수 측정에는 반드시 비디오가 필요함
  const video = document.createElement('video');

  const result = sdk.processFrame(video, mockLandmarks, Date.now());

  // 눈 깜빡임만 확인
  console.log('깜빡임 감지:', result.blink.isBlinking);
  console.log('EAR 값:', result.blink.ear);

  // 집중도만 확인
  console.log('집중도 점수:', result.focusScore.score);
  console.log('집중 상태:', result.focusScore.state);
}

// ============================================================================
// 예제 6: 세션 관리 (시작/종료)
// ============================================================================

class SuperKiwiSession {
  private sdk: SuperKiwiSDK;
  private results: SuperKiwiResult[] = [];
  private startTime: number = 0;
  private isRunning: boolean = false;

  constructor() {
    this.sdk = new SuperKiwiSDK({ debug: false });
  }

  /**
   * 세션 시작
   */
  start() {
    this.sdk.reset();
    this.results = [];
    this.startTime = Date.now();
    this.isRunning = true;
    console.log('세션 시작:', new Date(this.startTime).toISOString());
  }

  /**
   * 프레임 처리
   */
  processFrame(video: HTMLVideoElement, landmarks: any[]): SuperKiwiResult | null {
    if (!this.isRunning) return null;

    const result = this.sdk.processFrame(video, landmarks, Date.now());
    this.results.push(result);
    return result;
  }

  /**
   * 세션 종료 및 요약 반환
   */
  stop(): SessionSummary {
    this.isRunning = false;
    const endTime = Date.now();
    const duration = (endTime - this.startTime) / 1000; // 초

    // 요약 통계 계산
    const validHeartRates = this.results
      .filter((r) => r.heartRate.bpm !== null)
      .map((r) => r.heartRate.bpm as number);

    const focusScores = this.results.map((r) => r.focusScore.score);
    const blinkCounts = this.results.map((r) => r.blink.blinkCount);

    const summary: SessionSummary = {
      startTime: this.startTime,
      endTime,
      durationSeconds: Math.round(duration),
      frameCount: this.results.length,

      heartRate: {
        average: validHeartRates.length > 0
          ? Math.round(validHeartRates.reduce((a, b) => a + b, 0) / validHeartRates.length)
          : null,
        min: validHeartRates.length > 0 ? Math.min(...validHeartRates) : null,
        max: validHeartRates.length > 0 ? Math.max(...validHeartRates) : null,
      },

      focusScore: {
        average: focusScores.length > 0
          ? Math.round((focusScores.reduce((a, b) => a + b, 0) / focusScores.length) * 100) / 100
          : 0,
        highPercentage: Math.round(
          (focusScores.filter((s) => s >= 0.7).length / focusScores.length) * 100
        ),
      },

      blink: {
        totalCount: Math.max(...blinkCounts, 0),
        averageRate: this.results.length > 0
          ? Math.round(this.results[this.results.length - 1].blink.blinkRate * 10) / 10
          : 0,
      },

      lastHRV: this.results[this.results.length - 1]?.hrv ?? null,
    };

    console.log('세션 종료. 요약:', summary);
    return summary;
  }

  /**
   * 현재 평균 집중도
   */
  getAverageFocusScore(): number {
    return this.sdk.getAverageFocusScore();
  }
}

interface SessionSummary {
  startTime: number;
  endTime: number;
  durationSeconds: number;
  frameCount: number;
  heartRate: {
    average: number | null;
    min: number | null;
    max: number | null;
  };
  focusScore: {
    average: number;
    highPercentage: number;
  };
  blink: {
    totalCount: number;
    averageRate: number;
  };
  lastHRV: SuperKiwiResult['hrv'];
}

// ============================================================================
// 예제 7: 이벤트 기반 사용 (콜백)
// ============================================================================

type SuperKiwiEventType = 'heartRateReady' | 'blinkDetected' | 'focusChanged' | 'hrvReady';

interface SuperKiwiEventHandler {
  (event: SuperKiwiEventType, data: any): void;
}

class SuperKiwiMonitor {
  private sdk: SuperKiwiSDK;
  private handlers: Map<SuperKiwiEventType, SuperKiwiEventHandler[]> = new Map();
  private lastResult: SuperKiwiResult | null = null;
  private heartRateReady = false;
  private hrvReady = false;

  constructor(options?: SuperKiwiSDKOptions) {
    this.sdk = new SuperKiwiSDK(options);
  }

  /**
   * 이벤트 리스너 등록
   */
  on(event: SuperKiwiEventType, handler: SuperKiwiEventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  /**
   * 이벤트 발생
   */
  private emit(event: SuperKiwiEventType, data: any) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach((handler) => handler(event, data));
  }

  /**
   * 프레임 처리 및 이벤트 발생
   */
  process(video: HTMLVideoElement, landmarks: any[]): SuperKiwiResult {
    const result = this.sdk.processFrame(video, landmarks, Date.now());

    // 심박수 준비 이벤트
    if (!this.heartRateReady && result.heartRate.isReady) {
      this.heartRateReady = true;
      this.emit('heartRateReady', { bpm: result.heartRate.bpm });
    }

    // 깜빡임 감지 이벤트
    if (result.blink.isBlinking && !this.lastResult?.blink.isBlinking) {
      this.emit('blinkDetected', { count: result.blink.blinkCount });
    }

    // 집중도 변화 이벤트
    if (this.lastResult && result.focusScore.state !== this.lastResult.focusScore.state) {
      this.emit('focusChanged', {
        from: this.lastResult.focusScore.state,
        to: result.focusScore.state,
        score: result.focusScore.score,
      });
    }

    // HRV 준비 이벤트
    if (!this.hrvReady && result.hrv !== null) {
      this.hrvReady = true;
      this.emit('hrvReady', result.hrv);
    }

    this.lastResult = result;
    return result;
  }

  reset() {
    this.sdk.reset();
    this.lastResult = null;
    this.heartRateReady = false;
    this.hrvReady = false;
  }
}

// 사용 예시
function eventBasedExample() {
  const monitor = new SuperKiwiMonitor({ debug: true });

  // 이벤트 리스너 등록
  monitor.on('heartRateReady', (event, data) => {
    console.log(`💓 심박수 측정 시작! 현재: ${data.bpm} BPM`);
  });

  monitor.on('blinkDetected', (event, data) => {
    console.log(`👁️ 깜빡임 감지! 총 ${data.count}회`);
  });

  monitor.on('focusChanged', (event, data) => {
    console.log(`🎯 집중도 변화: ${data.from} → ${data.to} (${(data.score * 100).toFixed(0)}%)`);
  });

  monitor.on('hrvReady', (event, data) => {
    console.log(`📊 HRV 측정 완료! SDNN: ${data.sdnn}ms`);
  });

  return monitor;
}

// ============================================================================
// 예제 8: HTML 페이지 전체 예제
// ============================================================================

/**
 * 완전한 HTML 예제
 *
 * ```html
 * <!DOCTYPE html>
 * <html>
 * <head>
 *   <title>SuperKiwi SDK Demo</title>
 *   <style>
 *     body { font-family: Arial, sans-serif; padding: 20px; }
 *     #video-container { position: relative; width: 640px; height: 480px; }
 *     video { width: 100%; height: 100%; background: #000; }
 *     #stats { margin-top: 20px; }
 *     .stat { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; }
 *     .stat-label { font-weight: bold; }
 *     .stat-value { font-size: 24px; color: #333; }
 *   </style>
 * </head>
 * <body>
 *   <h1>SuperKiwi SDK Demo</h1>
 *
 *   <div id="video-container">
 *     <video id="webcam" autoplay playsinline></video>
 *   </div>
 *
 *   <div id="stats">
 *     <div class="stat">
 *       <div class="stat-label">심박수</div>
 *       <div class="stat-value" id="heart-rate">-- BPM</div>
 *     </div>
 *     <div class="stat">
 *       <div class="stat-label">집중도</div>
 *       <div class="stat-value" id="focus-score">--%</div>
 *     </div>
 *     <div class="stat">
 *       <div class="stat-label">깜빡임</div>
 *       <div class="stat-value" id="blink-rate">--/분</div>
 *     </div>
 *     <div class="stat">
 *       <div class="stat-label">HRV (SDNN)</div>
 *       <div class="stat-value" id="hrv">-- ms</div>
 *     </div>
 *   </div>
 *
 *   <script type="module">
 *     import { SuperKiwiSDK } from './SuperKiwiSDK.js';
 *     import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
 *
 *     const sdk = new SuperKiwiSDK({ fps: 30, debug: true });
 *     let faceLandmarker;
 *
 *     async function init() {
 *       // 웹캠 시작
 *       const video = document.getElementById('webcam');
 *       const stream = await navigator.mediaDevices.getUserMedia({
 *         video: { width: 640, height: 480 }
 *       });
 *       video.srcObject = stream;
 *       await video.play();
 *
 *       // MediaPipe 초기화
 *       const vision = await FilesetResolver.forVisionTasks(
 *         'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
 *       );
 *       faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
 *         baseOptions: {
 *           modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
 *           delegate: 'GPU',
 *         },
 *         runningMode: 'VIDEO',
 *         numFaces: 1,
 *       });
 *
 *       // 프레임 처리 시작
 *       processFrame();
 *     }
 *
 *     function processFrame() {
 *       const video = document.getElementById('webcam');
 *
 *       if (video.readyState >= 2) {
 *         const results = faceLandmarker.detectForVideo(video, performance.now());
 *
 *         if (results.faceLandmarks?.[0]) {
 *           const result = sdk.processFrame(video, results.faceLandmarks[0], Date.now());
 *           updateUI(result);
 *         }
 *       }
 *
 *       requestAnimationFrame(processFrame);
 *     }
 *
 *     function updateUI(result) {
 *       document.getElementById('heart-rate').textContent =
 *         result.heartRate.bpm ? `${result.heartRate.bpm} BPM` : '측정 중...';
 *
 *       document.getElementById('focus-score').textContent =
 *         `${Math.round(result.focusScore.score * 100)}%`;
 *
 *       document.getElementById('blink-rate').textContent =
 *         `${result.blink.blinkRate.toFixed(1)}/분`;
 *
 *       document.getElementById('hrv').textContent =
 *         result.hrv ? `${result.hrv.sdnn} ms` : '측정 중...';
 *     }
 *
 *     init().catch(console.error);
 *   </script>
 * </body>
 * </html>
 * ```
 */

// ============================================================================
// 내보내기
// ============================================================================

export {
  basicExample,
  customOptionsExample,
  displayResults,
  partialUsageExample,
  SuperKiwiSession,
  SuperKiwiMonitor,
  eventBasedExample,
};

export type { SessionSummary, SuperKiwiEventType, SuperKiwiEventHandler };
