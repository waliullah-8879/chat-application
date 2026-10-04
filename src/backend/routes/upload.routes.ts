import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";

export const uploadRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure uploads folder exists
void fs.mkdir(UPLOADS_DIR, { recursive: true }).catch((err) => {
  console.error("Failed to create uploads directory", err);
});

uploadRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, type, data } = req.body as { name?: string; type?: string; data?: string };

    if (!data || typeof data !== "string") {
      res.status(400).json({ success: false, message: "No file data provided." });
      return;
    }

    // Extract base64 payload (handles data:mime;base64,xxxx or raw base64)
    const base64Index = data.indexOf(";base64,");
    const rawBase64 = base64Index !== -1 ? data.slice(base64Index + 8) : data;

    const buffer = Buffer.from(rawBase64, "base64");

    // Max 25 MB limit
    if (buffer.length > 25 * 1024 * 1024) {
      res.status(413).json({ success: false, message: "File exceeds 25 MB size limit." });
      return;
    }

    // Clean original filename
    const originalName = (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    const extension = path.extname(originalName) || (type?.includes("audio") ? ".webm" : ".bin");
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const filename = `${Date.now()}-${uniqueId}${extension}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    await fs.writeFile(filePath, buffer);

    res.json({
      success: true,
      data: {
        url: `/uploads/${filename}`,
        name: originalName,
        size: buffer.length,
        type: type || "application/octet-stream",
      },
    });
  } catch (error) {
    next(error);
  }
});
