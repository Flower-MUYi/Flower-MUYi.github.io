const CELL_SIZE = 1.15;
const BOARD_WIDTH = CELL_SIZE * 8;
const BOARD_HEIGHT = CELL_SIZE * 9;

function gridToWorld(r, c) {
  return {
    x: (c - 4) * CELL_SIZE,
    z: (r - 4.5) * CELL_SIZE
  };
}

function createChessboardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2304;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const baseGrad = ctx.createLinearGradient(0, 0, W, H);
  baseGrad.addColorStop(0, '#ebd3a7');
  baseGrad.addColorStop(0.35, '#dec08c');
  baseGrad.addColorStop(0.7, '#cfa96e');
  baseGrad.addColorStop(1, '#bd9354');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, W, H);

  const glowGrad = ctx.createRadialGradient(W * 0.48, H * 0.46, 80, W * 0.5, H * 0.5, W * 0.68);
  glowGrad.addColorStop(0, 'rgba(255, 248, 225, 0.28)');
  glowGrad.addColorStop(0.55, 'rgba(225, 185, 115, 0.10)');
  glowGrad.addColorStop(1, 'rgba(56, 30, 10, 0.22)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  for (let i = 0; i < 240; i++) {
    const y = i * 9.8 + Math.sin(i * 0.65) * 4;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(68, 38, 12, 0.08)' : 'rgba(255, 242, 204, 0.06)';
    ctx.lineWidth = i % 4 === 0 ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(W * 0.32, y + 10 * Math.sin(i * 0.2), W * 0.68, y - 10 * Math.cos(i * 0.2), W, y);
    ctx.stroke();
  }
  ctx.restore();

  const marginX = 204;
  const marginY = 212;
  const gridW = W - marginX * 2;
  const gridH = H - marginY * 2;
  const dx = gridW / 8;
  const dy = gridH / 9;

  ctx.save();
  ctx.strokeStyle = '#241206';
  ctx.lineWidth = 14;
  ctx.strokeRect(marginX - 34, marginY - 34, gridW + 68, gridH + 68);

  ctx.strokeStyle = '#c89636';
  ctx.lineWidth = 4.5;
  ctx.strokeRect(marginX - 20, marginY - 20, gridW + 40, gridH + 40);

  ctx.strokeStyle = '#241206';
  ctx.lineWidth = 6.5;
  ctx.strokeRect(marginX, marginY, gridW, gridH);
  ctx.restore();

  const drawCornerFret = (cx, cy, sx, sy) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.strokeStyle = 'rgba(110, 66, 18, 0.68)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, 48); ctx.lineTo(0, 0); ctx.lineTo(48, 0);
    ctx.moveTo(11, 36); ctx.lineTo(11, 11); ctx.lineTo(36, 11);
    ctx.moveTo(22, 26); ctx.lineTo(22, 22); ctx.lineTo(26, 22);
    ctx.stroke();
    ctx.restore();
  };
  drawCornerFret(marginX - 28, marginY - 28, 1, 1);
  drawCornerFret(marginX + gridW + 28, marginY - 28, -1, 1);
  drawCornerFret(marginX - 28, marginY + gridH + 28, 1, -1);
  drawCornerFret(marginX + gridW + 28, marginY + gridH + 28, -1, -1);

  const riverTop = marginY + 4 * dy;
  const riverBot = marginY + 5 * dy;
  const riverMidY = marginY + 4.5 * dy;

  ctx.save();
  const riverGrad = ctx.createLinearGradient(marginX, riverTop, marginX, riverBot);
  riverGrad.addColorStop(0, 'rgba(48, 26, 8, 0.12)');
  riverGrad.addColorStop(0.5, 'rgba(255, 245, 215, 0.16)');
  riverGrad.addColorStop(1, 'rgba(48, 26, 8, 0.12)');
  ctx.fillStyle = riverGrad;
  ctx.fillRect(marginX + 3, riverTop + 3, gridW - 6, dy - 6);

  ctx.translate(W / 2, riverMidY);
  ctx.strokeStyle = 'rgba(58, 32, 10, 0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, dy * 0.33, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * dy * 0.18, Math.sin(a) * dy * 0.18);
    ctx.lineTo(Math.cos(a) * dy * 0.33, Math.sin(a) * dy * 0.33);
    ctx.stroke();
  }
  ctx.restore();

  const drawPalaceWatermark = (centerRow) => {
    const px = marginX + 4 * dx;
    const py = marginY + centerRow * dy;
    ctx.save();
    ctx.translate(px, py);
    ctx.strokeStyle = 'rgba(68, 38, 12, 0.22)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 0, dx * 0.56, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, dx * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };
  drawPalaceWatermark(1);
  drawPalaceWatermark(8);

  const drawPalaceLines = (startRow) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(184, 134, 45, 0.48)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(marginX + 3 * dx, marginY + startRow * dy);
    ctx.lineTo(marginX + 5 * dx, marginY + (startRow + 2) * dy);
    ctx.moveTo(marginX + 5 * dx, marginY + startRow * dy);
    ctx.lineTo(marginX + 3 * dx, marginY + (startRow + 2) * dy);
    ctx.stroke();

    ctx.strokeStyle = '#261306';
    ctx.lineWidth = 4.0;
    ctx.beginPath();
    ctx.moveTo(marginX + 3 * dx, marginY + startRow * dy);
    ctx.lineTo(marginX + 5 * dx, marginY + (startRow + 2) * dy);
    ctx.moveTo(marginX + 5 * dx, marginY + startRow * dy);
    ctx.lineTo(marginX + 3 * dx, marginY + (startRow + 2) * dy);
    ctx.stroke();
    ctx.restore();
  };
  drawPalaceLines(0);
  drawPalaceLines(7);

  ctx.save();
  ctx.lineWidth = 4.8;
  ctx.strokeStyle = '#241206';
  for (let r = 0; r < 10; r++) {
    const y = marginY + r * dy;
    ctx.beginPath();
    ctx.moveTo(marginX, y);
    ctx.lineTo(marginX + gridW, y);
    ctx.stroke();
  }

  for (let c = 1; c < 8; c++) {
    const x = marginX + c * dx;
    ctx.beginPath();
    ctx.moveTo(x, marginY);
    ctx.lineTo(x, marginY + 4 * dy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, marginY + 5 * dy);
    ctx.lineTo(x, marginY + 9 * dy);
    ctx.stroke();
  }
  ctx.restore();

  const drawCrossMarker = (r, c) => {
    const cx = marginX + c * dx;
    const cy = marginY + r * dy;
    const offset = 15;
    const len = 30;
    ctx.save();
    ctx.strokeStyle = '#261306';
    ctx.lineWidth = 4.2;

    const quadrants = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    quadrants.forEach(([qx, qy]) => {
      if (c === 0 && qx === -1) return;
      if (c === 8 && qx === 1) return;
      ctx.beginPath();
      ctx.moveTo(cx + qx * offset, cy + qy * (offset + len));
      ctx.lineTo(cx + qx * offset, cy + qy * offset);
      ctx.lineTo(cx + qx * (offset + len), cy + qy * offset);
      ctx.stroke();
    });

    ctx.fillStyle = '#6e4414';
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawCrossMarker(2, 1); drawCrossMarker(2, 7);
  drawCrossMarker(7, 1); drawCrossMarker(7, 7);
  for (let c = 0; c < 9; c += 2) {
    drawCrossMarker(3, c);
    drawCrossMarker(6, c);
  }

  const riverOpts = {
    fillStyle: '#281406',
    bevelColor: 'rgba(255, 244, 212, 0.72)',
    bevelOffsetX: 2.0,
    bevelOffsetY: 2.2,
    strokeStyle: 'rgba(184, 134, 45, 0.35)',
    lineWidth: 2.0
  };
  if (typeof drawCalligraphicGlyph === 'function') {
    drawCalligraphicGlyph(ctx, '楚', marginX + 1.55 * dx, riverMidY, 102, riverOpts);
    drawCalligraphicGlyph(ctx, '河', marginX + 2.45 * dx, riverMidY, 102, riverOpts);
    drawCalligraphicGlyph(ctx, '漢', marginX + 5.55 * dx, riverMidY, 102, riverOpts);
    drawCalligraphicGlyph(ctx, '界', marginX + 6.45 * dx, riverMidY, 102, riverOpts);

    const blackNums = ['１', '２', '３', '４', '５', '６', '７', '８', '９'];
    const redNums = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
    for (let c = 0; c < 9; c++) {
      const x = marginX + c * dx;
      drawCalligraphicGlyph(ctx, blackNums[c], x, marginY - 74, 48, {
        fillStyle: '#221206',
        bevelColor: 'rgba(255, 242, 210, 0.62)',
        bevelOffsetX: 1.2,
        bevelOffsetY: 1.4
      });
      drawCalligraphicGlyph(ctx, redNums[c], x, marginY + gridH + 74, 48, {
        fillStyle: '#7f1d1d',
        bevelColor: 'rgba(255, 242, 210, 0.62)',
        bevelOffsetX: 1.2,
        bevelOffsetY: 1.4
      });
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

const pieceTextureCache = {};
function getPieceMedallionTextures(color, char, isHidden = false) {
  const key = isHidden ? `${color}_HIDDEN_BACK_OBSIDIAN_V2` : `${color}_${char}_OBSIDIAN_V2`;
  if (pieceTextureCache[key]) return pieceTextureCache[key];

  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const isRed = color === RED;

  if (isRed) {
    const grad = ctx.createRadialGradient(cx - 56, cy - 56, 18, cx, cy, 252);
    grad.addColorStop(0, '#fcf6eb');
    grad.addColorStop(0.45, '#f2e4cb');
    grad.addColorStop(0.78, '#dfc8a0');
    grad.addColorStop(1, '#c5a470');
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createRadialGradient(cx - 64, cy - 64, 14, cx, cy, 254);
    grad.addColorStop(0, '#273042');
    grad.addColorStop(0.28, '#131926');
    grad.addColorStop(0.65, '#080b12');
    grad.addColorStop(1, '#020408');
    ctx.fillStyle = grad;
  }
  ctx.fillRect(0, 0, size, size);

  if (!isRed) {
    ctx.save();
    const sheenGrad = ctx.createLinearGradient(60, 40, 440, 460);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
    sheenGrad.addColorStop(0.32, 'rgba(148, 163, 184, 0.04)');
    sheenGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
    sheenGrad.addColorStop(0.85, 'rgba(212, 175, 55, 0.07)');
    sheenGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = isRed ? 'rgba(212, 163, 56, 0.11)' : 'rgba(148, 163, 184, 0.09)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(cx + Math.cos(i) * 40, cy + Math.sin(i) * 40, 60 + i * 24, i * 0.5, i * 0.5 + Math.PI * 0.85);
    ctx.stroke();
  }
  ctx.restore();

  bctx.fillStyle = '#848484';
  bctx.fillRect(0, 0, size, size);

  ctx.lineWidth = 12;
  ctx.strokeStyle = isRed ? '#b91c1c' : '#d4af37';
  ctx.beginPath();
  ctx.arc(cx, cy, 208, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 4.5;
  ctx.strokeStyle = isRed ? '#d97706' : '#f8fafc';
  ctx.beginPath();
  ctx.arc(cx, cy, 184, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = isRed ? 'rgba(180, 83, 9, 0.45)' : 'rgba(212, 175, 55, 0.62)';
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 16; i++) {
    const ang = (i * Math.PI) / 8;
    const r1 = 186;
    const r2 = 205;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
    ctx.stroke();

    const midA = ang + Math.PI / 16;
    ctx.fillStyle = isRed ? 'rgba(185, 28, 28, 0.45)' : 'rgba(250, 204, 21, 0.68)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(midA) * 195.5, cy + Math.sin(midA) * 195.5, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  bctx.lineWidth = 14;
  bctx.strokeStyle = '#2a2a2a';
  bctx.beginPath();
  bctx.arc(cx, cy, 208, 0, Math.PI * 2);
  ctx.stroke();

  bctx.lineWidth = 5;
  bctx.strokeStyle = '#3c3c3c';
  bctx.beginPath();
  bctx.arc(cx, cy, 184, 0, Math.PI * 2);
  bctx.stroke();

  if (isHidden) {
    ctx.save();
    ctx.translate(cx, cy);
    bctx.save();
    bctx.translate(cx, cy);

    const primaryStroke = isRed ? '#b91c1c' : '#d4af37';
    const secondaryStroke = isRed ? '#d97706' : '#cbd5e1';

    ctx.strokeStyle = primaryStroke;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 132, 0, Math.PI * 2);
    ctx.stroke();

    bctx.strokeStyle = '#262626';
    bctx.lineWidth = 8;
    ctx.beginPath();
    bctx.arc(0, 0, 132, 0, Math.PI * 2);
    bctx.stroke();

    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.save();
      ctx.rotate(a);
      ctx.strokeStyle = i % 2 === 0 ? primaryStroke : secondaryStroke;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.quadraticCurveTo(26, 86, 0, 126);
      ctx.quadraticCurveTo(-26, 86, 0, 40);
      ctx.stroke();
      ctx.restore();

      bctx.save();
      bctx.rotate(a);
      bctx.strokeStyle = '#303030';
      bctx.lineWidth = 5;
      bctx.beginPath();
      bctx.moveTo(0, 40);
      bctx.quadraticCurveTo(26, 86, 0, 126);
      bctx.quadraticCurveTo(-26, 86, 0, 40);
      bctx.stroke();
      bctx.restore();
    }

    const bossGrad = ctx.createRadialGradient(-8, -8, 4, 0, 0, 38);
    if (isRed) {
      bossGrad.addColorStop(0, '#fef3c7');
      bossGrad.addColorStop(0.6, '#d97706');
      bossGrad.addColorStop(1, '#991b1b');
    } else {
      bossGrad.addColorStop(0, '#fef08a');
      bossGrad.addColorStop(0.55, '#d4af37');
      bossGrad.addColorStop(1, '#1e293b');
    }
    ctx.fillStyle = bossGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = primaryStroke;
    ctx.stroke();

    bctx.fillStyle = '#c8c8c8';
    bctx.beginPath();
    bctx.arc(0, 0, 34, 0, Math.PI * 2);
    bctx.fill();

    ctx.restore();
    bctx.restore();
  } else if (typeof drawCalligraphicGlyph === 'function') {
    if (isRed) {
      drawCalligraphicGlyph(ctx, char, cx, cy, 248, {
        carveShadowColor: 'rgba(68, 18, 6, 0.36)',
        carveOffsetX: -2.4,
        carveOffsetY: -2.8,
        bevelColor: 'rgba(255, 252, 240, 0.90)',
        bevelOffsetX: 2.2,
        bevelOffsetY: 2.8,
        strokeStyle: '#d4af37',
        lineWidth: 5.6,
        topGradientColors: ['#ef4444', '#b91c1c', '#670d0d'],
        shadowColor: 'rgba(69, 10, 10, 0.25)',
        shadowBlur: 4,
        shadowOffsetX: 1,
        shadowOffsetY: 2
      });
    } else {
      drawCalligraphicGlyph(ctx, char, cx, cy, 248, {
        carveShadowColor: 'rgba(0, 0, 0, 0.90)',
        carveOffsetX: -2.6,
        carveOffsetY: -3.0,
        bevelColor: 'rgba(254, 240, 138, 0.85)',
        bevelOffsetX: 2.2,
        bevelOffsetY: 2.8,
        strokeStyle: '#b48222',
        lineWidth: 5.6,
        topGradientColors: ['#ffffff', '#fde047', '#d97706'],
        shadowColor: 'rgba(0, 0, 0, 0.72)',
        shadowBlur: 6,
        shadowOffsetX: 1,
        shadowOffsetY: 2
      });
    }

    drawCalligraphicGlyph(bctx, char, cx, cy, 248, {
      strokeStyle: '#4a4a4a',
      lineWidth: 6.2,
      fillStyle: '#121212'
    });
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const topMaterial = new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    color: new THREE.Color(isRed ? 0xf7ebd9 : 0xdbe4f0),
    bumpScale: 0.032,
    roughness: isRed ? 0.36 : 0.24,
    metalness: isRed ? 0.04 : 0.16
  });

  pieceTextureCache[key] = { map, bumpMap, topMaterial };
  return pieceTextureCache[key];
}

function getPieceTopMaterial(color, char, isHidden = false) {
  return getPieceMedallionTextures(color, char, isHidden).topMaterial;
}

const vfxTextureCache = {};

function getBaguaMagicTexture() {
  if (vfxTextureCache.bagua) return vfxTextureCache.bagua;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 120, cx, cy, 498);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
  grad.addColorStop(0.55, 'rgba(254, 240, 138, 0.22)');
  grad.addColorStop(0.85, 'rgba(245, 158, 11, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#fef08a';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 22;

  [480, 452, 372, 346, 260].forEach((r, idx) => {
    ctx.lineWidth = idx % 2 === 0 ? 6.5 : 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    ctx.lineWidth = i % 3 === 0 ? 4.5 : 2.2;
    ctx.strokeStyle = i % 3 === 0 ? '#ffffff' : 'rgba(254, 240, 138, 0.85)';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 452, cy + Math.sin(a) * 452);
    ctx.lineTo(cx + Math.cos(a) * 478, cy + Math.sin(a) * 478);
    ctx.stroke();
  }

  const trigramBars = [
    [1, 1, 1],
    [0, 1, 1],
    [1, 0, 1],
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, 0]
  ];
  const runes = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * 408, cy + Math.sin(ang) * 408);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 14;
    const bars = trigramBars[i];
    for (let b = 0; b < 3; b++) {
      const by = (b - 1) * 14;
      if (bars[b] === 1) {
        ctx.fillRect(-24, by - 4, 48, 8);
      } else {
        ctx.fillRect(-24, by - 4, 20, 8);
        ctx.fillRect(4, by - 4, 20, 8);
      }
    }
    ctx.restore();

    ctx.save();
    ctx.translate(cx + Math.cos(ang + Math.PI / 8) * 304, cy + Math.sin(ang + Math.PI / 8) * 304);
    ctx.rotate(ang + Math.PI / 8 + Math.PI / 2);
    if (typeof drawCalligraphicGlyph === 'function') {
      drawCalligraphicGlyph(ctx, runes[i], 0, 0, 42, { fillStyle: '#fef08a' });
    } else {
      ctx.fillStyle = '#fef08a';
      ctx.font = '900 40px "XiangqiCalligraphy", "Noto Serif SC", serif';
      ctx.fillText(runes[i], 0, 0);
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  vfxTextureCache.bagua = tex;
  return tex;
}

function getMagmaCrackTexture() {
  if (vfxTextureCache.crack) return vfxTextureCache.crack;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;

  const coreGrad = ctx.createRadialGradient(cx, cy, 48, cx, cy, 240);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
  coreGrad.addColorStop(0.28, 'rgba(254, 240, 138, 0.55)');
  coreGrad.addColorStop(0.58, 'rgba(249, 115, 22, 0.62)');
  coreGrad.addColorStop(0.84, 'rgba(220, 38, 38, 0.35)');
  coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#fef08a';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 14;
  for (let i = 0; i < 14; i++) {
    let ang = (i / 14) * Math.PI * 2 + (i % 3) * 0.09;
    let x = cx + Math.cos(ang) * 44;
    let y = cy + Math.sin(ang) * 44;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let step = 2; step <= 6; step++) {
      ang += (Math.sin(i * 7 + step * 3) * 0.28);
      const dist = step * 38;
      x = cx + Math.cos(ang) * dist;
      y = cy + Math.sin(ang) * dist;
      ctx.lineTo(x, y);
      ctx.lineWidth = Math.max(1.5, 6.0 - step * 0.85);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  vfxTextureCache.crack = tex;
  return tex;
}

function getGlowParticleTexture() {
  if (vfxTextureCache.glow) return vfxTextureCache.glow;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.28, 'rgba(254, 249, 195, 0.96)');
  grad.addColorStop(0.60, 'rgba(251, 191, 36, 0.65)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  vfxTextureCache.glow = tex;
  return tex;
}

function getSlashArcTexture() {
  if (vfxTextureCache.slashArc) return vfxTextureCache.slashArc;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;

  ctx.save();
  ctx.translate(cx, cy);
  const grad = ctx.createRadialGradient(0, 0, 92, 0, 0, 248);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.55, 'rgba(251, 191, 36, 0.35)');
  grad.addColorStop(0.80, 'rgba(255, 255, 255, 0.98)');
  grad.addColorStop(0.92, 'rgba(239, 68, 68, 0.82)');
  grad.addColorStop(1, 'rgba(220, 38, 38, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 244, -Math.PI * 0.72, Math.PI * 0.72, false);
  ctx.arc(0, 0, 152, Math.PI * 0.72, -Math.PI * 0.72, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  vfxTextureCache.slashArc = tex;
  return tex;
}

const tacticalAuraCache = {};
function getTacticalAuraTextures(kind = 'danger') {
  if (tacticalAuraCache[kind]) return tacticalAuraCache[kind];
  const isDanger = kind === 'danger';

  const rSize = 512;
  const rCanvas = document.createElement('canvas');
  rCanvas.width = rSize;
  rCanvas.height = rSize;
  const rctx = rCanvas.getContext('2d');
  const rcx = rSize / 2, rcy = rSize / 2;

  const rGrad = rctx.createRadialGradient(rcx, rcy, 128, rcx, rcy, 232);
  rGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
  rGrad.addColorStop(0.45, isDanger ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)');
  rGrad.addColorStop(0.75, isDanger ? 'rgba(254, 202, 202, 0.75)' : 'rgba(167, 243, 208, 0.75)');
  rGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  rctx.fillStyle = rGrad;
  rctx.fillRect(0, 0, rSize, rSize);

  const radialMap = new THREE.CanvasTexture(rCanvas);
  tacticalAuraCache[kind] = { radialMap, coronaMap: radialMap, cylinderMap: radialMap };
  return tacticalAuraCache[kind];
}

const turnAuraCache = {};
function getTurnAuraTexture(kind = 'red') {
  if (turnAuraCache[kind]) return turnAuraCache[kind];
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const tex = new THREE.CanvasTexture(canvas);
  turnAuraCache[kind] = tex;
  return tex;
}

const boardMarkerCache = {};
function getBoardMarkerTexture(kind = 'selected') {
  if (boardMarkerCache[kind]) return boardMarkerCache[kind];
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;

  if (kind === 'selected') {
    const ringGrad = ctx.createRadialGradient(cx, cy, 148, cx, cy, 224);
    ringGrad.addColorStop(0.0, 'rgba(245, 158, 11, 0.0)');
    ringGrad.addColorStop(0.42, 'rgba(251, 191, 36, 0.38)');
    ringGrad.addColorStop(0.72, 'rgba(254, 240, 138, 0.88)');
    ringGrad.addColorStop(0.88, 'rgba(217, 119, 6, 0.42)');
    ringGrad.addColorStop(1.0, 'rgba(180, 83, 9, 0.0)');
    ctx.fillStyle = ringGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 6.0;
    ctx.beginPath();
    ctx.arc(0, 0, 186, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 170, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 202, -0.22, 0.22);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  } else if (kind === 'last_from') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.82)';
    ctx.lineWidth = 5.0;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, 84, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(251, 191, 36, 0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  } else if (kind === 'last_to') {
    const ringGrad = ctx.createRadialGradient(cx, cy, 156, cx, cy, 222);
    ringGrad.addColorStop(0.0, 'rgba(245, 158, 11, 0.0)');
    ringGrad.addColorStop(0.50, 'rgba(251, 191, 36, 0.28)');
    ringGrad.addColorStop(0.78, 'rgba(254, 240, 138, 0.72)');
    ringGrad.addColorStop(1.0, 'rgba(217, 119, 6, 0.0)');
    ctx.fillStyle = ringGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.90)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, 186, 0, Math.PI * 2);
    ctx.stroke();

    const d = 158, l = 28;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5.0;
    ctx.lineCap = 'round';
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(sx * d, sy * (d - l));
      ctx.lineTo(sx * d, sy * d);
      ctx.lineTo(sx * (d - l), sy * d);
      ctx.stroke();
    });
    ctx.restore();
  } else {
    const ringGrad = ctx.createRadialGradient(cx, cy, 148, cx, cy, 224);
    ringGrad.addColorStop(0.0, 'rgba(239, 68, 68, 0.0)');
    ringGrad.addColorStop(0.52, 'rgba(239, 68, 68, 0.55)');
    ringGrad.addColorStop(0.80, 'rgba(254, 202, 202, 0.92)');
    ringGrad.addColorStop(1.0, 'rgba(220, 38, 38, 0.0)');
    ctx.fillStyle = ringGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 6.0;
    ctx.beginPath();
    ctx.arc(0, 0, 188, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  boardMarkerCache[kind] = tex;
  return tex;
}

const moveIndicatorTexCache = {};
function getMoveIndicatorTexture(kind = 'dot_safe') {
  if (moveIndicatorTexCache[kind]) return moveIndicatorTexCache[kind];
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;

  const isCapture = kind.startsWith('capture_');
  const isUnsafe = kind.endsWith('_unsafe');

  if (!isCapture) {
    const haloGrad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 138);
    if (isUnsafe) {
      haloGrad.addColorStop(0.0, 'rgba(254, 202, 202, 0.85)');
      haloGrad.addColorStop(0.45, 'rgba(239, 68, 68, 0.55)');
      haloGrad.addColorStop(0.82, 'rgba(185, 28, 28, 0.16)');
      haloGrad.addColorStop(1.0, 'rgba(153, 27, 27, 0.0)');
    } else {
      haloGrad.addColorStop(0.0, 'rgba(167, 243, 208, 0.85)');
      haloGrad.addColorStop(0.45, 'rgba(16, 185, 129, 0.55)');
      haloGrad.addColorStop(0.82, 'rgba(5, 150, 105, 0.16)');
      haloGrad.addColorStop(1.0, 'rgba(4, 120, 87, 0.0)');
    }
    ctx.fillStyle = haloGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = isUnsafe ? 'rgba(254, 202, 202, 0.92)' : 'rgba(167, 243, 208, 0.92)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, 86, 0, Math.PI * 2);
    ctx.stroke();

    const coreGrad = ctx.createRadialGradient(-8, -8, 4, 0, 0, 52);
    if (isUnsafe) {
      coreGrad.addColorStop(0.0, '#ffffff');
      coreGrad.addColorStop(0.40, '#fca5a5');
      coreGrad.addColorStop(0.82, '#ef4444');
      coreGrad.addColorStop(1.0, '#991b1b');
    } else {
      coreGrad.addColorStop(0.0, '#ffffff');
      coreGrad.addColorStop(0.40, '#6ee7b7');
      coreGrad.addColorStop(0.82, '#10b981');
      coreGrad.addColorStop(1.0, '#047857');
    }
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  } else {
    const ringGrad = ctx.createRadialGradient(cx, cy, 150, cx, cy, 228);
    if (isUnsafe) {
      ringGrad.addColorStop(0.0, 'rgba(239, 68, 68, 0.0)');
      ringGrad.addColorStop(0.42, 'rgba(239, 68, 68, 0.45)');
      ringGrad.addColorStop(0.74, 'rgba(254, 202, 202, 0.90)');
      ringGrad.addColorStop(1.0, 'rgba(185, 28, 28, 0.0)');
    } else {
      ringGrad.addColorStop(0.0, 'rgba(16, 185, 129, 0.0)');
      ringGrad.addColorStop(0.42, 'rgba(16, 185, 129, 0.45)');
      ringGrad.addColorStop(0.74, 'rgba(167, 243, 208, 0.90)');
      ringGrad.addColorStop(1.0, 'rgba(4, 120, 87, 0.0)');
    }
    ctx.fillStyle = ringGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.arc(0, 0, 186, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 7.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-38, -204);
      ctx.lineTo(0, -222);
      ctx.lineTo(38, -204);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  moveIndicatorTexCache[kind] = tex;
  return tex;
}
