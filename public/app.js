const video = document.getElementById("video");
const liveCanvas = document.getElementById("live-canvas");
const liveCtx = liveCanvas.getContext("2d");
const compositor = document.getElementById("compositor");
const ctx = compositor.getContext("2d");
const flash = document.getElementById("flash");
const countdownEl = document.getElementById("countdown");
const preview = document.getElementById("preview");
const previewImg = document.getElementById("preview-img");
const btnSave = document.getElementById("btn-save");
const btnPrint = document.getElementById("btn-print");
const btnCancel = document.getElementById("btn-cancel");
const backgroundsEl = document.getElementById("backgrounds");
const captureBtn = document.getElementById("capture");
const btnMirror = document.getElementById("btn-mirror");
const btnStrip = document.getElementById("btn-strip");

const W = 1280;
const H = 720;
liveCanvas.width = W;
liveCanvas.height = H;
compositor.width = W;
compositor.height = H;

const NO_BG_SVG = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="56"><rect x="4" y="4" width="72" height="48" rx="6" fill="none" stroke="#888" stroke-width="2.5"/><line x1="18" y1="14" x2="62" y2="42" stroke="#888" stroke-width="2.5" stroke-linecap="round"/><line x1="62" y1="14" x2="18" y2="42" stroke="#888" stroke-width="2.5" stroke-linecap="round"/></svg>`);

let selectedBg = 0;
let backgrounds = [];
let bgImage = null;
let bgReady = false;
let busy = false;
let mirrorMode = true;
let countdownDuration = 3;
let stripMode = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Position parser ---
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
    if (mirrorMode) {
      liveCtx.save();
      liveCtx.translate(W, 0);
      liveCtx.scale(-1, 1);
      drawBgTo(liveCtx, bgImage, W, H, pos);
      liveCtx.restore();
    } else {
      drawBgTo(liveCtx, bgImage, W, H, pos);
    }
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

document.getElementById("viewport").addEventListener("click", (e) => {
  if (e.target.closest("#preview")) return;
  if (!busy) capture();
});

async function capture() {
  if (busy) return;
  busy = true;
  captureBtn.disabled = true;

  if (stripMode) {
    await captureStrip();
  } else {
    await captureSingle();
  }

  busy = false;
  captureBtn.disabled = false;
}

async function captureSingle() {
  for (let i = countdownDuration; i >= 1; i--) {
    showCountdown(i);
    await sleep(700);
    hideCountdown();
    await sleep(100);
  }

  flashCapture();
  const frame = captureFrame();
  const dataUrl = frameToDataUrl(frame);
  previewImg.src = dataUrl;
  preview.hidden = false;

  const action = await waitForAction();
  if (action !== "cancel") {
    savePhoto(dataUrl, action === "print");
  }
}

async function captureStrip() {
  const frames = [];

  for (let shot = 0; shot < 4; shot++) {
    for (let i = countdownDuration; i >= 1; i--) {
      showCountdown(i);
      await sleep(700);
      hideCountdown();
      await sleep(100);
    }

    flashCapture();
    frames.push(captureFrame());

    if (shot < 3) await sleep(500);
  }

  const stripDataUrl = createStrip(frames);
  previewImg.src = stripDataUrl;
  preview.hidden = false;

  const action = await waitForAction();
  if (action !== "cancel") {
    savePhoto(stripDataUrl, action === "print");
  }
}

function showCountdown(num) {
  countdownEl.textContent = num;
  countdownEl.style.display = "flex";
  countdownEl.classList.remove("animate");
  void countdownEl.offsetWidth;
  countdownEl.classList.add("animate");
}

function hideCountdown() {
  countdownEl.style.display = "none";
}

function flashCapture() {
  flash.classList.add("active");
  setTimeout(() => flash.classList.remove("active"), 80);
}

function captureFrame() {
  if (mirrorMode) {
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, W, H);
    ctx.restore();
  } else {
    ctx.drawImage(video, 0, 0, W, H);
  }
  if (bgReady) {
    const pos = backgrounds[selectedBg]?.position || null;
    drawBgTo(ctx, bgImage, W, H, pos);
  }
  return ctx.getImageData(0, 0, W, H);
}

function frameToDataUrl(imageData) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  c.getContext("2d").putImageData(imageData, 0, 0);
  return c.toDataURL("image/png");
}

function createStrip(frames) {
  const gap = 2;
  const cw = W / 2;
  const ch = H / 2;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const sCtx = c.getContext("2d");

  sCtx.fillStyle = "#000";
  sCtx.fillRect(0, 0, W, H);

  const positions = [[0, 0], [cw + gap, 0], [0, ch + gap], [cw + gap, ch + gap]];
  frames.forEach((imageData, i) => {
    const tmp = document.createElement("canvas");
    tmp.width = W;
    tmp.height = H;
    tmp.getContext("2d").putImageData(imageData, 0, 0);
    sCtx.drawImage(tmp, positions[i][0], positions[i][1], cw, ch);
  });

  return c.toDataURL("image/png");
}

function waitForAction() {
  return new Promise((resolve) => {
    btnSave.onclick = () => { preview.hidden = true; resolve("save"); };
    btnPrint.onclick = () => { preview.hidden = true; resolve("print"); };
    btnCancel.onclick = () => { preview.hidden = true; resolve("cancel"); };
  });
}

function savePhoto(dataUrl, print) {
  fetch("/api/photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl, print }),
  }).catch((e) => console.error("Save/print failed:", e));
}

// --- Settings ---
function applyMirror() {
  video.style.transform = mirrorMode ? "scaleX(-1)" : "";
  btnMirror.classList.toggle("active", mirrorMode);
}

btnMirror.addEventListener("click", () => {
  mirrorMode = !mirrorMode;
  applyMirror();
  drawBg();
});

btnStrip.addEventListener("click", () => {
  stripMode = !stripMode;
  btnStrip.classList.toggle("active", stripMode);
});

document.querySelectorAll(".cd-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    countdownDuration = parseInt(btn.dataset.duration);
    document.querySelectorAll(".cd-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

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
  } else if (e.key === "m" || e.key === "M") {
    btnMirror.click();
  } else if (e.key === "t" || e.key === "T") {
    btnStrip.click();
  }
});

// --- Init ---
async function init() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: W }, height: { ideal: H } },
  });
  video.srcObject = stream;
  await video.play();

  applyMirror();

  const res = await fetch("/api/backgrounds");
  backgrounds = [null, ...await res.json()];
  renderBackgrounds();
  applyBg(0);
}

init().catch((e) => {
  console.error("Init failed:", e);
});
