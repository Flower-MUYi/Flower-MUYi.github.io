/*************************************************************************
 * 2D CANVAS PROCEDURAL TEXTURE GENERATORS
 * (Chessboard, 3D Calligraphic Piece Medallions, Bagua Array, Magma Cracks, Holo Banner)
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
  grad.addColorStop(0, '#eddcc0');
  grad.addColorStop(0.5, '#e2cba3');
  grad.addColorStop(1, '#d4b787');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 细腻金丝楠木纹理
  ctx.strokeStyle = 'rgba(115, 78, 38, 0.055)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 180; i++) {
    const y = i * 10 + Math.sin(i * 0.9) * 4;
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

  // 外粗内细古法双框线
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 11;
  ctx.strokeRect(marginX - 20, marginY - 20, gridW + 40, gridH + 40);

  ctx.strokeStyle = '#784e24';
  ctx.lineWidth = 3;
  ctx.strokeRect(marginX - 10, marginY - 10, gridW + 20, gridH + 20);

  ctx.strokeStyle = '#3a2410';
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

  // 楚河汉界（使用内置矢量书法字库，手机端与电脑端均呈现苍劲古籍书法）
  const riverY = marginY + 4.5 * dy;
  const riverOpts = {
    fillStyle: '#432a14',
    bevelColor: 'rgba(255, 245, 220, 0.55)',
    bevelOffsetX: 1.5,
    bevelOffsetY: 1.8
  };
  if (typeof drawCalligraphicGlyph === 'function') {
    drawCalligraphicGlyph(ctx, '楚', marginX + 1.55 * dx, riverY, 80, riverOpts);
    drawCalligraphicGlyph(ctx, '河', marginX + 2.45 * dx, riverY, 80, riverOpts);
    drawCalligraphicGlyph(ctx, '漢', marginX + 5.55 * dx, riverY, 80, riverOpts);
    drawCalligraphicGlyph(ctx, '界', marginX + 6.45 * dx, riverY, 80, riverOpts);

    // 顶底九路坐标铭文
    const blackNums = ['１', '２', '３', '４', '５', '６', '７', '８', '９'];
    const redNums = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
    for (let c = 0; c < 9; c++) {
      const x = marginX + c * dx;
      drawCalligraphicGlyph(ctx, blackNums[c], x, marginY - 58, 38, { fillStyle: '#4a3018' });
      drawCalligraphicGlyph(ctx, redNums[c], x, marginY + gridH + 58, 38, { fillStyle: '#7f1d1d' });
    }
  } else {
    ctx.save();
    ctx.fillStyle = '#472f18';
    ctx.font = 'bold 78px "XiangqiCalligraphy", "Noto Serif SC", "Songti SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚  河', marginX + 2 * dx, riverY);
    ctx.fillText('漢  界', marginX + 6 * dx, riverY);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

const pieceTextureCache = {};
function getPieceMedallionTextures(color, char, isHidden = false) {
  const key = isHidden ? `${color}_HIDDEN_BACK` : `${color}_${char}`;
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

  // 1. 象牙暖玉 / 玄武黑曜 棋子顶面底色
  if (isRed) {
    const grad = ctx.createRadialGradient(cx - 54, cy - 54, 18, cx, cy, 250);
    grad.addColorStop(0, '#fffef9');
    grad.addColorStop(0.55, '#f7efe0');
    grad.addColorStop(0.85, '#eadbc2');
    grad.addColorStop(1, '#d8c3a0');
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createRadialGradient(cx - 58, cy - 58, 18, cx, cy, 250);
    grad.addColorStop(0, '#334155');
    grad.addColorStop(0.55, '#151e2e');
    grad.addColorStop(0.85, '#0c121e');
    grad.addColorStop(1, '#060911');
    ctx.fillStyle = grad;
  }
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#848484';
  bctx.fillRect(0, 0, size, size);

  // 2. 外圈描金/朱砂双环与古法八角暗花刻线
  ctx.lineWidth = 13;
  ctx.strokeStyle = isRed ? '#b91c1c' : '#d4af37';
  ctx.beginPath();
  ctx.arc(cx, cy, 206, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 4.5;
  ctx.strokeStyle = isRed ? '#d97706' : '#f8fafc';
  ctx.beginPath();
  ctx.arc(cx, cy, 185, 0, Math.PI * 2);
  ctx.stroke();

  // 八方回纹刻点装饰，提升棋子古雅质感
  ctx.save();
  ctx.strokeStyle = isRed ? 'rgba(180, 83, 9, 0.36)' : 'rgba(212, 175, 55, 0.42)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const r1 = 186;
    const r2 = 204;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
    ctx.stroke();
  }
  ctx.restore();

  bctx.lineWidth = 15;
  bctx.strokeStyle = '#2d2d2d';
  bctx.beginPath();
  bctx.arc(cx, cy, 206, 0, Math.PI * 2);
  bctx.stroke();

  bctx.lineWidth = 5;
  bctx.strokeStyle = '#404040';
  bctx.beginPath();
  bctx.arc(cx, cy, 185, 0, Math.PI * 2);
  bctx.stroke();

  // 3. 若为揭棋暗子（背面朝上不见字体），绘制古法精雕暗花蟠龙如意背纹；若为明子，绘制刀刻书法字心
  if (isHidden) {
    ctx.save();
    ctx.translate(cx, cy);
    bctx.save();
    bctx.translate(cx, cy);

    // 内层暗花宝相花/八角星盘背纹（无任何文字，符合揭棋暗子背面朝上定义）
    const primaryStroke = isRed ? '#b91c1c' : '#d4af37';
    const secondaryStroke = isRed ? '#d97706' : '#94a3b8';

    ctx.strokeStyle = primaryStroke;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 128, 0, Math.PI * 2);
    ctx.stroke();

    bctx.strokeStyle = '#262626';
    bctx.lineWidth = 8;
    bctx.beginPath();
    bctx.arc(0, 0, 128, 0, Math.PI * 2);
    bctx.stroke();

    // 十二瓣古雅莲瓣纹
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.save();
      ctx.rotate(a);
      ctx.strokeStyle = i % 2 === 0 ? primaryStroke : secondaryStroke;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 42);
      ctx.quadraticCurveTo(24, 84, 0, 122);
      ctx.quadraticCurveTo(-24, 84, 0, 42);
      ctx.stroke();
      ctx.restore();

      bctx.save();
      bctx.rotate(a);
      bctx.strokeStyle = '#303030';
      bctx.lineWidth = 5;
      bctx.beginPath();
      bctx.moveTo(0, 42);
      bctx.quadraticCurveTo(24, 84, 0, 122);
      bctx.quadraticCurveTo(-24, 84, 0, 42);
      bctx.stroke();
      bctx.restore();
    }

    // 中心云雷圆脐
    const bossGrad = ctx.createRadialGradient(-8, -8, 4, 0, 0, 38);
    if (isRed) {
      bossGrad.addColorStop(0, '#fef3c7');
      bossGrad.addColorStop(0.6, '#d97706');
      bossGrad.addColorStop(1, '#991b1b');
    } else {
      bossGrad.addColorStop(0, '#fef08a');
      bossGrad.addColorStop(0.6, '#ca8a04');
      bossGrad.addColorStop(1, '#475569');
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
      drawCalligraphicGlyph(ctx, char, cx, cy, 246, {
        carveShadowColor: 'rgba(68, 22, 8, 0.35)',
        carveOffsetX: -2.4,
        carveOffsetY: -2.8,
        bevelColor: 'rgba(255, 251, 235, 0.85)',
        bevelOffsetX: 2.2,
        bevelOffsetY: 2.8,
        strokeStyle: '#d4af37',
        lineWidth: 5.5,
        topGradientColors: ['#dc2626', '#991b1b', '#670d0d'],
        shadowColor: 'rgba(69, 10, 10, 0.25)',
        shadowBlur: 4,
        shadowOffsetX: 1,
        shadowOffsetY: 2
      });
    } else {
      drawCalligraphicGlyph(ctx, char, cx, cy, 246, {
        carveShadowColor: 'rgba(0, 0, 0, 0.72)',
        carveOffsetX: -2.6,
        carveOffsetY: -3.0,
        bevelColor: 'rgba(212, 175, 55, 0.65)',
        bevelOffsetX: 2.2,
        bevelOffsetY: 2.8,
        strokeStyle: '#c79c2e',
        lineWidth: 5.2,
        topGradientColors: ['#ffffff', '#fef3c7', '#f59e0b'],
        shadowColor: 'rgba(0, 0, 0, 0.45)',
        shadowBlur: 5,
        shadowOffsetX: 1,
        shadowOffsetY: 2
      });
    }

    // 凹凸法线贴图同步使用矢量书法路径，营造真实 3D 刀刻凹槽
    drawCalligraphicGlyph(bctx, char, cx, cy, 246, {
      strokeStyle: '#4a4a4a',
      lineWidth: 6.0,
      fillStyle: '#181818'
    });
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const topMaterial = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 0.028 });

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
    ctx.font = 'bold 54px "XiangqiCalligraphy", "Noto Serif SC", serif';
    ctx.fillText(trigrams[i], 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(cx + Math.cos(ang + Math.PI / 8) * 290, cy + Math.sin(ang + Math.PI / 8) * 290);
    ctx.rotate(ang + Math.PI / 8 + Math.PI / 2);
    if (typeof drawCalligraphicGlyph === 'function') {
      drawCalligraphicGlyph(ctx, runes[i], 0, 0, 44, { fillStyle: '#fca5a5' });
    } else {
      ctx.fillStyle = '#fca5a5';
      ctx.font = '900 42px "XiangqiCalligraphy", "Noto Serif SC", serif';
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
  ctx.font = '900 138px "XiangqiCalligraphy", "STKaiti", "Kaiti SC", "KaiTi", "Noto Serif SC", "Songti SC", serif';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#7f1d1d';
  ctx.strokeText(cleanTitle, 512, 235);

  const textGrad = ctx.createLinearGradient(0, 140, 0, 330);
  textGrad.addColorStop(0, '#ffffff');
  textGrad.addColorStop(0.45, '#fef08a');
  textGrad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = textGrad;
  ctx.fillText(cleanTitle, 512, 235);

  ctx.font = 'bold 38px "XiangqiCalligraphy", "STKaiti", "Kaiti SC", "KaiTi", "Noto Serif SC", serif';
  ctx.fillStyle = '#fca5a5';
  ctx.shadowBlur = 10;
  ctx.fillText(`【 ${subText || '古谱十八杀法 · 天道绝杀'} 】`, 512, 355);

  return new THREE.CanvasTexture(canvas);
}


const tacticalAuraCache = {};
/**
 * 生成棋子危险红光 (danger) 与可安全吃子绿光 (safe) 的 3D 柔光贴图（底盘光晕 + 环绕立体柱面流光）
 */
