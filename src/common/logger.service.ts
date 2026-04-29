import { Injectable, LoggerService as NestLoggerService, LogLevel } from '@nestjs/common';

/**
 * Production-ready Logger Service
 * 
 * Automatically disables debug/verbose logs in production
 * Keeps error and warn logs for monitoring
 * 
 * Performance Benefits:
 * - Reduces I/O operations in production
 * - Decreases CPU usage from string formatting
 * - Reduces memory allocation for log strings
 * - Improves response times (especially for high-traffic endpoints)
 */
@Injectable()
export class ProductionLogger implements NestLoggerService {
  private isProduction = process.env.NODE_ENV === 'production';
  private enableDebugLogs = process.env.ENABLE_DEBUG_LOGS === 'true';

  /**
   * Log a message (disabled in production unless ENABLE_DEBUG_LOGS=true)
   */
  log(message: any, context?: string) {
    if (!this.isProduction || this.enableDebugLogs) {
      console.log(this.formatMessage('LOG', message, context));
    }
  }

  /**
   * Log an error (always enabled)
   */
  error(message: any, trace?: string, context?: string) {
    console.error(this.formatMessage('ERROR', message, context));
    if (trace) {
      console.error(trace);
    }
  }

  /**
   * Log a warning (always enabled)
   */
  warn(message: any, context?: string) {
    console.warn(this.formatMessage('WARN', message, context));
  }

  /**
   * Log debug information (disabled in production)
   */
  debug(message: any, context?: string) {
    if (!this.isProduction || this.enableDebugLogs) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  /**
   * Log verbose information (disabled in production)
   */
  verbose(message: any, context?: string) {
    if (!this.isProduction || this.enableDebugLogs) {
      console.log(this.formatMessage('VERBOSE', message, context));
    }
  }

  /**
   * Set log levels (NestJS compatibility)
   */
  setLogLevels?(levels: LogLevel[]) {
    // Implementation if needed
  }

  /**
   * Format log message with timestamp and context
   */
  private formatMessage(level: string, message: any, context?: string): string {
    const timestamp = new Date().toISOString();
    const ctx = context ? `[${context}]` : '';
    const msg = typeof message === 'object' ? JSON.stringify(message) : message;
    return `[${timestamp}] [${level}] ${ctx} ${msg}`;
  }

  /**
   * Conditional logging - only in development
   */
  logDev(message: any, context?: string) {
    if (!this.isProduction) {
      this.log(message, context);
    }
  }

  /**
   * Performance logging - measure execution time
   */
  logPerformance(label: string, startTime: number, context?: string) {
    if (!this.isProduction || this.enableDebugLogs) {
      const duration = Date.now() - startTime;
      this.log(`⏱️ ${label}: ${duration}ms`, context);
    }
  }
}

/**
 * Global logger instance for use in services
 */
export const logger = new ProductionLogger();
