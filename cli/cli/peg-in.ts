import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import {
	generateGrailPaymentAddress,
	generateSpendingScriptForGrail,
	generateSpendingScriptsForUser,
	KeyPair,
} from '../core/taproot';
import {
	GrailState,
	PegInRequest,
	Spell,
	UserPaymentDetails,
} from '../core/types';
import { showSpell } from '../core/charms-sdk';
import * as bitcoin from 'bitcoinjs-lib';
import {
	getStateFromNft,
	grailSignSpellNftInput,
	grailSignSpellUserInput,
	hashToTxid,
	injectGrailSignaturesIntoTxInput,
	resignSpellWithTemporarySecret,
	txBytesToTxid,
	txidToHash,
} from './utils/signing';
import config from '../config';
import { Network } from '../core/taproot/taproot-common';
import { setupLog } from './utils/log';
import { bufferReplacer } from '../core/json';
import { randomBytes } from 'node:crypto';

async function checkInputsAndOutputs(txBytes: Buffer) {
	const bitcoinClient = await BitcoinClient.create();
	const tx = bitcoin.Transaction.fromBuffer(txBytes);
	let totalInputValue = 0;
	for (const input of tx.ins) {
		const previousTxHex = await bitcoinClient.getTransactionHex(
			hashToTxid(input.hash)
		);
		const prevTx = bitcoin.Transaction.fromHex(previousTxHex);
		if (!prevTx.outs[input.index]) {
			throw new Error(
				`Input index ${input.index} out of bounds for transaction ${hashToTxid(
					input.hash
				)}`
			);
		}
		totalInputValue += prevTx.outs[input.index].value;
	}
	let totalOutputValue = 0;
	for (const output of tx.outs) {
		totalOutputValue += output.value;
	}
	console.log(
		`Total input value: ${totalInputValue}, Total output value: ${totalOutputValue}, Fee: ${
			totalInputValue - totalOutputValue
		}`
	);
}

function jsonUnhex(obj: any): any {
	if (typeof obj === 'string' && obj.startsWith('0x')) {
		return Buffer.from(obj.slice(2), 'hex');
	} else if (Array.isArray(obj)) {
		return obj.map(jsonUnhex);
	} else if (typeof obj === 'object' && obj !== null) {
		const newObj: any = {};
		for (const key in obj) {
			newObj[key] = jsonUnhex(obj[key]);
		}
		return newObj;
	}
	return obj;
}

