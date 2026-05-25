import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { jwtAuthGuard } from "../middlewares/authGuard";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/verify-account", authController.verifyAccount);
router.post("/logout", jwtAuthGuard, authController.logout);
router.get("/me", jwtAuthGuard, authController.me);

export default router;
