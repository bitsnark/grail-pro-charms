import { BitcoinClient } from './bitcoin';
import { Network } from './taproot/taproot-common';
export interface IContext {
    charmsBin: string;
    zkAppBin: string;
    appId: string;
    appVk: string;
    ticker: string;
    network: Network;
    mockProof?: boolean;
    temporarySecret: Buffer;
    bitcoinClient: BitcoinClient;
}
