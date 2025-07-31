import { bufferReplacer } from './json';

let debugLevel = parseInt(process.env.DEBUG || '0');

export function setDebugLevel(level: number): void {
	debugLevel = level;
}

export function log(...args: any): void {
	for (const arg of args) {
		if (typeof arg === 'object') {
			process.stdout.write(JSON.stringify(arg, bufferReplacer, 2));
		} else {
			process.stdout.write(String(arg));
		}
	}
	process.stdout.write('\n');
}

export function error(...args: any): void {
	console.error(...args);
}

export function warn(...args: any): void {
	if (debugLevel < 1) return;
	log(...args);
}

export function info(...args: any): void {
	if (debugLevel < 2) return;
	log(...args);
}

export function debug(...args: any): void {
	if (debugLevel < 3) return;
	log(...args);
}

export const logger = {
	log,
	error,
	warn,
	info,
	debug,
	setDebugLevel
};
