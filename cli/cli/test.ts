import { Transaction } from 'bitcoinjs-lib';
import { BitcoinClient } from '../core/bitcoin';

async function main() {
    const bitcoinClient = await BitcoinClient.create();

    const txhex = '02000000013de898d08b5c7ac47c06ba969d72a6e8e7a920da9f067def22fef7d0379ad1f50000000000ffffffff0122f1052a01000000225120a571b0a508cb2229163719d3b01b09fcf542e312155d3e6adcd6d0458d2279c100000000';
    const signedCommitmentTx = await bitcoinClient.signTransaction(txhex, undefined, 'ALL|ANYONECANPAY');
    console.log(signedCommitmentTx);
    const result1 = await bitcoinClient.transmitTransaction(signedCommitmentTx);
}

main()
    .then(() => console.log('Transaction signed successfully'))
    .catch((error) => console.error('Error signing transaction:', error));
