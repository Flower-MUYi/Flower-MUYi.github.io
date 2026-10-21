/*************************************************************************
 * 2D CANVAS PROCEDURAL TEXTURE GENERATORS
 * (Chessboard, 3D Calligraphic Piece Medallions, Bagua Array, Magma Cracks,
 *  Holo Banner, Beautified Tactical Auras, Board Markers & Move Indicators)
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
    ctx.beginPath();
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

  const grad = ctx.createRadialGradient(cx, cy, 32, cx, cy, 495);
  grad.addColorStop(0, 'rgba(254, 249, 195, 0.58)');
  grad.addColorStop(0.38, 'rgba(251, 191, 36, 0.36)');
  grad.addColorStop(0.74, 'rgba(220, 38, 38, 0.24)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#fef08a';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 20;

  [476, 450, 370, 346, 238, 134].forEach((r, idx) => {
    ctx.lineWidth = idx % 2 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 24 晷刻流光刻度与星芒点
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    ctx.lineWidth = i % 3 === 0 ? 4 : 2;
    ctx.strokeStyle = i % 3 === 0 ? '#fef08a' : 'rgba(251, 191, 36, 0.65)';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 450, cy + Math.sin(a) * 450);
    ctx.lineTo(cx + Math.cos(a) * 474, cy + Math.sin(a) * 474);
    ctx.stroke();
  }

  ctx.lineWidth = 5;
  ctx.strokeStyle = '#fbbf24';
  for (let offset = 0; offset < 2; offset++) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + (offset * Math.PI) / 4;
      const x = cx + Math.cos(ang) * 346;
      const y = cy + Math.sin(ang) * 346;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 矢量绘制八卦三爻符号（乾兑离震巽坎艮坤），彻底杜绝字体缺失方框
  const trigramBars = [
    [1, 1, 1], // 乾
    [0, 1, 1], // 兑
    [1, 0, 1], // 离
    [0, 0, 1], // 震
    [1, 1, 0], // 巽
    [0, 1, 0], // 坎
    [1, 0, 0], // 艮
    [0, 0, 0]  // 坤
  ];
  const runes = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * 408, cy + Math.sin(ang) * 408);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;
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
  grad.addColorStop(0.22, 'rgba(254, 249, 195, 0.95)');
  grad.addColorStop(0.52, 'rgba(251, 191, 36, 0.52)');
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
  bgGrad.addColorStop(0, 'rgba(185, 28, 28, 0.68)');
  bgGrad.addColorStop(0.5, 'rgba(120, 53, 15, 0.36)');
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
  ctx.font = '900 138px "XiangqiCalligraphy", "Noto Serif SC", "Songti SC", "STKaiti", "Kaiti SC", "KaiTi", serif';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#7f1d1d';
  ctx.strokeText(cleanTitle, 512, 235);

  const textGrad = ctx.createLinearGradient(0, 140, 0, 330);
  textGrad.addColorStop(0, '#ffffff');
  textGrad.addColorStop(0.45, '#fef08a');
  textGrad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = textGrad;
  ctx.fillText(cleanTitle, 512, 235);

  ctx.font = 'bold 38px "XiangqiCalligraphy", "Noto Serif SC", "Songti SC", "STKaiti", "Kaiti SC", "KaiTi", serif';
  ctx.fillStyle = '#fca5a5';
  ctx.shadowBlur = 10;
  ctx.fillText(`【 ${subText || '古谱十八杀法 · 天道绝杀'} 】`, 512, 355);

  return new THREE.CanvasTexture(canvas);
}

const tacticalAuraCache = {};
/**
 * 美化升级 1：生成棋子危险红光 (danger) 与可安全吃子绿光 (safe) 的高精 3D 柔光贴图
 * （八瓣宝相莲华底盘光晕 + 柔化流光瑞气冠环 + 丝绸气旋与星屑升腾柱面贴图）
 */
