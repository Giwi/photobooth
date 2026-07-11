# Photobooth

A web-based photobooth built with Node.js and TypeScript. Captures photos from a webcam, overlays PNG backgrounds, and saves or prints the result.

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

1. The live webcam feed fills the viewport
2. Select a background from the top bar — it overlays the video in real time
3. Click the capture button (or press Space) — 3-2-1 countdown, then flash
4. Preview the result, then choose **Save**, **Print**, or **Discard**

## Backgrounds

Place image files (PNG, JPG, WebP, SVG) in the `backgrounds/` folder. They appear automatically in the UI.

The "No BG" option (grey frame with cross) captures the raw webcam frame with no overlay.

Backgrounds are fitted to the canvas (contain mode) — the full image is visible with letterboxing if the aspect ratio doesn't match.

### Custom position

Use `config.json` to override where a background is placed on the canvas:

```json
{
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

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Capture |
| `s` | Save |
| `Enter` | Save and print |
| `Escape` | Discard |
| `←` `→` | Cycle backgrounds |

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