async function prepareSpell(
	spell: Spell,
	previousGrailState: GrailState,
	nextGrailState: GrailState,
	userPaymentDetails: UserPaymentDetails | null,
	keyPairs: KeyPair[],
	network: Network,
	temporarySecret: Buffer
): Promise<Spell> {
	// Clone it so we own it
	spell = { ...spell };

	const inputIndexNft = 0; // Assuming the first input is the NFT input

	const spellTx = bitcoin.Transaction.fromBuffer(spell.spellTxBytes);

	const spendingScriptGrail = generateSpendingScriptForGrail(
		previousGrailState,
		network
	);
	spellTx.ins[inputIndexNft].witness = [
		// bitcoin.script.compile([bitcoin.opcodes.OP_CODESEPARATOR]),
		spendingScriptGrail.script,
		spendingScriptGrail.controlBlock,
	];

	if (userPaymentDetails) {
		const bitcoinClient = await BitcoinClient.create();

		const userPaymentTxHex = await bitcoinClient.getTransactionHex(
			userPaymentDetails.txid
		);
		const userPaymentTx = bitcoin.Transaction.fromHex(userPaymentTxHex);
		const userPaymentOutput = userPaymentTx.outs[userPaymentDetails.vout];

		const inputIndexUser = 1; // Assuming the second input is the user payment input

		const spendingScriptUser = generateSpendingScriptsForUser(
			nextGrailState,
			userPaymentDetails,
			network
		);
		spellTx.ins[inputIndexUser] = {
			hash: txidToHash(userPaymentDetails.txid),
			index: userPaymentDetails.vout,
			script: Buffer.from(''),
			sequence: 0xffffffff,
			witness: [
				// bitcoin.script.compile([bitcoin.opcodes.OP_CODESEPARATOR]),
				spendingScriptUser.grail.script,
				spendingScriptUser.grail.controlBlock,
			],
		};
	}

	spell.spellTxBytes = spellTx.toBuffer();

	// Now we can sign and inject the signatures into the transaction inputs

	const nftInputSignatures = await grailSignSpellNftInput(
		spell,
		inputIndexNft,
		previousGrailState,
		keyPairs,
		network
	);
	spell.spellTxBytes = injectGrailSignaturesIntoTxInput(
		spell.spellTxBytes,
		inputIndexNft,
		previousGrailState,
		nftInputSignatures
	);

	// const ttrx = bitcoin.Transaction.fromBuffer(spell.spellTxBytes);
	// console.log(ttrx);

	if (userPaymentDetails) {
		const inputIndexUser = 1; // Assuming the second input is the user payment input

		const userInputSignatures = await grailSignSpellUserInput(
			spell,
			inputIndexUser,
			nextGrailState,
			userPaymentDetails,
			keyPairs,
			network
		);
		spell.spellTxBytes = injectGrailSignaturesIntoTxInput(
			spell.spellTxBytes,
			inputIndexUser,
			nextGrailState,
			userInputSignatures
		);
	}

	const commitmentTxid = txBytesToTxid(spell.commitmentTxBytes);

	if (userPaymentDetails && temporarySecret) {
		spell.spellTxBytes = await resignSpellWithTemporarySecret(
			spell.spellTxBytes,
			{ [commitmentTxid]: spell.commitmentTxBytes },
			temporarySecret
		);
	}

	return spell;
}

