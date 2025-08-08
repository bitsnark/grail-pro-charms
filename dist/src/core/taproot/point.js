"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modPow = modPow;
exports.lift_x = lift_x;
exports.hasEvenY = hasEvenY;
exports.pointAdd = pointAdd;
exports.pointMul = pointMul;
// Prime field characteristic (p) for SECP256K1
// This is the large prime defining the finite field F_p over which the curve is defined.
// p = 2^256 - 2^32 - 977
const p = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
function modulus(a, b) {
    const result = a % b;
    if (result < 0) {
        return result + b;
    }
    return result;
}
function modPow(x, y, p) {
    let result = 1n;
    x = modulus(x, p);
    while (y > 0) {
        if (y & 1n)
            result = modulus(result * x, p);
        y = y >> 1n;
        x = modulus(x * x, p);
    }
    return result;
}
function lift_x(x) {
    if (x > p)
        throw new Error('x > p');
    const y_sq = (modPow(x, 3n, p) + 7n) % p;
    const y = modPow(y_sq, (p + 1n) / 4n, p);
    if (modPow(y, 2n, p) !== y_sq)
        throw new Error('NaN');
    return { x: x, y: (y & 1n) === 0n ? y : p - y };
}
function hasEvenY(P) {
    if (P == null)
        throw new Error('P is null');
    return P.y % 2n === 0n;
}
function pointAdd(P1, P2) {
    if (P1 == null)
        return P2;
    if (P2 == null)
        return P1;
    if (P1.x === P2.x && P1.y !== P2.y)
        return null;
    let lam;
    if (P1.x === P2.x && P1.y === P2.y) {
        lam = modulus(3n * P1.x * P1.x * modPow(2n * P1.y, p - 2n, p), p);
    }
    else {
        lam = modulus((P2.y - P1.y) * modPow(P2.x - P1.x, p - 2n, p), p);
    }
    const x3 = modulus(lam * lam - P1.x - P2.x, p);
    return { x: x3, y: modulus(lam * (P1.x - x3) - P1.y, p) };
}
function pointMul(P, n) {
    let R = null;
    for (let i = 0; i < 256; i++) {
        if ((n >> BigInt(i)) & 1n)
            R = pointAdd(R, P);
        P = pointAdd(P, P);
    }
    return R;
}
