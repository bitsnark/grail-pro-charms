"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.strToBigint = strToBigint;
exports.bufferToBigints256BE = bufferToBigints256BE;
exports.bufferToBigintsBE = bufferToBigintsBE;
exports.padHex = padHex;
exports.cat = cat;
exports.hash = hash;
exports.hashPair = hashPair;
exports.taggedHash = taggedHash;
exports.bigintFromBytes = bigintFromBytes;
exports.bytesFromBigint = bytesFromBigint;
exports.bitsToBigint = bitsToBigint;
exports._256To32LE = _256To32LE;
exports._256To32BE = _256To32BE;
exports._32To256LE = _32To256LE;
exports._32To256BE = _32To256BE;
exports.bigintToString = bigintToString;
exports.stringToBigint = stringToBigint;
exports.numToStr2Digits = numToStr2Digits;
exports.bufferToBigint160 = bufferToBigint160;
exports.bufferToBigintBE = bufferToBigintBE;
exports.bigintToBufferBE = bigintToBufferBE;
const crypto_1 = require("crypto");
function strToBigint(s) {
    let n = 0n;
    for (let i = 0; i < s.length; i++) {
        n = n << 8n;
        n += BigInt(s.charCodeAt(i));
    }
    return n;
}
function bufferToBigints256BE(buffer) {
    if (buffer.length % 32 !== 0)
        throw new Error('invalid size');
    return bufferToBigintsBE(buffer, 32);
}
function bufferToBigintsBE(buffer, size) {
    const output = [];
    for (let i = 0; i < buffer.length;) {
        let n = 0n;
        for (let j = 0; j < size; j++) {
            n = (n << 8n) + BigInt(buffer[i++]);
        }
        output.push(n);
    }
    return output;
}
function padHex(s, bytes) {
    return s.padStart(bytes * 2, '0');
}
function cat(buffers) {
    return Buffer.concat(buffers);
}
function hash(input, times = 1) {
    let t = input;
    for (let i = 0; i < times; i++) {
        const s1 = padHex(t.toString(16), 32);
        const s2 = (0, crypto_1.createHash)('sha256').update(s1, 'hex').digest('hex');
        t = BigInt('0x' + s2);
    }
    return t;
}
function hashPair(inputA, inputB) {
    const s = padHex(inputA.toString(16), 32) + padHex(inputB.toString(16), 32);
    return BigInt('0x' + (0, crypto_1.createHash)('sha256').update(s, 'hex').digest('hex'));
}
function taggedHash(tag, msg) {
    const tagHash = (0, crypto_1.createHash)('sha256').update(tag, 'utf-8').digest();
    return (0, crypto_1.createHash)('sha256')
        .update(Buffer.concat([tagHash, tagHash, msg]))
        .digest();
}
function bigintFromBytes(buf) {
    return BigInt('0x' + buf.toString('hex'));
}
function bytesFromBigint(n) {
    let s = n.toString(16);
    if (s.length % 2) {
        // Buffer.from(n, 'hex') fails miserably if an odd-length string
        // (e.g. '2' or '101') is passed in
        s = '0' + s;
    }
    return Buffer.from(s, 'hex');
}
function bitsToBigint(bits) {
    let n = 0n;
    for (let i = 0; i < bits.length; i++) {
        n += BigInt(bits[i]) << BigInt(i);
    }
    return n;
}
function _256To32LE(n) {
    const r = [];
    for (let i = 0; i < 8; i++) {
        r.push(n & 0xffffffffn);
        n = n >> 32n;
    }
    return r;
}
function _256To32BE(n) {
    const r = [];
    const s = padHex(n.toString(16), 32);
    for (let i = 0; i < 8; i++) {
        r.push(BigInt('0x' + s.slice(i * 8, i * 8 + 8)));
    }
    return r;
}
function _32To256LE(na) {
    if (na.length !== 8)
        throw new Error('invalid size');
    let n = 0n;
    for (let i = 0; i < 8; i++) {
        n += na[i] << (32n * BigInt(i));
    }
    return n;
}
function _32To256BE(na) {
    if (na.length !== 8)
        throw new Error('invalid size');
    let n = 0n;
    for (let i = 0; i < 8; i++) {
        n = n << 32n;
        n += na[i];
    }
    return n;
}
function bigintToString(n, bits) {
    const s = n.toString(16);
    if (bits) {
        const hexLen = Math.ceil(bits / 4);
        return s.padStart(hexLen, '0');
    }
    return s;
}
function stringToBigint(s) {
    return BigInt('0x' + s);
}
function numToStr2Digits(i) {
    return i < 10 ? `${i}` : `0${i}`;
}
function bufferToBigint160(b) {
    if (b.length !== 20)
        throw new Error('Invalid size');
    return BigInt('0x' + b.toString('hex'));
}
function bufferToBigintBE(buffer) {
    if (buffer.length == 0)
        return 0n;
    return BigInt('0x' + buffer.toString('hex'));
}
function bigintToBufferBE(n, bits) {
    let s = n.toString(16);
    while (s.length < Math.ceil(bits / 4))
        s = '0' + s;
    return Buffer.from(s, 'hex');
}
