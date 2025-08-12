import { parse } from '../core/env-parser';
import { Network } from '../core/taproot/taproot-common';

export interface Config {
	network: Network;
	mockProof: boolean;
}

export const config: Config = {
	network: parse.string('BTC_NETWORK', 'regtest') as Network,
	mockProof: true,
};
