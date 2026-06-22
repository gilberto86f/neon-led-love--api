import { Router } from "express";
import { slideController } from "../controllers/slide.controller";
import { authorize } from "../middlewares/authGuard";

const router = Router();

const staff = authorize("super", "admin");

router.get("/", slideController.list);
router.post("/", staff, slideController.create);
// reorder must be registered before /:id to prevent "reorder" from matching as an id
router.put("/reorder", staff, slideController.reorder);
router.get("/:id", slideController.getById);
router.put("/:id", staff, slideController.update);

export default router;
