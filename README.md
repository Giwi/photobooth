# Photobooth

A web-based photobooth built with Node.js and TypeScript. Captures photos from a webcam, overlays PNG backgrounds, and saves or prints the result. Output is sized 10×15 cm (3:2 ratio, 1800×1200 px at 300 DPI) for printing on standard photo paper.

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:3000` in a browser with webcam access.

Or use the launch script (starts the server and opens a fullscreen browser):

```bash
./start.sh
```

## How it works

1. The live webcam feed fills the viewport (mirrored by default for a natural selfie view)
2. Select a background from the top bar — it overlays the video in real time
3. Click the capture button (or tap the screen / press Space) — 3-2-1 countdown, then flash
4. Preview the result, then choose **Save**, **Print**, or **Discard**

## Photo strip

Toggle strip mode (grid icon in the settings bar, or press `T`) to capture 4 shots in sequence. Each shot has its own countdown. The photos are arranged in a 2×2 grid and saved/printed as one image.

## Mirror mode

The webcam feed is mirrored by default (like a mirror). Toggle it off with the arrow icon in the settings bar or press `M`.

## Backgrounds

Place image files (PNG, JPG, WebP, SVG) in the `backgrounds/` folder. They appear automatically in the UI.

The "No BG" option (grey frame with cross) captures the raw webcam frame with no overlay.

Backgrounds are fitted to the canvas (contain mode) — the full image is visible with letterboxing if the aspect ratio doesn't match.

### Custom position

Use `config.json` to override where a background is placed on the canvas:

```json
{
  "watermark": "© 2026 My Photobooth",
  "backgrounds": {
    "beach.png": { "position": "bottom right" },
    "sky.png": { "position": "top" },
    "frame.png": { "position": "50% 25%" }
  }
}
```

Position format: `[y] [x]`

| Value | Meaning |
|-------|---------|
| `top` | Aligned to top edge |
| `bottom` | Aligned to bottom edge |
| `left` | Aligned to left edge |
| `right` | Aligned to right edge |
| `30%` | 30% from the top (if first) or from the left (if second) |

Examples:
- `"bottom"` — centered horizontally, aligned to bottom
- `"top right"` — top-right corner
- `"50% 25%"` — vertically centered, 25% from the left

Without a position, backgrounds are centered on the canvas.

## Watermark

Add an optional watermark text displayed on a translucent bar at the bottom of every captured photo:

```json
{
  "watermark": "© 2026 My Photobooth",
  "backgrounds": { ... }
}
```

Omit or leave empty to disable.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Capture |
| `s` | Save |
| `Enter` | Save and print |
| `Escape` | Discard |
| `←` `→` | Cycle backgrounds |
| `m` | Toggle mirror mode |
| `t` | Toggle strip mode |

## Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `PHOTOBOOTH_BACKGROUNDS` | `./backgrounds` | Path to the backgrounds folder |

The server port is `3000` (set in `src/server.ts`).

## Printing

Photos are printed via the system `lp` command (CUPS on Linux). Set up a default printer before using the print feature:

```bash
lpstat -p              # list available printers
lpoptions -d <printer>  # set default
```

Printing is only triggered by the **Print** button or the `Enter` shortcut, not by Save.

## Tech stack

- **Server**: Express + tsx (no build step)
- **Client**: Vanilla HTML/CSS/JS (ES modules)
- **Camera**: `navigator.mediaDevices.getUserMedia`
- **Compositing**: Canvas 2D API
- **Printing**: `lp` (CUPS)
