/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'node:fs';
import minimist from 'minimist';
import { GrailState, UserPaymentDetails } from '../core/types';
import { IContext } from '../core/i-context';
import { parse } from '../core/env-parser';
import { ZKAPP_BIN } from './consts';
import { Context } from '../core/context';
import { Network } from '../core/taproot/taproot-common';

const grailStateSchema = {
	publicKeys: [''],
	threshold: 0,
};

const userPaymentDetailsSchema = {
	recoveryPublicKey: '',
	timelockBlocks: 0,
	txid: '',
	vout: 0,
	grailState: grailStateSchema,
};

function checkObj(obj: any, schema: any): boolean {
	if (typeof obj != typeof schema) return false;
	if (Array.isArray(schema) && !Array.isArray(obj)) return false;
	if (Array.isArray(schema)) {
		for (const item of obj) {
			if (!checkObj(item, schema[0])) return false;
		}
		return true;
	}
	if (typeof schema === 'object') {
		for (const key of Object.keys(schema)) {
			if (!obj[key]) return false;
			if (!checkObj(obj[key], schema[key])) return false;
		}
	}
	return true;
}

export function getNewGrailStateFromArgv(
	argv: minimist.ParsedArgs
): GrailState {
	let newGrailState: GrailState | null = null;
	if (!argv['new-grail-state-file']) {
		throw new Error('--new-grail-state-file is required');
	}

	const grailStateFile = argv['new-grail-state-file'] as string;
	const fileContent = fs.readFileSync(grailStateFile, 'utf-8');
	newGrailState = JSON.parse(fileContent);
	if (!checkObj(newGrailState, grailStateSchema)) {
		throw new Error(
			`Invalid grail state format. Required format: ${JSON.stringify(grailStateSchema)}`
		);
	}
	return newGrailState as GrailState;
}

export function getUserPaymentFromArgv(
	argv: minimist.ParsedArgs
): UserPaymentDetails {
	if (!argv['user-payment-txid']) {
		throw new Error('--user-payment-txid is required');
	}

	const userPaymentFile = argv['user-payment-file'] as string;
	const fileContent = fs.readFileSync(userPaymentFile, 'utf-8');
	const userPaymentDetails = JSON.parse(fileContent) as UserPaymentDetails;
	if (!checkObj(userPaymentDetails, userPaymentDetailsSchema)) {
		throw new Error(
			`Invalid user payment details format. Required format: ${JSON.stringify(userPaymentDetails)}`
		);
	}
	return userPaymentDetails as UserPaymentDetails;
}

export async function createContext(
	argv: minimist.ParsedArgs
): Promise<IContext> {
	const appId = argv['app-id'] as string;
	if (!appId) {
		throw new Error('--app-id is required');
	}

	return await Context.create({
		appId: argv['app-id'] as string,
		appVk: argv['app-vk'] as string,
		charmsBin: parse.string('CHARMS_BIN'),
		zkAppBin: ZKAPP_BIN,
		network:
			argv['network'] ?? (parse.string('BTC_NETWORK', 'regtest') as Network),
		mockProof: !!argv['mock-proof'],
		skipProof: !!argv['skip-proof'],
	});
}
