"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Compressor = exports.SimpleTapTree = exports.INTERNAL_PUBLIC_KEY = exports.DEAD_ROOT_HASH = void 0;
const point_1 = require("./point");
const taproot_common_1 = require("./taproot-common");
const encoding_1 = require("./encoding");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const ecc = __importStar(require("tiny-secp256k1"));
const array_utils_1 = require("../array-utils");
bitcoin.initEccLib(ecc);
exports.DEAD_ROOT_HASH = (0, taproot_common_1.getHash)(Buffer.from([0x6a])); // always fail
const DEAD_ROOT_PAIR = (0, taproot_common_1.combineHashes)(exports.DEAD_ROOT_HASH, exports.DEAD_ROOT_HASH);
exports.INTERNAL_PUBLIC_KEY = 0x50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0n;
function combineHashes(a, b) {
    if (a.compare(b) == 0 && a.compare(exports.DEAD_ROOT_HASH) == 0)
        return DEAD_ROOT_PAIR;
    return (0, taproot_common_1.combineHashes)(a, b);
}
function toBinStringPad(n, l) {
    let s = n.toString(2);
    while (s.length < l)
        s = '0' + s;
    return s;
}
function taprootTweakPubkey(pubkey, h) {
    const t = (0, encoding_1.bigintFromBytes)((0, encoding_1.taggedHash)('TapTweak', (0, encoding_1.cat)([(0, encoding_1.bigintToBufferBE)(pubkey, 256), h])));
    if (t >= taproot_common_1.SECP256K1_ORDER)
        throw new Error('t >= SECP256K1_ORDER');
    const P = (0, point_1.lift_x)(pubkey);
    const Q = (0, point_1.pointAdd)(P, (0, point_1.pointMul)(taproot_common_1.G, t));
    return [(0, point_1.hasEvenY)(Q) ? 0n : 1n, (0, encoding_1.bytesFromBigint)(Q?.x ?? 0n)];
}
class SimpleTapTree {
    constructor(scripts, network) {
        this.network = network;
        this.internalPubkey = exports.INTERNAL_PUBLIC_KEY;
        this.scripts = scripts;
    }
    getRoot() {
        if (this.scripts.length == 0)
            return exports.DEAD_ROOT_HASH;
        let temp = this.scripts.map(b => (0, taproot_common_1.getHash)(b));
        while (temp.length > 1) {
            const other = [];
            while (temp.length > 0) {
                const left = temp.shift();
                const right = temp.shift() ?? left;
                other.push(combineHashes(left, right));
            }
            temp = other;
        }
        return temp[0];
    }
    getProof(index) {
        const buffers = [];
        let temp = this.scripts.map(b => (0, taproot_common_1.getHash)(b));
        while (temp.length > 1) {
            const other = [];
            const siblingIndex = index ^ 1;
            const sibling = temp[siblingIndex] ?? temp[index];
            buffers.push(sibling);
            while (temp.length > 0) {
                const left = temp.shift();
                const right = temp.shift() ?? left;
                other.push(combineHashes(left, right));
            }
            temp = other;
            index = index >> 1;
        }
        return (0, encoding_1.cat)(buffers);
    }
    getControlBlock(index) {
        const proof = this.getProof(index);
        const h = this.getRoot();
        const [parity] = taprootTweakPubkey(this.internalPubkey, h);
        const P = (0, point_1.lift_x)(this.internalPubkey);
        const versionBuf = Buffer.from([taproot_common_1.taprootVersion | Number(parity)]);
        const keyBuf = Buffer.from((0, encoding_1.padHex)(P.x.toString(16), 32), 'hex');
        return Buffer.concat([versionBuf, keyBuf, proof]);
    }
    getTaprootResults() {
        const root = this.getRoot();
        const t = (0, encoding_1.taggedHash)('TapTweak', Buffer.concat([(0, encoding_1.bigintToBufferBE)(this.internalPubkey, 256), root]));
        const mult = (0, point_1.pointMul)(taproot_common_1.G, (0, encoding_1.bigintFromBytes)(t));
        const yeven = (0, point_1.lift_x)(this.internalPubkey).y;
        const q = (0, point_1.pointAdd)({ x: this.internalPubkey, y: yeven }, mult);
        const pubkey = (0, encoding_1.bigintToBufferBE)(q.x, 256);
        const temp = bitcoin.payments.p2tr({
            internalPubkey: (0, encoding_1.bigintToBufferBE)(this.internalPubkey, 256),
            hash: this.getRoot(),
            network: bitcoin.networks[this.network],
        });
        if (pubkey.compare(temp.pubkey) != 0)
            throw new Error("Values don't match");
        return {
            pubkey: temp.pubkey,
            address: temp.address,
            output: temp.output,
        };
    }
    getTaprootPubkey() {
        return this.getTaprootResults().pubkey;
    }
    getTaprootOutput() {
        return this.getTaprootResults().output;
    }
    getTaprootAddress() {
        return this.getTaprootResults().address;
    }
}
exports.SimpleTapTree = SimpleTapTree;
class Compressor {
    constructor(total, network, indexToSave = -1) {
        this.network = network;
        this.nextIndex = 0;
        this.indexesForProof = [];
        this.lastHash = exports.DEAD_ROOT_HASH;
        this.proof = [];
        this.count = 0;
        const log2 = Math.ceil(Math.log2(total));
        this.depth = log2 + 1;
        this.total = 2 ** log2;
        this.data = (0, array_utils_1.array)(this.depth, (_) => []);
        this.internalPubKey = exports.INTERNAL_PUBLIC_KEY;
        this.indexToSave = indexToSave;
        if (indexToSave >= 0) {
            const s = toBinStringPad(indexToSave, this.depth - 1);
            for (let i = 0; i < s.length; i++) {
                const ts = s.slice(0, i + 1).split('');
                ts[ts.length - 1] = ts[ts.length - 1] == '0' ? '1' : '0';
                this.indexesForProof[i] = ts.join('');
            }
        }
    }
    setInteralPubKey(internalPubKey) {
        this.internalPubKey = internalPubKey;
    }
    indexStringForLevel(level) {
        if (level >= this.depth)
            throw new Error('Level should be < depth');
        let n = 0;
        for (let i = 0; i <= level; i++)
            n = n * 2 + this.data[i].length;
        return toBinStringPad(n, level);
    }
    compress() {
        for (let i = this.data.length - 1; i > 0; i--) {
            if (this.data[i].length == 2) {
                const hash = combineHashes(this.data[i][0], this.data[i][1]);
                const a = this.indexStringForLevel(i - 1);
                const b = this.indexesForProof[i - 2];
                if (a == b)
                    this.proof[this.data.length - i] = hash;
                this.data[i] = [];
                this.data[i - 1].push(hash);
            }
        }
    }
    addHash(hash) {
        if (!hash)
            throw new Error('Hash cannot be null');
        if (this.nextIndex + 1 > 2 ** this.depth)
            throw new Error('Too many leaves');
        if ((this.nextIndex ^ 1) === this.indexToSave)
            this.proof[0] = hash;
        (0, array_utils_1.last)(this.data).push(hash);
        this.nextIndex++;
        this.count++;
        this.lastHash = hash;
        this.compress();
    }
    getRoot() {
        if (this.count === 0) {
            return exports.DEAD_ROOT_HASH;
        }
        while (this.count < this.total) {
            this.addHash(this.lastHash);
        }
        return this.data[0][0];
    }
    getTaprootResults() {
        const root = this.getRoot();
        const t = (0, encoding_1.taggedHash)('TapTweak', Buffer.concat([(0, encoding_1.bigintToBufferBE)(this.internalPubKey, 256), root]));
        const mult = (0, point_1.pointMul)(taproot_common_1.G, (0, encoding_1.bigintFromBytes)(t));
        const yeven = (0, point_1.lift_x)(this.internalPubKey).y;
        const q = (0, point_1.pointAdd)({ x: this.internalPubKey, y: yeven }, mult);
        const pubkey = (0, encoding_1.bigintToBufferBE)(q.x, 256);
        const temp = bitcoin.payments.p2tr({
            internalPubkey: (0, encoding_1.bigintToBufferBE)(this.internalPubKey, 256),
            hash: this.getRoot(),
            network: bitcoin.networks[this.network],
        });
        if (pubkey.compare(temp.pubkey) != 0)
            throw new Error("Values don't match");
        return {
            pubkey: temp.pubkey,
            address: temp.address,
            output: temp.output,
        };
    }
    static toPubKey(internalPubkey, root, network) {
        const taproot = bitcoin.payments.p2tr({
            internalPubkey: (0, encoding_1.bigintToBufferBE)(internalPubkey, 256),
            hash: root,
            network: bitcoin.networks[network],
        });
        return taproot.output;
    }
    getTaprootPubkeyNew() {
        return this.getTaprootResults().output;
    }
    getAddress() {
        return this.getTaprootResults().address;
    }
    getTaprootPubkey() {
        return Compressor.toPubKey(this.internalPubKey, this.getRoot(), this.network);
    }
    getControlBlock() {
        const h = this.getRoot();
        const [parity] = taprootTweakPubkey(this.internalPubKey, h);
        const P = (0, point_1.lift_x)(this.internalPubKey);
        const versionBuf = Buffer.from([taproot_common_1.taprootVersion | Number(parity)]);
        const keyBuf = Buffer.from((0, encoding_1.padHex)(P.x.toString(16), 32), 'hex');
        return Buffer.concat([versionBuf, keyBuf, ...this.proof]);
    }
}
exports.Compressor = Compressor;
