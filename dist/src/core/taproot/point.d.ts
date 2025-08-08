interface Point {
    x: bigint;
    y: bigint;
}
export declare function modPow(x: bigint, y: bigint, p: bigint): bigint;
export declare function lift_x(x: bigint): Point;
export declare function hasEvenY(P: Point | null): boolean;
export declare function pointAdd(P1: Point | null, P2: Point | null): Point | null;
export declare function pointMul(P: Point | null, n: bigint): Point | null;
export {};
