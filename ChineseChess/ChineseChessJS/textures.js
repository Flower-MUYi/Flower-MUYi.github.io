/*************************************************************************
 * 2D CANVAS PROCEDURAL TEXTURE GENERATORS
 * (Chessboard, 3D Piece Medallions, Bagua Array, Magma Cracks, Holo Banner)
 *************************************************************************/

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
  canvas.width = 1600;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 1600, 1800);
  grad.addColorStop(0, '#e8d8b9');
  grad.addColorStop(0.5, '#dfc9a1');
  grad.addColorStop(1, '#d2b88b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(120, 85, 45, 0.05)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 180; i++) {
    const y = i * 10 + Math.sin(i) * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(500, y + 8, 1100, y - 8, 1600, y);
    ctx.stroke();
  }

  const marginX = 160;
  const marginY = 165;
  const gridW = canvas.width - marginX * 2;
  const gridH = canvas.height - marginY * 2;
  const dx = gridW / 8;
  const dy = gridH / 9;

  ctx.strokeStyle = '#3d2914';
  ctx.lineWidth = 10;
  ctx.strokeRect(marginX - 18, marginY - 18, gridW + 36, gridH + 36);

  ctx.lineWidth = 5;
  ctx.strokeRect(marginX, marginY, gridW, gridH);

  ctx.lineWidth = 4;
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

  const drawPalace = (startRow) => {
    ctx.beginPath();
    ctx.moveTo(marginX + 3 * dx, marginY + startRow * dy);
    ctx.lineTo(marginX + 5 * dx, marginY + (startRow + 2) * dy);
    ctx.moveTo(marginX + 5 * dx, marginY + startRow * dy);
    ctx.lineTo(marginX + 3 * dx, marginY + (startRow + 2) * dy);
    ctx.stroke();
  };
  drawPalace(0);
  drawPalace(7);

  const drawCrossMarker = (r, c) => {
    const cx = marginX + c * dx;
    const cy = marginY + r * dy;
    const offset = 12;
    const len = 24;
    ctx.lineWidth = 3.5;

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
  };

  drawCrossMarker(2, 1); drawCrossMarker(2, 7);
  drawCrossMarker(7, 1); drawCrossMarker(7, 7);
  for (let c = 0; c < 9; c += 2) {
    drawCrossMarker(3, c);
    drawCrossMarker(6, c);
  }

  const riverY = marginY + 4.5 * dy;
  ctx.save();
  ctx.fillStyle = '#472f18';
  ctx.font = 'bold 78px "Noto Serif SC", "Songti SC", "SimSun", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('楚  河', marginX + 2 * dx, riverY);
  ctx.fillText('漢  界', marginX + 6 * dx, riverY);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

