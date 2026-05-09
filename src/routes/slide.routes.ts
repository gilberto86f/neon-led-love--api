import { Router } from "express";
import { slideController } from "../controllers/slide.controller";

const router = Router();

router.get("/", slideController.list);
router.post("/", slideController.create);
// reorder must be registered before /:id to prevent "reorder" from matching as an id
router.put("/reorder", slideController.reorder);
router.get("/:id", slideController.getById);
router.put("/:id", slideController.update);

export default router;
