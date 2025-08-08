import { getAddressFromScript, hashToTxid } from '../core/bitcoin';
import { TransactionInfoMap } from './types';
import { IContext } from '../core/i-context';
import { SpellMetadata } from '../core/types';

function shortTxid(txid: string): string {
	return txid.slice(0, 4) + '...' + txid.slice(-4);
}

function shortAddress(txid: string): string {
	return txid.slice(0, 4) + '...' + txid.slice(-4);
}

function formatValue(value: number, units: string): string {
	return Math.round((100000 * value) / 100000000) / 100000 + ' ' + units;
}

function getTokenValue(
	context: IContext,
	spell: SpellMetadata,
	index: number
): string {
	if (!spell || !spell.apps || !spell.outs || !spell.outs[index]) {
		return '';
	}
	const values: string[] = [];
	Object.keys(spell.outs[index].charms as { [key: string]: unknown }).forEach(
		key => {
			if (
				spell.apps[key].startsWith('t/') &&
				typeof spell.outs[index].charms![key] == 'number'
			) {
				const appId = spell.apps[key].slice(0, 6) + '...';
				values.push(formatValue(spell.outs[index].charms![key], appId));
			} else if (spell.apps[key].startsWith('n/')) {
				values.push('NFT ' + spell.apps[key].slice(2, 6) + '...');
			}
		}
	);
	return values.join('<br/>');
}

function getSpellActions(spell: SpellMetadata): string[] {
	const sa: string[] = [];
	Object.keys(spell.public_args).forEach(key => {
		if (spell.public_args[key].action) {
			sa.push(spell.public_args[key].action as string);
		}
	});
	return sa;
}

export async function dot(
	context: IContext,
	transactionMap: TransactionInfoMap,
	out: { log: (s: string) => void } = console
) {
	out.log('digraph {');

	const transactions = Object.values(transactionMap);

	Object.values(transactions).forEach(txinfo => {
		txinfo.tx.ins.forEach((_, index) => {
			out.log(
				`"input-${txinfo.txid}:${index}" [rank="min", shape="point" label=""]`
			);
			out.log(
				`"input-${txinfo.txid}:${index}" -> "${txinfo.txid}" [style="${txinfo.spell && index == txinfo.tx.ins.length - 1 ? 'dotted' : 'solid'}", rank="source", tailport="s", weight=1000000]`
			);
		});
		if (txinfo.spell) {
			const label = `<${shortTxid(txinfo.txid)}<br/>${getSpellActions(txinfo.spell).map(a => `action: ${a}<br/>`)}<br/>>`;
			out.log(
				`"${txinfo.txid}" [shape="hexagon", color="${txinfo.spell ? 'red' : 'blue'}", ordering="in", rank="same", label=${label}, tooltip="", target="_blank", URL="https://mempool.space/tx/${txinfo.txid}"]`
			);
		} else {
			const label = `<${shortTxid(txinfo.txid)}<br/>>`;
			out.log(
				`"${txinfo.txid}" [shape="hexagon", color="${txinfo.spell ? 'red' : 'blue'}", ordering="in", rank="same", label=${label}, tooltip="",  target="_blank", URL="https://mempool.space/tx/${txinfo.txid}"]`
			);
		}
		txinfo.tx.outs.forEach((output, index) => {
			const address = getAddressFromScript(output.script, context.network);
			if (txinfo.spell && output.value == 1000) {
				const value = getTokenValue(context, txinfo.spell, index);
				const label = `<value: ${value}<br/>address: ${shortAddress(address)}>`;
				out.log(
					`"output-${txinfo.txid}:${index}" [shape="box", color="red", rank="sink", label=${label}, tooltip="",  weight=1]`
				);
			} else {
				const value = formatValue(output.value, 'BTC');
				const label = `<value: ${value}<br/>address: ${shortAddress(address)}>`;
				out.log(
					`"output-${txinfo.txid}:${index}" [shape="box", color="blue", rank="sink", label=${label}, tooltip="",  weight=1]`
				);
			}
			out.log(
				`"${txinfo.txid}" -> "output-${txinfo.txid}:${index}" [style=solid, tailport="s", headport="n", weight=1000000, arrowhead="none"]`
			);
		});
	});

	Object.values(transactions).forEach(txinfo => {
		txinfo.tx.ins.forEach((input, index) => {
			const ptxid = hashToTxid(input.hash);
			const ptxinfo = transactionMap[ptxid];
			if (!ptxinfo) return;
			out.log(
				`"output-${ptxid}:${input.index}" -> "input-${txinfo.txid}:${index}" [style="solid", tailport="s", headport="n", weight=1, arrowhead="none"]`
			);
		});
	});

	out.log('}');
}
