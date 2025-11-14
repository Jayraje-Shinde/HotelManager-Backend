import { Router } from "express";
import { list, record, listbyItem } from './stock_movement.controller';

const router = Router();

router.get('/', list);
router.get('/:id', listbyItem);
router.post('/', record);

export default router;