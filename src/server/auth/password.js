"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
var node_crypto_1 = require("node:crypto");
function hashPassword(password) {
    return (0, node_crypto_1.createHash)('sha256').update(password, 'utf8').digest('hex');
}
function verifyPassword(password, passwordHash) {
    var candidate = Buffer.from(hashPassword(password), 'hex');
    var stored = Buffer.from(passwordHash, 'hex');
    return candidate.length === stored.length && (0, node_crypto_1.timingSafeEqual)(candidate, stored);
}
