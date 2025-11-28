import { Router } from "express";
import { list, record, listbyItem } from './stock_movement.controller';
import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";
import { blockIfDayClosed } from "../../middleware/blockIfDayClosed";
const router = Router();

router.get('/', auth, allowRoles("admin", "manager"), list);
router.get('/:id', auth, allowRoles("admin", "manager"), listbyItem);
router.post('/', auth, blockIfDayClosed({ field: "created_at", source: "body" }), record);

export default router;