import { GeneralizedInfo, GrailState, SignatureRequest, Spell, TokenDetails, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
export declare function createGeneralizedSpell(context: IContext, feerate: number, previousNftTxid: string, nextGrailState: GrailState, generalizedInfo: GeneralizedInfo, tokenDetails?: TokenDetails, fundingUtxo?: Utxo): Promise<{
    spell: Spell;
    signatureRequest: SignatureRequest;
}>;
