import * as bitcoin from 'bitcoinjs-lib';
export interface TransactionInfo {
    txid: string;
    tx: bitcoin.Transaction;
    bytes: Buffer;
    spell?: any;
}
export type TransactionInfoMap = {
    [txid: string]: TransactionInfo;
};
