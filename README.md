--deployerPublicKey 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14
--deployerPrivateKey 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6

***

ts-node ./src/cli/deploy.ts --deployerPublicKey 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --mock-proof true &> deploy.log

--appId b71c3c93fb0aa8cea45f79470b73b678cb037d52a624f8e34fd42faf40eae6e7
--appVk 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b

Spell transmitted successfully: [
  "d0d5a16aef64c2e0eaf32e5d716158038a500c3275d9146f058b5fb2dbd0347e",
  "adeefcdf3a4d51219d97272a0dc70b22f26beec79beef7b02beae0a726c8935c"
]

***

ts-node ./src/cli/update.ts --app-id b71c3c93fb0aa8cea45f79470b73b678cb037d52a624f8e34fd42faf40eae6e7 --app-vk 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b --new-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --new-threshold 1 --previous-nft-txid adeefcdf3a4d51219d97272a0dc70b22f26beec79beef7b02beae0a726c8935c --private-keys 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6 --mock-proof true --transmit &> update.log

Spell transmitted successfully: [
  "029db15d930acaa411bcd724b87be23109fef9b185c8a5ac2673c64012178da8",
  "41161db8d6f88bca82a99da202e47ec9f65eed0a00d0d5c85d8f4af3741f4ff3"
]

***

ts-node ./src/cli/user-payment.ts --current-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --current-threshold 1 --amount 666666 &> user-payment.log

Recovery keypair generated: {
  "publicKey": "0x28fa3d9b03ac6e918091fb52dd0609979649fa8a55ca263475fe1a3a7be3698c",
  "privateKey": "0x0a891e68edab482e3fdc81adca40f23162d651cd6cfa1778b9d164aeb0f06981"
}
Sending funds to user payment address: bcrt1pukpus6ns69208vl07pyp4tjw4czzqjz2x4mp8mmq78wvu9vxzcqqefmhde
Funds sent successfully, txid:  fd44af4dfe84bfdd33c1646901b90f022743b3823b5af394113c94fc4421bb40
Recovery public key: 28fa3d9b03ac6e918091fb52dd0609979649fa8a55ca263475fe1a3a7be3698c

***

ts-node ./src/cli/pegin.ts --app-id 9a895d72ef3979f9577356981e272abd5fbb3d596cc7829f98f302df0034fd14 --app-vk 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b --new-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --new-threshold 1 --previous-nft-txid 41161db8d6f88bca82a99da202e47ec9f65eed0a00d0d5c85d8f4af3741f4ff3 --recovery-public-key 28fa3d9b03ac6e918091fb52dd0609979649fa8a55ca263475fe1a3a7be3698c --private-keys 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6 --user-payment-txid fd44af4dfe84bfdd33c1646901b90f022743b3823b5af394113c94fc4421bb40 --mock-proof --transmit &> pegin.log

Spell transmitted successfully: [
  "e4b4dab0de1efb59e7c6cd801fb7a57f4ab93016366a729399e68c1de6f5d7e0",
  "61c3f230d8e4ef674d734f166be8bf36a91f30e21f92a2ff6f5434d4fb8f9a0f"
]

