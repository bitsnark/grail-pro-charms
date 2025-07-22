import { GrailState, Spell, UserPaymentDetails, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
export declare function createPeginSpell(context: IContext, feeRate: number, previousNftTxid: string, nextGrailState: GrailState, userPaymentDetails: UserPaymentDetails, userWalletAddress: string, fundingUtxo?: Utxo): Promise<Spell>;
