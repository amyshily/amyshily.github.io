/* ============================================================
   Photo Booth — 2×6 inch strip capture
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const PHOTO_COUNT = 4;
  const COUNTDOWN_SEC = 3;
  const WATERMARK = 'amyshilyy.github.io';

  // 2×6 inches at 300 DPI (standard photo-booth strip)
  const STRIP_WIDTH = 600;
  const STRIP_HEIGHT = 1800;
  const STRIP_LAYOUT = {
    paddingX: 44,
    paddingTop: 52,
    paddingBottom: 130,
    photoGap: 22,
  };

  const DISPENSE_PRINT_MS = 1100;
  const DISPENSE_SLIDE_MS = 2400;
  const LENS_OPEN_MS = 1100;

  const STRIP_STYLES = {
    kawaii: {
      id: 'kawaii',
      label: 'Simple',
    },
    polkadot: {
      id: 'polkadot',
      label: 'Polka Dot',
      tile: 'images/strip-polkadot-tile.png',
    },
    pastelpink: {
      id: 'pastelpink',
      label: 'Pastel Pink',
    },
  };

  const video = document.getElementById('camera-video');
  const captureCanvas = document.getElementById('capture-canvas');
  const stripCanvas = document.getElementById('strip-canvas');
  const boothIdle = document.getElementById('booth-idle');
  const countdownEl = document.getElementById('booth-countdown');
  const countdownNum = document.getElementById('countdown-num');
  const flashEl = document.getElementById('booth-flash');
  const progressEl = document.getElementById('booth-progress');
  const hearts = document.querySelectorAll('.booth-heart');
  const boothLamp = document.getElementById('booth-lamp');
  const viewfinder = document.getElementById('viewfinder');
  const boothLens = document.getElementById('booth-lens');
  const stripPanel = document.getElementById('strip-panel');
  const stripActions = document.getElementById('strip-actions');
  const boothStage = document.querySelector('.booth-stage');
  const boothKiosk = document.getElementById('booth-kiosk');
  const boothHint = document.getElementById('booth-hint');
  const boothError = document.getElementById('booth-error');
  const styleOptions = document.querySelectorAll('.booth-style-option');

  const btnStart = document.getElementById('btn-start');
  const btnSnap = document.getElementById('btn-snap');
  const btnDownload = document.getElementById('btn-download');
  const btnNew = document.getElementById('btn-new');

  let stream = null;
  let photos = [];
  let isCapturing = false;
  let selectedStyle = 'kawaii';
  const assetCache = new Map();

  stripCanvas.width = STRIP_WIDTH;
  stripCanvas.height = STRIP_HEIGHT;
  captureCanvas.width = 640;
  captureCanvas.height = 480;

  preloadAssets();

  function getPhotoLayout(overrides = {}) {
    const layout = { ...STRIP_LAYOUT, ...overrides };
    const photoW = STRIP_WIDTH - layout.paddingX * 2;
    const totalGaps = (PHOTO_COUNT - 1) * layout.photoGap;
    const photoH =
      (STRIP_HEIGHT - layout.paddingTop - layout.paddingBottom - totalGaps) /
      PHOTO_COUNT;

    return {
      photoW,
      photoH,
      startX: layout.paddingX,
      startY: layout.paddingTop,
      photoGap: layout.photoGap,
    };
  }

  function preloadAssets() {
    const tile = STRIP_STYLES.polkadot.tile;
    if (tile) {
      loadImage(tile).catch(() => {});
    }
  }

  function loadImage(src) {
    if (assetCache.has(src)) {
      return assetCache.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

    assetCache.set(src, promise);
    return promise;
  }

  function loadPhotoImages() {
    return Promise.all(
      photos.map((src) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        });
      })
    );
  }

  function showError(msg) {
    boothError.textContent = msg;
    boothError.hidden = false;
  }

  function clearError() {
    boothError.hidden = true;
    boothError.textContent = '';
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function updateHearts(index) {
    hearts.forEach((heart, i) => {
      heart.classList.remove('done', 'current');
      if (i < index) heart.classList.add('done');
      if (i === index) heart.classList.add('current');
    });
  }

  async function startCamera() {
    clearError();
    if (btnStart.disabled) return;

    btnStart.disabled = true;
    boothIdle.classList.add('is-fading');
    viewfinder.classList.add('lens-opening');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const openMs = reducedMotion ? 150 : LENS_OPEN_MS;

    const cameraPromise = navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });

    try {
      const [, mediaStream] = await Promise.all([sleep(openMs), cameraPromise]);
      stream = mediaStream;
      video.srcObject = stream;
      video.classList.add('active');
      viewfinder.classList.remove('lens-opening');
      viewfinder.classList.add('lens-open');
      boothIdle.classList.add('hidden');
      boothLens.classList.add('hidden');
      boothLamp.classList.add('live');
      btnStart.hidden = true;
      btnSnap.hidden = false;
      boothHint.textContent = 'tap the star when you\'re ready ♡';
      boothHint.hidden = false;
    } catch (err) {
      viewfinder.classList.remove('lens-opening', 'lens-open');
      boothIdle.classList.remove('is-fading', 'hidden');
      boothLens.classList.remove('hidden');
      btnStart.disabled = false;
      showError('Could not open camera — please allow access and try again ♡');
    }
  }

  function resetLens() {
    viewfinder.classList.remove('lens-opening', 'lens-open');
    boothIdle.classList.remove('hidden', 'is-fading');
    boothLens.classList.remove('hidden');
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.srcObject = null;
    video.classList.remove('active');
    resetLens();
    boothLamp.classList.remove('live');
  }

  function applySoftFilter(ctx, w, h) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      d[i] = Math.min(255, r * 0.96 + 10);
      d[i + 1] = Math.min(255, g * 0.93 + 8);
      d[i + 2] = Math.min(255, b * 0.97 + 14);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function captureFrame() {
    const ctx = captureCanvas.getContext('2d');
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    ctx.save();
    ctx.translate(captureCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video, sx, sy, size, size,
      0, 0, captureCanvas.width, captureCanvas.height
    );
    ctx.restore();
    applySoftFilter(ctx, captureCanvas.width, captureCanvas.height);

    return captureCanvas.toDataURL('image/jpeg', 0.9);
  }

  async function runCountdown() {
    countdownEl.hidden = false;
    for (let i = COUNTDOWN_SEC; i >= 1; i--) {
      countdownNum.textContent = String(i);
      countdownNum.parentElement.style.animation = 'none';
      countdownNum.parentElement.offsetHeight;
      countdownNum.parentElement.style.animation = '';
      await sleep(850);
    }
    countdownEl.hidden = true;
  }

  function flash() {
    flashEl.hidden = false;
    flashEl.style.animation = 'none';
    flashEl.offsetHeight;
    flashEl.style.animation = '';
    setTimeout(() => { flashEl.hidden = true; }, 350);
  }

  async function takePhotoStrip() {
    if (isCapturing || !stream) return;
    isCapturing = true;
    photos = [];
    btnSnap.disabled = true;
    progressEl.hidden = false;

    for (let i = 0; i < PHOTO_COUNT; i++) {
      updateHearts(i);
      await runCountdown();
      flash();
      photos.push(captureFrame());
      hearts[i].classList.remove('current');
      hearts[i].classList.add('done');
      if (i < PHOTO_COUNT - 1) await sleep(650);
    }

    progressEl.hidden = true;
    await renderStrip();
    await dispenseStrip();
    btnSnap.hidden = true;
    isCapturing = false;
  }

  async function dispenseStrip() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const printMs = reducedMotion ? 200 : DISPENSE_PRINT_MS;
    const slideMs = reducedMotion ? 200 : DISPENSE_SLIDE_MS;

    boothHint.textContent = 'printing your strip...';
    boothHint.hidden = false;

    boothStage.classList.remove('has-dispensed', 'is-dispensing', 'has-strip');
    stripPanel.hidden = false;
    stripActions.hidden = true;

    stripPanel.style.animation = 'none';
    stripPanel.offsetHeight;
    stripPanel.style.animation = '';

    boothStage.classList.add('is-printing');
    boothKiosk.classList.add('is-printing');

    await sleep(printMs);

    boothStage.classList.remove('is-printing');
    boothKiosk.classList.remove('is-printing');
    boothStage.classList.add('is-dispensing', 'has-strip');

    await sleep(slideMs);

    boothStage.classList.remove('is-dispensing');
    boothStage.classList.add('has-dispensed');
    stripActions.hidden = false;
    boothHint.textContent = 'your strip is ready ~ save it if you like it ♡';
    boothHint.hidden = false;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawWatermark(ctx, x, y, w, h, options = {}) {
    const {
      text = WATERMARK,
      color = 'rgba(140, 110, 160, 0.1)',
      font = 'italic 12px Georgia, serif',
      angle = -0.3,
    } = options;

    ctx.save();
    roundRect(ctx, x, y, w, h, 6);
    ctx.clip();

    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';

    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }

  function drawStripDots(ctx, w, h) {
    ctx.fillStyle = 'rgba(201, 174, 216, 0.15)';
    for (let x = 10; x < w; x += 14) {
      for (let y = 10; y < h; y += 14) {
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawStaggeredDots(ctx, w, h, bgColor, dotColor, spacing = 58, radius = 13) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = dotColor;
    for (let row = 0, y = spacing * 0.45; y < h + spacing; row++, y += spacing) {
      const offset = row % 2 === 0 ? spacing * 0.5 : 0;
      for (let x = spacing * 0.45 + offset; x < w + spacing; x += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  async function drawTiledBackground(ctx, w, h, tileSrc, fallbackColors) {
    try {
      const tile = await loadImage(tileSrc);
      const pattern = ctx.createPattern(tile, 'repeat');
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    } catch (err) {
      drawStaggeredDots(ctx, w, h, fallbackColors.bg, fallbackColors.dots);
    }
  }

  function drawStyledPhotos(ctx, images, layout, options = {}) {
    const {
      borderColor,
      borderWidth = 2,
      borderRadius = 0,
      watermarkOptions = {},
    } = options;
    const gap = layout.photoGap ?? STRIP_LAYOUT.photoGap;

    let y = layout.startY;
    images.forEach((img) => {
      const x = layout.startX;
      const { photoW, photoH } = layout;

      if (borderRadius > 0) {
        ctx.save();
        roundRect(ctx, x, y, photoW, photoH, borderRadius);
        ctx.clip();
        ctx.drawImage(img, x, y, photoW, photoH);
        drawWatermark(ctx, x, y, photoW, photoH, watermarkOptions);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, y, photoW, photoH);
        drawWatermark(ctx, x, y, photoW, photoH, watermarkOptions);
      }

      if (borderColor) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        if (borderRadius > 0) {
          roundRect(ctx, x, y, photoW, photoH, borderRadius);
          ctx.stroke();
        } else {
          ctx.strokeRect(x, y, photoW, photoH);
        }
      }

      y += photoH + gap;
    });
  }

  function drawFooterText(ctx, w, h, options = {}) {
    const {
      text = WATERMARK,
      color = 'rgba(140, 110, 160, 0.45)',
      font = '600 22px "Caveat Brush", cursive',
      y = h - 42,
    } = options;

    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, y);
  }

  async function renderKawaiiStrip(ctx, images, layout) {
    const w = STRIP_WIDTH;
    const h = STRIP_HEIGHT;

    ctx.fillStyle = '#fffbfe';
    ctx.fillRect(0, 0, w, h);
    drawStripDots(ctx, w, h);

    ctx.strokeStyle = '#e8d0e4';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    let y = layout.startY;
    images.forEach((img) => {
      const x = layout.startX;
      const { photoW, photoH } = layout;

      ctx.fillStyle = 'rgba(140, 110, 160, 0.08)';
      roundRect(ctx, x + 2, y + 2, photoW, photoH, 6);
      ctx.fill();

      ctx.save();
      roundRect(ctx, x, y, photoW, photoH, 6);
      ctx.clip();
      ctx.drawImage(img, x, y, photoW, photoH);
      drawWatermark(ctx, x, y, photoW, photoH);
      ctx.restore();

      ctx.strokeStyle = '#dcc0d8';
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, photoW, photoH, 6);
      ctx.stroke();

      y += photoH + (layout.photoGap ?? STRIP_LAYOUT.photoGap);
    });

    drawFooterText(ctx, w, h, {
      color: 'rgba(140, 110, 160, 0.45)',
      font: '600 22px "Caveat Brush", cursive',
    });
  }

  async function renderPolkadotStrip(ctx, images, layout) {
    const w = STRIP_WIDTH;
    const h = STRIP_HEIGHT;

    await drawTiledBackground(ctx, w, h, STRIP_STYLES.polkadot.tile, {
      bg: '#b91c32',
      dots: '#ffffff',
    });

    drawStyledPhotos(ctx, images, layout, {
      borderColor: '#ffffff',
      borderWidth: 4,
      watermarkOptions: {
        color: 'rgba(255, 255, 255, 0.14)',
        font: 'italic 12px Georgia, serif',
      },
    });

    drawFooterText(ctx, w, h, {
      color: '#ffffff',
      font: '600 24px "Caveat Brush", cursive',
      y: h - 44,
    });
  }

  async function renderPastelPinkStrip(ctx, images, layout) {
    const w = STRIP_WIDTH;
    const h = STRIP_HEIGHT;

    drawStaggeredDots(ctx, w, h, '#f8dce8', '#ffffff', 58, 12);

    drawStyledPhotos(ctx, images, layout, {
      borderColor: '#ffffff',
      borderWidth: 3,
      borderRadius: 4,
      watermarkOptions: {
        color: 'rgba(200, 140, 170, 0.14)',
        font: 'italic 12px Georgia, serif',
      },
    });

    drawFooterText(ctx, w, h, {
      color: 'rgba(154, 100, 130, 0.75)',
      font: '600 22px "Caveat Brush", cursive',
      y: h - 44,
    });
  }

  async function renderStrip() {
    const ctx = stripCanvas.getContext('2d');
    const layout = getPhotoLayout();
    const images = await loadPhotoImages();

    ctx.clearRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);

    if (selectedStyle === 'polkadot') {
      await renderPolkadotStrip(ctx, images, layout);
      return;
    }

    if (selectedStyle === 'pastelpink') {
      await renderPastelPinkStrip(ctx, images, layout);
      return;
    }

    await renderKawaiiStrip(ctx, images, layout);
  }

  function setSelectedStyle(styleId) {
    if (!STRIP_STYLES[styleId]) return;
    selectedStyle = styleId;

    styleOptions.forEach((option) => {
      const isActive = option.dataset.style === styleId;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    if (photos.length) {
      renderStrip();
    }
  }

  function downloadStrip() {
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `photobooth-${selectedStyle}-${timestamp}.png`;
    link.href = stripCanvas.toDataURL('image/png');
    link.click();
  }

  function resetBooth() {
    photos = [];
    stripPanel.hidden = true;
    stripActions.hidden = true;
    boothStage.classList.remove('has-strip', 'has-dispensed', 'is-dispensing', 'is-printing');
    boothKiosk.classList.remove('is-printing');
    hearts.forEach((h) => h.classList.remove('done', 'current'));
    btnSnap.hidden = false;
    btnSnap.disabled = false;
    boothHint.textContent = '';
    boothHint.hidden = true;
  }

  function fullReset() {
    resetBooth();
    stopCamera();
    btnStart.hidden = false;
    btnStart.disabled = false;
    btnSnap.hidden = true;
    clearError();
  }

  styleOptions.forEach((option) => {
    option.addEventListener('click', () => {
      setSelectedStyle(option.dataset.style);
    });
  });

  btnStart.addEventListener('click', startCamera);
  btnSnap.addEventListener('click', takePhotoStrip);
  btnDownload.addEventListener('click', downloadStrip);
  btnNew.addEventListener('click', fullReset);

  window.addEventListener('beforeunload', stopCamera);
});
