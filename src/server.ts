import express from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

const app = express();
const PORT = 3000;
const ROOT = path.resolve();
const PHOTOS_DIR = path.join(ROOT, "photos");
const BG_DIR = path.join(process.env.PHOTOBOOTH_BACKGROUNDS || path.join(ROOT, "backgrounds"));
const CONFIG_PATH = path.join(ROOT, "config.json");

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

await fs.mkdir(PHOTOS_DIR, { recursive: true });
await fs.mkdir(BG_DIR, { recursive: true });

app.get("/api/backgrounds", async (_req, res) => {
  try {
    const files = await fs.readdir(BG_DIR);
    const bgFiles = files.filter((f) => /\.(png|jpe?g|svg|webp)$/i.test(f));
    let config: Record<string, { position?: string }> = {};
    try {
      config = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8")).backgrounds || {};
    } catch {}
    res.json(bgFiles.map((f) => ({ file: f, position: config[f]?.position || null })));
  } catch {
    res.json([]);
  }
});

app.get("/backgrounds/:file", async (req, res) => {
  const filepath = path.join(BG_DIR, path.basename(req.params.file));
  try {
    const data = await fs.readFile(filepath);
    const ext = path.extname(filepath).toLowerCase();
    const types = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
    };
    res.type(types[ext] || "application/octet-stream").send(data);
  } catch {
    res.status(404).end();
  }
});

app.post("/api/photo", async (req, res) => {
  const { image, print } = req.body;
  if (!image || typeof image !== "string")
    return res.status(400).json({ error: "No image" });

  const base64 = image.split(",")[1];
  if (!base64) return res.status(400).json({ error: "Invalid image data" });

  const buffer = Buffer.from(base64, "base64");
  const filename = `photo-${Date.now()}.png`;
  const filepath = path.join(PHOTOS_DIR, filename);

  await fs.writeFile(filepath, buffer);
  console.log(`Saved ${filepath}`);

  if (print) {
    execFile("lp", [filepath], (err, _stdout, stderr) => {
      if (err) console.error("Print failed:", stderr || err.message);
      else console.log(`Printed ${filename}`);
    });
  }

  res.json({ filename });
});

app.listen(PORT, () => {
  console.log(`Photobooth → http://localhost:${PORT}`);
  console.log(`Backgrounds → ${BG_DIR}`);
});
