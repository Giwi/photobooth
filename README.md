# Photobooth

A web-based photobooth built with Node.js and TypeScript. Captures photos from a webcam, overlays PNG backgrounds, and saves or prints the result. Output is sized 10×15 cm (landscape, 1800×1200 px at 300 DPI) for printing on standard photo paper.

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
3. Click the capture button (or press Space) — countdown, then flash
4. Preview the result, then choose **Save**, **Print**, or **Discard**

## Features

- **Mirror mode** — on by default, toggle with the arrow icon or keyboard shortcut
- **Photo strip** — captures 4 shots in a 2×2 grid
- **Custom countdown** — choose 3s, 5s, or 10s from the settings bar
- **Camera picker** — switch between connected webcams from the settings bar
- **Watermark** — optional text on a translucent bar at the bottom of every photo
- **Backgrounds** — fit inside the canvas preserving aspect ratio, with configurable position
- **Gamepad support** — navigate backgrounds and trigger actions with a gamepad
- **I18n** — English, French, German, Spanish (set `lang` in `config.json`)
- **Toast notifications** — save/print feedback and device connection alerts
- **Help popup** — keyboard shortcut reference accessible from the settings bar

## Backgrounds

Place image files (PNG, JPG, WebP, SVG) in the `backgrounds/` folder. They appear automatically in the UI.

The "No BG" option (grey frame with cross) captures the raw webcam frame with no overlay.

Backgrounds are scaled to fit inside the canvas while preserving their aspect ratio. Use `config.json` to control where each background is positioned.

### Custom position

```json
{
  "watermark": "© 2026 My Photobooth",
  "lang": "en",
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

Keyboard shortcuts are configurable in `config.json` under the `keys` section. The default mapping:

| Key | Action |
|-----|--------|
| `Space` | Capture |
| `s` | Save |
| `Enter` | Save and print |
| `Escape` | Discard |
| `←` `→` | Cycle backgrounds |
| `m` | Toggle mirror mode |
| `t` | Toggle strip mode |

A keyboard shortcut reference is available from the help button (keyboard icon) in the settings bar.

## Gamepad support

Connect a gamepad and use it to control the photobooth. Button and axis bindings are configurable in `config.json`:

```json
{
  "gamepad": {
    "capture": 0,
    "save": 2,
    "print": 3,
    "cancel": 1,
    "prevBg": 14,
    "nextBg": 15,
    "mirror": 8,
    "strip": 9,
    "prevBgAxis": { "axis": 0, "dir": -1 },
    "nextBgAxis": { "axis": 0, "dir": 1 }
  }
}
```

Values are either a button index (number) or an axis binding (`{ "axis": N, "dir": -1|1 }`). Standard gamepad layout: 0=A, 1=B, 2=X, 3=Y, 8=LB, 9=RB, 14=DPadLeft, 15=DPadRight. Axis 0 = left stick X.

## I18n

Set the language in `config.json`:

```json
{ "lang": "fr" }
```

Supported languages: `en` (default), `fr`, `de`, `es`. Translation files are in the `i18n/` folder.

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `lang` | `"en"` | UI language (`en`, `fr`, `de`, `es`) |
| `watermark` | `null` | Watermark text on captured photos |
| `keys` | (see above) | Keyboard shortcut bindings |
| `gamepad` | (see above) | Gamepad button/axis bindings |
| `backgrounds` | `{}` | Per-background position overrides |

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `PHOTOBOOTH_BACKGROUNDS` | `./backgrounds` | Path to the backgrounds folder |

The server port is `3000` (set in `src/server.ts`).

## Printing

Photos are printed via the system `lp` command (CUPS on Linux) on 4×6in glossy photo paper. Set up a default printer before using the print feature:

```bash
lpstat -p              # list available printers
lpoptions -d <printer>  # set default
```

Printing is only triggered by the **Print** button or the print shortcut, not by Save.

## Raspberry Pi

`start.sh` includes `--no-sandbox` and `--disable-gpu` flags for Chromium compatibility on Raspberry Pi.

## Tech stack

- **Server**: Express + tsx (no build step)
- **Client**: Vanilla HTML/CSS/JS (ES modules)
- **Icons**: Bootstrap Icons
- **Camera**: `navigator.mediaDevices.getUserMedia`
- **Compositing**: Canvas 2D API
- **Gamepad**: Gamepad API
- **Printing**: `lp` (CUPS)
