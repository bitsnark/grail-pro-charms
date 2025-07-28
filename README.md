--deployerPublicKey 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14
--deployerPrivateKey 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6

***

ts-node ./src/cli/deploy.ts --deployerPublicKey 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --mock-proof transmit &> deploy.log

--appId f1e846df2189b26c05b5c2e0155695a453b94b2446d733693915b0846283bfc6
--appVk ead64b28a5854f4be43637305362f33b32fa533ebd21cc2cda96840450f42151

Spell transmitted successfully: [
  "1a49388fa864c116f8cea43ccc98d5057adb037483b8f1f2efff5c0fa0bd0fd1",
  "df6f6bc168b9f9705c08b67739100c4026461e18cb6e6b95ac96844a95ee5edb"
]

***

ts-node ./src/cli/update.ts --app-id f1e846df2189b26c05b5c2e0155695a453b94b2446d733693915b0846283bfc6 --app-vk ead64b28a5854f4be43637305362f33b32fa533ebd21cc2cda96840450f42151 --new-grail-state-file ./grail-state.json --previous-nft-txid df6f6bc168b9f9705c08b67739100c4026461e18cb6e6b95ac96844a95ee5edb --private-keys 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6 --mock-proof --transmit &> update.log

Spell transmitted successfully: [
  "50f21ca4fa58813adaeb2e1fd85a983173b35c43600f322d6145bbc797175ba2",
  "761f7472d639fa65475e4e9343d24d013eaaa2b57a536bca1d2c16b99db21b48"
]

***

ts-node ./src/cli/user-payment.ts --current-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --current-threshold 1 --amount 666666 &> user-payment.log

Sending funds to user payment address: bcrt1pf6kmj4kynlzead52xtgarx5uldfkqfz663lq0d6h4rysn2lhwu8s5h2pgu
Funds sent successfully, txid:  8dab96b05467a42adba40a9a844eb64ab75fdd2561458858b397fb65077d3e0f
Recovery public key: b1f8468a2de8ba68aa2226813e9582dad855dc828bfc59ad094a237894de7323

***

ts-node ./src/cli/pegin.ts --app-id f1e846df2189b26c05b5c2e0155695a453b94b2446d733693915b0846283bfc6 --app-vk ead64b28a5854f4be43637305362f33b32fa533ebd21cc2cda96840450f42151 --new-public-keys 660614dc3a81bb9f7bc098897852b0a2c4111214a10e3f7d809e9624c76f5c14 --new-threshold 1 --previous-nft-txid 41161db8d6f88bca82a99da202e47ec9f65eed0a00d0d5c85d8f4af3741f4ff3 --recovery-public-key b1f8468a2de8ba68aa2226813e9582dad855dc828bfc59ad094a237894de7323 --private-keys 3ee8b75d7e17ee3846ce440740fca29be938d29253fdda3178172d0db6f444f6 --user-payment-txid 8dab96b05467a42adba40a9a844eb64ab75fdd2561458858b397fb65077d3e0f --mock-proof --transmit &> pegin.log

Spell transmitted successfully: [
  "e4b4dab0de1efb59e7c6cd801fb7a57f4ab93016366a729399e68c1de6f5d7e0",
  "61c3f230d8e4ef674d734f166be8bf36a91f30e21f92a2ff6f5434d4fb8f9a0f"
]

