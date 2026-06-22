import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { authorize, jwtAuthGuard } from "../middlewares/authGuard";

const router = Router();

// Listing all users is staff-only; check-email is a public signup helper.
router.get("/", authorize("super", "admin"), userController.list);
router.get("/check-email", userController.checkEmail);

// Read/update/delete a specific user require authentication; the controller
// enforces ownership (clients may only touch their own account, only super
// may manage others). Creating users is super-only.
router.get("/:id", jwtAuthGuard, userController.getById);
router.post("/", authorize("super"), userController.create);
router.put("/:id", jwtAuthGuard, userController.update);
router.delete("/:id", jwtAuthGuard, userController.remove);

export default router;
