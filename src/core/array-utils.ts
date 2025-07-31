export function range(start: number, end: number): number[] {
	return new Array(end - start).fill(0).map((_, i) => i);
}

export function array<T>(count: number, f?: ((i: number) => T) | T): T[] {
	if (f && typeof f == 'function')
		return new Array(count).fill(0).map((_, i) => (f as (i: number) => T)(i));
	return new Array(count).fill(f);
}

export function last<T>(a: T[]): T {
	return a[a.length - 1];
}

export function first<T>(a: T[]): T {
	return a[0];
}

export function butLast<T>(a: T[]): T[] {
	return a.slice(0, a.length - 1);
}

export function butFirst<T>(a: T[]): T[] {
	return a.slice(1);
}

export function chunk<T>(arr: T[], size: number): T[][] {
	const chunks = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

export function isIn<T>(i: T, a: T[]): boolean {
	return a.find(t => t == i) != undefined;
}

export function unique<T>(a: T[]): T[] {
	return a.filter((item, index) => a.indexOf(item) === index);
}

export function reverse<T>(a: T[]): T[] {
	return a.slice().reverse();
}

export async function forEachAsync<T>(
	a: T[],
	f: (item: T, index: number) => Promise<void>
): Promise<void> {
	for (let i = 0; i < a.length; i++) {
		await f(a[i], i);
	}
}

export async function mapAsync<T1, T2>(
	a: T1[],
	f: (item: T1, index: number) => Promise<T2>
): Promise<T2[]> {
	const results: T2[] = [];
	for (let i = 0; i < a.length; i++) {
		results.push(await f(a[i], i));
	}
	return results;
}

export async function filterAsync<T>(
	a: T[],
	f: (item: T, index: number) => Promise<boolean>
): Promise<T[]> {
	const results: T[] = [];
	for (let i = 0; i < a.length; i++) {
		if (await f(a[i], i)) results.push(a[i]);
	}
	return results;
}

export function arrayFromArrayWithIndex<T extends { index: number }>(
	array: T[]
): Exclude<T, 'index'>[] {
	return array.reduce(
		(acc, item) => {
			const { index, ...itemWithoutIndex } = item;
			acc[index] = itemWithoutIndex as Exclude<T, 'index'>;
			return acc;
		},
		[] as Exclude<T, 'index'>[]
	);
}
