/* eslint-disable  @typescript-eslint/no-explicit-any */
import { parse } from './env-parser';
import { bufferReplacer } from './json';

let debugLevel = parse.integer('DEBUG_LEVEL', 1);
let printDate = parse.boolean('PRINT_DATE', true); // Print date in logs
let printLevel = parse.boolean('PRINT_LEVEL', true); // Print log level in logs

export const DEBUG_LEVELS = {
	LOG: -1,
	ERROR: 0,
	WARN: 1,
	INFO: 2,
	DEBUG: 3,
	ALL: 10,
};

export function setLoggerOptions(
	_debugLevel: number,
	_printDate: boolean,
	_printLevel: boolean
): void {
	debugLevel = _debugLevel;
	printDate = _printDate;
	printLevel = _printLevel;
}

export function print(...args: any): void {
	for (const arg of args) {
		if (typeof arg === 'object') {
			process.stdout.write(JSON.stringify(arg, bufferReplacer, 2));
		} else {
			process.stdout.write(String(arg));
		}
	}
	process.stdout.write('\n');
}

function inject(args: any[], level: number) {
	if (printLevel)
		args.unshift((['ERROR', 'WARN', 'INFO', 'DEBUG'][level] ?? '') + ' ');
	if (printDate) args.unshift(`${new Date().toISOString()} `);
}

export function error(...args: any): void {
	inject(args, DEBUG_LEVELS.ERROR);
	console.error(...args);
}

export function log(...args: any): void {
	inject(args, DEBUG_LEVELS.LOG);
	print(...args);
}

export function warn(...args: any): void {
	if (debugLevel < DEBUG_LEVELS.WARN) return;
	inject(args, DEBUG_LEVELS.WARN);
	print(...args);
}

export function info(...args: any): void {
	if (debugLevel < DEBUG_LEVELS.INFO) return;
	inject(args, DEBUG_LEVELS.INFO);
	print(...args);
}

export function debug(...args: any): void {
	if (debugLevel < DEBUG_LEVELS.DEBUG) return;
	inject(args, DEBUG_LEVELS.DEBUG);
	print(...args);
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function devnull(...args: any): void {}

export const logger = {
	log,
	error,
	warn,
	info,
	debug,
	devnull,
	setLoggerOptions,
};
