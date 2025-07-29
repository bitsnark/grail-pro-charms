### grail charms

git clone git@github.com:bitsnark/charms.git
cd charms
git checkout dm-secret-parameters

cargo build --release --verbose --features prover

this will create the charms sdk is in: target/release
use this path in your CHARMS_BIN .env param


### env params

CHARMS_BIN=path to local charms.

BTC_WALLET_NAME=
BTC_NODE_USERNAME=
BTC_NODE_PASSWORD=
BTC_NODE_HOST=

CHARMS_SECRET= Optional for a static value.

### deploying, updating and peg operations

Those cli commands should be regarded as a template.
Key-pair may stay or be changed ()

Commands for deploy, update, pegin are available to use.
The deploy log contains: --app-id,  -app-vk
Each operation logs contain at its end the [commitment, spell] txids,
use --previous-nft-txid spellTxid for the next operation.

--private-keys are needed to sign the previous nft.
Prev threshold amount is needed. comma separated values.

--new-public-keys the full roster,comma separated values.
--new-threshold its threshold


ts-node ./src/cli/generate-random-keypairs.ts --count 1
 {
    privateKey: '3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6',
    publicKey: '660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14',
  }

ts-node ./src/cli/deploy.ts --deployerPublicKey 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14
App ID: a13c27aaef0c60e122f85db465eb75890024511ac198c02fd2fd4f234bd9ac5f
App Verification Key: d1929545464b091d0514a4087ccebc212483db21c391861a3cf043051b262936

Spell transmitted successfully: [
  "...",
  "d9d78ab7bdbbf2082e7615ebc125d724f9eb5f8ffabf7542b97961b22a40f97e"
]

private-keys
state new <-new roster //should be ordered?

ts-node ./src/cli/update.ts --app-id a13c27aaef0c60e122f85db465eb75890024511ac198c02fd2fd4f234bd9ac5f -app-vk d1929545464b091d0514a4087ccebc212483db21c391861a3cf043051b262936 --private-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --new-public-keys 9ad051ec4798d22004f2cad73c30ffa6fc4e62c3b3f20aa5675f01afc83682a6, --new-threshold 1 --previous-nft-txid 7c90524aa142db6f1f5046bdf0076ef81f48eedfc3db6a8a525c513dd3580c97 --mock-proof --transmit &> update.log

Spell transmitted successfully: [
  "2c464132c28e98a5d3f3c374da70f9678e87a7815ab0c32b3b64e49b88eb2f19",
  "71c962be6689f73c3f976647391397429571fd12f96cd942f59b7284565ff9bc"
]







