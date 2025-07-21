import { CharmerRequest, Spell } from './types';
import { KeyPair } from './taproot';
import { GrailState, LabeledSignature, UserPaymentDetails } from './types';
import { Network } from './taproot/taproot-common';
import { IContext } from './i-context';
export declare function txidToHash(txid: string): Buffer;
export declare function hashToTxid(hash: Buffer): string;
export declare function txBytesToTxid(txBytes: Buffer): string;
export declare function txHexToTxid(txHex: string): string;
export declare function getStateFromNft(context: IContext, nftTxId: string): Promise<{
    publicKeys: string[];
    threshold: number;
}>;
export declare function signTransactionInput(txBytes: Buffer, inputIndex: number, script: Buffer, previousTxBytesMap: {
    [txid: string]: Buffer;
}, keyPairs: KeyPair[], threshold: number): Promise<LabeledSignature[]>;
export declare function grailSignSpellNftInput(spell: Spell, inputIndex: number, grailState: GrailState, keyPairs: KeyPair[], network: Network): Promise<LabeledSignature[]>;
export declare function grailSignSpellUserInput(spell: Spell, inputIndex: number, grailState: GrailState, userPaymentDetails: UserPaymentDetails, keyPairs: KeyPair[], network: Network): Promise<LabeledSignature[]>;
export declare function injectGrailSignaturesIntoTxInput(txBytes: Buffer, inputIndex: number, grailState: GrailState, signatures: LabeledSignature[]): Buffer;
export declare function resignSpellWithTemporarySecret(spellTxBytes: Buffer, previousTxBytesMap: {
    [txid: string]: Buffer;
}, temporarySecret: Buffer): Promise<Buffer>;
export declare function createSpell(context: IContext, previousTxids: string[], request: CharmerRequest): Promise<Spell>;
