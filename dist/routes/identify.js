"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const contactService_1 = require("../utils/contactService");
const router = express_1.default.Router();
//@ts-ignore
router.post('/', contactService_1.handleIdentify);
exports.default = router;
