import { GrailState, SignatureRequest, Spell, UserPaymentDetails, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
export declare function createPeginSpell(context: IContext, feerate: number, previousNftTxid: string, nextGrailState: GrailState, userPaymentDetails: UserPaymentDetails, fundingUtxo?: Utxo): Promise<{
    spell: Spell;
    signatureRequest: SignatureRequest;
}>;
