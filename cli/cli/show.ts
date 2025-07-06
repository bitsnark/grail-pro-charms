import minimist from 'minimist';
import { BitcoinClient } from "../core/bitcoin";
import { showSpell } from "../core/charms-sdk";

import config from './config.json';

async function viewNft(nftTxid: string) {

    const bitcoinClient = await BitcoinClient.create();

    const txhex = await bitcoinClient.getTransactionHex(nftTxid);
    if (!txhex) {
        console.error(`Transaction ${nftTxid} not found`);
        return;
    }
    const spell = await showSpell(txhex);
    console.log('spell: ' + JSON.stringify(spell, null, '\t'));
}

if (require.main === module) {
    const argv = minimist(process.argv.slice(2), {
        alias: {},
        default: {
            'nft-txid': '509697aaa6bc0807dc00ebd8600d38c4879c66d8d79e426023861ba1a0e76769'
        }
    });

    const nftTxid = argv['nft-txid'];

    if (!nftTxid) {
        console.error('Please provide the NFT transaction ID using --nft-txid');
        process.exit(1);
    }

    viewNft(nftTxid).catch(error => {
        console.error('Error viewing NFT:', error);
    });
}