function getTacticalAuraTextures(kind = 'danger') {
  if (tacticalAuraCache[kind]) return tacticalAuraCache[kind];
  const isDanger = kind === 'danger';

  // 1. 地面八瓣宝相莲华柔光阵盘贴图 (512×512 Radial Lotus Halo)
  const rSize = 512;
  const rCanvas = document.createElement('canvas');
  rCanvas.width = rSize;
  rCanvas.height = rSize;
  const rctx = rCanvas.getContext('2d');
  const rcx = rSize / 2, rcy = rSize / 2;

  const rGrad = rctx.createRadialGradient(rcx, rcy, 18, rcx, rcy, 250);
  if (isDanger) {
    rGrad.addColorStop(0.0, 'rgba(255, 241, 242, 0.92)');
    rGrad.addColorStop(0.32, 'rgba(251, 113, 133, 0.82)');
    rGrad.addColorStop(0.58, 'rgba(239, 68, 68, 0.62)');
    rGrad.addColorStop(0.80, 'rgba(185, 28, 28, 0.25)');
    rGrad.addColorStop(1.0, 'rgba(153, 27, 27, 0.0)');
  } else {
    rGrad.addColorStop(0.0, 'rgba(236, 253, 245, 0.92)');
    rGrad.addColorStop(0.32, 'rgba(52, 211, 153, 0.82)');
    rGrad.addColorStop(0.58, 'rgba(16, 185, 129, 0.62)');
    rGrad.addColorStop(0.80, 'rgba(5, 150, 105, 0.25)');
    rGrad.addColorStop(1.0, 'rgba(4, 120, 87, 0.0)');
  }
  rctx.fillStyle = rGrad;
  rctx.fillRect(0, 0, rSize, rSize);

  // 柔和发光内外双环
  rctx.save();
  rctx.shadowColor = isDanger ? '#ef4444' : '#10b981';
  rctx.shadowBlur = 18;
  rctx.strokeStyle = isDanger ? 'rgba(254, 202, 202, 0.92)' : 'rgba(167, 243, 208, 0.92)';
  rctx.lineWidth = 6;
  rctx.beginPath();
  rctx.arc(rcx, rcy, 176, 0, Math.PI * 2);
  rctx.stroke();

  rctx.strokeStyle = isDanger ? 'rgba(253, 224, 71, 0.72)' : 'rgba(254, 240, 138, 0.72)';
  rctx.lineWidth = 3;
  rctx.beginPath();
  rctx.arc(rcx, rcy, 150, 0, Math.PI * 2);
  rctx.stroke();

  // 八瓣古典莲华流光弧线与八方星芒珠点
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rctx.save();
    rctx.translate(rcx, rcy);
    rctx.rotate(a);

    rctx.strokeStyle = isDanger ? 'rgba(254, 226, 226, 0.78)' : 'rgba(209, 250, 229, 0.78)';
    rctx.lineWidth = 3.5;
    rctx.beginPath();
    rctx.moveTo(-36, 148);
    rctx.quadraticCurveTo(0, 206, 36, 148);
    rctx.stroke();

    // 阵眼金珠
    rctx.fillStyle = '#fef08a';
    rctx.beginPath();
    rctx.arc(0, 192, 5.5, 0, Math.PI * 2);
    rctx.fill();
    rctx.restore();
  }
  rctx.restore();

  // 2. 柔化冠冕流光环贴图 (256×256 Feathered Corona Ring，替代原先生硬的纯色 RingGeometry)
  const kSize = 256;
  const kCanvas = document.createElement('canvas');
  kCanvas.width = kSize;
  kCanvas.height = kSize;
  const kctx = kCanvas.getContext('2d');
  const kcx = kSize / 2, kcy = kSize / 2;

  const kGrad = kctx.createRadialGradient(kcx, kcy, 72, kcx, kcy, 126);
  if (isDanger) {
    kGrad.addColorStop(0.0, 'rgba(239, 68, 68, 0.0)');
    kGrad.addColorStop(0.35, 'rgba(248, 113, 113, 0.35)');
    kGrad.addColorStop(0.62, 'rgba(254, 202, 202, 0.92)');
    kGrad.addColorStop(0.82, 'rgba(239, 68, 68, 0.48)');
    kGrad.addColorStop(1.0, 'rgba(220, 38, 38, 0.0)');
  } else {
    kGrad.addColorStop(0.0, 'rgba(16, 185, 129, 0.0)');
    kGrad.addColorStop(0.35, 'rgba(52, 211, 153, 0.35)');
    kGrad.addColorStop(0.62, 'rgba(209, 250, 229, 0.92)');
    kGrad.addColorStop(0.82, 'rgba(16, 185, 129, 0.48)');
    kGrad.addColorStop(1.0, 'rgba(5, 150, 105, 0.0)');
  }
  kctx.fillStyle = kGrad;
  kctx.fillRect(0, 0, kSize, kSize);

  // 冠冕环上 4 道柔光流云亮弧
  kctx.save();
  kctx.translate(kcx, kcy);
  kctx.strokeStyle = '#fef9c3';
  kctx.shadowColor = isDanger ? '#f87171' : '#34d399';
  kctx.shadowBlur = 10;
  kctx.lineWidth = 3.5;
  for (let i = 0; i < 4; i++) {
    const startA = (i * Math.PI) / 2 + 0.18;
    kctx.beginPath();
    kctx.arc(0, 0, 104, startA, startA + 0.85);
    kctx.stroke();
  }
  kctx.restore();

  // 3. 棋子周身升腾丝绸气旋与星屑柱面贴图 (512×256 Vertical Silk Ribbon & Stardust Shell)
  const cCanvas = document.createElement('canvas');
  cCanvas.width = 512;
  cCanvas.height = 256;
  const cctx = cCanvas.getContext('2d');
  const vGrad = cctx.createLinearGradient(0, 256, 0, 0);
  if (isDanger) {
    vGrad.addColorStop(0.0, 'rgba(220, 38, 38, 0.0)');
    vGrad.addColorStop(0.12, 'rgba(239, 68, 68, 0.85)');
    vGrad.addColorStop(0.50, 'rgba(251, 113, 133, 0.42)');
    vGrad.addColorStop(0.85, 'rgba(254, 215, 170, 0.14)');
    vGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  } else {
    vGrad.addColorStop(0.0, 'rgba(5, 150, 105, 0.0)');
    vGrad.addColorStop(0.12, 'rgba(16, 185, 129, 0.85)');
    vGrad.addColorStop(0.50, 'rgba(52, 211, 153, 0.42)');
    vGrad.addColorStop(0.85, 'rgba(167, 243, 208, 0.14)');
    vGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  }
  cctx.fillStyle = vGrad;
  cctx.fillRect(0, 0, 512, 256);

  // 柔美斜向螺旋丝绸流光带（消除原先 16 根生硬竖条）
  cctx.save();
  cctx.shadowColor = isDanger ? '#f87171' : '#34d399';
  cctx.shadowBlur = 12;
  for (let i = 0; i < 8; i++) {
    const baseX = i * 64;
    const ribGrad = cctx.createLinearGradient(0, 248, 0, 20);
    ribGrad.addColorStop(0, isDanger ? 'rgba(254, 202, 202, 0.0)' : 'rgba(209, 250, 229, 0.0)');
    ribGrad.addColorStop(0.25, isDanger ? 'rgba(254, 226, 226, 0.65)' : 'rgba(209, 250, 229, 0.65)');
    ribGrad.addColorStop(0.7, isDanger ? 'rgba(253, 224, 71, 0.32)' : 'rgba(254, 240, 138, 0.32)');
    ribGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    cctx.strokeStyle = ribGrad;
    cctx.lineWidth = 10;
    cctx.lineCap = 'round';
    cctx.beginPath();
    cctx.moveTo(baseX, 246);
    cctx.bezierCurveTo(baseX + 24, 175, baseX + 42, 95, baseX + 68, 22);
    cctx.stroke();

    // 灵气星屑光点
    const dotX = (baseX + 32) % 512;
    const dotY = 70 + (i % 3) * 48;
    const dotGrad = cctx.createRadialGradient(dotX, dotY, 1, dotX, dotY, 12);
    dotGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    dotGrad.addColorStop(0.45, 'rgba(254, 240, 138, 0.65)');
    dotGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    cctx.fillStyle = dotGrad;
    cctx.beginPath();
    cctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
    cctx.fill();
  }
  cctx.restore();

  const radialMap = new THREE.CanvasTexture(rCanvas);
  const coronaMap = new THREE.CanvasTexture(kCanvas);
  const cylinderMap = new THREE.CanvasTexture(cCanvas);
  cylinderMap.wrapS = THREE.RepeatWrapping;
  tacticalAuraCache[kind] = { radialMap, coronaMap, cylinderMap };
  return tacticalAuraCache[kind];
}

