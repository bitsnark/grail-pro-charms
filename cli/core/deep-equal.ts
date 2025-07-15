export const ANY = [];

export interface DeepEqualOptions {
	ignoreMissingInTarget?: boolean;
}

export const SOME_STRING = 'SOME_STRING';

function _deepEqual(a: any, b: any, options: DeepEqualOptions): boolean {
	if (a === b) return true;
	if (a === undefined || b === undefined) return false;
	if (b === SOME_STRING && typeof a == 'string') return true;
	if (
		typeof a !== 'object' ||
		a === null ||
		typeof b !== 'object' ||
		b === null
	)
		return false;
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (!options.ignoreMissingInTarget && keysA.length !== keysB.length)
		return false;
	const allKeys = options.ignoreMissingInTarget
		? new Set([...keysA, ...keysB])
		: keysB;
	for (const key of allKeys) {
		if (!deepEqual(a[key], b[key], options)) return false;
	}
	return true;
}

export function deepEqual<T>(a: T, b: T, options: DeepEqualOptions): boolean {
	return _deepEqual(a, b, options || {});
}
