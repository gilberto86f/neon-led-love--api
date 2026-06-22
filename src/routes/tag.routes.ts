import { Router } from "express";
import { tagController } from "../controllers/tag.controller";
import { authorize } from "../middlewares/authGuard";

const router = Router();

const staff = authorize("super", "admin");

router.get("/", tagController.list);
router.get("/:slug", tagController.getBySlug);
router.post("/", staff, tagController.create);
router.put("/:id", staff, tagController.update);
router.delete("/:id", staff, tagController.remove);

export default router;
