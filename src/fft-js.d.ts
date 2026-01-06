declare module 'fft-js' {
  /**
   * Compute the Fast Fourier Transform of a signal
   * @param signal - Array of real numbers representing the input signal
   * @returns Array of [real, imaginary] pairs
   */
  export function fft(signal: number[]): [number, number][];

  /**
   * Compute the Inverse Fast Fourier Transform
   * @param phasors - Array of [real, imaginary] pairs
   * @returns Array of real numbers
   */
  export function ifft(phasors: [number, number][]): number[];

  /**
   * Utility functions for FFT
   */
  export const util: {
    /**
     * Compute magnitudes from FFT result
     * @param phasors - Array of [real, imaginary] pairs from fft()
     * @returns Array of magnitude values
     */
    fftMag(phasors: [number, number][]): number[];

    /**
     * Compute frequencies for FFT result
     * @param N - Length of the original signal
     * @param sampleRate - Sample rate in Hz
     * @returns Array of frequencies
     */
    fftFreq(phasors: [number, number][], sampleRate: number): number[];
  };
}
