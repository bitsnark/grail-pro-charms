export declare const ANY: never[];
export interface DeepEqualOptions {
    ignoreMissingInTarget?: boolean;
}
export declare const SOME_STRING = "SOME_STRING";
export declare function deepEqual<T>(a: T, b: T, options: DeepEqualOptions): boolean;
