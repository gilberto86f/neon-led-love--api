import { Router } from "express";
import { imageController } from "../controllers/image.controller";
import { validateUploadType, handleUpload } from "../middlewares/upload.middleware";

const router = Router();

router.post("/upload/:type", validateUploadType, handleUpload, imageController.upload);
router.delete("/", imageController.remove);

export default router;
