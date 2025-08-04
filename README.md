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

[2025-07-28T10:46:00.582Z] [
        {
                "publicKey": "0xaf6644ddd084ac99ffbc0f3e233694cf4356c4106709913210413779d17e8486",
                "privateKey": "0x88eab7fda0159b008a2f3636c88b8af0196fc2fc9a34bbb1b63c1958488223ce"
        }
]

***

ts-node ./src/cli/deploy.ts --deployerPublicKey af6644ddd084ac99ffbc0f3e233694cf4356c4106709913210413779d17e8486 --mock-proof --transmit &> deploy.log

[2025-07-28T10:48:33.823Z] App ID: 3b0ad31236878d16961cdd16f99c37b048943747c09a4a9eed97c9592a25fb87
[2025-07-28T10:48:37.051Z] App Verification Key: ead64b28a5854f4be43637305362f33b32fa533ebd21cc2cda96840450f42151
[2025-07-28T10:49:17.318Z] Spell transmitted successfully: [
  "38f02936e121cd854fcbbf0a6236c22c61dc1f56c5002c7c77dd318daa6fa20e",
  "961a2734d3b9bcd0049b15dbf8c5f11fa6623d4cd0bd3f2ed2b6e237b1c4fdd3"
]

***

ts-node ./src/cli/user-payment.ts --current-public-keys af6644ddd084ac99ffbc0f3e233694cf4356c4106709913210413779d17e8486 --current-threshold 1 --amount 666666 &> user-payment.log

[2025-07-28T10:53:18.843Z] Recovery keypair generated: {
  "publicKey": "0x213c1539be1fb847318ab399053cd89f10ad449bdffa3969e72b275d1e2b811f",
  "privateKey": "0x24eee63154ab7934ea272ca72edb966e649bdcdc62d5525c94477eefd4f3b37a"
}
[2025-07-28T10:53:18.883Z] Sending funds to user payment address: bcrt1p4dj20vtz4l7wxgj738pyalrvt0440d33v0zta43yzjnjrjuy0dyq6yjdsp
[2025-07-28T10:53:18.917Z] Funds sent successfully, txid:  01c59201c89cd07137b5f510d60286c4a23893b0153581d39cf0ccfa7c59c390
[2025-07-28T10:53:18.917Z] Recovery public key: 213c1539be1fb847318ab399053cd89f10ad449bdffa3969e72b275d1e2b811f

***

ts-node ./src/cli/pegin.ts --app-id 3b0ad31236878d16961cdd16f99c37b048943747c09a4a9eed97c9592a25fb87 --app-vk ead64b28a5854f4be43637305362f33b32fa533ebd21cc2cda96840450f42151 --new-public-keys af6644ddd084ac99ffbc0f3e233694cf4356c4106709913210413779d17e8486 --new-threshold 1 --previous-nft-txid 961a2734d3b9bcd0049b15dbf8c5f11fa6623d4cd0bd3f2ed2b6e237b1c4fdd3 --recovery-public-key 213c1539be1fb847318ab399053cd89f10ad449bdffa3969e72b275d1e2b811f --private-keys 88eab7fda0159b008a2f3636c88b8af0196fc2fc9a34bbb1b63c1958488223ce --user-payment-txid 01c59201c89cd07137b5f510d60286c4a23893b0153581d39cf0ccfa7c59c390 --mock-proof --transmit &> pegin.log

[2025-07-28T11:02:10.719Z] Spell transmitted successfully: [
  "dec430075feddbc98388d5a9d8acfd87c7ba660c334a861711aab759789b534f",
  "acbe668971eac0865ce28c026af649a954beddbbe80c09dd2714bfc65a85d41c"
]

***

# How to Run E2E Tests

## Prerequisites

- Bitcoin Core with regtest configuration
- Charms CLI tool installed from [bitsnark/charms](https://github.com/bitsnark/charms) (stable version)


## Environment Setup

Set the following environment variables:

```bash
export BTC_WALLET_NAME=testwallet
export CHARMS_BIN=~/.cargo/bin/charms
```

## Bitcoin Regtest Node Configuration

### 1. Bitcoin Configuration File

Create or update your `bitcoin.conf` file with the following settings:

```ini
server=1
txindex=1

daemon=0
addresstype=bech32m
changetype=bech32m

rpcport=18443
# Enable regtest mode
regtest=1

# RPC authentication
rpcuser=bitcoin
rpcpassword=1234

# Allow RPC connections only from localhost
rpcallowip=127.0.0.1

# Optional: Enable timestamps in logs
logtimestamps=1

# Optional: Enable debugging logs
debug=1

# estimation is available. It helps ensure transactions are processed even
fallbackfee=0.0001
```

### 2. Bitcoin Node Setup

Start the Bitcoin regtest node and perform initial setup:

```bash
# Start bitcoind
bitcoind

# Create wallet
b createwallet testwallet

# Unload wallet (if needed)
b loadwallet "testwallet"

# Generate new address
b getnewaddress
# Example output: bcrt1pyezp8aenr3d779g6hg7z8jhjmrdwuvw3lnt9a2gdlec72hrkfpxqqx6m5p

# Generate 101 blocks to the address (for coinbase maturity)
b generatetoaddress 101 bcrt1pyezp8aenr3d779g6hg7z8jhjmrdwuvw3lnt9a2gdlec72hrkfpxqqx6m5p

# List unspent transactions
b listunspent
```


# Running the Tests
## Simple e2e (deploy to pegin)
```bash
$ npm run test:e2e
```

_Note:_ See pegin-e2e-test-log.md

## NFT update e2e
```bash
$ npm run test:e2e:update
```

_Note:_ See update-e2e-test-log.md
