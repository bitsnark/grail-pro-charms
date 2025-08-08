import { IContext } from '../core/i-context';
import { TransactionInfoMap } from './types';
export declare function crawl(context: IContext, maxDepth: number, txid: string, transactions?: TransactionInfoMap): Promise<TransactionInfoMap>;
