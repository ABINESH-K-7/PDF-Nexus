import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";

import {
  getFileTree,
  saveFileTree
} from "../controllers/fileController.js";

import { isAuthenticated } from "../middleware/isAuthenticated.js";

const router = express.Router();

const ingestRagPdf = async ({ fileId, userId }) => {
  const ragServiceUrl = process.env.RAG_SERVICE_URL
  if (!ragServiceUrl) throw new Error("RAG_SERVICE_URL is not configured")
  const response = await fetch(`${ragServiceUrl}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId, user_id: userId }),
    signal: AbortSignal.timeout(10 * 60 * 1000)
  });
  if (!response.ok) throw new Error(await response.text());
};


/* =========================
   FILE TREE ROUTES
========================= */

router.get("/", isAuthenticated, getFileTree);

router.post("/", isAuthenticated, saveFileTree);


/* =========================
   MULTER MEMORY STORAGE
========================= */

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});


/* =========================
   PDF UPLOAD → GRIDFS
========================= */

router.post(
  "/upload",
  isAuthenticated,
  upload.single("file"),
  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded"
        });
      }


      // Optional: allow only PDFs for now
      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({
          success: false,
          message: "Only PDF files are supported"
        });
      }


      // Create GridFS bucket
      const bucket = new GridFSBucket(
        mongoose.connection.db,
        {
          bucketName: "fs"
        }
      );


      // Upload to MongoDB GridFS
      const uploadStream = bucket.openUploadStream(
        req.file.originalname,
        {
          contentType: req.file.mimetype,

          metadata: {
            userId: req.userId.toString(),
            originalName: req.file.originalname
          }
        }
      );


      // Handle upload completion
      uploadStream.on("error", (error) => {

        console.error("GridFS Upload Error:", error);

        return res.status(500).json({
          success: false,
          message: "Failed to upload file"
        });
      });


      uploadStream.on("finish", async () => {

        const fileId = uploadStream.id.toString();

        console.log("PDF uploaded to GridFS:", fileId);

        // Keep GridFS as the source of truth; RAG indexing runs independently
        // so an unavailable Python service never makes an upload fail.
        void ingestRagPdf({ fileId, userId: req.userId.toString() })
          .catch((error) => console.error("RAG indexing failed:", error.message));


        return res.json({
          success: true,

          id: fileId,

          gridFsId: fileId,

          name: req.file.originalname,

          fileType: "pdf",

          url: `/files/${fileId}/view`
        });

      });


      // Write memory buffer into GridFS
      uploadStream.end(req.file.buffer);


    } catch (error) {

      console.error("Upload Error:", error);

      return res.status(500).json({
        success: false,
        message: error.message
      });

    }

  }
);

router.post("/:fileId/ingest", isAuthenticated, async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!ObjectId.isValid(fileId)) return res.status(400).json({ success: false, message: "Invalid file ID" });
    const file = await mongoose.connection.db.collection("fs.files").findOne({
      _id: new ObjectId(fileId), "metadata.userId": req.userId.toString()
    });
    if (!file) return res.status(404).json({ success: false, message: "PDF not found" });
    await ingestRagPdf({ fileId, userId: req.userId.toString() });
    res.json({ success: true, file_id: fileId, message: "PDF ingested successfully" });
  } catch (error) {
    res.status(502).json({ success: false, message: "Unable to ingest PDF", detail: error.message });
  }
});


/* =========================
   VIEW PDF FROM GRIDFS
========================= */

router.get(
  "/:fileId/view",
  isAuthenticated,
  async (req, res) => {

    try {

      const { fileId } = req.params;


      if (!ObjectId.isValid(fileId)) {

        return res.status(400).json({
          success: false,
          message: "Invalid file ID"
        });

      }


      const bucket = new GridFSBucket(
        mongoose.connection.db,
        {
          bucketName: "fs"
        }
      );


      // Get file metadata
      const files = await mongoose.connection.db
        .collection("fs.files")
        .find({
          _id: new ObjectId(fileId)
        })
        .toArray();


      if (!files.length) {

        return res.status(404).json({
          success: false,
          message: "File not found"
        });

      }


      const file = files[0];


      // Security check
      if (
        file.metadata?.userId !== req.userId.toString()
      ) {

        return res.status(403).json({
          success: false,
          message: "Unauthorized access"
        });

      }


      res.setHeader(
        "Content-Type",
        file.contentType || "application/pdf"
      );


      res.setHeader(
        "Content-Disposition",
        `inline; filename="${file.filename}"`
      );


      const downloadStream =
        bucket.openDownloadStream(
          new ObjectId(fileId)
        );


      downloadStream.pipe(res);


      downloadStream.on(
        "error",
        (error) => {

          console.error(
            "GridFS Download Error:",
            error
          );

          if (!res.headersSent) {

            res.status(404).json({
              success: false,
              message: "File not found"
            });

          }

        }
      );


    } catch (error) {

      console.error("View PDF Error:", error);

      res.status(500).json({
        success: false,
        message: error.message
      });

    }

  }
);


export default router;
