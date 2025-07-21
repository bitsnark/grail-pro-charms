import { GrailState, Spell, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
export declare function createUpdateNftSpell(context: IContext, feeRate: number, previousNftTxid: string, grailState: GrailState, fundingUtxo?: Utxo): Promise<Spell>;
