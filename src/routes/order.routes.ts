import { Router } from "express";
import { orderController } from "../controllers/order.controller";
import { authorize, jwtAuthGuard } from "../middlewares/authGuard";

const router = Router();

// List and read require authentication; the controller scopes clients to their
// own orders. Create/update are staff-only; only super may delete.
router.get("/", jwtAuthGuard, orderController.list);
router.get("/:id", jwtAuthGuard, orderController.getById);
router.post("/", authorize("super", "admin"), orderController.create);
router.put("/:id", authorize("super", "admin"), orderController.update);
router.delete("/:id", authorize("super"), orderController.remove);

export default router;
