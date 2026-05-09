import { Request, Response, NextFunction } from "express";
import { imageService } from "../services/image.service";
import { ok } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";

export const imageController = {
  upload: (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new HttpError(400, "No file provided. Send the file in the \"file\" field.");
      const result = imageService.uploadImage(req.file, req.params.type as string);
      res.status(201).json(ok(result, 201));
    } catch (err) {
      next(err);
    }
  },

  remove: (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageUrl = req.query.imageUrl as string;
      if (!imageUrl) throw new HttpError(400, "Query param \"imageUrl\" is required");
      imageService.deleteImage(imageUrl);
      res.status(200).json(ok({ deleted: true, imageUrl }));
    } catch (err) {
      next(err);
    }
  },
};
