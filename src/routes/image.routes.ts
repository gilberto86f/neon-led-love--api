import { Router, Request, Response, NextFunction } from "express";
import { imageController } from "../controllers/image.controller";
import { validateUploadType, handleUpload } from "../middlewares/upload.middleware";
import { authorize, jwtAuthGuard, requireRole } from "../middlewares/authGuard";

const router = Router();

// Customers may upload to "quotes" (custom-quote / checkout flow) without an
// account; uploading product/category/slide assets is staff-only. Authorize
// before accepting the file so an unauthorized upload is rejected early.
const authorizeImageUpload = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.type === "quotes") return next();
  jwtAuthGuard(req, res, (err?: unknown) =>
    err ? next(err) : requireRole("super", "admin")(req, res, next),
  );
};

router.post(
  "/upload/:type",
  validateUploadType,
  authorizeImageUpload,
  handleUpload,
  imageController.upload,
);
router.delete("/", authorize("super", "admin"), imageController.remove);

export default router;
