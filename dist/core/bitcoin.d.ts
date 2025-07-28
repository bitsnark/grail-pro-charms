import Client from 'bitcoin-core';
import { Utxo } from './types';
import { Network } from './taproot/taproot-common';
export declare const DUST_LIMIT = 546;
export declare function txidToHash(txid: string): Buffer;
export declare function hashToTxid(hash: Buffer): string;
export declare function txBytesToTxid(txBytes: Buffer): string;
export declare function txHexToTxid(txHex: string): string;
export declare class ExtendedClient extends Client {
    constructor(options: any);
    getRawTransaction(txid: string): Promise<any>;
    sendRawTransaction(txHex: string): Promise<string>;
    signTransactionInputs(txHex: string, prevtxs?: string[], sighashType?: string): Promise<any>;
    listUnspent(minconf: number, maxconf: number, addresses: string[]): Promise<any[]>;
    getNewAddress(): Promise<string>;
    loadWallet(name: string): Promise<any>;
    sendToAddress(toAddress: string, amountBtc: number): Promise<string>;
    getTxOut(txid: string, vout: number, includeMempool?: boolean): Promise<any>;
}
export declare class BitcoinClient {
    private client;
    private static txhash;
    private constructor();
    static initialize(client?: ExtendedClient): Promise<BitcoinClient>;
    getTransactionHex(txid: string): Promise<string>;
    getTransactionBytes(txid: string): Promise<Buffer>;
    signTransaction(txHex: string, prevtxs?: string[], sighashType?: string): Promise<string>;
    transmitTransaction(txHex: string): Promise<string>;
    listUnspent(address?: string): Promise<{
        spendable: boolean;
        value: number;
        txid: string;
        vout: number;
    }[]>;
    getAddress(): Promise<string>;
    getFundingUtxo(): Promise<Utxo>;
    fundAddress(address: string, amount: number): Promise<string>;
    getTransactionsBytes(txids: string[]): Promise<Buffer[]>;
    getTransactionsMap(txids: string[]): Promise<{
        [txid: string]: Buffer;
    }>;
    isUtxoSpendable(txid: string, vout: number): Promise<boolean>;
    getUserWalletAddressFromFundingUtxo(fundingUtxo: Utxo, network: Network): Promise<string>;
}
