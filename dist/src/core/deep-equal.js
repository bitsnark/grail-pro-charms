"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOME_STRING = exports.ANY = void 0;
exports.deepEqual = deepEqual;
exports.ANY = [];
exports.SOME_STRING = 'SOME_STRING';
function _deepEqual(a, b, options) {
    if (a === b)
        return true;
    if (a === undefined || b === undefined)
        return false;
    if (b === exports.SOME_STRING && typeof a == 'string')
        return true;
    if (typeof a !== 'object' ||
        a === null ||
        typeof b !== 'object' ||
        b === null)
        return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (!options.ignoreMissingInTarget && keysA.length !== keysB.length)
        return false;
    const allKeys = options.ignoreMissingInTarget
        ? new Set([...keysA, ...keysB])
        : keysB;
    for (const key of allKeys) {
        if (!deepEqual(a[key], b[key], options))
            return false;
    }
    return true;
}
function deepEqual(a, b, options) {
    return _deepEqual(a, b, options || {});
}
