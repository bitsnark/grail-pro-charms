"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.DEBUG_LEVELS = void 0;
exports.setLoggerOptions = setLoggerOptions;
exports.print = print;
exports.error = error;
exports.log = log;
exports.warn = warn;
exports.info = info;
exports.debug = debug;
const json_1 = require("./json");
let debugLevel = parseInt(process.env.DEBUG || '0');
let printDate = false;
let printLevel = false;
exports.DEBUG_LEVELS = {
    LOG: -1,
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    ALL: 10,
};
function setLoggerOptions(_debugLevel, _printDate, _printLevel) {
    debugLevel = _debugLevel;
    printDate = _printDate;
    printLevel = _printLevel;
}
function print(...args) {
    for (const arg of args) {
        if (typeof arg === 'object') {
            process.stdout.write(JSON.stringify(arg, json_1.bufferReplacer, 2));
        }
        else {
            process.stdout.write(String(arg));
        }
    }
    process.stdout.write('\n');
}
function inject(args, level) {
    if (printLevel)
        args.unshift((['ERROR', 'WARN', 'INFO', 'DEBUG'][level] ?? '') + ' ');
    if (printDate)
        args.unshift(`${new Date().toISOString()} `);
}
function error(...args) {
    inject(args, exports.DEBUG_LEVELS.ERROR);
    console.error(...args);
}
function log(...args) {
    inject(args, exports.DEBUG_LEVELS.LOG);
    print(...args);
}
function warn(...args) {
    inject(args, exports.DEBUG_LEVELS.WARN);
    print(...args);
}
function info(...args) {
    inject(args, exports.DEBUG_LEVELS.INFO);
    print(...args);
}
function debug(...args) {
    inject(args, exports.DEBUG_LEVELS.DEBUG);
    print(...args);
}
exports.logger = {
    log,
    error,
    warn,
    info,
    debug,
    setLoggerOptions,
};
