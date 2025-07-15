import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress } from '../core/taproot';
import { DeployRequest } from '../core/types';
import { getVerificationKey } from '../core/charms-sdk';
import config from '../config';
import { sha256 } from 'bitcoinjs-lib/src/crypto';
import { setupLog } from './utils/log';
import { Network } from '../core/taproot/taproot-common';

export async function deployNft(
	network: Network,
	feeRate: number,
	deployerPublicKey: Buffer,
	transmit: boolean
) {
	const bitcoinClient = await BitcoinClient.create();

	const initialNftState = {
		publicKeys: [deployerPublicKey.toString('hex')],
		threshold: 1,
	};

	const grailAddress = generateGrailPaymentAddress(initialNftState, network);
	const fundingChangeAddress = await bitcoinClient.getAddress();
	const fundingUtxo = await bitcoinClient.getFundingUtxo();

	const appId = sha256(
		Buffer.from(`${fundingUtxo.txid}:${fundingUtxo.vout}`, 'ascii')
	).toString('hex');
	console.log('App ID:', appId);

	const appVk = await getVerificationKey();
	console.log('App Verification Key:', appVk);

	const request: DeployRequest = {
		fundingUtxo,
		fundingChangeAddress,
		feeRate,
		nextNftAddress: grailAddress,
		currentNftState: {
			publicKeysAsString: initialNftState.publicKeys.join(','),
			threshold: initialNftState.threshold,
		},

		toYamlObj: function () {
			return {
				version: 4,
				apps: { $00: `n/${appId}/${appVk}` },
				private_inputs: { $00: `${fundingUtxo.txid}:${fundingUtxo.vout}` },
				public_inputs: { $00: { action: 'deploy' } },
				ins: [],
				outs: [
					{
						address: this.nextNftAddress,
						charms: {
							$00: {
								ticker: config.ticker,
								current_cosigners: this.currentNftState.publicKeysAsString,
								current_threshold: this.currentNftState.threshold,
							},
						},
					},
				],
			};
		},
	};

	const spell = await createSpell(bitcoinClient, [], request);

	if (transmit) {
		const txids = await transmitSpell(bitcoinClient, spell);

		config.appId = appId;
		config.appVk = appVk;
		config.firstNftTxid = txids[1];
		config.latestNftTxid = txids[1];
		console.log('Update your config: \n' + JSON.stringify(config, null, 2));
	}
}

async function main() {
	setupLog();

	const argv = minimist(process.argv.slice(2), {
		alias: {},
		default: {
			network: config.network,
			feerate: config.feerate,
			'deployer-public-key': config.deployerPublicKey,
			transmit: true,
		},
		'--': true,
	});

	const network = argv['network'] as Network;
	const feeRate = Number.parseInt(argv['feerate']);
	const deployerPublicKey = Buffer.from(argv['deployer-public-key'], 'hex');
	const transmit = !!argv['transmit'];

	await deployNft(network, feeRate, deployerPublicKey, transmit);
}

if (require.main === module) {
	main().catch(error => {
		console.error('Error during NFT deployment:', error);
	});
}
