/**
 * SuperKiwi SDK
 *
 * A comprehensive non-contact biometric signal analysis SDK using MediaPipe face landmarks.
 *
 * Features:
 * - Heart rate measurement via rPPG (Remote Photoplethysmography)
 * - HRV (Heart Rate Variability) analysis
 * - Blink detection and analysis
 * - Gaze tracking and stability measurement
 * - Head pose estimation
 * - Focus score calculation
 *
 * @packageDocumentation
 */

export {
  SuperKiwiSDK,
  type SuperKiwiSDKOptions,
  type SuperKiwiResult,
  type HeartRateResult,
  type HRVResult,
  type BlinkResult,
  type GazeResult,
  type HeadPoseResult,
  type FocusScoreResult,
  type Point3D,
  type Point2D,
} from './SuperKiwiSDK';

// Re-export the SDK as default for convenience
export { SuperKiwiSDK as default } from './SuperKiwiSDK';
