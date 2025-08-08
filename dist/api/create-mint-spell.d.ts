import { SignatureRequest, Spell, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
export declare function createMintSpell(context: IContext, feerate: number, previousNftTxid: string, amount: number, userWalletAddress: string, fundingUtxo?: Utxo): Promise<{
    spell: Spell;
    signatureRequest: SignatureRequest;
}>;
