#!/bin/sh -e

. "$(dirname "$(realpath "$0")")/common.sh"

snapshot_dir="$(realpath ./snapshot)"

create() {
    read -p "Deleting current snapshot in $snapshot_dir, continue? (y/N): " response
    [ "$response" = y ] || [ "$response" = Y ] || exit 1
    rm -rf snapshot || true
    mkdir -p snapshot
    bitcoin_cli stop
    cp -a "$bitcoin_data_dir" ./snapshot/bitcoin_data
    $docker_cmd start "$bitcoin_container_name"
}

load() {
    echo "Loading snapshot from $snapshot_dir"
    bitcoin_cli stop || true
    cp -a ./snapshot/bitcoin_data "$bitcoin_data_dir"
    npm run regtest -- persist
}

dir_exists() {
    local path="$1"
    local name="$2"
    if ! [ -d "$path" ]; then
        echo "$name directory not found: $path"
        exit 1
    fi
}

if [ "$1" = create ]; then
    dir_exists "$bitcoin_data_dir" 'Bitcoin data'
    create
else
    dir_exists "$snapshot_dir" Snapshot
    load
fi