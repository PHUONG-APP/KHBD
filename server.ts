import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { generateLessonPlan, regenerateActivitySection } from "./server/geminiService";
import { generateLessonContent, generateFullLessonPlan } from "./server/gemini";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generate-lesson-plan", async (req, res) => {
    try {
      const result = await generateLessonPlan(req.body);
      res.json({ result });
    } catch (error: any) {
      console.error("API error /api/generate-lesson-plan:", error);
      res.status(500).json({ error: true, message: error?.message || "Có lỗi xảy ra khi tạo kế hoạch bài dạy." });
    }
  });

  app.post("/api/regenerate-activity", async (req, res) => {
    try {
      const result = await regenerateActivitySection(req.body);
      res.json({ result });
    } catch (error: any) {
      console.error("API error /api/regenerate-activity:", error);
      res.status(500).json({ error: true, message: error?.message || "Có lỗi xảy ra khi soạn lại hoạt động." });
    }
  });

  app.post("/api/generate-lesson-content", async (req, res) => {
    try {
      const { prompt, section } = req.body;
      const result = await generateLessonContent(prompt, section);
      res.json({ result });
    } catch (error: any) {
      console.error("API error /api/generate-lesson-content:", error);
      res.status(500).json({ error: true, message: error?.message || "Có lỗi xảy ra khi sinh nội dung." });
    }
  });

  app.post("/api/generate-full-lesson-plan", async (req, res) => {
    try {
      const result = await generateFullLessonPlan(req.body);
      res.json({ result });
    } catch (error: any) {
      console.error("API error /api/generate-full-lesson-plan:", error);
      res.status(500).json({ error: true, message: error?.message || "Có lỗi xảy ra khi sinh toàn bộ giáo án." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
