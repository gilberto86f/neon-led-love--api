import { Router } from "express";
import { orderController } from "../controllers/order.controller";
import { authorize, jwtAuthGuard } from "../middlewares/authGuard";

const router = Router();

// List and read require authentication; the controller scopes clients to their
// own orders. Create, edit and status transitions are staff-only; only super may
// delete — and only an order that never took money (see orderService.deleteOrder).
router.get("/", jwtAuthGuard, orderController.list);
router.get("/:id", jwtAuthGuard, orderController.getById);
router.get("/:id/status-history", jwtAuthGuard, orderController.statusHistory);
router.post("/", authorize("super", "admin"), orderController.create);
router.put("/:id", authorize("super", "admin"), orderController.update);
router.patch("/:id/status", authorize("super", "admin"), orderController.updateStatus);
router.delete("/:id", authorize("super"), orderController.remove);

export default router;
