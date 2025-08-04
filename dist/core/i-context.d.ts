import Client from 'bitcoin-core';
import { Network } from './taproot/taproot-common';
import { BitcoinClient } from './bitcoin';
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
    core?: Client;
}
