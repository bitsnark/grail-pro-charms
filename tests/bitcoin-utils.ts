import { exec } from 'node:child_process';

export async function generateBlocks(count: number = 1) {
  const network = 'regtest';
  const username = process.env.BTC_NODE_USERNAME || 'bitcoin';
  const password = process.env.BTC_NODE_PASSWORD || '1234';
  const bitcoinCliPath = process.env.BITCOIN_CLI_PATH || 'bitcoin-cli';
  const command = `${bitcoinCliPath} -${network} -rpcuser=${username} -rpcpassword=${password} -generate ${count}`;
  await exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error generating blocks: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Error output: ${stderr}`);
      return;
    }
    console.log(`Blocks generated: ${stdout}`);
  });
}
