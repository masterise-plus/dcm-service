import winston from 'winston';
import path from 'path';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';

const { combine, timestamp, json, errors, colorize, printf, align } = winston.format;

// Custom format for console output with colors
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  align(),
  printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
);

// JSON format for file logging
const fileFormat = combine(
  errors({ stack: true }),
  timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  json()
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Initialize Logtail if credentials are available
let logtailTransport: LogtailTransport | null = null;

if (process.env.LOGTAIL_SOURCE_TOKEN) {
  try {
    // Create Logtail client with custom endpoint if provided
    const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN, {
      endpoint: process.env.LOGTAIL_ENDPOINT || 'https://in.logs.betterstack.com',
    });

    // Create Logtail transport
    logtailTransport = new LogtailTransport(logtail);
    
    console.log('✅ Logtail integration enabled for BetterStack Telemetry');
  } catch (error) {
    console.error('❌ Failed to initialize Logtail:', error);
  }
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: {
    service: 'salesforce-data-export',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add Logtail transport if available
if (logtailTransport) {
  logger.add(logtailTransport);
}

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'exceptions.log'),
  })
);

// Handle unhandled promise rejections
logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'rejections.log'),
  })
);

// Create service-specific loggers
export const createServiceLogger = (serviceName: string) => {
  return logger.child({
    service: serviceName,
  });
};

export default logger;