function getTacticalAuraTextures(kind = 'danger') {
  if (tacticalAuraCache[kind]) return tacticalAuraCache[kind];
  const isDanger = kind === 'danger';

  // 1. 地面与顶面柔光光环贴图 (Radial Halo)
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 256;
  rCanvas.height = 256;
  const rctx = rCanvas.getContext('2d');
  const rGrad = rctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  if (isDanger) {
    rGrad.addColorStop(0.0, 'rgba(255, 120, 120, 0.95)');
    rGrad.addColorStop(0.45, 'rgba(239, 68, 68, 0.80)');
    rGrad.addColorStop(0.72, 'rgba(220, 38, 38, 0.42)');
    rGrad.addColorStop(1.0, 'rgba(220, 38, 38, 0.0)');
  } else {
    rGrad.addColorStop(0.0, 'rgba(167, 243, 208, 0.95)');
    rGrad.addColorStop(0.45, 'rgba(16, 185, 129, 0.82)');
    rGrad.addColorStop(0.72, 'rgba(5, 150, 105, 0.42)');
    rGrad.addColorStop(1.0, 'rgba(5, 150, 105, 0.0)');
  }
  rctx.fillStyle = rGrad;
  rctx.fillRect(0, 0, 256, 256);

  // 精巧双流光内环
  rctx.strokeStyle = isDanger ? 'rgba(254, 202, 202, 0.88)' : 'rgba(167, 243, 208, 0.88)';
  rctx.lineWidth = 5;
  rctx.beginPath();
  rctx.arc(128, 128, 82, 0, Math.PI * 2);
  rctx.stroke();

  // 2. 棋子周身升腾立体光焰柱面贴图 (Vertical Cylinder Shell)
  const cCanvas = document.createElement('canvas');
  cCanvas.width = 256;
  cCanvas.height = 128;
  const cctx = cCanvas.getContext('2d');
  const vGrad = cctx.createLinearGradient(0, 128, 0, 0);
  if (isDanger) {
    vGrad.addColorStop(0.0, 'rgba(239, 68, 68, 0.92)');
    vGrad.addColorStop(0.45, 'rgba(248, 113, 113, 0.55)');
    vGrad.addColorStop(0.85, 'rgba(254, 202, 202, 0.16)');
    vGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  } else {
    vGrad.addColorStop(0.0, 'rgba(16, 185, 129, 0.92)');
    vGrad.addColorStop(0.45, 'rgba(52, 211, 153, 0.55)');
    vGrad.addColorStop(0.85, 'rgba(167, 243, 208, 0.16)');
    vGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  }
  cctx.fillStyle = vGrad;
  cctx.fillRect(0, 0, 256, 128);

  // 柔和竖向流光纹
  for (let i = 0; i < 16; i++) {
    const x = i * 16 + 8;
    const wGrad = cctx.createLinearGradient(0, 128, 0, 12);
    wGrad.addColorStop(0, isDanger ? 'rgba(254, 226, 226, 0.45)' : 'rgba(209, 250, 229, 0.45)');
    wGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    cctx.fillStyle = wGrad;
    cctx.fillRect(x - 2, 12, 4, 116);
  }

  const radialMap = new THREE.CanvasTexture(rCanvas);
  const cylinderMap = new THREE.CanvasTexture(cCanvas);
  cylinderMap.wrapS = THREE.RepeatWrapping;
  tacticalAuraCache[kind] = { radialMap, cylinderMap };
  return tacticalAuraCache[kind];
}
