import fs from 'fs';
import * as bitcoin from 'bitcoinjs-lib';
import { Context } from '../core/context';
import { dot } from '../visualize/dot';
import { exec } from 'child_process';
import { logger } from '../core/logger';
import { ExtendedTransaction } from '../core/bitcoin';
import { parse } from '../core/env-parser';
import { config } from './config';
import { crawlBack, crawlForward } from '../visualize/crawl';
import { styles } from './styles';
import { TransactionInfo, TransactionInfoMap } from '../visualize/types';
import { getNftMeta } from './nft-meta';

function formatValue(value: number, units: string): string {
	return Math.round((100000 * value) / 100000000) / 100000 + ' ' + units;
}

export async function renderTransaction(txid: string): Promise<string> {
	const context = await Context.createForVisualize({
		charmsBin: parse.string('CHARMS_BIN', 'charms'),
		zkAppBin: './zkapp/target/charms-app',
		network: config.network,
		mockProof: config.mockProof,
		skipProof: false,
	});

	const transaction =
		context.network === 'regtest'
			? bitcoin.Transaction.fromBuffer(
					await context.bitcoinClient.getTransactionBytes(txid)
				)
			: await context.bitcoinClient.getExtendedTransactionData(txid);

	const maxDepth = 3;

	const transactionInfoMap = await crawlBack(context, maxDepth, txid);
	await crawlForward(context, maxDepth, txid, transactionInfoMap);

	const outfile = `./tempfiles/transaction-${txid}.svg`;
	const dotfile = `./tempfiles/transaction-${txid}.dot`;

	// Open a write stream to the output file
	const fileWriter = fs.createWriteStream(dotfile, { flags: 'w' });
	const out = { log: (s: string) => fileWriter.write(s + '\n') };
	await dot(context, txid, transactionInfoMap, out);
	fileWriter.close();

	await new Promise<void>((resolve, reject) => {
		exec(`dot -Tsvg ${dotfile} -o ${outfile}`, (error, stdout, stderr) => {
			if (error) {
				logger.error(`Error generating SVG: ${error.message}`);
				reject(error);
			}
			if (stderr) logger.warn(stderr);
			logger.debug(stdout);
			resolve();
		});
	});

	// Read the resulting SVG file
	const svgContent = fs.readFileSync(outfile, 'utf-8');

	const transactionInfo = transactionInfoMap[txid];

	// Now render the template
	return render(
		transactionInfoMap,
		transaction as ExtendedTransaction,
		transactionInfo,
		svgContent
	);
}

function renderBlockInfo(transaction: ExtendedTransaction): string {
	if (!transaction?.status?.confirmed) return '';
	const date = new Date(Number(transaction.status.block_time) * 1000);
	const timestr = date.toString();
	return `
				<tr>
				<td>Status:</td>
				<td>${transaction.status.confirmed ? 'Confirmed' : 'Pending'}</td>
				</tr>
        <tr>
        <td>Block hash:</td>
        <td>${transaction.status.block_hash ? `<a href="https://mempool.space/block/${transaction.status.block_hash}" target=_blank >${transaction.status.block_hash}</a>` : 'Unconfirmed'}</td>
        </tr>
        <tr>
        <td>Block time:</td>
        <td>${timestr}</td>
        </tr>
  `;
}

function renderSpellInfo(transactionInfo: TransactionInfo): string {
	return `
	<tr><td>Spell:</td>
	<td>
	<div class=spell ><pre>${JSON.stringify(transactionInfo.spell, null, 2)}</pre></div>
	</td>
	</tr>
	`;
}

function renderOuts(
	transactionInfoMap: TransactionInfoMap,
	transactionInfo: TransactionInfo
): string {
	if (!transactionInfo.spell || !transactionInfo.spell.outs) return '';
	const spell = transactionInfo.spell;
	const routs = spell.outs.map((out, outIndex) => {
		let str = `<div class="output"><span class="output_title">Output ${outIndex}</span>`;
		const nftMeta = getNftMeta(transactionInfoMap, transactionInfo.txid);
		const value = out.charms ? (out.charms['$0001'] as number) : 0;
		if (value) {
			str += `<span class="output_value">${formatValue(value, nftMeta?.ticker ?? '')}</span>`;
		}
		if (nftMeta) {
			str += `<span class="nft-meta"><a href="${nftMeta.url}"><img class="nft-meta-image" src="${nftMeta.image}" alt="${nftMeta.name}" class="nft-image" /></a></span>`;
		}
		str += `</div>`;
		return str;
	});
	return `
	<tr>
	<td class="outputs">Outputs:</td>
	<td>${routs.join('<br />')}</td>
	</tr>
	`;
}

function render(
	transactionInfoMap: TransactionInfoMap,
	transaction: ExtendedTransaction,
	transactionInfo: TransactionInfo,
	svgContent: string
): string {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Charms Transaction Visualization</title>
	<style>
		${styles}
	</style>
</head>
<body>
	<h1>
	<a href="https://bitcoinos.build/" target=_blank><image class="logo" src="https://bitcoinos.build/images/logo-dark.png" /></a>
	Bitcoin OS Charms Explorer
	</h1>

  <table style="width: 100%; valign: top; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
    <td>
      <table>
        <tr>
        <td>Transaction ID:</td>
        <td><a href="https://mempool.space/tx/${transaction.txid}" target=_blank >${transaction.txid}</a></td>
        </tr>
        ${renderBlockInfo(transaction)}
				<tr>
				<td>Fee:</td>
				<td>${transaction.fee ? `${transaction.fee} satoshis` : 'Unknown'}</td>
				</tr>
				<tr>
				<td>Size:</td>
				<td>${transaction.size} vbytes</td>
				</tr>
				${renderOuts(transactionInfoMap, transactionInfo)}
				${renderSpellInfo(transactionInfo)}
      </table>
    </td>
    <td>
      <div>${svgContent}</div>
    </td>
    </tr>
  </table>
  <hr>
</body>
</html>
`;
}
