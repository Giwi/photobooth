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
const btnCamera = document.getElementById("btn-camera");
const cameraDropdown = document.getElementById("camera-dropdown");
const btnHelp = document.getElementById("btn-help");
const helpPopup = document.getElementById("help-popup");

const W = 1800;
const H = 1200;
liveCanvas.width = W;
liveCanvas.height = H;
compositor.width = W;
compositor.height = H;

const NO_BG_SVG = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="56"><rect x="4" y="4" width="72" height="48" rx="6" fill="none" stroke="#888" stroke-width="2.5"/><line x1="18" y1="14" x2="62" y2="42" stroke="#888" stroke-width="2.5" stroke-linecap="round"/><line x1="62" y1="14" x2="18" y2="42" stroke="#888" stroke-width="2.5" stroke-linecap="round"/></svg>`);

let selectedBg = 0;
let backgrounds = [];
let watermark = null;
let bgImage = null;
let bgReady = false;
let busy = false;
let mirrorMode = true;
let countdownDuration = 3;
let stripMode = false;
let keyMap = {
  capture: " ",
  save: "s",
  print: "Enter",
  cancel: "Escape",
  prevBg: "ArrowLeft",
  nextBg: "ArrowRight",
  mirror: "m",
  strip: "t",
};
let gamepadMap = {
  capture: 0,
  save: 2,
  print: 3,
  cancel: 1,
  prevBg: 14,
  nextBg: 15,
  mirror: 8,
  strip: 9,
};
let prevGamepadState = {};
let prevAxisState = {};
let i18n = {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function t(key) { return i18n[key] || key; }

function applyTranslations() {
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const label = t(key);
    if (!label) return;
    const icon = el.querySelector("i");
    if (icon) {
      el.textContent = "";
      el.appendChild(icon);
      el.append(" " + label);
    } else {
      el.textContent = label;
    }
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
}

// --- Toast ---
const toastsEl = document.getElementById("toasts");
function notify(msg, type = "info", ms = 3000) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastsEl.appendChild(el);
  setTimeout(() => { el.classList.add("out"); el.addEventListener("animationend", () => el.remove()); }, ms);
}

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
  const scale = Math.max(cw / iw, ch / ih);
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
    drawVideoCrop(ctx);
    ctx.restore();
  } else {
    drawVideoCrop(ctx);
  }
  if (bgReady) {
    const pos = backgrounds[selectedBg]?.position || null;
    drawBgTo(ctx, bgImage, W, H, pos);
  }
  drawWatermark(ctx);
  return ctx.getImageData(0, 0, W, H);
}

function drawVideoCrop(c) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(W / vw, H / vh);
  const sw = vw * scale;
  const sh = vh * scale;
  c.drawImage(video, (W - sw) / 2, (H - sh) / 2, sw, sh);
}

function drawWatermark(c) {
  if (!watermark) return;
  c.save();
  const fontSize = Math.round(W / 30);
  c.font = `bold ${fontSize}px system-ui, sans-serif`;
  const metrics = c.measureText(watermark);
  const pad = fontSize * 0.6;
  const barH = fontSize + pad * 2;
  c.fillStyle = "rgba(0,0,0,0.45)";
  c.fillRect(0, H - barH, W, barH);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "rgba(255,255,255,0.85)";
  c.fillText(watermark, W / 2, H - barH / 2);
  c.restore();
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
  })
    .then((r) => r.json())
    .then((d) => {
      if (d.error) { notify(d.error, "error"); return; }
      notify(print ? t("notify.savedPrint") : t("notify.saved"), "success");
    })
    .catch((e) => { console.error("Save/print failed:", e); notify(t("notify.saveFailed"), "error"); });
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

// --- Camera picker ---
let currentDeviceId = null;

async function switchCamera(deviceId) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId }, width: { ideal: W }, height: { ideal: H }, aspectRatio: { ideal: 3 / 2 } },
  });
  const oldStream = video.srcObject;
  if (oldStream) oldStream.getTracks().forEach((t) => t.stop());
  video.srcObject = stream;
  await video.play();
  currentDeviceId = deviceId;
  updateCameraDropdown();
  cameraDropdown.hidden = true;
  notify(t("notify.cameraSwitched"), "info", 2000);
}

function updateCameraDropdown() {
  cameraDropdown.querySelectorAll(".cam-option").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === currentDeviceId);
  });
}

async function populateCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((d) => d.kind === "videoinput");
  cameraDropdown.innerHTML = "";
  cameras.forEach((cam) => {
    const opt = document.createElement("div");
    opt.className = "cam-option";
    opt.dataset.id = cam.deviceId;
    opt.textContent = cam.label || `Camera ${cameraDropdown.children.length + 1}`;
    opt.addEventListener("click", () => switchCamera(cam.deviceId));
    cameraDropdown.appendChild(opt);
  });
  updateCameraDropdown();
}

btnCamera.addEventListener("click", (e) => {
  e.stopPropagation();
  if (cameraDropdown.hidden) {
    populateCameras();
    cameraDropdown.hidden = false;
  } else {
    cameraDropdown.hidden = true;
  }
});

document.addEventListener("click", () => { cameraDropdown.hidden = true; helpPopup.hidden = true; });

// --- Help popup ---
function renderHelp() {
  const labelMap = {
    capture: t("help.capture"),
    save: t("help.save"),
    print: t("help.print"),
    cancel: t("help.discard"),
    prevBg: t("help.prevBg"),
    nextBg: t("help.nextBg"),
    mirror: t("help.mirror"),
    strip: t("help.strip"),
  };
  const keyLabels = {
    " ": "Space", ArrowLeft: "←", ArrowRight: "→", Enter: "↵", Escape: "Esc",
  };
  helpPopup.innerHTML = "";
  for (const [action, label] of Object.entries(labelMap)) {
    const key = keyMap[action];
    if (!key) continue;
    const row = document.createElement("div");
    row.className = "help-row";
    row.innerHTML = `<span>${label}</span><kbd>${keyLabels[key] || key}</kbd>`;
    helpPopup.appendChild(row);
  }
}

btnHelp.addEventListener("click", (e) => {
  e.stopPropagation();
  if (helpPopup.hidden) {
    renderHelp();
    helpPopup.hidden = false;
  } else {
    helpPopup.hidden = true;
  }
});

// --- Input dispatch ---
function dispatchAction(action) {
  if (action === "capture") {
    if (!busy) capture();
  } else if (action === "print") {
    if (!preview.hidden) btnPrint.onclick();
  } else if (action === "save") {
    if (!preview.hidden) btnSave.onclick();
  } else if (action === "cancel") {
    if (!preview.hidden) btnCancel.onclick();
  } else if (action === "prevBg") {
    if (!busy && backgrounds.length) applyBg((selectedBg - 1 + backgrounds.length) % backgrounds.length);
  } else if (action === "nextBg") {
    if (!busy && backgrounds.length) applyBg((selectedBg + 1) % backgrounds.length);
  } else if (action === "mirror") {
    btnMirror.click();
  } else if (action === "strip") {
    btnStrip.click();
  }
}

function keyMatch(key, mapping) {
  return key.toLowerCase() === mapping.toLowerCase();
}

// --- Keyboard ---
document.addEventListener("keydown", (e) => {
  const k = e.key;
  for (const [action, binding] of Object.entries(keyMap)) {
    if (keyMatch(k, binding) || (action === "capture" && e.code === "Space")) {
      e.preventDefault();
      dispatchAction(action);
      return;
    }
  }
});

// --- Gamepad ---
const AXIS_THRESHOLD = 0.5;

function pollGamepad() {
  const gamepads = navigator.getGamepads();
  if (!gamepads) return;
  const gp = gamepads[0];
  if (!gp) return;

  for (const [action, binding] of Object.entries(gamepadMap)) {
    if (binding == null) continue;

    if (typeof binding === "number") {
      const pressed = gp.buttons[binding]?.pressed;
      const wasPressed = prevGamepadState[binding];
      if (pressed && !wasPressed) {
        console.log(`Gamepad button ${binding} → ${action}`, gp.id);
        dispatchAction(action);
      }
      prevGamepadState[binding] = pressed;
    } else if (binding.axis != null) {
      const val = gp.axes[binding.axis] || 0;
      const active = binding.dir > 0 ? val > AXIS_THRESHOLD : val < -AXIS_THRESHOLD;
      const wasActive = prevAxisState[action];
      if (active && !wasActive) {
        console.log(`Gamepad axis ${binding.axis} → ${action}`, gp.id);
        dispatchAction(action);
      }
      prevAxisState[action] = active;
    }
  }

  requestAnimationFrame(pollGamepad);
}

window.addEventListener("gamepadconnected", (e) => {
  console.log("Gamepad connected:", e.gamepad.id);
  notify(`${t("notify.gamepadConnected")} ${e.gamepad.id}`, "success");
  prevGamepadState = {};
  prevAxisState = {};
  requestAnimationFrame(pollGamepad);
});

window.addEventListener("gamepaddisconnected", (e) => {
  console.log("Gamepad disconnected:", e.gamepad.id);
  notify(`${t("notify.gamepadDisconnected")} ${e.gamepad.id}`, "error");
});

// --- Init ---
async function init() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: W }, height: { ideal: H }, aspectRatio: { ideal: 3 / 2 } },
  });
  video.srcObject = stream;
  await video.play();

  const track = stream.getVideoTracks()[0];
  if (track) currentDeviceId = track.getSettings().deviceId;

  applyMirror();

  const res = await fetch("/api/backgrounds");
  const data = await res.json();
  backgrounds = [null, ...data.backgrounds];
  watermark = data.watermark;
  if (data.keys) keyMap = { ...keyMap, ...data.keys };
  if (data.gamepad) gamepadMap = { ...gamepadMap, ...data.gamepad };
  if (data.i18n) i18n = data.i18n;
  applyTranslations();
  renderBackgrounds();
  applyBg(0);

  populateCameras();
}

init().catch((e) => {
  console.error("Init failed:", e);
});
