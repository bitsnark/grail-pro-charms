import Client from 'bitcoin-core';
import { Utxo } from './types';
export declare class ExtendedClient extends Client {
    constructor(options: any);
    getRawTransaction(txid: string): Promise<any>;
    sendRawTransaction(txHex: string): Promise<string>;
    signTransactionInputs(txHex: string, prevtxs?: string[], sighashType?: string): Promise<any>;
    listUnspent(minconf: number, maxconf: number, addresses: string[]): Promise<any[]>;
    getNewAddress(): Promise<string>;
    loadWallet(name: string): Promise<any>;
    sendToAddress(toAddress: string, amountBtc: number): Promise<string>;
}
export declare class BitcoinClient {
    private client;
    private constructor();
    static initialize(client?: ExtendedClient): Promise<BitcoinClient>;
    getTransactionHex(txid: string): Promise<string>;
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
}
