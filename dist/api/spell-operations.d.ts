import { CosignerSignatures, PreviousTransactions, SignatureRequest, SignatureResponse, Spell, UpdateRequest, Utxo } from '../core/types';
import { KeyPair } from '../core/taproot';
import { GrailState, GeneralizedInfo } from '../core/types';
import { IContext } from '../core/i-context';
import { Network } from '../core/taproot/taproot-common';
export declare function getPreviousGrailState(context: IContext, previousNftTxid: string): Promise<GrailState>;
export declare function getPreviousGrailStateMap(context: IContext, txids: string[]): Promise<{
    [key: string]: GrailState;
}>;
export declare function createUpdatingSpell(context: IContext, request: UpdateRequest, previousTxIds: string[], previousGrailState: GrailState, nextGrailState: GrailState, generalizedInfo: GeneralizedInfo): Promise<Spell>;
export declare function injectSignaturesIntoSpell(context: IContext, spell: Spell, signatureRequest: SignatureRequest, fromCosigners: SignatureResponse[]): Promise<Spell>;
export declare function transmitSpell(context: IContext, transactions: Spell): Promise<[string, string]>;
export declare function getPreviousTransactions(context: IContext, spellTxBytes: Buffer, commitmentTxBytes?: Buffer): Promise<PreviousTransactions>;
export declare function signAsCosigner(context: IContext, request: SignatureRequest, keypair: KeyPair): CosignerSignatures[];
export declare function findUserPaymentVout(context: IContext, grailState: GrailState, userPaymentTxid: string, recoveryPublicKey: string, timelockBlocks: number): Promise<number>;
export declare function getUserWalletAddressFromUserPaymentUtxo(context: IContext, fundingUtxo: Utxo, network: Network): Promise<string>;
