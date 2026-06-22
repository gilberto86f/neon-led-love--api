import { Router } from "express";
import { pricesController } from "../controllers/prices.controller";
import { authorize } from "../middlewares/authGuard";

const router = Router();

router.get("/custom", pricesController.getCustom);
router.put("/custom", authorize("super", "admin"), pricesController.updateCustom);

export default router;
