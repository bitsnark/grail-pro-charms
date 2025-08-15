import dotenv from 'dotenv';
import { parse } from '../core/env-parser';
import { Network } from '../core/taproot/taproot-common';

dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

export interface Config {
	network: Network;
	mockProof: boolean;
}

export const config: Config = {
	network: parse.string('BTC_NETWORK', 'regtest') as Network,
	mockProof: true,
};
