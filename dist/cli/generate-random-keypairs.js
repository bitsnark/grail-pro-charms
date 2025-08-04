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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicFromPrivate = publicFromPrivate;
exports.privateToKeypair = privateToKeypair;
exports.generateRandomKeypair = generateRandomKeypair;
exports.generateRandomKeypairs = generateRandomKeypairs;
const logger_1 = require("../core/logger");
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const secp = __importStar(require("@bitcoinerlab/secp256k1"));
const node_buffer_1 = require("node:buffer");
const crypto_1 = require("crypto");
const array_utils_1 = require("../core/array-utils");
function publicFromPrivate(privateKey) {
    if (!secp.isPrivate(privateKey)) {
        throw new Error('Invalid private key');
    }
    const publicKey = secp.xOnlyPointFromScalar(privateKey);
    if (!publicKey) {
        throw new Error('Failed to derive public key');
    }
    return node_buffer_1.Buffer.from(publicKey);
}
function privateToKeypair(privateKey) {
    if (!secp.isPrivate(privateKey)) {
        throw new Error('Invalid private key');
    }
    const publicKey = publicFromPrivate(privateKey);
    return {
        publicKey: node_buffer_1.Buffer.from(publicKey),
        privateKey: node_buffer_1.Buffer.from(privateKey),
    };
}
function generateRandomKeypair() {
    // Generate a random private key
    const privateKey = (0, crypto_1.randomBytes)(32);
    return privateToKeypair(privateKey);
}
function generateRandomKeypairs(size) {
    return (0, array_utils_1.array)(size, generateRandomKeypair);
}
function main() {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(process.argv.slice(2), {
        alias: { c: 'count' },
        '--': true,
    });
    if (argv.count === undefined) {
        logger_1.logger.error('Parameter --count is required');
        return;
    }
    // Generate the random roster
    const roster = generateRandomKeypairs(argv.count || 1);
    // Print the roster
    logger_1.logger.log(roster);
}
if (require.main === module) {
    main();
}
