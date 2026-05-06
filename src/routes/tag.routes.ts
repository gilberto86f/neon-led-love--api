import { Router } from "express";
import { tagController } from "../controllers/tag.controller";

const router = Router();

router.get("/", tagController.list);
router.get("/:slug", tagController.getBySlug);
router.post("/", tagController.create);
router.put("/:id", tagController.update);
router.delete("/:id", tagController.remove);

export default router;
