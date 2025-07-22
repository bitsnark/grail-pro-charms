--deployerPublicKey 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14
--deployerPrivateKey 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6

***

ts-node ./src/cli/deploy.ts --deployerPublicKey 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --mock-proof true &> deploy.log

--appId 1e5cd0baab41f3a0552f285cd5ec703485772d365317a28a39bb61d79b0b77b1
--appVk 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b

Spell transmitted successfully: [
  "967618c4c075c524a48e73f67fe1dbf687db54990802ebf92ca5f54d8d6ddc0b",
  "d7a71b76e56fa72f6f3115fca946ee566ad302e6b792799c143ce99c86c2d20f"
]

***

ts-node ./src/cli/update.ts --app-id 1e5cd0baab41f3a0552f285cd5ec703485772d365317a28a39bb61d79b0b77b1 --app-vk 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b --new-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --new-threshold 1 --previous-nft-txid d7a71b76e56fa72f6f3115fca946ee566ad302e6b792799c143ce99c86c2d20f --private-keys 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6 --mock-proof --transmit &> update.log

Spell transmitted successfully: [
  "a2381b034a9027d2dc3af69710915e7a77149be78f9188e1ee1d7ac044a90756",
  "abc1ca9d2eb2dec25b800c52b6e22e03cde58403a2eb5e86244423d57096aef5"
]

***

ts-node ./src/cli/user-payment.ts --current-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --current-threshold 1 --amount 666666 &> user-payment.log

Recovery keypair generated: {
  "publicKey": "0xbe4caac492c6a1ae5722e59dbc7bfb5baa15a0dba00e69cfb89c71955d207a6e",
  "privateKey": "0x9baa8dc75af02366f55e3908b6dc3057f6fbdab2a6c34637d1a03c9285cc2e93"
}

Funds sent successfully, txid:  0d2fc7d0f73ec28180ad3bf791bf4de7eb923d589344dc82d04e5de4a289be70

***

ts-node ./src/cli/pegin.ts --app-id 1e5cd0baab41f3a0552f285cd5ec703485772d365317a28a39bb61d79b0b77b1 --app-vk 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b --new-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --new-threshold 1 --previous-nft-txid abc1ca9d2eb2dec25b800c52b6e22e03cde58403a2eb5e86244423d57096aef5 --recovery-public-key be4caac492c6a1ae5722e59dbc7bfb5baa15a0dba00e69cfb89c71955d207a6e --private-keys 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6 --user-payment-txid 0d2fc7d0f73ec28180ad3bf791bf4de7eb923d589344dc82d04e5de4a289be70 --user-payment-vout 1 --mock-proof --transmit &> pegin.log

Spell transmitted successfully: [
  "4f382d1337506610bf2f82e35b2cc0873eb053a6ad9d489bef9eea7f6b4464f2",
  "363419d5d94d8f4604b4e47892603d8f7a13c999d51c1718c0e78004947d6394"
]

