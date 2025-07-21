import { Utxo } from './types';
export declare class BitcoinClient {
    private client;
    private constructor();
    static create(): Promise<BitcoinClient>;
    private initialize;
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
