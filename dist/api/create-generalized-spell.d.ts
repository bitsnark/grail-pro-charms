import { GeneralizedInfo, GrailState, SignatureRequest, Spell, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
export declare function createGeneralizedSpell(context: IContext, feerate: number, previousNftTxid: string, nextGrailState: GrailState, generalizedInfo: GeneralizedInfo, fundingUtxo?: Utxo): Promise<{
    spell: Spell;
    signatureRequest: SignatureRequest;
}>;
