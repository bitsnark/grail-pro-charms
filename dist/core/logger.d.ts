export declare function setDebugLevel(level: number): void;
export declare function log(...args: any): void;
export declare function error(...args: any): void;
export declare function warn(...args: any): void;
export declare function info(...args: any): void;
export declare function debug(...args: any): void;
export declare const logger: {
    log: typeof log;
    error: typeof error;
    warn: typeof warn;
    info: typeof info;
    debug: typeof debug;
    setDebugLevel: typeof setDebugLevel;
};
