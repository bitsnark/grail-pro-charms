import { CharmerRequest, GrailState, Spell, TokenUtxo, Utxo } from './types';
import { KeyPair } from './taproot';
import { IContext } from './i-context';
export declare function getStateFromNft(context: IContext, nftTxId: string): Promise<GrailState | null>;
export declare function getCharmsAmountFromUtxo(context: IContext, utxo: Utxo): Promise<number>;
export declare function signTransactionInput(context: IContext, txBytes: Buffer, inputIndex: number, script: Buffer, previousTxBytesMap: {
    [txid: string]: Buffer;
}, keypair: KeyPair): Buffer;
export declare function resignSpellWithTemporarySecret(context: IContext, spellTxBytes: Buffer, previousTxBytesMap: {
    [txid: string]: Buffer;
}, temporarySecret: Buffer): Promise<Buffer>;
export declare function createSpell(context: IContext, previousTxids: string[], request: CharmerRequest): Promise<Spell>;
export declare function getTokenInfoForUtxo(context: IContext, utxo: Utxo): Promise<{
    amount: number;
}>;
export declare function findCharmsUtxos(context: IContext, minTotal: number, utxos?: Utxo[]): Promise<TokenUtxo[]>;
