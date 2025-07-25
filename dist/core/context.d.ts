import { IContext } from './i-context';
import { Network } from './taproot/taproot-common';
import { BitcoinClient } from './bitcoin';
import { Utxo } from './types';
export declare class Context implements IContext {
    charmsBin: string;
    zkAppBin: string;
    appId: string;
    appVk: string;
    ticker: string;
    network: Network;
    mockProof: boolean;
    temporarySecret: Buffer<ArrayBufferLike>;
    bitcoinClient: BitcoinClient;
    private constructor();
    static create(obj: Partial<IContext>): Promise<Context>;
    static createForDeploy(obj: Partial<Exclude<IContext, ['appId']>>, fundingUtxo: Utxo): Promise<Context>;
}
