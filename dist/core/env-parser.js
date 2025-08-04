"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = void 0;
const logger_1 = require("./logger");
function parseEnv(name, parser, defaultValue) {
    const value = process.env[name];
    if (value === undefined) {
        if (defaultValue === undefined) {
            throw new Error(`Missing environment variable: '${name}'`);
        }
        return defaultValue;
    }
    try {
        return parser(value);
    }
    catch (e) {
        const error = e;
        logger_1.logger.error(`Error parsing environment variable '${name}': ${error.message}`);
        throw new Error(`${error.message} for environment variable: '${name}'`);
    }
}
function makeParsingError(value, type) {
    return new Error(`Invalid ${type} value: '${value}'`);
}
function parseString(value) {
    if (value === '') {
        throw makeParsingError(value, 'string');
    }
    return value;
}
function parseInteger(value) {
    const parsed = parseFloat(value);
    if (!Number.isInteger(parsed)) {
        throw makeParsingError(value, 'integer');
    }
    return parsed;
}
function parseBigInt(value) {
    if (value === '') {
        throw makeParsingError(value, 'bigint');
    }
    try {
        return BigInt(value);
    }
    catch {
        throw makeParsingError(value, 'bigint');
    }
}
function parseBoolean(value) {
    const TRUE_VALUES = new Set(['true', 't', '1', 'yes', 'y', 'on']);
    const FALSE_VALUES = new Set(['false', 'f', '0', 'no', 'n', 'off']);
    const lowerValue = value.toLowerCase();
    if (TRUE_VALUES.has(lowerValue))
        return true;
    if (FALSE_VALUES.has(lowerValue))
        return false;
    throw makeParsingError(value, 'boolean');
}
function parseNumber(value) {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
        throw makeParsingError(value, 'number');
    }
    return parsed;
}
exports.parse = {
    string: (name, defaultValue) => parseEnv(name, parseString, defaultValue),
    integer: (name, defaultValue) => parseEnv(name, parseInteger, defaultValue),
    bigint: (name, defaultValue) => parseEnv(name, parseBigInt, defaultValue),
    boolean: (name, defaultValue) => parseEnv(name, parseBoolean, defaultValue),
    number: (name, defaultValue) => parseEnv(name, parseNumber, defaultValue),
};
