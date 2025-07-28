import { GrailState, SignatureRequest, Spell, UserPaymentDetails, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
export declare function findLockedBtcUtxos(context: IContext, lestNftTxid: string, minAmount: number): Promise<Utxo[]>;
export declare function createPegoutSpell(context: IContext, feerate: number, previousNftTxid: string, nextGrailState: GrailState, userPaymentDetails: UserPaymentDetails, fundingUtxo?: Utxo): Promise<{
    spell: Spell;
    signatureRequest: SignatureRequest;
}>;
