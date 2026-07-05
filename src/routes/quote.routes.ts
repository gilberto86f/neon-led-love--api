import { Router } from "express";
import { quoteController } from "../controllers/quote.controller";
import { authorize, jwtAuthGuard } from "../middlewares/authGuard";

const router = Router();

// Create is public — guests may request a custom-neon quote. List and read
// require authentication; the controller scopes clients to their own quotes and
// enforces ownership. Update is staff-only (super/admin); only super may delete.
router.post("/", quoteController.create);
router.get("/", jwtAuthGuard, quoteController.list);
router.get("/:id", jwtAuthGuard, quoteController.getById);
router.put("/:id", authorize("super", "admin"), quoteController.update);
router.delete("/:id", authorize("super"), quoteController.remove);

export default router;
