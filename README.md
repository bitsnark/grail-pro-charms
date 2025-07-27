
ts-node ./src/cli/generate-random-keypairs.ts --count 1

"publicKey": "0x9ad051ec4798d22004f2cad73c30ffa6fc4e62c3b3f20aa5675f01afc83682a6",
"privateKey": "0x4d78d8bfee0e78ed9f6b3ba37a7c5ed892ce8e01ae63e863cc6af7a804b9f646"

ts-node ./src/cli/deploy.ts --deployerPublicKey 9ad051ec4798d22004f2cad73c30ffa6fc4e62c3b3f20aa5675f01afc83682a6
App ID: 5f5f744bbb6658dcd6ad329c546641c04e8a8c732a8990936187e948a6718992
App Verification Key: 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b
Spell transmitted successfully: [
  "dc2728c8c330d65ad823067e91eaaa83ccb2c9f81895736a58a2eacc54dfcc90",
  "46e4f3487516e0ba0af4a77c01ea27b70e0ef5f17a885dfd4abd1eecbf41b9e2"
]

ts-node ./src/cli/update.ts --app-id 5f5f744bbb6658dcd6ad329c546641c04e8a8c732a8990936187e948a6718992 -app-vk 76f6ea263c513548c1f15915a4867c71be83f13ceb30380fd43f8f32d1da425b --private-keys 4d78d8bfee0e78ed9f6b3ba37a7c5ed892ce8e01ae63e863cc6af7a804b9f646 --new-public-keys 9ad051ec4798d22004f2cad73c30ffa6fc4e62c3b3f20aa5675f01afc83682a6 --new-threshold 1 --previous-nft-txid 46e4f3487516e0ba0af4a77c01ea27b70e0ef5f17a885dfd4abd1eecbf41b9e2 --mock-proof --transmit &> update.log

Spell transmitted successfully: [
  "2c464132c28e98a5d3f3c374da70f9678e87a7815ab0c32b3b64e49b88eb2f19",
  "71c962be6689f73c3f976647391397429571fd12f96cd942f59b7284565ff9bc"
]







