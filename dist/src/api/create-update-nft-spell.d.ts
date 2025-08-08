import { IContext } from '../core/i-context';
import { GrailState, SignatureRequest, Spell, Utxo } from '../core/types';
export declare function createUpdateNftSpell(context: IContext, feerate: number, previousNftTxid: string, grailState: GrailState, fundingUtxo?: Utxo): Promise<{
    spell: Spell;
    signatureRequest: SignatureRequest;
}>;
