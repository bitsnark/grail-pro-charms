export declare function range(start: number, end: number): number[];
export declare function array<T>(count: number, f?: ((i: number) => T) | T): T[];
export declare function last<T>(a: T[]): T;
export declare function first<T>(a: T[]): T;
export declare function butLast<T>(a: T[]): T[];
export declare function butFirst<T>(a: T[]): T[];
export declare function chunk<T>(arr: T[], size: number): T[][];
export declare function isIn<T>(i: T, a: T[]): boolean;
export declare function unique<T>(a: T[]): T[];
export declare function reverse<T>(a: T[]): T[];
export declare function forEachAsync<T>(a: T[], f: (item: T, index: number) => Promise<void>): Promise<void>;
export declare function mapAsync<T1, T2>(a: T1[], f: (item: T1, index: number) => Promise<T2>): Promise<T2[]>;
export declare function arrayFromArrayWithIndex<T extends {
    index: number;
}>(array: T[]): Exclude<T, 'index'>[];