export async function createPegInSpell(
	feeRate: number,
	previousNftTxid: string,
	nextGrailState: GrailState,
	userPaymentDetails: UserPaymentDetails,
	userWalletAddress: string,
	temporarySecret: Buffer,
	network: Network
): Promise<Spell> {
	const bitcoinClient = await BitcoinClient.create();

	const previousNftTxhex =
		await bitcoinClient.getTransactionHex(previousNftTxid);
	if (!previousNftTxhex) {
		throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
	}

	const grailAddress = generateGrailPaymentAddress(nextGrailState, network);
	const fundingChangeAddress = await bitcoinClient.getAddress();
	const fundingUtxo = await bitcoinClient.getFundingUtxo();

	const previousSpellData = await showSpell(previousNftTxhex);
	console.log(
		'Previous NFT spell:',
		JSON.stringify(previousSpellData, null, '\t')
	);

	const previousPublicKeys =
		previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
	const previousThreshold =
		previousSpellData.outs[0].charms['$0000'].current_threshold;

	const userPaymentTxHex = await bitcoinClient.getTransactionHex(
		userPaymentDetails.txid
	);
	if (!userPaymentTxHex) {
		throw new Error(
			`User payment transaction ${userPaymentDetails.txid} not found`
		);
	}
	const userPaymenTx = bitcoin.Transaction.fromHex(userPaymentTxHex);
	const userPaymentAmount = userPaymenTx.outs[0].value;
	console.log('User payment transaction amount:', userPaymentAmount);

	const request: PegInRequest = {
		fundingUtxo,
		fundingChangeAddress,
		feeRate,
		previousNftTxid,
		nextNftAddress: grailAddress,
		currentNftState: {
			publicKeysAsString: nextGrailState.publicKeys.join(','),
			threshold: nextGrailState.threshold,
		},
		amount: userPaymentAmount,
		userWalletAddress,

		toYamlObj: function () {
			return {
				version: 4,
				apps: {
					$00: `n/${config.appId}/${config.appVk}`,
					$01: `t/${config.appId}/${config.appVk}`,
				},
				public_inputs: {
					$00: { action: 'update' },
					$01: { action: 'mint' },
				},
				ins: [
					{
						utxo_id: `${previousNftTxid}:0`,
						charms: {
							$00: {
								ticker: config.ticker,
								current_cosigners: previousPublicKeys.join(','),
								current_threshold: previousThreshold,
							},
						},
					},
					{
						utxo_id: `${userPaymentDetails.txid}:${userPaymentDetails.vout}`,
					},
				],
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
					{
						address: this.nextNftAddress,
						amount: this.amount,
					},
					{
						address: this.userWalletAddress,
						charms: {
							$01: {
								amount: this.amount,
							},
						},
					},
				],
			};
		},
	};

	const spell = await createSpell(
		bitcoinClient,
		[previousNftTxid, userPaymentDetails?.txid].filter(t => t),
		request,
		temporarySecret
	);
	// const spell = jsonUnhex({
	// 	commitmentTxBytes:
	// 		'0x0200000001e3fe6beefc1ccb6c9087494a61ff959b0d5201379b23f667bd26edebd2a2da4c0000000000ffffffff01a27b814a000000002251204e5a77ffeb22225a3cdbe4076a23039a164cb723a7d5b97160decf59f6f6ca7a00000000',
	// 	spellTxBytes:
	// 		'0x020000000001025ca5e7c7290405a42c256d7de72830a7537a0f836f6bbbafe7a4b711058abde30000000000ffffffffebadf3ac248d5f5f0a7bd01bca48c398baf0c0cb1f7270653d20a0aa813f36c30000000000ffffffff04e8030000000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e2f547774a000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e2e8030000000000001600140c2ba5242064097fe376ac41be7c892a7abec8fa602b0a0000000000160014f5d18899ce75086119b1522e13ef553074639e1b00034125e1f7f345935b6c88e3b6602d9d481c956dc8bb459cf3beed7e37a2e02b644d52782c5c097922e7cc1435a9b8c00c4b128f823905cbd667ed510530a3e88cdb81fd2d040063057370656c6c4d080282a36776657273696f6e04627478a2647265667380646f75747383a100a3667469636b657269475241494c2d4e46547163757272656e745f636f7369676e6572737881666636316530666333623735336163623463333239343334353264303962386636643165353861303565396565313430643765373634343161616237306334632c623935353532613666613631656135363137316536653236306364626135376432353062343462613132333464633932386131373736393866336630313664617163757272656e745f7468726573686f6c6401a0a101a166616d6f756e741a4a7747f5716170705f7075626c69635f696e70757473a283616e98201618b1184c1893187a18fb18fa184f184418e2189b18e918f8184e187a187c18ec186a189a189918c91883182718ce18c7182618dc18c6188018770f183f982018f418e1091831189618f3181f0f188e18be1856183c1880186018940a18271871181e170218d808184a181c14182c0718f318ab12182da166616374696f6e6675706461746583617498201618b1184c1893187a18fb18fa184f184418e2189b18e918f8184e187a187c18ec186a189a189918c91883182718ce18c7182618dc18c6188018770f183f982018f418e1091831189618f3181f0f188e18be1856183c1880186018940a18271871181e170218d808184a181c14182c0718f318ab12182da166616374696f4df4016e646d696e7499010418a41859184c1859182a187318321718ba184818dc185418fa185b1869184a189a187818a118e218801860183018ab188a18ae18b9182e184418a518f318281860189e141871182218fa186016187818390c183d1869188b184e181d18ab1857183518b209184d0518c20e182f18fd18ed186e181e183007184d18ca189a1894061618fe18a5182218d7184d18c8187c18eb186a184418c318c918f618a81881183e18f01860189218f2185f187018b318ba181d184a183218ee18b118be1827189818c3183e18c91874187018b60816184a189418bd18e5183f18e8182118d0183418231836183e18c318b918d415184018e818bc18e418a418dc09187a0a18ee187618f91857187f183b18d5187d1876182f18d81869184018c8184f18f6182b18d2184f184f1830189018d918c6182218cb18e80f18be182d16188f18ae1898185218950d18c5188818650f182218e618f518fa18920302187b1820184a18c1183b18e4186c18b718d6181f0818ca189105184518de184118e61897181c185b188900185718c618c809182f182f186318431846182c18ae18341839189911182f185a18d118cc1891184a1822182a187b18de18df186218cd18cf18d318fb18f9184c18bc188e0818e718ac18ce187018ee1870189618c3189f187718961868182d0c18cd04187218516820c1e18921d41d9786cf5532e88817286ccc2e2ea5b96f0211872aecbbd277fba6ac21c0c1e18921d41d9786cf5532e88817286ccc2e2ea5b96f0211872aecbbd277fba600000000',
	// }) as Spell;

	console.log(
		'Peg-in spell created:',
		JSON.stringify(spell, bufferReplacer, '\t')
	);
	return spell;
}

