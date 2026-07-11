const video = document.getElementById("video");
const liveCanvas = document.getElementById("live-canvas");
const liveCtx = liveCanvas.getContext("2d");
const compositor = document.getElementById("compositor");
const ctx = compositor.getContext("2d");
const flash = document.getElementById("flash");
const countdown = document.getElementById("countdown");
const preview = document.getElementById("preview");
const previewImg = document.getElementById("preview-img");
const btnSave = document.getElementById("btn-save");
const btnPrint = document.getElementById("btn-print");
const btnCancel = document.getElementById("btn-cancel");
const backgroundsEl = document.getElementById("backgrounds");
const captureBtn = document.getElementById("capture");

const W = 1280;
const H = 720;
liveCanvas.width = W;
liveCanvas.height = H;
compositor.width = W;
compositor.height = H;

const NO_BG_SVG = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="56"><rect x="4" y="4" width="72" height="48" rx="6" fill="none" stroke="#888" stroke-width="2.5"/><line x1="18" y1="14" x2="62" y2="42" stroke="#888" stroke-width="2.5" stroke-linecap="round"/><line x1="62" y1="14" x2="18" y2="42" stroke="#888" stroke-width="2.5" stroke-linecap="round"/></svg>`);

let selectedBg = 0;
let backgrounds = []; // [{ file, position }, ...]  index 0 = null (No BG)
let bgImage = null;
let bgReady = false;
let busy = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Position parser ---
// "top", "bottom", "left", "right", "30%", "top right", "bottom 25%", "50% 70%"
function parsePosition(pos) {
  if (!pos) return { x: 0.5, y: 0.5 };
  const parts = pos.trim().split(/\s+/);
  let x = 0.5, y = 0.5;
  let xSet = false, ySet = false;
  for (const p of parts) {
    if (p === "top") { y = 0; ySet = true; }
    else if (p === "bottom") { y = 1; ySet = true; }
    else if (p === "left") { x = 0; xSet = true; }
    else if (p === "right") { x = 1; xSet = true; }
    else if (p.endsWith("%")) {
      const v = parseFloat(p) / 100;
      if (!ySet) { y = v; ySet = true; }
      else { x = v; xSet = true; }
    }
  }
  return { x, y };
}

// --- Image loading ---

function loadBgImage(src) {
  bgImage = new Image();
  bgReady = false;
  bgImage.onload = () => { bgReady = true; drawBg(); };
  bgImage.src = src;
}

function clearBg() {
  bgImage = null;
  bgReady = false;
  liveCtx.clearRect(0, 0, W, H);
}

function drawBgTo(c, img, cw, ch, position) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.min(cw / iw, ch / ih);
  const sw = iw * scale;
  const sh = ih * scale;
  const { x, y } = parsePosition(position);
  c.drawImage(img, (cw - sw) * x, (ch - sh) * y, sw, sh);
}

function drawBg() {
  liveCtx.clearRect(0, 0, W, H);
  if (bgReady) {
    const pos = backgrounds[selectedBg]?.position || null;
    drawBgTo(liveCtx, bgImage, W, H, pos);
  }
}

function applyBg(i) {
  selectedBg = i;
  const bg = backgrounds[i];
  if (!bg) {
    clearBg();
  } else {
    loadBgImage(`/backgrounds/${encodeURIComponent(bg.file)}`);
  }
  updateBgSelection();
}

// --- Backgrounds UI ---

function renderBackgrounds() {
  backgroundsEl.innerHTML = "";
  backgrounds.forEach((bg, i) => {
    const thumb = document.createElement("div");
    thumb.className = "bg-thumb";
    if (!bg) {
      thumb.style.backgroundImage = `url("${NO_BG_SVG}")`;
    } else {
      thumb.style.backgroundImage = `url(/backgrounds/${encodeURIComponent(bg.file)})`;
    }
    thumb.addEventListener("click", () => applyBg(i));
    backgroundsEl.appendChild(thumb);
  });
  updateBgSelection();
}

function updateBgSelection() {
  backgroundsEl.querySelectorAll(".bg-thumb").forEach((el, i) => {
    el.classList.toggle("selected", i === selectedBg);
  });
}

// --- Capture ---

captureBtn.addEventListener("click", capture);

async function capture() {
  if (busy) return;
  busy = true;
  captureBtn.disabled = true;

  for (let i = 3; i >= 1; i--) {
    countdown.textContent = i;
    countdown.style.display = "flex";
    await sleep(700);
    countdown.style.display = "none";
    await sleep(100);
  }

  flash.classList.add("active");
  await sleep(80);
  flash.classList.remove("active");

  ctx.drawImage(video, 0, 0, W, H);
  if (bgReady) {
    const pos = backgrounds[selectedBg]?.position || null;
    drawBgTo(ctx, bgImage, W, H, pos);
  }

  const dataUrl = compositor.toDataURL("image/png");
  previewImg.src = dataUrl;
  preview.hidden = false;

  const action = await new Promise((resolve) => {
    btnSave.onclick = () => { preview.hidden = true; resolve("save"); };
    btnPrint.onclick = () => { preview.hidden = true; resolve("print"); };
    btnCancel.onclick = () => { preview.hidden = true; resolve("cancel"); };
  });

  if (action === "save" || action === "print") {
    fetch("/api/photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, print: action === "print" }),
    }).catch((e) => console.error("Save/print failed:", e));
  }

  busy = false;
  captureBtn.disabled = false;
}

// --- Keyboard ---

document.addEventListener("keydown", (e) => {
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    if (!busy) capture();
  } else if (e.key === "Enter") {
    if (!preview.hidden) btnPrint.onclick();
  } else if (e.key === "s" || e.key === "S") {
    if (!preview.hidden) btnSave.onclick();
  } else if (e.key === "Escape") {
    if (!preview.hidden) btnCancel.onclick();
  } else if (e.key === "ArrowLeft") {
    if (!busy && backgrounds.length) applyBg((selectedBg - 1 + backgrounds.length) % backgrounds.length);
  } else if (e.key === "ArrowRight") {
    if (!busy && backgrounds.length) applyBg((selectedBg + 1) % backgrounds.length);
  }
});

// --- Init ---

async function init() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: W }, height: { ideal: H } },
  });
  video.srcObject = stream;
  await video.play();

  const res = await fetch("/api/backgrounds");
  backgrounds = [null, ...await res.json()];
  renderBackgrounds();
  applyBg(0);
}

init().catch((e) => {
  console.error("Init failed:", e);
});
