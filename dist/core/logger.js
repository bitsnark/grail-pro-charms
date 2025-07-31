"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.setDebugLevel = setDebugLevel;
exports.log = log;
exports.error = error;
exports.warn = warn;
exports.info = info;
exports.debug = debug;
const json_1 = require("./json");
let debugLevel = parseInt(process.env.DEBUG || '0');
function setDebugLevel(level) {
    debugLevel = level;
}
function log(...args) {
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
function error(...args) {
    console.error(...args);
}
function warn(...args) {
    if (debugLevel < 1)
        return;
    log(...args);
}
function info(...args) {
    if (debugLevel < 2)
        return;
    log(...args);
}
function debug(...args) {
    if (debugLevel < 3)
        return;
    log(...args);
}
exports.logger = {
    log,
    error,
    warn,
    info,
    debug,
    setDebugLevel
};
