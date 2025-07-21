import { Spell, Utxo } from './types';
import { IContext } from './i-context';
export declare function getVerificationKey(context: IContext): Promise<string>;
export declare function executeSpell(context: IContext, fundingUtxo: Utxo, changeAddress: string, yamlStr: any, previousTransactions?: Buffer[]): Promise<Spell>;
export declare function showSpell(context: IContext, transactionHex: string, previousTransactions?: Buffer[]): Promise<any>;