const turnAuraCache = {};
/**
 * 美化升级 2：棋子回合呼吸光环贴图 (red / black / selected)，替代原先无贴图锯齿硬环
 */
function getTurnAuraTexture(kind = 'red') {
  if (turnAuraCache[kind]) return turnAuraCache[kind];
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;

  const isRed = kind === 'red';
  const isSel = kind === 'selected';

  const grad = ctx.createRadialGradient(cx, cy, 52, cx, cy, 124);
  if (isSel) {
    grad.addColorStop(0.0, 'rgba(254, 240, 138, 0.25)');
    grad.addColorStop(0.55, 'rgba(251, 191, 36, 0.85)');
    grad.addColorStop(0.78, 'rgba(245, 158, 11, 0.55)');
    grad.addColorStop(1.0, 'rgba(217, 119, 6, 0.0)');
  } else if (isRed) {
    grad.addColorStop(0.0, 'rgba(254, 202, 202, 0.08)');
    grad.addColorStop(0.60, 'rgba(239, 68, 68, 0.68)');
    grad.addColorStop(0.80, 'rgba(245, 158, 11, 0.42)');
    grad.addColorStop(1.0, 'rgba(220, 38, 38, 0.0)');
  } else {
    grad.addColorStop(0.0, 'rgba(186, 230, 253, 0.08)');
    grad.addColorStop(0.60, 'rgba(56, 189, 248, 0.68)');
    grad.addColorStop(0.80, 'rgba(251, 191, 36, 0.38)');
    grad.addColorStop(1.0, 'rgba(14, 165, 233, 0.0)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = isSel ? '#fef08a' : (isRed ? '#fca5a5' : '#bae6fd');
  ctx.shadowColor = isSel ? '#f59e0b' : (isRed ? '#ef4444' : '#38bdf8');
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(0, 0, 96, 0, Math.PI * 2);
  ctx.stroke();

  // 12 晷刻细芒
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 88, Math.sin(a) * 88);
    ctx.lineTo(Math.cos(a) * 104, Math.sin(a) * 104);
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  turnAuraCache[kind] = tex;
  return tex;
}

const boardMarkerCache = {};
/**
 * 美化升级 3：棋盘交互阵印贴图
 *   - 'selected'  : 选中棋子脚下鎏金八角莲华阵
 *   - 'last_from' : 上一步起点流云残影印
 *   - 'last_to'   : 上一步落点鎏金瑞光环
 *   - 'warning'   : 禁着/将军高光警示环
 */
function getBoardMarkerTexture(kind = 'selected') {
  if (boardMarkerCache[kind]) return boardMarkerCache[kind];
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;

  if (kind === 'selected') {
    const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 245);
    grad.addColorStop(0.0, 'rgba(254, 249, 195, 0.35)');
    grad.addColorStop(0.55, 'rgba(251, 191, 36, 0.65)');
    grad.addColorStop(0.78, 'rgba(245, 158, 11, 0.85)');
    grad.addColorStop(1.0, 'rgba(217, 119, 6, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 186, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.78)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 158, 0, Math.PI * 2);
    ctx.stroke();

    // 八方菱花阵芒
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 4);
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.moveTo(0, -218);
      ctx.lineTo(12, -186);
      ctx.lineTo(0, -166);
      ctx.lineTo(-12, -186);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  } else if (kind === 'last_from') {
    // 起点残影古印：中心灵泉光点 + 虚线圆环 + 四隅折角
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 185);
    grad.addColorStop(0.0, 'rgba(254, 249, 195, 0.95)');
    grad.addColorStop(0.18, 'rgba(96, 165, 250, 0.78)');
    grad.addColorStop(0.55, 'rgba(59, 130, 246, 0.26)');
    grad.addColorStop(1.0, 'rgba(37, 99, 235, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#bfdbfe';
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, 112, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 中心起点圆印
    ctx.fillStyle = '#eff6ff';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    // 四隅古雅折角
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.lineWidth = 5;
    const d = 136, l = 28;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([ sx, sy ]) => {
      ctx.beginPath();
      ctx.moveTo(sx * d, sy * (d - l));
      ctx.lineTo(sx * d, sy * d);
      ctx.lineTo(sx * (d - l), sy * d);
      ctx.stroke();
    });
    ctx.restore();
  } else if (kind === 'last_to') {
    // 落子瑞光环：温润琥珀金双环 + 四方瑞芒
    const grad = ctx.createRadialGradient(cx, cy, 108, cx, cy, 246);
    grad.addColorStop(0.0, 'rgba(245, 158, 11, 0.0)');
    grad.addColorStop(0.45, 'rgba(251, 191, 36, 0.42)');
    grad.addColorStop(0.72, 'rgba(254, 240, 138, 0.92)');
    grad.addColorStop(0.88, 'rgba(245, 158, 11, 0.45)');
    grad.addColorStop(1.0, 'rgba(217, 119, 6, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 188, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(96, 165, 250, 0.82)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 168, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 188, Math.sin(a) * 188, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else {
    // warning / checkmate highlight ring
    const grad = ctx.createRadialGradient(cx, cy, 90, cx, cy, 248);
    grad.addColorStop(0.0, 'rgba(239, 68, 68, 0.0)');
    grad.addColorStop(0.50, 'rgba(239, 68, 68, 0.55)');
    grad.addColorStop(0.75, 'rgba(254, 202, 202, 0.95)');
    grad.addColorStop(1.0, 'rgba(220, 38, 38, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 188, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  boardMarkerCache[kind] = tex;
  return tex;
}

const moveIndicatorTexCache = {};
/**
 * 美化升级 4：所有落点高精纹理生成器 ("美化所有落点")
 *   - 'dot_safe'       : 翠玉灵珠菱花落点（普通安全走子）
 *   - 'dot_unsafe'     : 朱砂警珠菱花落点（走过去会被吃）
 *   - 'capture_safe'   : 翠金四方锁敌阵（安全吃子落点）
 *   - 'capture_unsafe' : 赤焰四方警敌阵（吃子后会被兑/被吃）
 */
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
    // 走子落点：柔和Radial玉晕 + 外层金/翠细环 + 四方古典菱花星芒 + 中心立体灵珠光核
    const outerGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 236);
    if (isUnsafe) {
      outerGrad.addColorStop(0.0, 'rgba(255, 241, 242, 1.0)');
      outerGrad.addColorStop(0.22, 'rgba(251, 113, 133, 0.94)');
      outerGrad.addColorStop(0.46, 'rgba(239, 68, 68, 0.68)');
      outerGrad.addColorStop(0.75, 'rgba(185, 28, 28, 0.22)');
      outerGrad.addColorStop(1.0, 'rgba(153, 27, 27, 0.0)');
    } else {
      outerGrad.addColorStop(0.0, 'rgba(236, 253, 245, 1.0)');
      outerGrad.addColorStop(0.22, 'rgba(52, 211, 153, 0.94)');
      outerGrad.addColorStop(0.46, 'rgba(16, 185, 129, 0.68)');
      outerGrad.addColorStop(0.75, 'rgba(5, 150, 105, 0.22)');
      outerGrad.addColorStop(1.0, 'rgba(4, 120, 87, 0.0)');
    }
    ctx.fillStyle = outerGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = isUnsafe ? '#ef4444' : '#10b981';
    ctx.shadowBlur = 16;

    // 外层流光瑞环
    ctx.strokeStyle = isUnsafe ? 'rgba(254, 202, 202, 0.92)' : 'rgba(167, 243, 208, 0.92)';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.arc(0, 0, 128, 0, Math.PI * 2);
    ctx.stroke();

    // 内层描金细环
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.88)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 92, 0, Math.PI * 2);
    ctx.stroke();

    // 四方十字星芒花瓣（契合棋盘横竖网格线）
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.fillStyle = isUnsafe ? '#fecdd3' : '#d1fae5';
      ctx.beginPath();
      ctx.moveTo(0, -188);
      ctx.quadraticCurveTo(18, -142, 0, -104);
      ctx.quadraticCurveTo(-18, -142, 0, -188);
      ctx.fill();
      ctx.restore();
    }

    // 四隅金粟珠点
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 128, Math.sin(a) * 128, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 中心立体玉珠高光核心
    const coreGrad = ctx.createRadialGradient(-14, -14, 4, 0, 0, 66);
    if (isUnsafe) {
      coreGrad.addColorStop(0.0, '#ffffff');
      coreGrad.addColorStop(0.35, '#fecaca');
      coreGrad.addColorStop(0.78, '#ef4444');
      coreGrad.addColorStop(1.0, '#991b1b');
    } else {
      coreGrad.addColorStop(0.0, '#ffffff');
      coreGrad.addColorStop(0.35, '#a7f3d0');
      coreGrad.addColorStop(0.78, '#10b981');
      coreGrad.addColorStop(1.0, '#065f46');
    }
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#fef9c3';
    ctx.stroke();
    ctx.restore();
  } else {
    // 吃子落点：四方金戈锁敌阵盘（外层锁定角标 + 双层流光符文环 + 内向锋芒）
    const ringGrad = ctx.createRadialGradient(cx, cy, 110, cx, cy, 250);
    if (isUnsafe) {
      ringGrad.addColorStop(0.0, 'rgba(239, 68, 68, 0.0)');
      ringGrad.addColorStop(0.38, 'rgba(239, 68, 68, 0.42)');
      ringGrad.addColorStop(0.68, 'rgba(254, 202, 202, 0.92)');
      ringGrad.addColorStop(0.88, 'rgba(220, 38, 38, 0.48)');
      ringGrad.addColorStop(1.0, 'rgba(185, 28, 28, 0.0)');
    } else {
      ringGrad.addColorStop(0.0, 'rgba(16, 185, 129, 0.0)');
      ringGrad.addColorStop(0.38, 'rgba(16, 185, 129, 0.42)');
      ringGrad.addColorStop(0.68, 'rgba(167, 243, 208, 0.92)');
      ringGrad.addColorStop(0.88, 'rgba(5, 150, 105, 0.48)');
      ringGrad.addColorStop(1.0, 'rgba(4, 120, 87, 0.0)');
    }
    ctx.fillStyle = ringGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = isUnsafe ? '#ef4444' : '#10b981';
    ctx.shadowBlur = 18;

    ctx.strokeStyle = isUnsafe ? '#fecaca' : '#a7f3d0';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 184, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.setLineDash([22, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, 160, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 四隅古戈锁定折角与内指锋芒
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-42, -206);
      ctx.lineTo(0, -222);
      ctx.lineTo(42, -206);
      ctx.stroke();

      // 内指锁敌锋芒三角
      ctx.fillStyle = isUnsafe ? '#fca5a5' : '#6ee7b7';
      ctx.beginPath();
      ctx.moveTo(0, -142);
      ctx.lineTo(15, -176);
      ctx.lineTo(-15, -176);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  moveIndicatorTexCache[kind] = tex;
  return tex;
}
