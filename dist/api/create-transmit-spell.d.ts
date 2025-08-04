import { Spell, TokenUtxo, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
export declare function createTransmitSpell(context: IContext, feerate: number, inputUtxos: TokenUtxo[], outputAddress: string, changeAddress: string, amount: number, fundingUtxo?: Utxo): Promise<Spell>;