export async function signAndTransmitSpell(
	spell: Spell,
	keyPairs: KeyPair[],
	nextGrailState: GrailState,
	userPaymentDetails: UserPaymentDetails,
	previousNftTxid: string,
	temporarySecret: Buffer,
	network: Network,
	transmit: boolean
): Promise<void> {
	const previousGrailState = await getStateFromNft(previousNftTxid);

	const signedSpell = await prepareSpell(
		spell,
		previousGrailState,
		nextGrailState,
		userPaymentDetails,
		keyPairs,
		network,
		temporarySecret
	);

	console.log(
		'Signed spell:',
		JSON.stringify(signedSpell, bufferReplacer, '\t')
	);

	if (transmit) {
		const bitcoinClient = await BitcoinClient.create();
		console.info('Transmitting...');
		await transmitSpell(bitcoinClient, signedSpell);
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
			'deployer-private-key': config.deployerPrivateKey,
			'previous-nft-txid': config.latestNftTxid,
			'current-public-keys': `ff61e0fc3b753acb4c32943452d09b8f6d1e58a05e9ee140d7e76441aab70c4c,${config.deployerPublicKey}`,
			'current-threshold': 1,
			'user-payment-txid':
				'cfadce94834844eb91ee72813b76cc08b2aef214ecf942e0a32e22e0d8c4d54e',
			'recovery-public-key':
				'684286d7e610c168e498d5f2dea3be262cc25385d8d74b9415a9090f8b94d592',
			'user-wallet-address': config.userWalletAddress,
			transmit: true,
		},
		'--': true,
	});

	const network = argv['network'] as Network;
	const feeRate = Number.parseInt(argv['feerate']);
	const deployerPublicKey = argv['deployer-public-key'];
	const deployerPrivateKey = argv['deployer-private-key'];
	const previousNftTxid = argv['previous-nft-txid'] as string;
	const currentPublicKeys = (argv['current-public-keys'] as string)
		.split(',')
		.map(pk => pk.trim());
	const currentThreshold = Number.parseInt(argv['current-threshold']);
	const recoveryPublicKey = argv['recovery-public-key'] as string;
	const userWalletAddress = argv['user-wallet-address'] as string;
	const userPaymentTxid = argv['user-payment-txid'] as string;
	const transmit = !!argv['transmit'];

	const temporarySecret = Buffer.from(randomBytes(32));

	const userPaymentDetails = {
		txid: userPaymentTxid,
		vout: 0,
		recoveryPublicKey,
		timelockBlocks: config.userTimelockBlocks,
	};

	const spell = await createPegInSpell(
		feeRate,
		previousNftTxid,
		{ publicKeys: currentPublicKeys, threshold: currentThreshold },
		userPaymentDetails,
		userWalletAddress,
		temporarySecret,
		network
	);

	await signAndTransmitSpell(
		spell,
		[
			{
				publicKey: Buffer.from(deployerPublicKey, 'hex'),
				privateKey: Buffer.from(deployerPrivateKey, 'hex'),
			},
		],
		{ publicKeys: currentPublicKeys, threshold: currentThreshold },
		userPaymentDetails,
		previousNftTxid,
		temporarySecret,
		network,
		transmit
	);
}

if (require.main === module) {
	main().catch(err => {
		console.error(err);
	});
}
