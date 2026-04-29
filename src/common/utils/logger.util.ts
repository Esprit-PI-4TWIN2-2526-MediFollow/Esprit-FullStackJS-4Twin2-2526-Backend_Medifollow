/**
 * Production-safe logging utility
 * Only logs in development or when ENABLE_DEBUG_LOGS=true
 */

const isProduction = process.env.NODE_ENV === 'production';
const debugEnabled = process.env.ENABLE_DEBUG_LOGS === 'true';

export class AppLogger {
  /**
   * Log general information (disabled in production)
   */
  static log(...args: any[]): void {
    if (!isProduction || debugEnabled) {
      console.log(...args);
    }
  }

  /**
   * Log debug information (disabled in production)
   */
  static debug(...args: any[]): void {
    if (!isProduction || debugEnabled) {
      console.debug(...args);
    }
  }

  /**
   * Log info messages (disabled in production)
   */
  static info(...args: any[]): void {
    if (!isProduction || debugEnabled) {
      console.info(...args);
    }
  }

  /**
   * Log warnings (always enabled)
   */
  static warn(...args: any[]): void {
    console.warn(...args);
  }

  /**
   * Log errors (always enabled)
   */
  static error(...args: any[]): void {
    console.error(...args);
  }
}
