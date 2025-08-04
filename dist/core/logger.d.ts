export declare const DEBUG_LEVELS: {
    LOG: number;
    ERROR: number;
    WARN: number;
    INFO: number;
    DEBUG: number;
    ALL: number;
};
export declare function setLoggerOptions(_debugLevel: number, _printDate: boolean, _printLevel: boolean): void;
export declare function print(...args: any): void;
export declare function error(...args: any): void;
export declare function log(...args: any): void;
export declare function warn(...args: any): void;
export declare function info(...args: any): void;
export declare function debug(...args: any): void;
export declare const logger: {
    log: typeof log;
    error: typeof error;
    warn: typeof warn;
    info: typeof info;
    debug: typeof debug;
    setLoggerOptions: typeof setLoggerOptions;
};
