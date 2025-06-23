#!/bin/bash

json_file="rabbit_result.json"
declare -A env_map

while IFS="=" read -r key value; do
  env_map["$key"]="$value"
done < <(jq -r "to_entries|map(\"\(.key)=\(.value)\")|.[]" "$json_file")

# Fail if app_id or app_vk are unset
: "${app_id:?Missing app_id}"
: "${app_vk:?Missing app_vk}"

template='
version: 3

apps:
  $00: t/${app_id}/${app_vk}
  $01: n/${app_id}/${app_vk}

private_inputs:
  $00: "${lock_funds_tx_hex}"

ins:
  - utxo_id: ${in_utxo_1} # txid:vout

outs:
  - address: ${addr_1}
    charms:
      $00:
        funding_utxo: ${funding_utxo} 
        lock_amount: ${lock_amount}
        change_amount:  ${change_amount}
        change_address: ${change_address}
        fee: 1000, # sats
        action: ${action}, # mint/burn
      $01:
        cosigners: ${cosigner_roster}
        new_cosigners: ${new_cosigners}
'

# Substitute all values
output="$template"
output="${output//\$\{app_id\}/$app_id}"
output="${output//\$\{app_vk\}/$app_vk}"

for key in "${!env_map[@]}"; do
  value="${env_map[$key]}"
  output="${output//\$\{$key\}/$value}"
done

# Write spell
echo "$output" > ../spells/mint-token.yaml