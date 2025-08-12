import { IContext } from '../core/i-context';
import { TransactionInfoMap } from './types';
export declare function crawlBack(context: IContext, maxDepth: number, txid: string, transactions?: TransactionInfoMap): Promise<TransactionInfoMap>;
export declare function crawlForward(context: IContext, maxDepth: number, txid: string, transactions?: TransactionInfoMap): Promise<TransactionInfoMap>;
