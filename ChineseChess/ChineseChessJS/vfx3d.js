/*************************************************************************
 * 3D + 2D JJ-STYLE ULTIMATE CHECKMATE CINEMATICS, MOVE IMPACT RIPPLES
 * & GRANDMASTER HINT TRAJECTORY MODULE
 * Extends Xiangqi3DApp.prototype
 *************************************************************************/

Object.assign(Xiangqi3DApp.prototype, {
  clearCheckmateHighlights() {
    if (!this.checkmateHighlightRings) return;
    for (const ring of this.checkmateHighlightRings) {
      this.scene?.remove(ring);
      ring.geometry?.dispose?.();
      ring.material?.dispose?.();
    }
    this.checkmateHighlightRings = [];
  },

  showCheckmateHighlights(coords) {
    this.clearCheckmateHighlights();
    if (!coords || !coords.length) return;
    const warnTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('warning') : null;
    const goldTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('selected') : null;

    const seen = new Set();
    coords.forEach((pt, idx) => {
      if (!pt || typeof pt.r !== 'number' || typeof pt.c !== 'number') return;
      const key = `${pt.r}_${pt.c}`;
      if (seen.has(key)) return;
      seen.add(key);
      const pos = gridToWorld(pt.r, pt.c);
      const tex = idx === 0 ? warnTex : goldTex;
      const ring = new THREE.Mesh(
        new THREE.PlaneGeometry(1.24, 1.24),
        new THREE.MeshBasicMaterial({
          map: tex || null,
          color: tex ? 0xffffff : (idx === 0 ? 0xff2222 : 0xfbbf24),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.94,
          depthWrite: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.028, pos.z);
      this.scene.add(ring);
      this.checkmateHighlightRings.push(ring);
    });
  },

  ensureCheckmateFXCanvas() {
    let canvas = document.getElementById('checkmate-fx-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'checkmate-fx-canvas';
      canvas.className = 'pointer-events-none fixed inset-0 z-30 hidden';
      document.body.appendChild(canvas);
    }
    canvas.style.zIndex = '28';
    canvas.style.pointerEvents = 'none';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, window.innerWidth || 1024);
    const h = Math.max(320, window.innerHeight || 768);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    return { canvas, ctx: canvas.getContext('2d'), w, h, dpr };
  },

  projectWorldToScreen(wx, wy, wz, w, h) {
    if (!this.camera) return { x: w * 0.5, y: h * 0.5 };
    const v = new THREE.Vector3(wx, wy, wz);
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * w,
      y: (-v.y * 0.5 + 0.5) * h
    };
  },

  clearCheckmateVFX() {
    if (this._activeCheckerMeshes && this._activeCheckerMeshes.length > 0) {
      for (const item of this._activeCheckerMeshes) {
        if (item.mesh && item.basePos) {
          item.mesh.position.copy(item.basePos);
          item.mesh.rotation.set(0, 0, 0);
          item.mesh.scale.set(1, 1, 1);
        }
      }
      this._activeCheckerMeshes = [];
    }
    if (this._activeCheckerMesh && this._activeCheckerBasePos) {
      this._activeCheckerMesh.position.copy(this._activeCheckerBasePos);
      this._activeCheckerMesh.rotation.set(0, 0, 0);
      this._activeCheckerMesh.scale.set(1, 1, 1);
      this._activeCheckerMesh = null;
      this._activeCheckerBasePos = null;
    }
    if (this._savedCamBeforeVFX) {
      this.desiredSpherical = { ...this._savedCamBeforeVFX.spherical };
      this.camTarget.copy(this._savedCamBeforeVFX.target);
      this._savedCamBeforeVFX = null;
    }
    const fxCanvas = document.getElementById('checkmate-fx-canvas');
    if (fxCanvas) {
      const ctx = fxCanvas.getContext('2d');
      ctx?.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
      fxCanvas.classList.add('hidden');
    }
    if (this.container) {
      this.container.style.filter = '';
      this.container.style.transform = '';
    }
    if (this.checkmateVFXGroup) {
      while (this.checkmateVFXGroup.children.length > 0) {
        const child = this.checkmateVFXGroup.children[0];
        this.checkmateVFXGroup.remove(child);
        child.traverse?.(obj => {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
          else obj.material?.dispose?.();
        });
      }
    }
    this.checkmateVFXAnimations = [];
    this.vfxAtmosphereTimer = 0;
    this.vfxAtmosphereDuration = 0;
    if (this.scene && this.sunLight && this.hemiLight) {
      const sc = this.getActiveSceneConfig?.() || {
        bgHex: 0xdbe9dc,
        sunColor: 0xfff8eb,
        sunIntensity: 0.88,
        hemiSky: 0xfffdf6,
        hemiGround: 0x5c7a58,
        hemiIntensity: 0.62
      };
      this.scene.background.setHex(sc.bgHex);
      if (this.scene.fog) this.scene.fog.color.setHex(sc.bgHex);
      this.sunLight.color.setHex(sc.sunColor || 0xfff8eb);
      this.sunLight.intensity = sc.sunIntensity || 0.88;
      this.hemiLight.color.setHex(sc.hemiSky || 0xfffdf6);
      this.hemiLight.groundColor.setHex(sc.hemiGround || 0x5c7a58);
      this.hemiLight.intensity = sc.hemiIntensity || 0.62;
    }
  },

  toggleVFXDrawer(forceState) {
    if (this.onlineRole && forceState !== false) {
      this.showCenterCallout('联机中不可演武绝杀', this.onlineRole);
      return;
    }
    const drawer = document.getElementById('vfx-drawer');
    if (!drawer) return;
    const willShow = typeof forceState === 'boolean' ? forceState : drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !willShow);
    if (willShow) this.sfx.playSelect();
  },

  previewUltimateVFX(vfxType, title, badge, stampText = '') {
    if (vfxType === 'sea_bottom_moon') vfxType = 'frost_lotus_strike';
    this.toggleVFXDrawer(false);
    this.closeModalOnly();
    let kr = 0, kc = 4, wkr = 9, wkc = 4;
    for (let r = 0; r < 10; r++) {
      for (let c = 3; c <= 5; c++) {
        const p = this.engine.board[r][c];
        if (p && p.type === 'k') {
          if (p.color === BLACK) { kr = r; kc = c; }
          else { wkr = r; wkc = c; }
        }
      }
    }
    const meta = (typeof CheckmateClassifier !== 'undefined' && CheckmateClassifier.getMetaByType)
      ? CheckmateClassifier.getMetaByType(vfxType)
      : { title: title || '绝杀', stampText: stampText || '绝杀', subBanner: badge || '雷霆绝杀', badge: badge || '绝杀', vfxType };

    const sampleCheckersByType = {
      double_chariot: [{ r: 0, c: 0, char: '俥', type: 'r' }, { r: 1, c: 8, char: '俥', type: 'r' }],
      smothered_palace: [{ r: 0, c: 0, char: '炮', type: 'c' }, { r: 0, c: 3, char: '士', type: 'a' }],
      royal_gaze: [{ r: 2, c: 3, char: '俥', type: 'r' }, { r: wkr, c: wkc, char: '帥', type: 'k' }],
      double_cannon: [{ r: 6, c: 3, char: '炮', type: 'c' }, { r: 4, c: 3, char: '炮', type: 'c' }],
      horse_cannon: [{ r: 2, c: 4, char: '傌', type: 'n' }, { r: 4, c: 4, char: '炮', type: 'c' }],
      iron_bolt: [{ r: 0, c: 7, char: '俥', type: 'r' }, { r: 7, c: 4, char: '炮', type: 'c' }],
      side_tiger: [{ r: 3, c: 6, char: '傌', type: 'n' }, { r: 0, c: 7, char: '俥', type: 'r' }],
      octagon_horse: [{ r: 2, c: 5, char: '傌', type: 'n' }, { r: 0, c: 0, char: '俥', type: 'r' }],
      fishing_horse: [{ r: 2, c: 6, char: '傌', type: 'n' }, { r: 0, c: 8, char: '俥', type: 'r' }],
      standing_horse_chariot: [{ r: 0, c: 3, char: '俥', type: 'r' }, { r: 2, c: 2, char: '傌', type: 'n' }],
      double_check: [{ r: 4, c: 3, char: '俥', type: 'r' }, { r: 9, c: 3, char: '炮', type: 'c' }],
      chariot_cannon_clamp: [{ r: 0, c: 0, char: '炮', type: 'c' }, { r: 1, c: 3, char: '俥', type: 'r' }, { r: 0, c: 3, char: '炮', type: 'c' }],
      trough_horse: [{ r: 1, c: 2, char: '傌', type: 'n' }],
      smothered_kill: [{ r: 0, c: 5, char: '炮', type: 'c' }],
      heaven_earth_cannon: [{ r: 0, c: 8, char: '炮', type: 'c' }, { r: 5, c: 4, char: '炮', type: 'c' }],
      stalemate_trap: [{ r: 2, c: 2, char: '傌', type: 'n' }, { r: 1, c: 3, char: '俥', type: 'r' }],
      frost_lotus_strike: [{ r: 0, c: 2, char: '兵', type: 'p' }, { r: 7, c: 4, char: '俥', type: 'r' }]
    };
    const mockCheckers = sampleCheckersByType[vfxType] || [{ r: 1, c: 4, char: '俥', type: 'r' }];
    const highlightCoords = [{ r: kr, c: kc }, ...mockCheckers.map(c => ({ r: c.r, c: c.c }))];

    const mockPattern = {
      ...meta,
      title: title || meta.title,
      stampText: stampText || title || meta.stampText,
      subBanner: badge || meta.subBanner,
      badge: badge || meta.badge,
      vfxType,
      kingCoord: { r: kr, c: kc },
      royalCoord: { r: wkr, c: wkc },
      checkers: mockCheckers,
      highlightCoords
    };
    this.showCheckmateHighlights(mockPattern.highlightCoords);
    this.triggerCheckmateVFX(mockPattern, RED);
  },

  replayCheckmateVFX() {
    if (!this.lastCheckmatePattern) return;
    this.closeModalOnly();
    this.triggerCheckmateVFX(this.lastCheckmatePattern, this.lastWinnerColor);
  },

  triggerScreenFlash() {
    const flashEl = document.getElementById('vfx-screen-flash');
    if (!flashEl) return;
    flashEl.classList.remove('vfx-flash-active');
    void flashEl.offsetWidth;
    flashEl.classList.add('vfx-flash-active');
  },

  /**
   * 绘制 JJ 象棋风格 3D 立体斜视木质/玉质棋子勋章（带厚实侧边、双环回纹与刀刻书法）
   */
  drawJJMedallion2D(ctx, x, y, radius, char, isRed, scaleX = 1, scaleY = 1, rot = 0, glowColor = '#fef08a', alpha = 1) {
    if (alpha <= 0.01 || radius <= 2) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scaleX, scaleY);

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = radius * 0.48;

    // 3D 棋子立体侧壁厚度 (Cylindrical Rim Extrusion)
    const depth = radius * 0.24;
    const rimGrad = ctx.createLinearGradient(-radius, 0, radius, depth);
    if (isRed) {
      rimGrad.addColorStop(0, '#92400e');
      rimGrad.addColorStop(0.5, '#d97706');
      rimGrad.addColorStop(1, '#451a03');
    } else {
      rimGrad.addColorStop(0, '#334155');
      rimGrad.addColorStop(0.5, '#64748b');
      rimGrad.addColorStop(1, '#090d16');
    }
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(0, depth, radius, 0, Math.PI * 2);
    ctx.fill();

    // 棋子顶面温润象牙木 / 玄武乌木渐变
    const bodyGrad = ctx.createRadialGradient(-radius * 0.28, -radius * 0.28, radius * 0.08, 0, 0, radius);
    if (isRed) {
      bodyGrad.addColorStop(0, '#fffbeb');
      bodyGrad.addColorStop(0.52, '#f5e6c8');
      bodyGrad.addColorStop(0.84, '#d4a359');
      bodyGrad.addColorStop(1, '#854d0e');
    } else {
      bodyGrad.addColorStop(0, '#475569');
      bodyGrad.addColorStop(0.45, '#1e293b');
      bodyGrad.addColorStop(0.82, '#0f172a');
      bodyGrad.addColorStop(1, '#020617');
    }
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // 外圈双环回纹装饰
    ctx.lineWidth = Math.max(2.5, radius * 0.075);
    ctx.strokeStyle = isRed ? '#b91c1c' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.84, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = Math.max(1.2, radius * 0.028);
    ctx.strokeStyle = isRed ? '#d97706' : '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.74, 0, Math.PI * 2);
    ctx.stroke();

    if (typeof drawCalligraphicGlyph === 'function') {
      drawCalligraphicGlyph(ctx, char, 0, 0, radius * 1.12, {
        strokeStyle: isRed ? '#fef08a' : '#78350f',
        lineWidth: radius * 0.04,
        topGradientColors: isRed ? ['#ef4444', '#b91c1c', '#450a0a'] : ['#ffffff', '#fde047', '#d97706']
      });
    } else {
      ctx.font = `900 ${Math.round(radius * 1.02)}px "XiangqiCalligraphy", "Noto Serif SC", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isRed ? '#b91c1c' : '#fde047';
      ctx.fillText(char, 0, 0);
    }
    ctx.restore();
  },

  /**
   * 绘制 JJ 象棋标志性玄铁锁链 (闷宫 / 铁门栓 / 闷杀)
   */
  drawJJChain2D(ctx, x1, y1, x2, y2, linkCount = 14, glowColor = '#f59e0b', alpha = 1) {
    if (alpha <= 0.01) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 14;
    for (let i = 0; i <= linkCount; i++) {
      const f = i / linkCount;
      const lx = x1 + dx * f;
      const ly = y1 + dy * f;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(ang + (i % 2 === 0 ? 0.22 : -0.22));
      ctx.strokeStyle = i % 2 === 0 ? '#1e293b' : '#090d16';
      ctx.lineWidth = 8.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },

  drawJJTopCinematicBar(ctx, cx, topY, subBannerText, alpha = 1, accentColor = '#f59e0b') {
    if (alpha <= 0.01 || !subBannerText) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, topY);

    const barW = Math.min(500, window.innerWidth * 0.86);
    const barH = 38;
    const grad = ctx.createLinearGradient(-barW * 0.5, 0, barW * 0.5, 0);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
    grad.addColorStop(0.18, 'rgba(18, 12, 10, 0.88)');
    grad.addColorStop(0.5, 'rgba(52, 14, 14, 0.94)');
    grad.addColorStop(0.82, 'rgba(18, 12, 10, 0.88)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-barW * 0.5, -barH * 0.5, barW, barH);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-barW * 0.38, -barH * 0.5);
    ctx.lineTo(barW * 0.38, -barH * 0.5);
    ctx.moveTo(-barW * 0.38, barH * 0.5);
    ctx.lineTo(barW * 0.38, barH * 0.5);
    ctx.stroke();

    ctx.font = 'bold 15px "XiangqiCalligraphy", "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef3c7';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.fillText(`◆  ${subBannerText}  ◆`, 0, 1);
    ctx.restore();
  },

  /**
   * 绘制 JJ 象棋原版风格 3D 浮雕鎏金行书大字（无黑框遮挡法相，带多层立体厚度与刀锋长尾）
   */
  drawJJBrushTitle(ctx, cx, cy, text, fontSize, slamScale = 1, alpha = 1, subText = '', accentColor = '#f59e0b', colorPhase = 1) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(slamScale, slamScale);

    const chars = String(text || '绝杀').split('');
    const spacing = fontSize * 1.06;
    const totalW = (chars.length - 1) * spacing;

    // 底部柔和流光气韵（不遮挡后方法相插画）
    const glowW = totalW + fontSize * 2.2;
    const glowGrad = ctx.createRadialGradient(0, 0, fontSize * 0.1, 0, 0, glowW * 0.58);
    const isCyanPhase = colorPhase < 0.45;
    glowGrad.addColorStop(0, isCyanPhase ? 'rgba(56, 189, 248, 0.42)' : 'rgba(245, 158, 11, 0.38)');
    glowGrad.addColorStop(0.55, isCyanPhase ? 'rgba(14, 116, 144, 0.18)' : 'rgba(180, 83, 9, 0.16)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, glowW * 0.58, fontSize * 0.72, -0.04, 0, Math.PI * 2);
    ctx.fill();

    // 书法飞白金色横扫刀芒（复刻JJ象棋文字底部的流光剑气）
    ctx.save();
    ctx.strokeStyle = isCyanPhase ? '#7dd3fc' : '#fef08a';
    ctx.shadowColor = isCyanPhase ? '#0284c7' : accentColor;
    ctx.shadowBlur = 18;
    ctx.lineWidth = Math.max(3, fontSize * 0.045);
    ctx.beginPath();
    ctx.moveTo(-glowW * 0.46, fontSize * 0.36);
    ctx.quadraticCurveTo(0, fontSize * 0.54, glowW * 0.48, fontSize * 0.22);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px "XiangqiCalligraphy", "STKaiti", "Kaiti SC", "KaiTi", "Noto Serif SC", "Songti SC", serif`;

    chars.forEach((ch, idx) => {
      const ox = idx * spacing - totalW * 0.5;
      const oy = (idx % 2 === 0 ? -3 : 3);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate((idx - (chars.length - 1) * 0.5) * 0.032 - 0.03);

      // 1. 7层 3D 立体暗金铜浮雕底座 (3D Extruded Bevel Depth)
      const extrudeSteps = 7;
      for (let d = extrudeSteps; d >= 1; d--) {
        ctx.fillStyle = isCyanPhase
          ? (d > 4 ? '#082f49' : '#0369a1')
          : (d > 4 ? '#270e04' : '#78350f');
        ctx.fillText(ch, d * 1.4, d * 1.9);
      }

      // 2. 深色外轮廓勾边，凸显立体凌厉感
      ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 6;
      ctx.lineWidth = Math.max(6, fontSize * 0.10);
      ctx.strokeStyle = isCyanPhase ? '#082f49' : '#3b1106';
      ctx.strokeText(ch, 0, 0);

      // 3. 阳刻鎏金主体渐变填充
      ctx.shadowColor = isCyanPhase ? '#38bdf8' : accentColor;
      ctx.shadowBlur = 26;
      const g = ctx.createLinearGradient(0, -fontSize * 0.52, 0, fontSize * 0.52);
      if (isCyanPhase) {
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, '#bae6fd');
        g.addColorStop(0.75, '#38bdf8');
        g.addColorStop(1, '#0284c7');
      } else {
        g.addColorStop(0, '#fffef0');
        g.addColorStop(0.28, '#fef08a');
        g.addColorStop(0.65, '#f59e0b');
        g.addColorStop(1, '#b45309');
      }
      ctx.fillStyle = g;
      ctx.fillText(ch, 0, 0);

      // 4. 顶部高光描边
      ctx.lineWidth = Math.max(1.8, fontSize * 0.025);
      ctx.strokeStyle = isCyanPhase ? '#e0f2fe' : '#fffbeb';
      ctx.strokeText(ch, -1, -1.5);
      ctx.restore();
    });

    if (subText) {
      const subSize = Math.max(14, Math.round(fontSize * 0.23));
      ctx.font = `bold ${subSize}px "XiangqiCalligraphy", "Noto Serif SC", serif`;
      ctx.fillStyle = '#fef3c7';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      ctx.fillText(`◆ ${subText} ◆`, 0, fontSize * 0.82);
    }
    ctx.restore();
  },

  /**
   * 复刻 JJ象棋绝杀动画 17 种专属史诗 2D 法相画卷 (renderJJHeroSpectacle2D)
   */
  renderJJHeroSpectacle2D(ctx, w, h, p, vfxType, winnerColor, checker, kCoord, pattern) {
    const cx = w * 0.5;
    const cy = h * 0.44;
    const minDim = Math.min(w, h);
    const R = minDim * 0.36;
    const isRedWinner = winnerColor === RED;
    const enemyKingChar = isRedWinner ? '將' : '帥';
    const allyKingChar = isRedWinner ? '帥' : '將';
    const checkerChar = checker?.char || (isRedWinner ? '俥' : '車');

    ctx.save();

    // 1. 双车错 (00:00 - 00:04): 双俥火环交错旋转 -> 双金甲战车破空冲锋
    if (vfxType === 'double_chariot') {
      // S型烈焰流光轨迹
      for (let idx = 0; idx < 2; idx++) {
        const dir = idx === 0 ? 1 : -1;
        ctx.save();
        ctx.strokeStyle = idx === 0 ? '#f97316' : '#fef08a';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 24;
        ctx.lineWidth = Math.max(8, R * 0.09 * (1 - p * 0.3));
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let s = 0; s <= 24; s++) {
          const t = (s / 24) * Math.min(1, p * 1.4);
          const ang = t * Math.PI * 1.85 + (idx * Math.PI);
          const rad = R * (0.95 - t * 0.42);
          const px = cx + Math.cos(ang) * rad * 1.15;
          const py = cy + Math.sin(ang) * rad * 0.82;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // 双战车 3D 意象与旋转战轮 (00:03)
        if (p > 0.22) {
          const cp = Math.min(1, (p - 0.22) / 0.65);
          const wx = cx + dir * THREE.MathUtils.lerp(R * 1.1, R * 0.38, cp);
          const wy = cy + dir * THREE.MathUtils.lerp(R * 0.62, R * 0.22, cp);
          ctx.save();
          ctx.translate(wx, wy);
          ctx.rotate(-0.35);
          // 战车金轮与辐条
          const wheelR = R * 0.28;
          ctx.strokeStyle = '#fbbf24';
          ctx.fillStyle = 'rgba(120, 53, 15, 0.85)';
          ctx.lineWidth = 5;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(0, 0, wheelR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          for (let sp = 0; sp < 8; sp++) {
            const sa = (sp * Math.PI) / 4 + p * 14 * dir;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(sa) * wheelR, Math.sin(sa) * wheelR);
            ctx.stroke();
          }
          // 战车弩机与金戈锋刃
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.moveTo(dir * wheelR * 0.4, -wheelR * 0.35);
          ctx.lineTo(dir * wheelR * 1.85, 0);
          ctx.lineTo(dir * wheelR * 0.4, wheelR * 0.35);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // 双「俥」棋子交错飞旋 (00:02)
        const ang = p * Math.PI * 1.6 + idx * Math.PI;
        const mx = cx + Math.cos(ang) * R * 0.56;
        const my = cy + Math.sin(ang) * R * 0.52;
        this.drawJJMedallion2D(
          ctx, mx, my, R * (0.28 + idx * 0.06),
          isRedWinner ? '俥' : '車', isRedWinner,
          1.0, 0.78, ang * 0.3, '#f97316', Math.min(1, (1 - p * 0.15))
        );
      }
    }

    // 2. 闷宫 (00:05 - 00:12): 烈焰风暴 + 四周粗铁链锁宫 + 敌将旋转裂光爆碎
    else if (vfxType === 'smothered_palace') {
      // 烈焰气旋漩涡 (00:07-00:09)
      for (let ring = 3; ring >= 0; ring--) {
        const rad = R * (0.38 + ring * 0.24);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(p * (4.5 - ring * 0.6));
        const g = ctx.createRadialGradient(0, 0, rad * 0.2, 0, 0, rad);
        g.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
        g.addColorStop(0.6, 'rgba(234, 88, 12, 0.35)');
        g.addColorStop(1, 'rgba(124, 45, 18, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, rad * 1.18, rad * 0.88, 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 上下弧形玄铁重链 (00:07-00:10)
      this.drawJJChain2D(ctx, w * 0.05, cy - R * 0.78, w * 0.95, cy - R * 0.52, 16, '#fbbf24', 0.92);
      this.drawJJChain2D(ctx, w * 0.05, cy + R * 0.65, w * 0.95, cy + R * 0.82, 16, '#fbbf24', 0.92);

      // 中心「將」字棋子翻转锁困 + 内部金光崩裂射线 (00:08 - 00:10)
      const flipScaleX = p < 0.35 ? Math.max(0.22, Math.abs(Math.cos(p * Math.PI * 4))) : 1.0;
      this.drawJJMedallion2D(ctx, cx, cy - R * 0.06, R * 0.36, enemyKingChar, !isRedWinner, flipScaleX, 1.0, 0, '#f59e0b', 1.0);

      if (p > 0.42) {
        const crackP = (p - 0.42) / 0.58;
        ctx.save();
        ctx.translate(cx, cy - R * 0.06);
        ctx.globalCompositeOperation = 'lighter';
        for (let rIdx = 0; rIdx < 10; rIdx++) {
          const ra = (rIdx / 10) * Math.PI * 2 + crackP * 0.4;
          const beamLen = R * (0.35 + crackP * 0.95) * (rIdx % 2 === 0 ? 1.15 : 0.75);
          const bGrad = ctx.createLinearGradient(0, 0, Math.cos(ra) * beamLen, Math.sin(ra) * beamLen);
          bGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
          bGrad.addColorStop(0.4, 'rgba(254, 240, 138, 0.85)');
          bGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ra - 0.09) * beamLen, Math.sin(ra - 0.09) * beamLen);
          ctx.lineTo(Math.cos(ra + 0.09) * beamLen, Math.sin(ra + 0.09) * beamLen);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 3. 对面笑 (00:13 - 00:19): 金色流光绸带 + 巨型金甲帝王神将挥戈斩击
    else if (vfxType === 'royal_gaze') {
      const heroY = cy - R * 0.18;
      ctx.save();
      ctx.translate(cx, heroY);
      const auraGrad = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.15);
      auraGrad.addColorStop(0, 'rgba(254, 240, 138, 0.52)');
      auraGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.25)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // 金甲神将半身法相 (00:16 - 00:18)
      const appear = Math.min(1, p / 0.28);
      ctx.scale(appear, appear);
      ctx.strokeStyle = '#fef08a';
      ctx.fillStyle = 'rgba(180, 83, 9, 0.72)';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 22;
      ctx.lineWidth = 4;

      // 披风与肩甲
      ctx.beginPath();
      ctx.moveTo(-R * 0.75, R * 0.55);
      ctx.quadraticCurveTo(-R * 0.58, -R * 0.25, -R * 0.26, -R * 0.35);
      ctx.lineTo(R * 0.26, -R * 0.35);
      ctx.quadraticCurveTo(R * 0.58, -R * 0.25, R * 0.75, R * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 胸甲护心镜
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-R * 0.34, -R * 0.28);
      ctx.lineTo(R * 0.34, -R * 0.28);
      ctx.lineTo(R * 0.22, R * 0.38);
      ctx.lineTo(-R * 0.22, R * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 帝王凤翅金盔
      ctx.beginPath();
      ctx.arc(0, -R * 0.52, R * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 凤翅冠翼
      [-1, 1].forEach(dir => {
        ctx.beginPath();
        ctx.moveTo(dir * R * 0.14, -R * 0.62);
        ctx.quadraticCurveTo(dir * R * 0.48, -R * 0.92, dir * R * 0.56, -R * 0.52);
        ctx.stroke();
      });

      // 横贯画面的神将黄金龙枪/长剑 (00:16-00:18)
      const slashAng = -0.32 + Math.sin(p * Math.PI) * 0.22;
      ctx.save();
      ctx.rotate(slashAng);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-R * 1.25, 0);
      ctx.lineTo(R * 1.25, 0);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(R * 1.05, -R * 0.10);
      ctx.lineTo(R * 1.48, 0);
      ctx.lineTo(R * 1.05, R * 0.10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.restore();

      // 掠过的「帥」与「俥」勋章 (00:15)
      if (p < 0.55) {
        const mp = p / 0.55;
        this.drawJJMedallion2D(ctx, cx - R * (1.1 - mp * 0.5), cy + R * 0.35, R * 0.26, allyKingChar, isRedWinner, 1, 0.72, -0.2, '#fef08a', 1 - mp);
        this.drawJJMedallion2D(ctx, cx + R * (1.1 - mp * 0.5), cy - R * 0.35, R * 0.25, checkerChar, isRedWinner, 1, 0.72, 0.2, '#fef08a', 1 - mp);
      }
    }

    // 4. 重炮 (00:20 - 00:26): 巍峨城墙垛口 + 并列双龙巨炮齐射轰击
    else if (vfxType === 'double_cannon') {
      const wallY = cy + R * 0.12;
      ctx.save();
      // 城墙垛口底座 (00:23)
      const wallGrad = ctx.createLinearGradient(0, wallY - R * 0.2, 0, wallY + R * 0.75);
      wallGrad.addColorStop(0, '#78350f');
      wallGrad.addColorStop(0.5, '#451a03');
      wallGrad.addColorStop(1, '#1c0a00');
      ctx.fillStyle = wallGrad;
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - R * 1.25, wallY + R * 0.68);
      ctx.lineTo(cx - R * 1.12, wallY);
      for (let i = -3; i <= 2; i++) {
        const bx = cx + i * R * 0.34;
        ctx.lineTo(bx, wallY);
        ctx.lineTo(bx, wallY - R * 0.12);
        ctx.lineTo(bx + R * 0.18, wallY - R * 0.12);
        ctx.lineTo(bx + R * 0.18, wallY);
      }
      ctx.lineTo(cx + R * 1.12, wallY);
      ctx.lineTo(cx + R * 1.25, wallY + R * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 并列双龙巨炮 (00:23 - 00:24)
      [-R * 0.48, R * 0.48].forEach((ox, idx) => {
        const recoil = p > 0.32 ? Math.sin(Math.min(1, (p - 0.32) * 4) * Math.PI) * R * 0.08 : 0;
        const px = cx + ox;
        const py = wallY - R * 0.28 + recoil;
        ctx.save();
        ctx.translate(px, py);

        // 龙首护盾与双角
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        (ctx.roundRect ? ctx.roundRect(-R * 0.28, -R * 0.22, R * 0.56, R * 0.42, 10) : ctx.rect(-R * 0.28, -R * 0.22, R * 0.56, R * 0.42, 10));
        ctx.fill();
        ctx.stroke();

        // 巨炮炮管口 (正对镜头微微上扬)
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, -R * 0.14, R * 0.19, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 炮口烈焰齐射闪光 (00:24)
        if (p > 0.30) {
          const flashP = Math.sin(Math.min(1, (p - 0.30 + idx * 0.06) * 2.2) * Math.PI);
          if (flashP > 0.05) {
            const fg = ctx.createRadialGradient(0, -R * 0.18, 2, 0, -R * 0.18, R * 0.48 * flashP);
            fg.addColorStop(0, '#ffffff');
            fg.addColorStop(0.35, '#fef08a');
            fg.addColorStop(0.7, '#f97316');
            fg.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = fg;
            ctx.beginPath();
            ctx.arc(0, -R * 0.18, R * 0.48 * flashP, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      });
      ctx.restore();
    }

    // 5. 马后炮 (00:27 - 00:32): 后方巨炮镇守 + 前方金甲战马扬蹄 + 烈焰炮弹越马轰击
    else if (vfxType === 'horse_cannon') {
      ctx.save();
      // 后方中路巨炮炮台 (00:30)
      ctx.save();
      ctx.translate(cx, cy - R * 0.22);
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      (ctx.roundRect ? ctx.roundRect(-R * 0.34, -R * 0.22, R * 0.68, R * 0.42, 8) : ctx.rect(-R * 0.34, -R * 0.22, R * 0.68, R * 0.42, 8));
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, -R * 0.05, R * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 右侧前景跃起的金焰战马剪影 (00:30)
      ctx.save();
      ctx.translate(cx + R * 0.62, cy + R * 0.18);
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#fef08a';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 22;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(R * 0.22, R * 0.48);
      ctx.quadraticCurveTo(-R * 0.08, R * 0.12, -R * 0.18, -R * 0.15);
      ctx.lineTo(-R * 0.36, -R * 0.05);
      ctx.lineTo(-R * 0.24, -R * 0.32);
      ctx.lineTo(-R * 0.05, -R * 0.48);
      ctx.quadraticCurveTo(R * 0.18, -R * 0.32, R * 0.28, R * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 呼啸而出的烈焰火球 (00:31)
      if (p > 0.35) {
        const bp = Math.min(1, (p - 0.35) / 0.55);
        const bx = THREE.MathUtils.lerp(cx, cx - R * 0.25, bp);
        const by = THREE.MathUtils.lerp(cy - R * 0.25, cy - R * 0.55, Math.sin(bp * Math.PI));
        const br = R * (0.14 + bp * 0.28);
        const fg = ctx.createRadialGradient(bx, by, 2, bx, by, br * 1.8);
        fg.addColorStop(0, '#ffffff');
        fg.addColorStop(0.35, '#fef08a');
        fg.addColorStop(0.7, '#ea580c');
        fg.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(bx, by, br * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. 铁门栓 (00:33 - 00:40): 三扇玄铁巨门合拢 + 四方粗铁链死锁 + 铁门轰然炸裂碎片
    else if (vfxType === 'iron_bolt') {
      const shatterP = p > 0.62 ? (p - 0.62) / 0.38 : 0;
      // 四角粗大玄铁锁链 (00:36 - 00:37)
      const chainAlpha = shatterP > 0 ? Math.max(0, 1 - shatterP * 1.8) : Math.min(1, p * 3.5);
      const corners = [[0, h * 0.08], [w, h * 0.08], [0, h * 0.88], [w, h * 0.88]];
      corners.forEach(([sx, sy]) => {
        this.drawJJChain2D(ctx, sx, sy, cx, cy, 12, '#f59e0b', chainAlpha);
      });

      if (shatterP <= 0) {
        // 三扇玄铁黑门夹紧并发出熔岩金光 (00:36 - 00:37)
        const closeEase = 1 - Math.pow(1 - Math.min(1, p / 0.26), 3);
        [-1, 0, 1].forEach(idx => {
          const ox = idx * R * THREE.MathUtils.lerp(0.85, 0.36, closeEase);
          ctx.save();
          ctx.translate(cx + ox, cy + idx * 8);
          ctx.rotate(idx * 0.08);
          ctx.fillStyle = '#090d16';
          ctx.strokeStyle = '#f97316';
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 24;
          ctx.lineWidth = 4;
          ctx.beginPath();
          (ctx.roundRect ? ctx.roundRect(-R * 0.22, -R * 0.48, R * 0.44, R * 0.96, 6) : ctx.rect(-R * 0.22, -R * 0.48, R * 0.44, R * 0.96, 6));
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      } else {
        // 铁门轰然炸裂为飞散玄铁碎片 (00:38)
        const fg = ctx.createRadialGradient(cx, cy, 8, cx, cy, R * 1.35);
        fg.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        fg.addColorStop(0.35, 'rgba(254, 240, 138, 0.85)');
        fg.addColorStop(0.7, 'rgba(249, 115, 22, 0.45)');
        fg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2 + i * 0.2;
          const dist = R * (0.2 + shatterP * 1.35);
          ctx.save();
          ctx.translate(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist);
          ctx.rotate(ang + shatterP * 6);
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          const sz = R * 0.14 * (1 - shatterP * 0.4);
          ctx.fillRect(-sz, -sz * 0.6, sz * 2, sz * 1.2);
          ctx.strokeRect(-sz, -sz * 0.6, sz * 2, sz * 1.2);
          ctx.restore();
        }
      }
    }

    // 7. 侧面虎 (00:41 - 00:46): 俥傌双棋盘旋 + 左上方咆哮金焰猛虎扑击与五道虎爪裂芒
    else if (vfxType === 'side_tiger') {
      // 金焰猛虎扑击剪影 (00:44)
      const leapP = Math.min(1, p / 0.45);
      const tx = cx - R * THREE.MathUtils.lerp(0.85, 0.35, leapP);
      const ty = cy - R * THREE.MathUtils.lerp(0.75, 0.38, leapP);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(0.24);
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 26;
      const tGrad = ctx.createLinearGradient(-R * 0.4, -R * 0.3, R * 0.4, R * 0.3);
      tGrad.addColorStop(0, '#fef08a');
      tGrad.addColorStop(0.5, '#f59e0b');
      tGrad.addColorStop(1, '#b45309');
      ctx.fillStyle = tGrad;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      // 猛虎躯干与咆哮虎首轮廓
      ctx.beginPath();
      ctx.moveTo(-R * 0.42, 0);
      ctx.quadraticCurveTo(-R * 0.15, -R * 0.28, R * 0.22, -R * 0.22);
      ctx.lineTo(R * 0.38, -R * 0.08);
      ctx.lineTo(R * 0.28, R * 0.14);
      ctx.lineTo(R * 0.44, R * 0.32); // 前扑虎爪
      ctx.lineTo(R * 0.12, R * 0.20);
      ctx.quadraticCurveTo(-R * 0.15, R * 0.22, -R * 0.38, R * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 俥与傌双棋流光环绕 (00:44)
      this.drawJJMedallion2D(ctx, cx - R * 0.62, cy - R * 0.05, R * 0.24, isRedWinner ? '傌' : '馬', isRedWinner, 1.0, 0.68, -0.25, '#f97316', 0.95);
      this.drawJJMedallion2D(ctx, cx + R * 0.38, cy + R * 0.18, R * 0.34, isRedWinner ? '俥' : '車', isRedWinner, 1.0, 0.72, 0.12, '#fef08a', 0.98);

      // 虎爪撕裂金芒 (00:45)
      if (p > 0.32) {
        const sp = Math.min(1, (p - 0.32) / 0.45);
        ctx.save();
        ctx.strokeStyle = '#fef08a';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 18;
        ctx.lineWidth = 5;
        for (let cIdx = -2; cIdx <= 2; cIdx++) {
          ctx.beginPath();
          ctx.moveTo(cx - R * 0.75 + cIdx * 18, cy - R * 0.45 - cIdx * 12);
          ctx.quadraticCurveTo(cx + cIdx * 20, cy + cIdx * 10, cx - R * 0.75 + R * 1.55 * sp + cIdx * 18, cy - R * 0.45 + R * 0.95 * sp - cIdx * 12);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 8. 八角马 (00:47 - 00:51): 幽夜皎洁满月 + 立马横枪将军剪影化为金焰神骑冲锋
    else if (vfxType === 'octagon_horse') {
      const moonX = cx;
      const moonY = cy - R * 0.28;
      const moonR = R * 0.46;

      // 皎洁满月与月华光晕 (00:49 - 00:50)
      const mGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 1.9);
      mGlow.addColorStop(0, 'rgba(255, 255, 240, 0.95)');
      mGlow.addColorStop(0.5, 'rgba(254, 240, 138, 0.42)');
      mGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mGlow;
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR * 1.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fefce8';
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      ctx.fill();

      // 月下立马横枪将军 (p < 0.48 为月前墨色剪影，p >= 0.48 化为金焰神将冲出明月)
      const isCharging = p >= 0.46;
      const chargeP = isCharging ? (p - 0.46) / 0.54 : 0;
      const rx = THREE.MathUtils.lerp(moonX, cx - R * 0.65, chargeP);
      const ry = THREE.MathUtils.lerp(moonY + R * 0.04, cy - R * 0.05, chargeP);
      const rScale = 1 + chargeP * 0.45;

      ctx.save();
      ctx.translate(rx, ry);
      ctx.scale(rScale, rScale);
      ctx.fillStyle = isCharging ? '#fbbf24' : '#1e1b2e';
      ctx.strokeStyle = isCharging ? '#fef08a' : '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = isCharging ? 28 : 8;
      ctx.lineWidth = 2.8;

      // 扬蹄战马与武将剪影
      ctx.beginPath();
      ctx.moveTo(-R * 0.18, R * 0.26);
      ctx.lineTo(-R * 0.08, -R * 0.05);
      ctx.lineTo(-R * 0.16, -R * 0.24);
      ctx.lineTo(0, -R * 0.34);
      ctx.lineTo(R * 0.14, -R * 0.18);
      ctx.lineTo(R * 0.22, R * 0.18);
      ctx.closePath();
      ctx.fill();
      if (isCharging) ctx.stroke();

      // 武将长枪
      ctx.strokeStyle = isCharging ? '#ffffff' : '#1e1b2e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-R * 0.35, -R * 0.28);
      ctx.lineTo(R * 0.42, R * 0.08);
      ctx.stroke();
      ctx.restore();
    }

    // 9. 钓鱼马 (00:52 - 01:01): 全屏碧海漩涡 + 傌字居中 + 垂钓者金钩钓起碧海巨鲲
    else if (vfxType === 'fishing_horse') {
      // 全屏深海漩涡波纹 (00:54 - 00:58)
      for (let i = 6; i >= 1; i--) {
        const wr = R * (0.24 + i * 0.22);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-p * (5.2 - i * 0.45));
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.62)' : 'rgba(186, 230, 253, 0.48)';
        ctx.lineWidth = 4 + i * 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, wr, 0, Math.PI * 1.35);
        ctx.stroke();
        ctx.restore();
      }

      // 漩涡中心「傌」棋子 (00:54)
      if (p < 0.42) {
        this.drawJJMedallion2D(ctx, cx, cy, R * 0.36, isRedWinner ? '傌' : '馬', isRedWinner, 1, 1, p * 2.5, '#38bdf8', 1 - p * 1.8);
      }

      // 漩涡中心垂钓者剪影与弯弓鱼竿 (00:57)
      if (p > 0.28) {
        const fp = Math.min(1, (p - 0.28) / 0.35);
        ctx.save();
        ctx.globalAlpha = fp;
        ctx.translate(cx - R * 0.12, cy - R * 0.08);
        ctx.fillStyle = '#082f49';
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2.5;
        // 斗笠垂钓者
        ctx.beginPath();
        ctx.moveTo(-R * 0.16, -R * 0.12);
        ctx.lineTo(0, -R * 0.24);
        ctx.lineTo(R * 0.16, -R * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 弧形钓竿与发光钓线
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.05);
        ctx.quadraticCurveTo(R * 0.45, -R * 0.42, R * 0.68, -R * 0.12);
        ctx.stroke();
        ctx.restore();
      }

      // 破浪而出的碧海巨鲲/蛟龙灵影 (00:58)
      if (p > 0.52) {
        const dp = (p - 0.52) / 0.48;
        ctx.save();
        ctx.translate(cx + R * 0.38, cy + R * (0.45 - dp * 0.65));
        ctx.fillStyle = 'rgba(125, 211, 252, 0.82)';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 28;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.35 * dp, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 10. 列马车 (01:02 - 01:09): 苍穹赤日红月 + 浮空断崖石台 + 赤焰烈马傲立跃空
    else if (vfxType === 'standing_horse_chariot') {
      const sunY = cy - R * 0.48;
      const sunR = R * 0.44;
      // 苍穹赤日红月 (01:06 - 01:08)
      const sunGrad = ctx.createRadialGradient(cx, sunY, sunR * 0.1, cx, sunY, sunR * 1.45);
      sunGrad.addColorStop(0, '#fef08a');
      sunGrad.addColorStop(0.45, '#ef4444');
      sunGrad.addColorStop(0.75, '#991b1b');
      sunGrad.addColorStop(1, 'rgba(153, 27, 27, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(cx, sunY, sunR * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // 浮空断崖与阶梯石台 (01:06 - 01:07)
      const cliffY = cy + R * 0.12;
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.45, cliffY);
      ctx.lineTo(cx + R * 0.32, cliffY);
      ctx.lineTo(cx + R * 0.18, cliffY + R * 0.58);
      ctx.lineTo(cx - R * 0.32, cliffY + R * 0.48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 断崖之巅的赤焰烈马 (01:06 傲立 -> 01:08 腾空跃起)
      const jumpP = p > 0.55 ? (p - 0.55) / 0.45 : 0;
      const hx = cx - R * 0.06 - jumpP * R * 0.25;
      const hy = cliffY - R * 0.26 - Math.sin(jumpP * Math.PI * 0.8) * R * 0.55;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(-jumpP * 0.45);
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#fef08a';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 22;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-R * 0.24, R * 0.22);
      ctx.lineTo(-R * 0.14, -R * 0.12);
      ctx.lineTo(-R * 0.26, -R * 0.28);
      ctx.lineTo(-R * 0.06, -R * 0.36);
      ctx.lineTo(R * 0.22, -R * 0.08);
      ctx.lineTo(R * 0.26, R * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 11. 双将 (01:10 - 01:16): 双道金弧交击 + 右下方破空巨型黄金圣剑/金锏轰碎乱石
    else if (vfxType === 'double_check') {
      const thrust = Math.min(1, p / 0.35);
      ctx.save();
      ctx.translate(cx + R * (0.45 - thrust * 0.35), cy + R * (0.45 - thrust * 0.35));
      ctx.rotate(-Math.PI * 0.72);

      // 巨型黄金圣剑/金锏剑身 (01:13 - 01:14)
      const bladeG = ctx.createLinearGradient(-R * 0.28, 0, R * 0.28, 0);
      bladeG.addColorStop(0, '#b45309');
      bladeG.addColorStop(0.5, '#fef08a');
      bladeG.addColorStop(1, '#d97706');
      ctx.fillStyle = bladeG;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 28;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-R * 0.24, -R * 0.95);
      ctx.lineTo(0, -R * 1.38);
      ctx.lineTo(R * 0.24, -R * 0.95);
      ctx.lineTo(R * 0.20, R * 0.55);
      ctx.lineTo(-R * 0.20, R * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 剑柄护手
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      (ctx.roundRect ? ctx.roundRect(-R * 0.46, R * 0.48, R * 0.92, R * 0.18, 8) : ctx.rect(-R * 0.46, R * 0.48, R * 0.92, R * 0.18, 8));
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 崩飞的白玉碎石 (01:13)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + p * 2;
        const d = R * (0.32 + p * 0.75);
        ctx.save();
        ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
        ctx.rotate(a);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-10, -7, 20, 14);
        ctx.restore();
      }
    }

    // 12. 夹车炮 (01:17 - 01:24): 大漠狂沙 + 双红战旗重甲巨炮战车正面冲锋
    else if (vfxType === 'chariot_cannon_clamp') {
      const scaleC = THREE.MathUtils.lerp(0.65, 1.08, Math.min(1, p / 0.48));
      ctx.save();
      ctx.translate(cx, cy - R * 0.08);
      ctx.scale(scaleC, scaleC);

      // 双面迎风招展的赤红战旗 (01:21 - 01:22)
      [-R * 0.32, R * 0.18].forEach((fx, idx) => {
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(fx, -R * 0.22);
        ctx.lineTo(fx, -R * 0.88);
        ctx.stroke();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(fx, -R * 0.86);
        ctx.quadraticCurveTo(fx + R * 0.22, -R * 0.82 + Math.sin(p * 18 + idx) * 12, fx + R * 0.34, -R * 0.68);
        ctx.lineTo(fx, -R * 0.52);
        ctx.closePath();
        ctx.fill();
      });

      // 重甲战车木铁城垛车体 (01:22)
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      (ctx.roundRect ? ctx.roundRect(-R * 0.68, -R * 0.35, R * 1.36, R * 0.72, 10) : ctx.rect(-R * 0.68, -R * 0.35, R * 1.36, R * 0.72, 10));
      ctx.fill();
      ctx.stroke();

      // 左右战车铁刺巨轮
      [-R * 0.74, R * 0.74].forEach(wx => {
        ctx.fillStyle = '#334155';
        ctx.fillRect(wx - R * 0.08, -R * 0.25, R * 0.16, R * 0.65);
        ctx.strokeRect(wx - R * 0.08, -R * 0.25, R * 0.16, R * 0.65);
      });

      // 中央巨炮黑洞炮口
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, -R * 0.02, R * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 13. 卧槽马 (01:25 - 01:31): 璀璨黄金马厩牌坊图腾 + 金焰神驹破门直冲镜头
    else if (vfxType === 'trough_horse') {
      const gateY = cy - R * 0.14;
      ctx.save();
      ctx.translate(cx, gateY);
      ctx.strokeStyle = '#fef08a';
      ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 32;
      ctx.lineWidth = 6;

      // 黄金牌坊立柱与飞檐 (01:28 - 01:29)
      ctx.strokeRect(-R * 0.62, -R * 0.52, R * 1.24, R * 0.96);
      ctx.beginPath();
      ctx.moveTo(-R * 0.82, -R * 0.52);
      ctx.quadraticCurveTo(0, -R * 0.76, R * 0.82, -R * 0.52);
      ctx.stroke();

      // 牌坊中心骏马金印图腾 + 破门冲出的神驹 (01:29 -> 01:30)
      const rushScale = p < 0.45 ? 1.0 : 1.0 + (p - 0.45) * 1.65;
      ctx.scale(rushScale, rushScale);
      const coreG = ctx.createRadialGradient(0, 0, 5, 0, 0, R * 0.42);
      coreG.addColorStop(0, '#ffffff');
      coreG.addColorStop(0.5, '#fef08a');
      coreG.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = coreG;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 神驹昂首剪影
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(-R * 0.15, R * 0.22);
      ctx.lineTo(-R * 0.06, -R * 0.24);
      ctx.lineTo(R * 0.16, -R * 0.12);
      ctx.lineTo(R * 0.08, R * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 14. 闷杀 (01:32 - 01:37): 巨型将棋翻滚 + 暗黑玄铁巨柱烈焰 + 黑铁锁链横扫
    else if (vfxType === 'smothered_kill') {
      // 翻滚的特写敌将棋子 (01:34)
      if (p < 0.58) {
        const kp = p / 0.58;
        this.drawJJMedallion2D(
          ctx,
          cx - R * (0.95 - kp * 0.35),
          cy + R * 0.12,
          R * 0.52,
          enemyKingChar,
          !isRedWinner,
          0.92,
          1.0,
          -0.65 + kp * 0.4,
          '#fbbf24',
          1 - kp * 0.5
        );
      }
      // 交叉黑铁锁链 (01:35)
      this.drawJJChain2D(ctx, w * 0.04, h * 0.78, w * 0.36, h * 0.18, 14, '#eab308', 0.95);
      this.drawJJChain2D(ctx, w * 0.22, h * 0.56, w * 0.96, h * 0.24, 16, '#eab308', 0.95);
    }

    // 15. 天地炮 (01:38 - 01:43): 赤云群峰苍穹 + 九天雷火冲击波从天而降轰击敌将
    else if (vfxType === 'heaven_earth_cannon') {
      // 远景群山剪影 (01:41)
      ctx.save();
      ctx.fillStyle = 'rgba(69, 10, 10, 0.72)';
      ctx.beginPath();
      ctx.moveTo(0, cy + R * 0.65);
      ctx.lineTo(w * 0.22, cy - R * 0.18);
      ctx.lineTo(w * 0.45, cy + R * 0.25);
      ctx.lineTo(w * 0.76, cy - R * 0.28);
      ctx.lineTo(w, cy + R * 0.35);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // 天降乾坤火柱冲击波与底部受击敌将 (01:41)
      const beamG = ctx.createRadialGradient(cx, cy - R * 0.45, 10, cx, cy + R * 0.35, R * 1.25);
      beamG.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
      beamG.addColorStop(0.35, 'rgba(254, 240, 138, 0.68)');
      beamG.addColorStop(0.7, 'rgba(239, 68, 68, 0.38)');
      beamG.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = beamG;
      ctx.fillRect(cx - R * 1.2, cy - R * 1.1, R * 2.4, R * 1.8);

      this.drawJJMedallion2D(ctx, cx, cy + R * 0.58, R * 0.34, enemyKingChar, !isRedWinner, 1.0, 0.58, 0, '#ef4444', 0.95);
      ctx.restore();
    }

    // 16. 困毙 (01:44 - 01:53): 3D 透视八卦奇门石阵升起 + 敌将坠入阵眼封印
    else if (vfxType === 'stalemate_trap') {
      const arrayY = cy + R * 0.18;
      ctx.save();
      ctx.translate(cx, arrayY);
      ctx.scale(1.0, 0.56); // 3D 俯视透视石阵 (01:48 - 01:52)

      // 八卦熔金石阵底座
      const coreG = ctx.createRadialGradient(0, 0, 5, 0, 0, R * 1.28);
      coreG.addColorStop(0, '#ffffff');
      coreG.addColorStop(0.28, '#fef08a');
      coreG.addColorStop(0.55, '#d97706');
      coreG.addColorStop(1, 'rgba(69, 26, 3, 0)');
      ctx.fillStyle = coreG;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.28, 0, Math.PI * 2);
      ctx.fill();

      // 八方升起的奇门石墙
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + p * 0.35;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = '#451a03';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.fillRect(-R * 0.24, R * 0.52, R * 0.48, R * 0.22);
        ctx.strokeRect(-R * 0.24, R * 0.52, R * 0.48, R * 0.22);
        ctx.fillRect(-R * 0.32, R * 0.84, R * 0.64, R * 0.24);
        ctx.strokeRect(-R * 0.32, R * 0.84, R * 0.64, R * 0.24);
        ctx.restore();
      }
      ctx.restore();

      // 坠入八卦阵眼的「將」棋子 (01:50)
      if (p < 0.72) {
        const dp = p / 0.72;
        this.drawJJMedallion2D(
          ctx,
          cx,
          THREE.MathUtils.lerp(cy - R * 0.85, arrayY, dp * dp),
          R * THREE.MathUtils.lerp(0.32, 0.16, dp),
          enemyKingChar,
          !isRedWinner,
          1.0,
          0.75,
          dp * 4,
          '#fef08a',
          1 - dp * 0.6
        );
      }
    }

    // 17. 海底捞月 (01:54 - 02:01): 金轮沉海水中映月 (01:58) + 碧海莲华巨浪绽放 (01:59-02:00)
    else {
      if (p < 0.48) {
        // 水中映月波纹倒影 (01:58)
        const wp = p / 0.48;
        ctx.save();
        ctx.translate(cx, cy - R * 0.08);
        for (let wIdx = 0; wIdx < 6; wIdx++) {
          const wy = (wIdx - 2.5) * R * 0.16 + Math.sin(wp * 14 + wIdx) * 8;
          ctx.fillStyle = 'rgba(254, 240, 138, 0.22)';
          ctx.beginPath();
          ctx.ellipse(Math.sin(wp * 10 + wIdx) * 16, wy, R * (0.68 - Math.abs(wIdx - 2.5) * 0.1), R * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        this.drawJJMedallion2D(ctx, cx, cy - R * 0.08, R * 0.48, checkerChar, isRedWinner, 1.0, 0.88, wp * 0.4, '#fef08a', 0.92);
      } else {
        // 碧海冰莲巨浪绽放 + 棋子居中 (01:59 - 02:00)
        const lp = (p - 0.48) / 0.52;
        ctx.save();
        ctx.translate(cx, cy - R * 0.05);
        const petalCount = 12;
        for (let i = 0; i < petalCount; i++) {
          const a = (i / petalCount) * Math.PI * 2 + lp * 0.35;
          const pLen = R * (0.55 + lp * 0.68) * (i % 2 === 0 ? 1.12 : 0.88);
          ctx.save();
          ctx.rotate(a);
          const pg = ctx.createLinearGradient(0, 0, 0, -pLen);
          pg.addColorStop(0, 'rgba(224, 242, 254, 0.92)');
          pg.addColorStop(0.55, 'rgba(56, 189, 248, 0.78)');
          pg.addColorStop(1, 'rgba(2, 132, 199, 0.05)');
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(R * 0.24, -pLen * 0.55, 0, -pLen);
          ctx.quadraticCurveTo(-R * 0.24, -pLen * 0.55, 0, 0);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        this.drawJJMedallion2D(ctx, cx, cy - R * 0.02, R * (0.42 * (1 - lp * 0.35)), checkerChar, isRedWinner, 1.0, 0.72, 0, '#38bdf8', 1 - lp * 0.4);
      }
    }

    ctx.restore();
  },

  build3DSpectacleForType(vfxType, kPos, cPos, rPos, winnerColor) {
    const group = new THREE.Group();
    this.checkmateVFXGroup.add(group);
    const slashTex = typeof getSlashArcTexture === 'function' ? getSlashArcTexture() : null;

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.65,
      metalness: 0.88,
      roughness: 0.22
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      emissiveIntensity: 0.28,
      metalness: 0.82,
      roughness: 0.28
    });
    const crimsonLacquerMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0x450a0a,
      emissiveIntensity: 0.35,
      metalness: 0.35,
      roughness: 0.32
    });
    const crimsonGlowMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const goldGlowMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    if (vfxType === 'double_chariot') {
      const halberds = [-1, 1].map((dir, idx) => {
        const hGroup = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.6, 12), goldMat);
        shaft.rotation.z = Math.PI / 2;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.95, 4), goldMat);
        tip.rotation.z = -dir * Math.PI / 2;
        tip.position.x = dir * 3.1;
        const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 8, 24, Math.PI), crimsonGlowMat.clone());
        crescent.position.set(dir * 2.2, 0, 0.25);
        hGroup.add(shaft, tip, crescent);
        hGroup.position.set(kPos.x - dir * 3.2, 0.72 + idx * 0.22, kPos.z + (idx === 0 ? -0.45 : 0.45));
        hGroup.rotation.y = dir * 0.36;
        group.add(hGroup);
        return { hGroup, dir, idx };
      });
      const slashPlanes = [-1, 1].map((dir, idx) => {
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(5.6, 1.15),
          new THREE.MeshBasicMaterial({
            map: slashTex,
            color: idx === 0 ? 0xfef08a : 0xef4444,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        plane.rotation.x = -Math.PI / 2;
        plane.rotation.z = dir * 0.55;
        plane.position.set(kPos.x, 0.48 + idx * 0.1, kPos.z);
        group.add(plane);
        return plane;
      });
      return (p, dt, fade = 1) => {
        const rush = Math.min(1, p / 0.38);
        const ease = 1 - Math.pow(1 - rush, 3);
        halberds.forEach(({ hGroup, dir }) => {
          hGroup.position.x = THREE.MathUtils.lerp(kPos.x - dir * 3.4, kPos.x + dir * 0.35, ease);
          hGroup.scale.setScalar(fade);
        });
        slashPlanes.forEach((pl, i) => {
          pl.material.opacity = Math.sin(Math.min(1, p * 1.25) * Math.PI) * 0.88 * fade;
          pl.scale.set(0.5 + ease * 1.25, 0.7 + ease * 0.5, 1);
          pl.rotation.z += (i === 0 ? 1 : -1) * dt * 1.8;
        });
      };
    }

    if (vfxType === 'smothered_palace') {
      const walls = [];
      const offsets = [
        { x: -1.38, z: 0, ry: Math.PI / 2 },
        { x: 1.38, z: 0, ry: Math.PI / 2 },
        { x: 0, z: -1.38, ry: 0 },
        { x: 0, z: 1.38, ry: 0 }
      ];
      offsets.forEach(o => {
        const wGroup = new THREE.Group();
        const wall = new THREE.Mesh(new THREE.BoxGeometry(2.55, 1.45, 0.22), darkIronMat);
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.22, 0.32), goldMat);
        topBeam.position.y = 0.78;
        wGroup.add(wall, topBeam);
        wGroup.position.set(kPos.x + o.x, -1.1, kPos.z + o.z);
        wGroup.rotation.y = o.ry;
        group.add(wGroup);
        walls.push(wGroup);
      });
      const sealRoof = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.55, 0.42, 4),
        goldMat
      );
      sealRoof.rotation.y = Math.PI / 4;
      sealRoof.position.set(kPos.x, 6.2, kPos.z);
      group.add(sealRoof);

      return (p, dt, fade = 1) => {
        const rise = Math.min(1, p / 0.36);
        const ease = 1 - Math.pow(1 - rise, 3);
        walls.forEach(w => {
          w.position.y = THREE.MathUtils.lerp(-1.1, 0.72, ease);
          w.scale.y = fade;
        });
        const drop = Math.min(1, Math.max(0, (p - 0.24) / 0.34));
        sealRoof.position.y = THREE.MathUtils.lerp(6.2, 1.82, drop * drop);
        sealRoof.rotation.y = Math.PI / 4 + p * 1.5;
        sealRoof.scale.setScalar(fade);
      };
    }

    if (vfxType === 'royal_gaze') {
      const dist = Math.hypot(kPos.x - rPos.x, kPos.z - rPos.z) || 8;
      const midX = (kPos.x + rPos.x) * 0.5;
      const midZ = (kPos.z + rPos.z) * 0.5;

      const bridgeBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, dist, 16, 1, true),
        goldGlowMat.clone()
      );
      bridgeBeam.rotation.x = Math.PI / 2;
      bridgeBeam.position.set(midX, 0.58, midZ);
      group.add(bridgeBeam);

      const gates = [0.25, 0.5, 0.75].map((frac) => {
        const gRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.06, 10, 32), goldMat);
        gRing.position.set(
          THREE.MathUtils.lerp(rPos.x, kPos.x, frac),
          0.85,
          THREE.MathUtils.lerp(rPos.z, kPos.z, frac)
        );
        group.add(gRing);
        return gRing;
      });

      const swordGroup = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 3.4, 4), goldMat);
      blade.rotation.x = Math.PI;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.28), crimsonLacquerMat);
      guard.position.y = 1.65;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.85, 10), goldMat);
      hilt.position.y = 2.15;
      swordGroup.add(blade, guard, hilt);
      swordGroup.position.set(kPos.x, 7.2, kPos.z);
      group.add(swordGroup);

      return (p, dt, fade = 1) => {
        const beamP = Math.min(1, p / 0.30);
        bridgeBeam.scale.set(beamP * (0.85 + Math.sin(p * 28) * 0.2), 1, beamP);
        bridgeBeam.material.opacity = 0.88 * fade;
        gates.forEach((g, idx) => {
          const gp = Math.min(1, Math.max(0, (p - idx * 0.08) / 0.25));
          g.scale.setScalar(gp * fade);
          g.rotation.z += dt * (idx % 2 === 0 ? 2.5 : -2.5);
        });
        const swordDrop = Math.min(1, Math.max(0, (p - 0.28) / 0.32));
        swordGroup.position.y = THREE.MathUtils.lerp(7.2, 2.15, swordDrop * swordDrop);
        swordGroup.rotation.y += dt * 3.2;
        swordGroup.scale.setScalar(fade);
      };
    }

    if (vfxType === 'double_cannon') {
      const startZ = kPos.z + (kPos.z < 0 ? 3.8 : -3.8);
      const dirSign = kPos.z < 0 ? -1 : 1;
      const batteries = [-0.92, 0.92].map((ox, idx) => {
        const bGroup = new THREE.Group();
        bGroup.position.set(kPos.x + ox, 0.42, startZ);
        const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.32, 1.15), crimsonLacquerMat);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.65, 16), goldMat);
        barrel.rotation.x = dirSign * (Math.PI / 3);
        barrel.position.y = 0.26;
        const wheelL = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 16), darkIronMat);
        wheelL.rotation.z = Math.PI / 2;
        wheelL.position.set(-0.38, 0, 0);
        const wheelR = wheelL.clone();
        wheelR.position.x = 0.38;
        bGroup.add(carriage, barrel, wheelL, wheelR);
        group.add(bGroup);

        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), crimsonGlowMat.clone());
        group.add(shell);
        return { bGroup, shell, ox, delay: idx * 0.16 };
      });

      return (p, dt, fade = 1) => {
        batteries.forEach(({ bGroup, shell, ox, delay }) => {
          bGroup.scale.setScalar(fade);
          const sp = Math.max(0, Math.min(1, (p - delay) / 0.46));
          shell.position.set(
            THREE.MathUtils.lerp(kPos.x + ox, kPos.x + ox * 0.2, sp),
            0.55 + Math.sin(sp * Math.PI) * 2.8,
            THREE.MathUtils.lerp(startZ, kPos.z, sp)
          );
          const active = sp > 0.02 && sp < 0.98;
          shell.scale.setScalar(active ? 1.15 * fade : 0.001);
          bGroup.position.z = startZ - dirSign * (sp > 0 && sp < 0.25 ? Math.sin(sp * 4 * Math.PI) * 0.26 : 0);
        });
      };
    }

    if (vfxType === 'horse_cannon') {
      const horseHalo = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.06, 10, 36), goldMat);
      horseHalo.rotation.x = Math.PI / 2;
      horseHalo.position.set(cPos.x, 0.32, cPos.z);
      group.add(horseHalo);

      const lockChainCurve = new THREE.LineCurve3(
        new THREE.Vector3(cPos.x, 0.35, cPos.z),
        new THREE.Vector3(kPos.x, 0.35, kPos.z)
      );
      const lockBeam = new THREE.Mesh(
        new THREE.TubeGeometry(lockChainCurve, 16, 0.055, 8, false),
        goldGlowMat.clone()
      );
      group.add(lockBeam);

      const startZ = kPos.z + (kPos.z < 0 ? 4.2 : -4.2);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), crimsonGlowMat.clone());
      group.add(shell);

      return (p, dt, fade = 1) => {
        horseHalo.rotation.z += dt * 3.5;
        horseHalo.scale.setScalar((0.9 + Math.sin(p * 16) * 0.12) * fade);
        lockBeam.material.opacity = Math.min(1, p * 3) * 0.85 * fade;
        const sp = Math.min(1, Math.max(0, (p - 0.12) / 0.48));
        shell.position.set(
          THREE.MathUtils.lerp(cPos.x, kPos.x, sp),
          0.48 + Math.sin(sp * Math.PI) * 3.1,
          THREE.MathUtils.lerp(startZ, kPos.z, sp)
        );
        shell.scale.setScalar((sp > 0 && sp < 0.98) ? 1.2 * fade : 0.001);
      };
    }

    if (vfxType === 'iron_bolt') {
      const gateZ = kPos.z + (kPos.z < 0 ? 1.25 : -1.25);
      const leftDoor = new THREE.Group();
      const rightDoor = new THREE.Group();
      [-1, 1].forEach((dir) => {
        const dGroup = dir === -1 ? leftDoor : rightDoor;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.32, 2.35, 0.18), crimsonLacquerMat);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.38, 2.42, 0.14), goldMat);
        dGroup.add(frame, panel);
        for (let r = -1; r <= 1; r++) {
          for (let c = -1; c <= 1; c += 2) {
            const stud = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), goldMat);
            stud.position.set(c * 0.34, r * 0.62, 0.11);
            dGroup.add(stud);
          }
        }
        dGroup.position.set(kPos.x + dir * 2.2, 1.22, gateZ);
        group.add(dGroup);
      });

      const ironBolt = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.30, 0.28), darkIronMat);
      const boltTrim = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.12, 0.32), goldMat);
      ironBolt.add(boltTrim);
      ironBolt.position.set(kPos.x, 4.8, gateZ + (kPos.z < 0 ? 0.18 : -0.18));
      group.add(ironBolt);

      return (p, dt, fade = 1) => {
        const closeP = Math.min(1, p / 0.30);
        const easeC = 1 - Math.pow(1 - closeP, 3);
        leftDoor.position.x = THREE.MathUtils.lerp(kPos.x - 2.3, kPos.x - 0.68, easeC);
        rightDoor.position.x = THREE.MathUtils.lerp(kPos.x + 2.3, kPos.x + 0.68, easeC);
        const boltP = Math.min(1, Math.max(0, (p - 0.24) / 0.24));
        ironBolt.position.y = THREE.MathUtils.lerp(4.8, 1.25, boltP * boltP);
        leftDoor.scale.setScalar(fade);
        rightDoor.scale.setScalar(fade);
        ironBolt.scale.setScalar(fade);
      };
    }

    if (vfxType === 'side_tiger') {
      const claws = [];
      for (let i = -2; i <= 2; i++) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(1.65, 0.065, 8, 32, Math.PI * 0.78),
          i % 2 === 0 ? goldGlowMat.clone() : crimsonGlowMat.clone()
        );
        arc.position.set(kPos.x + i * 0.32, 0.95, kPos.z);
        arc.rotation.y = 0.65;
        arc.rotation.x = 0.45;
        group.add(arc);
        claws.push({ arc, i });
      }
      return (p, dt, fade = 1) => {
        const swipe = Math.min(1, p / 0.40);
        claws.forEach(({ arc, i }) => {
          arc.rotation.z = -1.2 + swipe * 2.4 + i * 0.08;
          arc.scale.setScalar((0.65 + swipe * 0.65) * fade);
          arc.material.opacity = Math.sin(Math.min(1, p * 1.2) * Math.PI) * 0.92 * fade;
        });
      };
    }

    if (vfxType === 'octagon_horse') {
      const pillars = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const pGroup = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.6, 8), goldMat);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 6), goldGlowMat.clone());
        tip.position.y = 1.48;
        pGroup.add(shaft, tip);
        pGroup.position.set(kPos.x + Math.cos(a) * 2.15, 1.3, kPos.z + Math.sin(a) * 2.15);
        group.add(pGroup);
        pillars.push({ pGroup, a });
      }
      const moonHalo = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.055, 10, 48), goldGlowMat.clone());
      moonHalo.rotation.x = Math.PI / 2;
      moonHalo.position.set(kPos.x, 2.45, kPos.z);
      group.add(moonHalo);

      return (p, dt, fade = 1) => {
        const lock = Math.min(1, p / 0.38);
        const rad = THREE.MathUtils.lerp(2.45, 1.62, lock);
        pillars.forEach(({ pGroup, a }) => {
          const curA = a + p * 1.2;
          pGroup.position.x = kPos.x + Math.cos(curA) * rad;
          pGroup.position.z = kPos.z + Math.sin(curA) * rad;
          pGroup.scale.setScalar(fade);
        });
        moonHalo.scale.setScalar((rad / 2.15) * fade);
        moonHalo.material.opacity = 0.88 * fade;
      };
    }

    if (vfxType === 'fishing_horse') {
      const waterRings = [];
      for (let i = 0; i < 4; i++) {
        const wr = new THREE.Mesh(
          new THREE.TorusGeometry(0.65 + i * 0.45, 0.045, 10, 40),
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0x38bdf8 : 0x7dd3fc,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        wr.rotation.x = Math.PI / 2;
        wr.position.set(kPos.x, 0.12 + i * 0.14, kPos.z);
        group.add(wr);
        waterRings.push({ wr, i });
      }
      const rodGroup = new THREE.Group();
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.085, 12, 28, Math.PI * 1.35), goldMat);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.6, 8), goldGlowMat.clone());
      line.position.y = 2.1;
      rodGroup.add(hook, line);
      rodGroup.position.set(kPos.x, 4.6, kPos.z);
      group.add(rodGroup);

      return (p, dt, fade = 1) => {
        waterRings.forEach(({ wr, i }) => {
          wr.rotation.z -= dt * (3.6 - i * 0.5);
          const sc = (0.88 + Math.sin(p * 10 + i) * 0.12) * fade;
          wr.scale.set(sc, sc, 1);
          wr.material.opacity = 0.84 * fade;
        });
        const drop = p < 0.42 ? (p / 0.42) : (1 - (p - 0.42) * 0.55);
        rodGroup.position.y = THREE.MathUtils.lerp(4.6, 0.88, Math.min(1, Math.max(0, drop)));
        rodGroup.scale.setScalar(fade);
      };
    }

    if (vfxType === 'standing_horse_chariot') {
      const sunHalo = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 12, 40), crimsonGlowMat.clone());
      sunHalo.position.set(kPos.x, 2.55, kPos.z + (kPos.z < 0 ? -1.4 : 1.4));
      group.add(sunHalo);

      const spears = [-0.62, 0.62].map((ox, i) => {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.22, 4.2, 8), i === 0 ? goldMat : crimsonLacquerMat);
        sp.rotation.x = kPos.z < 0 ? -Math.PI * 0.38 : Math.PI * 0.38;
        sp.position.set(kPos.x + ox, 1.45, kPos.z + (kPos.z < 0 ? 2.6 : -2.6));
        group.add(sp);
        return { sp, ox };
      });

      return (p, dt, fade = 1) => {
        const strike = Math.min(1, p / 0.36);
        const ease = 1 - Math.pow(1 - strike, 3);
        spears.forEach(({ sp }) => {
          sp.position.z = THREE.MathUtils.lerp(kPos.z + (kPos.z < 0 ? 2.8 : -2.8), kPos.z, ease);
          sp.position.y = THREE.MathUtils.lerp(2.4, 0.95, ease);
          sp.scale.setScalar(fade);
        });
        sunHalo.scale.setScalar((0.85 + Math.sin(p * Math.PI) * 0.35) * fade);
        sunHalo.material.opacity = 0.88 * fade;
      };
    }

    if (vfxType === 'double_check') {
      const hammers = [-1, 1].map((dir) => {
        const hGroup = new THREE.Group();
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.98, 12), goldMat);
        head.rotation.z = Math.PI / 2;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 2.4, 10), crimsonLacquerMat);
        shaft.position.y = -1.2;
        hGroup.add(head, shaft);
        hGroup.position.set(kPos.x + dir * 2.4, 3.6, kPos.z);
        group.add(hGroup);
        return { hGroup, dir };
      });
      return (p, dt, fade = 1) => {
        const strike = Math.min(1, p / 0.34);
        const ease = strike * strike;
        hammers.forEach(({ hGroup, dir }) => {
          hGroup.position.x = THREE.MathUtils.lerp(kPos.x + dir * 2.5, kPos.x + dir * 0.62, ease);
          hGroup.position.y = THREE.MathUtils.lerp(3.8, 1.15, ease);
          hGroup.rotation.z = dir * (1 - ease) * 0.95;
          hGroup.scale.setScalar(fade);
        });
      };
    }

    if (vfxType === 'chariot_cannon_clamp') {
      const jaws = [-1, 1].map((dir) => {
        const jGroup = new THREE.Group();
        const arc = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.18, 12, 28, Math.PI * 0.85), goldMat);
        arc.rotation.x = Math.PI / 2;
        arc.rotation.z = dir === 1 ? -Math.PI * 0.42 : Math.PI * 0.58;
        jGroup.add(arc);
        jGroup.position.set(kPos.x + dir * 2.6, 0.55, kPos.z);
        group.add(jGroup);
        return { jGroup, dir };
      });
      return (p, dt, fade = 1) => {
        const clamp = Math.min(1, p / 0.36);
        const ease = 1 - Math.pow(1 - clamp, 3);
        jaws.forEach(({ jGroup, dir }) => {
          jGroup.position.x = THREE.MathUtils.lerp(kPos.x + dir * 2.6, kPos.x + dir * 0.45, ease);
          jGroup.scale.setScalar(fade);
        });
      };
    }

    if (vfxType === 'trough_horse') {
      const sealGroup = new THREE.Group();
      const sealBlock = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.92, 1.36), goldMat);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 14), crimsonLacquerMat);
      knob.position.y = 0.62;
      sealGroup.add(sealBlock, knob);
      sealGroup.position.set(kPos.x, 6.4, kPos.z);
      group.add(sealGroup);

      const troughBars = [-0.85, 0.85].map((oz) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 0.22), crimsonLacquerMat);
        bar.position.set(kPos.x, 0.32, kPos.z + oz);
        group.add(bar);
        return { bar, oz };
      });

      return (p, dt, fade = 1) => {
        const slam = Math.min(1, p / 0.30);
        sealGroup.position.y = THREE.MathUtils.lerp(6.4, 1.28, slam * slam);
        sealGroup.rotation.y = p * 1.8;
        sealGroup.scale.setScalar(fade);
        troughBars.forEach(({ bar, oz }) => {
          if (p > 0.28) {
            const burst = (p - 0.28) / 0.72;
            bar.position.z = kPos.z + oz * (1 + burst * 1.4);
            bar.rotation.x = burst * 3.5;
          }
          bar.scale.setScalar(fade);
        });
      };
    }

    if (vfxType === 'smothered_kill') {
      const cageGroup = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.18, 1), darkIronMat);
      const wire = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.24, 1),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.9 })
      );
      cageGroup.add(core, wire);
      cageGroup.position.set(kPos.x, 7.6, kPos.z);
      group.add(cageGroup);

      return (p, dt, fade = 1) => {
        const fall = Math.min(1, p / 0.34);
        cageGroup.position.y = THREE.MathUtils.lerp(7.6, 1.55, fall * fall);
        cageGroup.rotation.y += dt * 3.2;
        cageGroup.rotation.x += dt * 2.1;
        cageGroup.scale.setScalar(fade);
      };
    }

    if (vfxType === 'heaven_earth_cannon') {
      const skyRing = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 12, 48), goldGlowMat.clone());
      skyRing.rotation.x = Math.PI / 2;
      skyRing.position.set(kPos.x, 3.2, kPos.z);

      const crossX = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.18, 0.36), crimsonGlowMat.clone());
      crossX.position.set(kPos.x, 0.24, kPos.z);
      const crossZ = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 9.2), goldGlowMat.clone());
      crossZ.position.set(kPos.x, 0.26, 0);
      group.add(skyRing, crossX, crossZ);

      return (p, dt, fade = 1) => {
        skyRing.rotation.z -= dt * 3.2;
        skyRing.position.y = THREE.MathUtils.lerp(3.6, 0.45, Math.min(1, p * 1.6));
        skyRing.scale.setScalar((0.8 + p * 0.9) * fade);
        const pulse = (0.7 + Math.sin(p * 26) * 0.3) * fade;
        crossX.scale.set(1, pulse, pulse);
        crossZ.scale.set(pulse, pulse, 1);
        crossX.material.opacity = 0.88 * fade;
        crossZ.material.opacity = 0.88 * fade;
      };
    }

    if (vfxType === 'stalemate_trap') {
      const monoliths = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const slab = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.25, 0.24), darkIronMat);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.28), goldMat);
        trim.position.y = 1.08;
        slab.add(body, trim);
        slab.position.set(kPos.x + Math.cos(a) * 2.4, 1.15, kPos.z + Math.sin(a) * 2.4);
        slab.rotation.y = -a + Math.PI / 2;
        group.add(slab);
        monoliths.push({ slab, a });
      }
      return (p, dt, fade = 1) => {
        const closeIn = Math.min(1, p / 0.48);
        const rad = THREE.MathUtils.lerp(2.55, 1.38, closeIn);
        monoliths.forEach(({ slab, a }) => {
          slab.position.x = kPos.x + Math.cos(a) * rad;
          slab.position.z = kPos.z + Math.sin(a) * rad;
          slab.scale.setScalar(fade);
        });
      };
    }

    // Default / frost_lotus_strike (海底捞月)
    const icePetals = [];
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 2.15, 6),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x7dd3fc : 0xe0f2fe,
          transparent: true,
          opacity: 0.86,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      const r = i % 2 === 0 ? 1.18 : 1.68;
      crystal.position.set(kPos.x + Math.cos(a) * r, 0.72, kPos.z + Math.sin(a) * r);
      crystal.rotation.z = -Math.cos(a) * 0.48;
      crystal.rotation.x = Math.sin(a) * 0.48;
      group.add(crystal);
      icePetals.push({ crystal, i });
    }
    return (p, dt, fade = 1) => {
      const bloom = Math.min(1, p / 0.36);
      icePetals.forEach(({ crystal }) => {
        crystal.scale.set(bloom * fade, bloom * (1 + Math.sin(p * 12) * 0.12) * fade, bloom * fade);
        crystal.material.opacity = 0.85 * fade;
      });
    };
  },

  triggerCheckmateVFX(pattern, winnerColor) {
    this.clearCheckmateVFX();
    this.lastCheckmatePattern = pattern;
    this.lastWinnerColor = winnerColor;

    const vfxType = (pattern.vfxType === 'sea_bottom_moon' ? 'frost_lotus_strike' : pattern.vfxType) || 'frost_lotus_strike';
    const stampTitle = pattern.stampText || (pattern.title || '绝杀').replace(/\s*·.*$/, '');
    const subBannerText = pattern.subBanner || pattern.badge || 'JJ象棋名局杀法 · 雷霆绝杀';

    this.sfx.playCheckmateVFXSound(vfxType);

    const TOTAL_DURATION = 3.90;
    this.vfxAtmosphereDuration = TOTAL_DURATION;
    this.vfxAtmosphereTimer = TOTAL_DURATION;

    const kCoord = pattern.kingCoord || { r: 0, c: 4 };
    const rCoord = pattern.royalCoord || { r: 9, c: 4 };
    const kPos = gridToWorld(kCoord.r, kCoord.c);
    const rPos = gridToWorld(rCoord.r, rCoord.c);
    const lastRec = this.engine?.history?.[this.engine.history.length - 1];
    const checker = (pattern.checkers && pattern.checkers[0])
      ? pattern.checkers[0]
      : (lastRec?.move ? { r: lastRec.move.tr, c: lastRec.move.tc, char: lastRec.piece?.char || '俥' } : { r: Math.min(9, kCoord.r + 2), c: kCoord.c, char: '俥' });
    const cPos = gridToWorld(checker.r, checker.c);

    this._activeCheckerMeshes = [];
    const highlightList = Array.isArray(pattern.highlightCoords) && pattern.highlightCoords.length > 0
      ? pattern.highlightCoords
      : [checker, kCoord];
    highlightList.forEach(coord => {
      if (!coord || typeof coord.r !== 'number') return;
      const p = this.engine?.board?.[coord.r]?.[coord.c];
      const m = p ? this.pieceMeshes.get(p.id) : null;
      if (m && !this._activeCheckerMeshes.some(x => x.mesh === m)) {
        this._activeCheckerMeshes.push({
          mesh: m,
          basePos: m.position.clone(),
          isKing: p.type === 'k' && p.color !== winnerColor
        });
      }
    });

    this._savedCamBeforeVFX = {
      spherical: { ...this.desiredSpherical },
      target: this.camTarget.clone()
    };

    const focusX = (cPos.x * 0.42 + kPos.x * 0.58);
    const focusZ = (cPos.z * 0.42 + kPos.z * 0.58);
    const baseTheta = this._savedCamBeforeVFX.spherical.theta;

    const vfxLight = new THREE.PointLight(0xffb700, 3.8, 22, 1.5);
    vfxLight.position.set(kPos.x, 3.6, kPos.z);
    this.checkmateVFXGroup.add(vfxLight);

    const baguaTex = getBaguaMagicTexture();
    const crackTex = getMagmaCrackTexture();
    const glowTex = getGlowParticleTexture();

    const groundShockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.78, 64),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    groundShockRing.rotation.x = -Math.PI / 2;
    groundShockRing.position.set(kPos.x, 0.036, kPos.z);
    this.checkmateVFXGroup.add(groundShockRing);

    const crackDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 5.2),
      new THREE.MeshBasicMaterial({
        map: crackTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    crackDisc.rotation.x = -Math.PI / 2;
    crackDisc.position.set(kPos.x, 0.024, kPos.z);
    this.checkmateVFXGroup.add(crackDisc);

    const baguaOuter = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 5.8),
      new THREE.MeshBasicMaterial({
        map: baguaTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    baguaOuter.rotation.x = -Math.PI / 2;
    baguaOuter.position.set(kPos.x, 0.032, kPos.z);
    this.checkmateVFXGroup.add(baguaOuter);

    const updateCustom3D = this.build3DSpectacleForType(vfxType, kPos, cPos, rPos, winnerColor);

    const spawn3DBurst = (wx, wy, wz, primaryHex = 0xff5500, secondaryHex = 0xfef08a, count = 52) => {
      for (let i = 0; i < count; i++) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            color: i % 2 === 0 ? primaryHex : secondaryHex,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        const initScale = 0.36 + Math.random() * 0.45;
        sprite.scale.set(initScale, initScale, 1);
        sprite.position.set(wx + (Math.random() - 0.5) * 0.35, wy + Math.random() * 0.25, wz + (Math.random() - 0.5) * 0.35);
        this.checkmateVFXGroup.add(sprite);

        const angle = Math.random() * Math.PI * 2;
        const speedXZ = 2.2 + Math.random() * 6.8;
        const speedY = 3.2 + Math.random() * 7.2;
        this.checkmateVFXAnimations.push({
          elapsed: 0,
          duration: 1.05 + Math.random() * 0.55,
          update: (t, dt) => {
            sprite.position.x += Math.cos(angle) * speedXZ * dt;
            sprite.position.z += Math.sin(angle) * speedXZ * dt;
            sprite.position.y += (speedY - t * 10.5) * dt;
            if (sprite.position.y < 0.08) sprite.position.y = 0.08;
            sprite.material.opacity = Math.max(0, 1 - Math.pow(t, 1.35));
          }
        });
      }
    };

    const sparks2D = Array.from({ length: 72 }, (_, i) => {
      const ang = (i / 72) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const spd = 120 + Math.random() * 440;
      return {
        ang,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 55,
        size: 3.0 + Math.random() * 8.5,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 9,
        color: i % 4 === 0 ? '#ffffff' : (i % 2 === 0 ? '#fef08a' : '#f97316')
      };
    });

    let stage2Triggered = false;
    let stage3Triggered = false;

    const { canvas: fxCanvas } = this.ensureCheckmateFXCanvas();
    fxCanvas.classList.remove('hidden');

    this.checkmateVFXAnimations.push({
      elapsed: 0,
      duration: TOTAL_DURATION,
      update: (normT, dt) => {
        const sec = normT * TOTAL_DURATION;
        const { ctx, w, h, dpr } = this.ensureCheckmateFXCanvas();
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        if (sec < 0.62) {
          const p1 = sec / 0.62;
          const ease1 = 1 - Math.pow(1 - p1, 3);

          this.camTarget.set(
            THREE.MathUtils.lerp(0, focusX, ease1 * 0.85),
            THREE.MathUtils.lerp(0, 0.28, ease1),
            THREE.MathUtils.lerp(0.3, focusZ, ease1 * 0.85)
          );
          this.desiredSpherical.radius = THREE.MathUtils.lerp(this._savedCamBeforeVFX.spherical.radius, 11.6, ease1);
          this.desiredSpherical.phi = THREE.MathUtils.lerp(this._savedCamBeforeVFX.spherical.phi, 0.92, ease1);
          this.desiredSpherical.theta = baseTheta + ease1 * 0.14;

          this._activeCheckerMeshes.forEach((item, idx) => {
            if (!item.mesh) return;
            const lift = Math.sin(ease1 * Math.PI * 0.5) * (item.isKing ? 0.32 : 0.78);
            item.mesh.position.set(item.basePos.x, lift, item.basePos.z);
            item.mesh.rotation.y = ease1 * Math.PI * (idx % 2 === 0 ? 2 : -2);
          });

          const shockScale = 1 + ease1 * 8.5;
          groundShockRing.scale.set(shockScale, shockScale, 1);
          groundShockRing.material.opacity = Math.sin(p1 * Math.PI) * 0.90;
          baguaOuter.material.opacity = ease1 * 0.78;
          baguaOuter.rotation.z += dt * 2.2;

          const kScreen = this.projectWorldToScreen(kPos.x, 0.35, kPos.z, w, h);
          const cScreen = this.projectWorldToScreen(cPos.x, 0.35, cPos.z, w, h);
          const vig = ctx.createRadialGradient(kScreen.x, kScreen.y, Math.min(w, h) * 0.16, kScreen.x, kScreen.y, Math.max(w, h) * 0.78);
          vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
          vig.addColorStop(0.55, `rgba(24, 10, 16, ${0.28 * ease1})`);
          vig.addColorStop(1, `rgba(6, 4, 12, ${0.68 * ease1})`);
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, w, h);

          // 阶段1：制胜杀子流光升腾动画
          const flyX = THREE.MathUtils.lerp(cScreen.x, w * 0.5, ease1);
          const flyY = THREE.MathUtils.lerp(cScreen.y, h * 0.44, ease1) - Math.sin(p1 * Math.PI) * 65;
          this.drawJJMedallion2D(
            ctx,
            flyX,
            flyY,
            Math.min(w, h) * (0.055 + ease1 * 0.045),
            checker?.char || (winnerColor === RED ? '俥' : '車'),
            winnerColor === RED,
            1.0,
            0.85,
            ease1 * 0.4,
            '#fef08a',
            ease1 * 0.92
          );

          this.drawJJTopCinematicBar(ctx, w * 0.5, h * 0.11, subBannerText, ease1, '#f59e0b');
        } else if (sec < 2.58) {
          const p2 = (sec - 0.62) / 1.96;
          if (!stage2Triggered) {
            stage2Triggered = true;
            this.triggerScreenFlash();
            this.cameraShake = 0.88;
            this._activeCheckerMeshes.forEach(item => {
              if (item.mesh && item.basePos) {
                item.mesh.position.copy(item.basePos);
                item.mesh.rotation.set(0, 0, 0);
              }
            });
            const primaryColor = (vfxType === 'fishing_horse' || vfxType === 'frost_lotus_strike') ? 0x38bdf8 : 0xef4444;
            spawn3DBurst(kPos.x, 0.35, kPos.z, primaryColor, 0xfef08a, 60);
          }

          this.desiredSpherical.theta = baseTheta + 0.14 + Math.sin(p2 * Math.PI) * 0.09;
          crackDisc.material.opacity = Math.min(0.86, p2 * 2.4) * (1 - p2 * 0.22);
          baguaOuter.material.opacity = 0.78 * (1 - p2 * 0.18);
          baguaOuter.rotation.z += dt * 1.6;
          if (updateCustom3D) updateCustom3D(p2, dt, 1.0);

          this.renderJJTypeSpectacle2D(ctx, w, h, p2, vfxType, stampTitle, subBannerText, winnerColor, checker, kCoord, sparks2D, pattern);
        } else {
          const p3 = (sec - 2.58) / Math.max(0.01, TOTAL_DURATION - 2.58);
          const ease3 = 1 - Math.pow(1 - p3, 3);
          if (!stage3Triggered) {
            stage3Triggered = true;
            this.triggerScreenFlash();
            this.cameraShake = 0.78;
            spawn3DBurst(kPos.x, 0.45, kPos.z, 0xfbbf24, 0xef4444, 54);
          }

          this.camTarget.lerpVectors(new THREE.Vector3(focusX, 0.28, focusZ), this._savedCamBeforeVFX.target, ease3);
          this.desiredSpherical.radius = THREE.MathUtils.lerp(11.6, this._savedCamBeforeVFX.spherical.radius, ease3);
          this.desiredSpherical.phi = THREE.MathUtils.lerp(0.92, this._savedCamBeforeVFX.spherical.phi, ease3);
          this.desiredSpherical.theta = THREE.MathUtils.lerp(baseTheta + 0.14, this._savedCamBeforeVFX.spherical.theta, ease3);

          const fade3D = Math.max(0, 1 - p3 * 1.45);
          crackDisc.material.opacity = fade3D * 0.75;
          baguaOuter.material.opacity = fade3D * 0.75;
          if (updateCustom3D) updateCustom3D(1.0, dt, fade3D);

          this.renderJJFinalJueshaSeal2D(ctx, w, h, p3, stampTitle, subBannerText, sparks2D, vfxType);
        }

        vfxLight.intensity = (1 - normT * 0.55) * (3.6 + Math.sin(normT * 36) * 0.9);
        ctx.restore();
      }
    });
  },

  renderJJTypeSpectacle2D(ctx, w, h, p, vfxType, stampTitle, subBannerText, winnerColor, checker, kCoord, sparks2D, pattern) {
    const cx = w * 0.5;
    const cy = h * 0.44;
    const minDim = Math.min(w, h);

    ctx.save();

    // 1. 专属氛围背景晕染
    const isIceOrWater = vfxType === 'fishing_horse' || vfxType === 'frost_lotus_strike';
    const isNightMoon = vfxType === 'octagon_horse';
    const vig = ctx.createRadialGradient(cx, cy, minDim * 0.18, cx, cy, Math.max(w, h) * 0.78);
    if (isIceOrWater) {
      vig.addColorStop(0.0, 'rgba(3, 105, 161, 0.24)');
      vig.addColorStop(0.55, 'rgba(12, 74, 110, 0.52)');
      vig.addColorStop(1.0, 'rgba(4, 22, 42, 0.82)');
    } else if (isNightMoon) {
      vig.addColorStop(0.0, 'rgba(49, 46, 129, 0.22)');
      vig.addColorStop(0.55, 'rgba(30, 27, 75, 0.56)');
      vig.addColorStop(1.0, 'rgba(9, 9, 24, 0.85)');
    } else {
      vig.addColorStop(0.0, 'rgba(180, 83, 9, 0.18)');
      vig.addColorStop(0.55, 'rgba(69, 18, 12, 0.48)');
      vig.addColorStop(1.0, 'rgba(12, 6, 8, 0.80)');
    }
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // 2. 绘制 17 种 JJ 象棋专属史诗法相画卷
    this.renderJJHeroSpectacle2D(ctx, w, h, p, vfxType, winnerColor, checker, kCoord, pattern);

    // 3. 火星星屑粒子飞舞
    sparks2D.forEach((sp, idx) => {
      if (idx % 2 !== 0) return;
      const sx = cx + sp.vx * p * 1.15;
      const sy = cy + sp.vy * p * 1.15 + 140 * p * p;
      if (Math.hypot(sx - cx, sy - cy) < minDim * 0.14) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p * 0.82);
      ctx.translate(sx, sy);
      ctx.rotate(sp.rot + sp.vRot * p);
      ctx.fillStyle = isIceOrWater ? (idx % 4 === 0 ? '#ffffff' : '#7dd3fc') : sp.color;
      const s = sp.size * (1 - p * 0.35);
      ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
      ctx.restore();
    });

    const accent = isIceOrWater ? '#38bdf8' : '#f59e0b';
    const topBarAlpha = p > 0.86 ? Math.max(0, (1 - p) / 0.14) : Math.min(1, p / 0.14);
    this.drawJJTopCinematicBar(ctx, cx, h * 0.11, subBannerText, topBarAlpha, accent);

    // 4. 3D 浮雕鎏金杀法名号大字（钓鱼马先呈现碧水冰晶色再化为鎏金，复刻 00:55-00:56）
    const slamT = Math.min(1, p / 0.16);
    const slamScale = slamT < 1
      ? THREE.MathUtils.lerp(2.45, 0.98, slamT * slamT)
      : 1.0 + Math.sin((p - 0.16) * 14) * 0.02;
    const titleAlpha = p > 0.86 ? Math.max(0, (1 - p) / 0.14) : 1.0;
    const fontSize = Math.round(Math.min(w * 0.14, h * 0.105, 94));
    const colorPhase = vfxType === 'fishing_horse' ? p : 1.0;
    this.drawJJBrushTitle(ctx, cx, h * 0.62, stampTitle, fontSize, slamScale, titleAlpha, '', accent, colorPhase);

    ctx.restore();
  },

  renderJJFinalJueshaSeal2D(ctx, w, h, p3, stampTitle, subBannerText, sparks2D, vfxType = '') {
    const cx = w * 0.5;
    const cy = h * 0.46;
    const fadeOut = p3 > 0.72 ? Math.max(0, 1 - (p3 - 0.72) / 0.28) : 1.0;
    if (fadeOut <= 0.01) return;

    const isIceOrWater = vfxType === 'fishing_horse' || vfxType === 'frost_lotus_strike';

    ctx.save();
    ctx.globalAlpha = fadeOut;

    const bg = ctx.createRadialGradient(cx, cy, 35, cx, cy, Math.max(w, h) * 0.72);
    if (isIceOrWater) {
      bg.addColorStop(0, 'rgba(56, 189, 248, 0.30)');
      bg.addColorStop(0.55, 'rgba(12, 74, 110, 0.46)');
      bg.addColorStop(1, 'rgba(4, 16, 32, 0.68)');
    } else {
      bg.addColorStop(0, 'rgba(245, 158, 11, 0.30)');
      bg.addColorStop(0.55, 'rgba(68, 16, 12, 0.48)');
      bg.addColorStop(1, 'rgba(8, 4, 8, 0.68)');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 冲击波光环
    const ringR = Math.min(w, h) * (0.14 + p3 * 0.42);
    ctx.strokeStyle = isIceOrWater
      ? `rgba(186, 230, 253, ${(1 - p3) * 0.85})`
      : `rgba(254, 240, 138, ${(1 - p3) * 0.85})`;
    ctx.lineWidth = 6 * (1 - p3 * 0.55);
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();

    sparks2D.forEach((sp, i) => {
      const sx = cx + sp.vx * (0.20 + p3 * 0.88);
      const sy = cy + sp.vy * (0.20 + p3 * 0.88) + 185 * p3 * p3;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(sp.rot + sp.vRot * p3);
      ctx.fillStyle = isIceOrWater && i % 2 === 0 ? '#bae6fd' : sp.color;
      const s = sp.size * Math.max(0.2, 1 - p3 * 0.5);
      ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
      ctx.restore();
    });

    const slamT = Math.min(1, p3 / 0.16);
    const slamScale = slamT < 1
      ? THREE.MathUtils.lerp(2.85, 0.96, slamT * slamT)
      : 1.0 + Math.sin((p3 - 0.16) * 18) * 0.018;
    const bigFontSize = Math.round(Math.min(w * 0.21, h * 0.16, 132));
    // 复刻 JJ象棋绝杀视频：所有17种终局最后均呈现震撼「绝杀」金印大字！
    const finalText = '绝杀';
    const caption = stampTitle && stampTitle !== '绝杀' ? `${stampTitle} · ${subBannerText}` : subBannerText;
    this.drawJJBrushTitle(ctx, cx, cy, finalText, bigFontSize, slamScale, fadeOut, caption, '#f59e0b', 1.0);

    ctx.restore();
  },

  spawnMoveTrailRibbon(startPos, endPos, color, isCapture = false) {
    if (!this.scene) return;
    const isRed = color === RED;
    const midX = (startPos.x + endPos.x) * 0.5;
    const midZ = (startPos.z + endPos.z) * 0.5;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(startPos.x, 0.18, startPos.z),
      new THREE.Vector3(midX, isCapture ? 1.05 : 0.78, midZ),
      new THREE.Vector3(endPos.x, 0.18, endPos.z)
    );
    const tubeGeo = new THREE.TubeGeometry(curve, 28, isCapture ? 0.068 : 0.046, 10, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: isCapture ? 0xfef08a : (isRed ? 0xff6b6b : 0xfbbf24),
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    this.scene.add(tubeMesh);
    if (!this.impactWaves) this.impactWaves = [];
    this.impactWaves.push({
      mesh: tubeMesh,
      age: 0,
      maxAge: isCapture ? 0.46 : 0.36,
      maxScale: 1.0,
      isTrail: true
    });
  },

  spawnMoveImpactWave(worldX, worldZ, isCapture = false) {
    if (!this.scene) return;
    const markerTex = typeof getBoardMarkerTexture === 'function'
      ? getBoardMarkerTexture(isCapture ? 'warning' : 'last_to')
      : null;
    const mat = new THREE.MeshBasicMaterial({
      map: markerTex || null,
      color: isCapture ? 0xffef8a : 0xfde047,
      transparent: true,
      opacity: isCapture ? 0.92 : 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const waveMesh = new THREE.Mesh(
      markerTex ? new THREE.PlaneGeometry(1.12, 1.12) : new THREE.RingGeometry(0.32, 0.50, 36),
      mat
    );
    waveMesh.rotation.x = -Math.PI / 2;
    waveMesh.position.set(worldX, 0.026, worldZ);
    this.scene.add(waveMesh);
    if (!this.impactWaves) this.impactWaves = [];
    this.impactWaves.push({
      mesh: waveMesh,
      age: 0,
      maxAge: isCapture ? 0.56 : 0.40,
      maxScale: isCapture ? 2.45 : 1.72
    });
  },

  spawnShatterFragments(worldX, worldZ, color) {
    const isRed = color === RED;
    this.spawnMoveImpactWave(worldX, worldZ, true);
    this.cameraShake = Math.max(this.cameraShake || 0, 0.34);
    const glowTex = typeof getGlowParticleTexture === 'function' ? getGlowParticleTexture() : null;
    const slashTex = typeof getSlashArcTexture === 'function' ? getSlashArcTexture() : null;

    if (slashTex) {
      for (let sIdx = 0; sIdx < 2; sIdx++) {
        const slashMat = new THREE.MeshBasicMaterial({
          map: slashTex,
          color: sIdx === 0 ? 0xfef08a : 0xff3333,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const slashMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 1.68), slashMat);
        slashMesh.position.set(worldX, 0.38, worldZ);
        slashMesh.rotation.x = -Math.PI * 0.36;
        slashMesh.rotation.z = sIdx === 0 ? 0.55 : -0.55;
        this.scene.add(slashMesh);
        this.impactWaves.push({
          mesh: slashMesh,
          age: 0,
          maxAge: 0.36,
          maxScale: 2.15,
          isSlash: true
        });
      }
    }

    for (let i = 0; i < 20; i++) {
      const fragMat = new THREE.MeshStandardMaterial({
        color: isRed ? 0xe6d5b8 : 0x090d16,
        emissive: isRed ? 0xf59e0b : 0xfbbf24,
        emissiveIntensity: 0.48,
        roughness: 0.18,
        metalness: 0.38,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.075 + Math.random() * 0.045, 0), fragMat);
      mesh.position.set(worldX, 0.24, worldZ);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(mesh);
      this.shatterParticles.push({
        mesh,
        vx: (Math.random() - 0.5) * 5.6,
        vy: 3.4 + Math.random() * 4.0,
        vz: (Math.random() - 0.5) * 5.6,
        life: 0,
        maxLife: 0.85
      });
    }

    if (glowTex) {
      for (let i = 0; i < 16; i++) {
        const spMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: i % 2 === 0 ? 0xfef08a : (isRed ? 0xef4444 : 0xf59e0b),
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const sp = new THREE.Sprite(spMat);
        sp.scale.set(0.44, 0.44, 1);
        sp.position.set(worldX, 0.28, worldZ);
        this.scene.add(sp);
        this.shatterParticles.push({
          mesh: sp,
          vx: (Math.random() - 0.5) * 6.0,
          vy: 2.8 + Math.random() * 4.5,
          vz: (Math.random() - 0.5) * 6.0,
          life: 0,
          maxLife: 0.72
        });
      }
    }
  },

  showGrandmasterHint3D(move) {
    this.clearGrandmasterHint3D();
    if (!this.scene || !window.THREE) return;
    this.hintVFXGroup = new THREE.Group();
    this.scene.add(this.hintVFXGroup);
    const a = gridToWorld(move.fr, move.fc);
    const b = gridToWorld(move.tr, move.tc);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(a.x, 0.34, a.z),
      new THREE.Vector3((a.x + b.x) / 2, 1.48, (a.z + b.z) / 2),
      new THREE.Vector3(b.x, 0.26, b.z)
    );

    const coreTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, 0.048, 12, false),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.96,
        depthWrite: false
      })
    );
    this.hintVFXGroup.add(coreTube);

    const startTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('selected') : null;
    const endTex = typeof getMoveIndicatorTexture === 'function' ? getMoveIndicatorTexture('capture_safe') : null;

    [a, b].forEach((pos, i) => {
      const tex = i === 0 ? startTex : endTex;
      const ring = new THREE.Mesh(
        new THREE.PlaneGeometry(1.18, 1.18),
        new THREE.MeshBasicMaterial({
          map: tex || null,
          color: tex ? 0xffffff : (i ? 0x10b981 : 0xf59e0b),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.96,
          depthWrite: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.032, pos.z);
      this.hintVFXGroup.add(ring);
    });
  },

  clearGrandmasterHint3D() {
    if (this.hintVFXGroup) {
      this.scene?.remove(this.hintVFXGroup);
      this.hintVFXGroup.traverse?.(o => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
        else o.material?.dispose?.();
      });
      this.hintVFXGroup = null;
    }
  }
});
