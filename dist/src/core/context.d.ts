import { IContext } from './i-context';
import { Network } from './taproot/taproot-common';
import { Utxo } from './types';
import { BitcoinClient } from './bitcoin';
export declare class Context implements IContext {
    charmsBin: string;
    zkAppBin: string;
    appId: string;
    appVk: string;
    network: Network;
    mockProof: boolean;
    skipProof: boolean;
    temporarySecret: Buffer<ArrayBufferLike>;
    bitcoinClient: BitcoinClient;
    private constructor();
    static create(obj: Partial<IContext>): Promise<Context>;
    static createForDeploy(obj: Partial<Exclude<IContext, ['appId']>>, fundingUtxo: Utxo): Promise<Context>;
    static createForVisualize(obj: Partial<IContext>): Promise<Context>;
}
