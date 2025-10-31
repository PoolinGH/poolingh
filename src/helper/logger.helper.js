// IMPORTS

import winston from 'winston';
import * as path from 'path';

/**
 * Manages the application logs.
 */
export class Logger {
  /**
   * Creates a logger with the specified log directory.
   * @param {String} logDirectory The specified log directory. Default is '/logs'.
   */
  constructor(logDirectory = 'logs') {
    this.logger = winston.createLogger({
      level: 'info', // Minimum log level.
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(
          ({ timestamp, level, message }) =>
            `${timestamp} [${level.toUpperCase()}] ${message}`,
        ),
      ),
      transports: [
        //new winston.transports.Console({
        //  level: 'error',
        //}),
        new winston.transports.Console(),
        new winston.transports.File({
          filename: path.join(logDirectory, 'info.log'),
          level: 'info',
        }),
        new winston.transports.File({
          filename: path.join(logDirectory, 'warn.log'),
          level: 'warn',
        }),
        new winston.transports.File({
          filename: path.join(logDirectory, 'error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: path.join(logDirectory, 'combined.log'),
        }),
      ],
    });
  }

  info(message) {
    this.logger.info(message);
  }

  warn(message) {
    this.logger.warn(message);
  }

  error(message) {
    this.logger.error(message);
  }
}

export const logger = new Logger();
