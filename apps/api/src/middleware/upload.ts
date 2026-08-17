import multer from "multer";

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/octet-stream", // some browsers send this for .xlsx — extension is checked too
]);

// Memory storage only — files are parsed in-process and never written to
// disk, so there is nothing left behind to clean up or leak.
export const uploadWorkbook = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const looksLikeXlsx = file.originalname.toLowerCase().endsWith(".xlsx");
    if (looksLikeXlsx && ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx Excel files are accepted"));
    }
  },
}).single("file");
