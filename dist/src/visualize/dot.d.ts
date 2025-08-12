import { TransactionInfoMap } from './types';
import { IContext } from '../core/i-context';
export declare function dot(context: IContext, txid: string, transactionMap: TransactionInfoMap, out?: {
    log: (s: string) => void;
}): Promise<void>;
