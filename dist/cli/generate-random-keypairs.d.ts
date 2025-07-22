import { Buffer } from 'node:buffer';
interface Keypair {
    publicKey: Buffer;
    privateKey: Buffer;
}
export declare function publicFromPrivate(privateKey: Buffer): Buffer;
export declare function privateToKeypair(privateKey: Buffer): Keypair;
export declare function generateRandomKeypair(): Keypair;
export declare function generateRandomKeypairs(size: number): Keypair[];
export {};
