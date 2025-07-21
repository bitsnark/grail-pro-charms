import { Network } from './taproot-common';
export declare const DEAD_ROOT_HASH: Buffer<ArrayBufferLike>;
export declare const INTERNAL_PUBLIC_KEY = 36444060476547731421425013472121489344383018981262552973668657287772036414144n;
export declare class SimpleTapTree {
    private network;
    internalPubkey: bigint;
    scripts: Buffer[];
    constructor(scripts: Buffer[], network: Network);
    getRoot(): Buffer;
    getProof(index: number): Buffer;
    getControlBlock(index: number): Buffer;
    getTaprootResults(): {
        pubkey: Buffer;
        address: string;
        output: Buffer;
    };
    getTaprootPubkey(): Buffer;
    getTaprootOutput(): Buffer;
    getTaprootAddress(): string;
}
export declare class Compressor {
    private network;
    private depth;
    private data;
    private nextIndex;
    private indexToSave;
    private indexesForProof;
    private internalPubKey;
    private lastHash;
    script?: Buffer;
    proof: Buffer[];
    total: number;
    count: number;
    constructor(total: number, network: Network, indexToSave?: number);
    setInteralPubKey(internalPubKey: bigint): void;
    private indexStringForLevel;
    private compress;
    addHash(hash: Buffer): void;
    getRoot(): Buffer;
    getTaprootResults(): {
        pubkey: Buffer;
        address: string;
        output: Buffer;
    };
    static toPubKey(internalPubkey: bigint, root: Buffer, network: Network): Buffer;
    getTaprootPubkeyNew(): Buffer;
    getAddress(): string;
    getTaprootPubkey(): Buffer;
    getControlBlock(): Buffer;
}
