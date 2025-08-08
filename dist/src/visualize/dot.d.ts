import { TransactionInfoMap } from './types';
import { IContext } from '../core/i-context';
export declare function dot(context: IContext, transactionMap: TransactionInfoMap, out?: {
    log: (s: string) => void;
}): Promise<void>;
