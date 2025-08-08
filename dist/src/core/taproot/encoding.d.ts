export interface Key {
    prvt: bigint;
    pblc: bigint;
}
export declare function strToBigint(s: string): bigint;
export declare function bufferToBigints256BE(buffer: Buffer): bigint[];
export declare function bufferToBigintsBE(buffer: Buffer, size: number): bigint[];
export declare function padHex(s: string, bytes: number): string;
export declare function cat(buffers: Buffer[]): Buffer;
export declare function hash(input: bigint, times?: number): bigint;
export declare function hashPair(inputA: bigint, inputB: bigint): bigint;
export declare function taggedHash(tag: string, msg: Buffer): Buffer;
export declare function bigintFromBytes(buf: Buffer): bigint;
export declare function bytesFromBigint(n: bigint): Buffer;
export declare function bitsToBigint(bits: number[]): bigint;
export declare function _256To32LE(n: bigint): bigint[];
export declare function _256To32BE(n: bigint): bigint[];
export declare function _32To256LE(na: bigint[]): bigint;
export declare function _32To256BE(na: bigint[]): bigint;
export declare function bigintToString(n: bigint, bits?: number): string;
export declare function stringToBigint(s: string): bigint;
export declare function numToStr2Digits(i: number): string;
export declare function bufferToBigint160(b: Buffer): bigint;
export declare function bufferToBigintBE(buffer: Buffer): bigint;
export declare function bigintToBufferBE(n: bigint, bits: number): Buffer;
