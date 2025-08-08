import * as bitcoin from 'bitcoinjs-lib';
export declare const taprootVersion = 192;
export declare const SECP256K1_ORDER = 115792089237316195423570985008687907852837564279074904382605163141518161494337n;
export type Network = 'regtest' | 'testnet' | 'mainnet';
export declare const bitcoinjslibNetworks: {
    regtest: bitcoin.networks.Network;
    testnet: bitcoin.networks.Network;
    mainnet: bitcoin.networks.Network;
};
export declare const G: {
    x: bigint;
    y: bigint;
};
export declare function getHash(script: Buffer): Buffer;
export declare function combineHashes(left_h: Buffer, right_h: Buffer): Buffer;
export declare function compactSize(l: number): Buffer;
