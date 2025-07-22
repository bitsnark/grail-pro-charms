***

--deployerPublicKey 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14
--deployerPrivateKey 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6

***

 ts-node ./src/cli/deploy.ts --deployerPublicKey 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --mock-proof true &> deploy.log

--appId 29a11fea2e0d8b052c30c04e84b72f201b9a53448994dd46da20f332ef55d6ba
--appVk 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b

Spell transmitted successfully: [
  "4f1e87922e012e9c187b54a1c35a18ce1c83392e72c7662a35fd7bcdb9bd31ff",
  "b1b8246cfebcc1a9e6c935680db8bc1d729d3159035745944cdde37736c3b26f"
]

***

ts-node ./src/cli/update.ts --app-id 29a11fea2e0d8b052c30c04e84b72f201b9a53448994dd46da20f332ef55d6ba --app-vk 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b --new-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --new-threshold 1 --previous-nft-txid b1b8246cfebcc1a9e6c935680db8bc1d729d3159035745944cdde37736c3b26f --private-keys 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6 --mock-proof --transmit &> update.log

Spell transmitted successfully: [
  "7f6d262a0915b79e34b5ccbb1eb68fcd053cefb9c66893bfe607b001825e8e66",
  "aa19d1f0aa5b6d0aabfa99a0ca65bcd2d5a7d6197890bd7b32c4b5504c8d16b6"
]

***

ts-node ./src/cli/user-payment.ts --current-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --current-threshold 1 --amount 666666 &> user-payment.log

Recovery keypair generated: {
  "publicKey": "31330e24ef0934fc105d6a0adb44e02eb9ae9fa6f11749b2a13d989e1f0d771e",
  "privateKey": "0x39baa4c4a675b5eb68e5391081a526c4041fc7df349f13656242e60bafae6489"
}

Funds sent successfully, txid:  5c688f5449e833216eb29f9f3a5aefc5b7a688be196f9594f81c4fbeefda1ec8

***

ts-node ./src/cli/pegin.ts --app-id 29a11fea2e0d8b052c30c04e84b72f201b9a53448994dd46da20f332ef55d6ba --app-vk 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b --new-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --new-threshold 1 --previous-nft-txid aa19d1f0aa5b6d0aabfa99a0ca65bcd2d5a7d6197890bd7b32c4b5504c8d16b6 --recovery-public-key 31330e24ef0934fc105d6a0adb44e02eb9ae9fa6f11749b2a13d989e1f0d771e --private-keys 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6 --user-payment-txid 5c688f5449e833216eb29f9f3a5aefc5b7a688be196f9594f81c4fbeefda1ec8 --mock-proof --transmit &> pegin.log

Spell transmitted successfully: [
  "7f6d262a0915b79e34b5ccbb1eb68fcd053cefb9c66893bfe607b001825e8e66",
  "aa19d1f0aa5b6d0aabfa99a0ca65bcd2d5a7d6197890bd7b32c4b5504c8d16b6"
]

