import * as bitcoin from 'bitcoinjs-lib';
import { SpellMetadata } from '../core/types';
export interface TransactionInfo {
    txid: string;
    tx: bitcoin.Transaction;
    bytes: Buffer;
    spell?: SpellMetadata;
}
export type TransactionInfoMap = {
    [txid: string]: TransactionInfo;
};