const pieceTextureCache = {};
function getPieceMedallionTextures(color, char) {
  const key = `${color}_${char}`;
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

  if (color === RED) {
    const grad = ctx.createRadialGradient(cx - 50, cy - 50, 20, cx, cy, 250);
    grad.addColorStop(0, '#fffdf7');
    grad.addColorStop(0.75, '#f5ecd9');
    grad.addColorStop(1, '#e4d5b7');
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createRadialGradient(cx - 60, cy - 60, 20, cx, cy, 250);
    grad.addColorStop(0, '#273244');
    grad.addColorStop(0.6, '#111827');
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
  }
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  ctx.lineWidth = 14;
  ctx.strokeStyle = color === RED ? '#b91c1c' : '#d4af37';
  ctx.beginPath();
  ctx.arc(cx, cy, 205, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 5;
  ctx.strokeStyle = color === RED ? '#d97706' : '#f8fafc';
  ctx.beginPath();
  ctx.arc(cx, cy, 184, 0, Math.PI * 2);
  ctx.stroke();

  bctx.lineWidth = 16;
  bctx.strokeStyle = '#303030';
  ctx.beginPath();
  bctx.beginPath();
  bctx.arc(cx, cy, 205, 0, Math.PI * 2);
  bctx.stroke();

  ctx.font = '900 245px "KaiTi", "STKaiti", "Kaiti SC", "Noto Serif SC", "Songti SC", "STSong", "SimSun", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(45, 24, 8, 0.22)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  if (color === RED) {
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#d4af37';
    ctx.strokeText(char, cx, cy + 12);
    ctx.fillStyle = '#991b1b';
    ctx.fillText(char, cx, cy + 12);
  } else {
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#b48a28';
    ctx.strokeText(char, cx, cy + 12);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(char, cx, cy + 12);
  }

  bctx.font = '900 245px "KaiTi", "STKaiti", "Kaiti SC", "Noto Serif SC", "Songti SC", "STSong", "SimSun", serif';
  bctx.textAlign = 'center';
  bctx.textBaseline = 'middle';
  bctx.fillStyle = '#202020';
  bctx.fillText(char, cx, cy + 12);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);

  pieceTextureCache[key] = { map, bumpMap };
  return pieceTextureCache[key];
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

  const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 490);
  grad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
  grad.addColorStop(0.45, 'rgba(245, 158, 11, 0.32)');
  grad.addColorStop(0.78, 'rgba(220, 38, 38, 0.24)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#fef08a';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 18;

  [470, 445, 365, 345, 235, 130].forEach((r, idx) => {
    ctx.lineWidth = idx % 2 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.lineWidth = 5;
  ctx.strokeStyle = '#fbbf24';
  for (let offset = 0; offset < 2; offset++) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + (offset * Math.PI) / 4;
      const x = cx + Math.cos(ang) * 345;
      const y = cy + Math.sin(ang) * 345;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  const trigrams = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];
  const runes = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * 405, cy + Math.sin(ang) * 405);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 54px "Noto Serif SC", serif';
    ctx.fillText(trigrams[i], 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(cx + Math.cos(ang + Math.PI / 8) * 290, cy + Math.sin(ang + Math.PI / 8) * 290);
    ctx.rotate(ang + Math.PI / 8 + Math.PI / 2);
    ctx.fillStyle = '#fca5a5';
    ctx.font = '900 42px "Noto Serif SC", serif';
    ctx.fillText(runes[i], 0, 0);
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

  const coreGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 220);
  coreGrad.addColorStop(0, 'rgba(254, 249, 195, 0.95)');
  coreGrad.addColorStop(0.25, 'rgba(249, 115, 22, 0.75)');
  coreGrad.addColorStop(0.6, 'rgba(220, 38, 38, 0.3)');
  coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#fef08a';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 12;
  for (let i = 0; i < 14; i++) {
    let ang = (i / 14) * Math.PI * 2 + (i % 3) * 0.1;
    let x = cx, y = cy;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let step = 1; step <= 6; step++) {
      ang += (Math.sin(i * 7 + step * 3) * 0.28);
      const dist = step * 36;
      x = cx + Math.cos(ang) * dist;
      y = cy + Math.sin(ang) * dist;
      ctx.lineTo(x, y);
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
  grad.addColorStop(0.25, 'rgba(254, 240, 138, 0.9)');
  grad.addColorStop(0.55, 'rgba(245, 158, 11, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  vfxTextureCache.glow = tex;
  return tex;
}

function createHoloKillBannerTexture(titleText, subText) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createRadialGradient(512, 256, 20, 512, 256, 460);
  bgGrad.addColorStop(0, 'rgba(185, 28, 28, 0.65)');
  bgGrad.addColorStop(0.5, 'rgba(120, 53, 15, 0.35)');
  bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 512);

  ctx.strokeStyle = '#fbbf24';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 24;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(140, 110); ctx.lineTo(884, 110);
  ctx.moveTo(140, 405); ctx.lineTo(884, 405);
  ctx.stroke();

  const cleanTitle = (titleText || '绝杀').replace(/\s*·\s*绝杀/g, '');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 138px "Noto Serif SC", "Songti SC", "SimSun", serif';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#7f1d1d';
  ctx.strokeText(cleanTitle, 512, 235);

  const textGrad = ctx.createLinearGradient(0, 140, 0, 330);
  textGrad.addColorStop(0, '#ffffff');
  textGrad.addColorStop(0.45, '#fef08a');
  textGrad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = textGrad;
  ctx.fillText(cleanTitle, 512, 235);

  ctx.font = 'bold 38px "Noto Serif SC", serif';
  ctx.fillStyle = '#fca5a5';
  ctx.shadowBlur = 10;
  ctx.fillText(`【 ${subText || '古谱十八杀法 · 天道绝杀'} 】`, 512, 355);

  return new THREE.CanvasTexture(canvas);
}
