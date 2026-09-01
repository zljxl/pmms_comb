"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var promises_1 = require("node:fs/promises");
var adapter_better_sqlite3_1 = require("@prisma/adapter-better-sqlite3");
var client_1 = require("../src/generated/prisma/client");
var password_1 = require("../src/server/auth/password");
var adapter = new adapter_better_sqlite3_1.PrismaBetterSqlite3({
    url: (_a = process.env.DATABASE_URL) !== null && _a !== void 0 ? _a : 'file:./prisma/database.db',
});
var prisma = new client_1.PrismaClient({ adapter: adapter });
function parseDrivers(csv) {
    var lines = csv
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter(Boolean);
    var header = lines.shift();
    if (header !== 'Registro;Nome;CNH;Unidade;Subunidade;Validade CNH;Status;Data Cadastro') {
        throw new Error('Cabeçalho inesperado em dados_prime_condutores.csv.');
    }
    return lines.map(function (line, index) {
        var columns = line.split(';').map(function (value) { return value.trim(); });
        if (columns.length !== 8) {
            throw new Error("Linha ".concat(index + 2, " inv\u00E1lida em dados_prime_condutores.csv."));
        }
        var matricula = columns[0], nome = columns[1], cnh = columns[2], unidade = columns[3], status = columns[6];
        if (!matricula || !nome || !cnh || !unidade) {
            throw new Error("Linha ".concat(index + 2, " possui campos obrigat\u00F3rios vazios."));
        }
        return {
            matricula: matricula,
            nome: nome,
            cnh: cnh,
            unidade: unidade,
            ativo: status.toUpperCase() === 'ATIVO',
        };
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var csvUrl, drivers, _a, unidades, result;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    csvUrl = new URL('../dados_prime_condutores.csv', import.meta.url);
                    _a = parseDrivers;
                    return [4 /*yield*/, (0, promises_1.readFile)(csvUrl, 'utf8')];
                case 1:
                    drivers = _a.apply(void 0, [_b.sent()]);
                    unidades = __spreadArray([], new Set(drivers.map(function (driver) { return driver.unidade; })), true);
                    return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var secretariaIds, secretariasCriadas, motoristasCriados, motoristasAtualizados, _i, unidades_1, nome, secretaria, _a, drivers_1, driver, existing, secretariaId;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        secretariaIds = new Map();
                                        secretariasCriadas = 0;
                                        motoristasCriados = 0;
                                        motoristasAtualizados = 0;
                                        _i = 0, unidades_1 = unidades;
                                        _b.label = 1;
                                    case 1:
                                        if (!(_i < unidades_1.length)) return [3 /*break*/, 8];
                                        nome = unidades_1[_i];
                                        return [4 /*yield*/, tx.secretaria.findFirst({ where: { nome: nome } })];
                                    case 2:
                                        secretaria = _b.sent();
                                        if (!!secretaria) return [3 /*break*/, 4];
                                        return [4 /*yield*/, tx.secretaria.create({ data: { nome: nome } })];
                                    case 3:
                                        secretaria = _b.sent();
                                        secretariasCriadas += 1;
                                        return [3 /*break*/, 6];
                                    case 4:
                                        if (!!secretaria.ativo) return [3 /*break*/, 6];
                                        return [4 /*yield*/, tx.secretaria.update({
                                                where: { id: secretaria.id },
                                                data: { ativo: true },
                                            })];
                                    case 5:
                                        secretaria = _b.sent();
                                        _b.label = 6;
                                    case 6:
                                        secretariaIds.set(nome, secretaria.id);
                                        _b.label = 7;
                                    case 7:
                                        _i++;
                                        return [3 /*break*/, 1];
                                    case 8:
                                        _a = 0, drivers_1 = drivers;
                                        _b.label = 9;
                                    case 9:
                                        if (!(_a < drivers_1.length)) return [3 /*break*/, 15];
                                        driver = drivers_1[_a];
                                        return [4 /*yield*/, tx.user.findUnique({ where: { matricula: driver.matricula } })];
                                    case 10:
                                        existing = _b.sent();
                                        if (existing && existing.role !== client_1.Role.DRIVER) {
                                            throw new Error("A matr\u00EDcula ".concat(driver.matricula, " j\u00E1 pertence a um usu\u00E1rio com perfil ").concat(existing.role, "."));
                                        }
                                        secretariaId = secretariaIds.get(driver.unidade);
                                        if (!existing) return [3 /*break*/, 12];
                                        return [4 /*yield*/, tx.user.update({
                                                where: { id: existing.id },
                                                data: { nome: driver.nome, secretariaId: secretariaId, ativo: driver.ativo },
                                            })];
                                    case 11:
                                        _b.sent();
                                        motoristasAtualizados += 1;
                                        return [3 /*break*/, 14];
                                    case 12: return [4 /*yield*/, tx.user.create({
                                            data: {
                                                matricula: driver.matricula,
                                                nome: driver.nome,
                                                passwordHash: (0, password_1.hashPassword)(driver.cnh),
                                                role: client_1.Role.DRIVER,
                                                secretariaId: secretariaId,
                                                ativo: driver.ativo,
                                            },
                                        })];
                                    case 13:
                                        _b.sent();
                                        motoristasCriados += 1;
                                        _b.label = 14;
                                    case 14:
                                        _a++;
                                        return [3 /*break*/, 9];
                                    case 15: return [2 /*return*/, { secretariasCriadas: secretariasCriadas, motoristasCriados: motoristasCriados, motoristasAtualizados: motoristasAtualizados }];
                                }
                            });
                        }); })];
                case 2:
                    result = _b.sent();
                    console.log("Seed conclu\u00EDdo: ".concat(drivers.length, " motoristas sincronizados, ") +
                        "".concat(result.motoristasCriados, " criados, ").concat(result.motoristasAtualizados, " atualizados e ") +
                        "".concat(result.secretariasCriadas, " secretarias criadas."));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (error) {
    console.error('Falha ao executar o seed:', error);
    process.exitCode = 1;
})
    .finally(function () { return prisma.$disconnect(); });
