import { CharmerRequest, Spell } from './types';
import { KeyPair } from './taproot';
import { IContext } from './i-context';
export declare function txidToHash(txid: string): Buffer;
export declare function hashToTxid(hash: Buffer): string;
export declare function txBytesToTxid(txBytes: Buffer): string;
export declare function txHexToTxid(txHex: string): string;
export declare function getStateFromNft(context: IContext, nftTxId: string): Promise<{
    publicKeys: string[];
    threshold: number;
}>;
export declare function signTransactionInput(context: IContext, txBytes: Buffer, inputIndex: number, script: Buffer, previousTxBytesMap: {
    [txid: string]: Buffer;
}, keypair: KeyPair): Buffer;
export declare function resignSpellWithTemporarySecret(context: IContext, spellTxBytes: Buffer, previousTxBytesMap: {
    [txid: string]: Buffer;
}, temporarySecret: Buffer): Promise<Buffer>;
export declare function createSpell(context: IContext, previousTxids: string[], request: CharmerRequest): Promise<Spell>;
