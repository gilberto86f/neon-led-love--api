import { Router } from "express";
import { quoteController } from "../controllers/quote.controller";
import { authorize, jwtAuthGuard } from "../middlewares/authGuard";

const router = Router();

// Create is public — guests may request a custom-neon quote. List and read
// require authentication; the controller scopes clients to their own quotes and
// enforces ownership. Update is client-own or staff (controller-checked); only
// staff (super/admin) may delete.
router.post("/", quoteController.create);
router.get("/", jwtAuthGuard, quoteController.list);
router.get("/:id", jwtAuthGuard, quoteController.getById);
router.put("/:id", jwtAuthGuard, quoteController.update);
router.delete("/:id", authorize("super", "admin"), quoteController.remove);

export default router;
