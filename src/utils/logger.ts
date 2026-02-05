/**
 * Structured Logger with multiple output levels
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: Record<string, any>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

export class Logger {
    private level: LogLevel;
    private enableConsole: boolean;
    private enableFile: boolean;
    private logFilePath?: string;

    constructor(options: {
        level?: LogLevel;
        enableConsole?: boolean;
        enableFile?: boolean;
        logFilePath?: string;
    } = {}) {
        this.level = options.level ?? LogLevel.INFO;
        this.enableConsole = options.enableConsole ?? true;
        this.enableFile = options.enableFile ?? false;
        this.logFilePath = options.logFilePath;
    }

    private formatEntry(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: LogLevel[level],
            message,
        };

        if (context && Object.keys(context).length > 0) {
            entry.context = context;
        }

        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }

        return entry;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.level;
    }

    private write(entry: LogEntry): void {
        const formatted = JSON.stringify(entry);

        if (this.enableConsole) {
            // Color-coded console output
            const colors: Record<string, string> = {
                DEBUG: '\x1b[36m', // Cyan
                INFO: '\x1b[32m',  // Green
                WARN: '\x1b[33m',  // Yellow
                ERROR: '\x1b[31m', // Red
            };
            const reset = '\x1b[0m';
            const color = colors[entry.level] || '';

            console.log(`${color}[${entry.timestamp}] ${entry.level}${reset}: ${entry.message}`);
            if (entry.context) {
                console.log('  Context:', entry.context);
            }
            if (entry.error) {
                console.error('  Error:', entry.error.message);
                if (entry.error.stack) {
                    console.error(entry.error.stack);
                }
            }
        }

        if (this.enableFile && this.logFilePath) {
            // File logging (append mode)
            const fs = require('fs');
            fs.appendFileSync(this.logFilePath, formatted + '\n', 'utf-8');
        }
    }

    debug(message: string, context?: Record<string, any>): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            this.write(this.formatEntry(LogLevel.DEBUG, message, context));
        }
    }

    info(message: string, context?: Record<string, any>): void {
        if (this.shouldLog(LogLevel.INFO)) {
            this.write(this.formatEntry(LogLevel.INFO, message, context));
        }
    }

    warn(message: string, context?: Record<string, any>): void {
        if (this.shouldLog(LogLevel.WARN)) {
            this.write(this.formatEntry(LogLevel.WARN, message, context));
        }
    }

    error(message: string, error?: Error, context?: Record<string, any>): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            this.write(this.formatEntry(LogLevel.ERROR, message, context, error));
        }
    }
}

// Singleton instance
export const logger = new Logger({
    level: process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO,
    enableConsole: true,
    enableFile: false, // Enable in production with proper path
});
