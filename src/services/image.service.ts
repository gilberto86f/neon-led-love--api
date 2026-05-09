import path from "path";
import fs from "fs";
import { HttpError } from "../utils/HttpError";

export const imageService = {
  uploadImage: (file: Express.Multer.File, type: string) => {
    const imageUrl = `/uploads/${type}/${file.filename}`;
    return { imageUrl };
  },

  deleteImage: (imageUrl: string) => {
    if (!imageUrl.startsWith("/uploads/")) {
      throw new HttpError(400, "Invalid imageUrl: must start with /uploads/");
    }
    const filePath = path.join(process.cwd(), imageUrl);
    if (!fs.existsSync(filePath)) {
      throw new HttpError(404, `File not found: ${imageUrl}`);
    }
    fs.unlinkSync(filePath);
  },
};
