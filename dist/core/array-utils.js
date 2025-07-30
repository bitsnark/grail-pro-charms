"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.range = range;
exports.array = array;
exports.last = last;
exports.first = first;
exports.butLast = butLast;
exports.butFirst = butFirst;
exports.chunk = chunk;
exports.isIn = isIn;
exports.unique = unique;
exports.reverse = reverse;
exports.forEachAsync = forEachAsync;
exports.mapAsync = mapAsync;
exports.arrayFromArrayWithIndex = arrayFromArrayWithIndex;
function range(start, end) {
    return new Array(end - start).fill(0).map((_, i) => i);
}
function array(count, f) {
    if (f && typeof f == 'function')
        return new Array(count).fill(0).map((_, i) => f(i));
    return new Array(count).fill(f);
}
function last(a) {
    return a[a.length - 1];
}
function first(a) {
    return a[0];
}
function butLast(a) {
    return a.slice(0, a.length - 1);
}
function butFirst(a) {
    return a.slice(1);
}
function chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}
function isIn(i, a) {
    return a.find(t => t == i) != undefined;
}
function unique(a) {
    return a.filter((item, index) => a.indexOf(item) === index);
}
function reverse(a) {
    return a.slice().reverse();
}
async function forEachAsync(a, f) {
    for (let i = 0; i < a.length; i++) {
        await f(a[i], i);
    }
}
async function mapAsync(a, f) {
    const results = [];
    for (let i = 0; i < a.length; i++) {
        results.push(await f(a[i], i));
    }
    return results;
}
function arrayFromArrayWithIndex(array) {
    return array.reduce((acc, item) => {
        const { index, ...itemWithoutIndex } = item;
        acc[index] = itemWithoutIndex;
        return acc;
    }, []);
}
