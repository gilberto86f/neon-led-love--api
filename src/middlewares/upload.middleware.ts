import multer from "multer";
import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/HttpError";

const VALID_TYPES = new Set(["products", "quotes", "categories", "slides"]);

const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "application/pdf",
  "application/postscript", // .ai
  "application/illustrator", // .ai (some clients)
]);

const ALLOWED_EXTS = new Set([".png", ".jpeg", ".jpg", ".gif", ".pdf", ".ai"]);

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const sanitizeName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const type = (req.params as { type: string }).type;
    const dir = path.join(process.cwd(), "uploads", type);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = sanitizeName(path.basename(file.originalname, ext));
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${base}${ext}`;
    cb(null, unique);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIMES.has(file.mimetype) || (ext === ".ai")) {
    cb(null, true);
  } else {
    cb(new HttpError(400, `File type not allowed. Allowed: png, jpeg, jpg, gif, pdf, ai`));
  }
};

const multerInstance = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } });

export const validateUploadType = (req: Request, _res: Response, next: NextFunction) => {
  const { type } = req.params as { type: string };
  if (!VALID_TYPES.has(type)) {
    return next(
      new HttpError(400, `Invalid upload type "${type}". Allowed: ${[...VALID_TYPES].join(", ")}`)
    );
  }
  next();
};

export const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  multerInstance.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? "File too large. Maximum allowed size is 20 MB."
          : err.message;
      return next(new HttpError(400, msg));
    }
    next(err);
  });
};
