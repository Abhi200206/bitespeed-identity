import express from 'express';
import { handleIdentify } from '../utils/contactService';

const router = express.Router();
//@ts-ignore
router.post('/', handleIdentify);

export default router;
