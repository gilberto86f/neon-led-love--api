import { Router } from "express";
import { pricesController } from "../controllers/prices.controller";

const router = Router();

router.get("/custom", pricesController.getCustom);
router.put("/custom", pricesController.updateCustom);

export default router;
