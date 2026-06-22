import { Router } from "express";
import { categoryController } from "../controllers/category.controller";
import { authorize } from "../middlewares/authGuard";

const router = Router();

const staff = authorize("super", "admin");

router.get("/", categoryController.list);
router.get("/:slug", categoryController.getBySlug);
router.post("/", staff, categoryController.create);
router.put("/:id", staff, categoryController.update);
router.delete("/:id", staff, categoryController.remove);

export default router;
