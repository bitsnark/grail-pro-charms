import { GrailState, SignatureRequest, Spell, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
import { UserPaymentDetails } from '../core/types';
export declare function findLockedBtcUtxos(context: IContext, lastNftTxid: string, minAmount: number): Promise<Utxo[]>;
export declare function createPegoutSpell(context: IContext, feerate: number, previousNftTxid: string, nextGrailState: GrailState, userPaymentDetails: UserPaymentDetails, fundingUtxo?: Utxo): Promise<{
    spell: Spell;
    signatureRequest: SignatureRequest;
}>;
