import { Network } from './taproot/taproot-common';
import { GrailState, UserPaymentDetails } from './types';
export interface KeyPair {
    publicKey: Buffer;
    privateKey: Buffer;
}
export interface SpendingScript {
    script: Buffer;
    controlBlock: Buffer;
}
export declare function generateSpendingScriptForGrail(grailState: GrailState, network: Network): SpendingScript;
export declare function generateSpendingScriptsForUser(grailState: GrailState, userPaymentDetails: UserPaymentDetails, network: Network): {
    grail: SpendingScript;
    recovery: SpendingScript;
};
export declare function generateUserPaymentAddress(grailState: GrailState, userPaymentDetails: Pick<UserPaymentDetails, 'recoveryPublicKey' | 'timelockBlocks'>, network: Network): string;
export declare function generateGrailPaymentAddress(grailState: GrailState, network: Network): string;
