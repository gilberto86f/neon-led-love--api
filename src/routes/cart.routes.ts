import { Router } from "express";
import { cartController } from "../controllers/cart.controller";

const router = Router();

router.post("/validate", cartController.validate);

export default router;
