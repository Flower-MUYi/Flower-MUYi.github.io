/*************************************************************************
 * 3D ARTICULATED ULTIMATE CHECKMATE CINEMATICS, MOVE IMPACT RIPPLES
 * & GRANDMASTER HINT TRAJECTORY MODULE
 * (古谱十七大杀法 · 纯3D精细建模全屏演武系统)
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

  drawImperialTopCinematicBar(ctx, cx, topY, subBannerText, alpha = 1, accentColor = '#f59e0b') {
    if (alpha <= 0.01 || !subBannerText) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, topY);

    const barW = Math.min(500, window.innerWidth * 0.86);
    const barH = 36;
    const grad = ctx.createLinearGradient(-barW * 0.5, 0, barW * 0.5, 0);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
    grad.addColorStop(0.18, 'rgba(18, 12, 10, 0.82)');
    grad.addColorStop(0.5, 'rgba(52, 14, 14, 0.90)');
    grad.addColorStop(0.82, 'rgba(18, 12, 10, 0.82)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-barW * 0.5, -barH * 0.5, barW, barH);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-barW * 0.38, -barH * 0.5);
    ctx.lineTo(barW * 0.38, -barH * 0.5);
    ctx.moveTo(-barW * 0.38, barH * 0.5);
    ctx.lineTo(barW * 0.38, barH * 0.5);
    ctx.stroke();

    ctx.font = 'bold 14px "XiangqiCalligraphy", "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef3c7';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.fillText(`◆  ${subBannerText}  ◆`, 0, 1);
    ctx.restore();
  },

  drawImperialBrushTitle(ctx, cx, cy, text, fontSize, slamScale = 1, alpha = 1, subText = '', accentColor = '#f59e0b', colorPhase = 1) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(slamScale, slamScale);

    const chars = String(text || '绝杀').split('');
    const spacing = fontSize * 1.05;
    const totalW = (chars.length - 1) * spacing;

    const glowW = totalW + fontSize * 2.0;
    const glowGrad = ctx.createRadialGradient(0, 0, fontSize * 0.08, 0, 0, glowW * 0.55);
    const isCyanPhase = colorPhase < 0.45;
    glowGrad.addColorStop(0, isCyanPhase ? 'rgba(56, 189, 248, 0.34)' : 'rgba(245, 158, 11, 0.32)');
    glowGrad.addColorStop(0.55, isCyanPhase ? 'rgba(14, 116, 144, 0.12)' : 'rgba(180, 83, 9, 0.12)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, glowW * 0.55, fontSize * 0.62, -0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = isCyanPhase ? '#7dd3fc' : '#fef08a';
    ctx.shadowColor = isCyanPhase ? '#0284c7' : accentColor;
    ctx.shadowBlur = 16;
    ctx.lineWidth = Math.max(2.5, fontSize * 0.04);
    ctx.beginPath();
    ctx.moveTo(-glowW * 0.44, fontSize * 0.34);
    ctx.quadraticCurveTo(0, fontSize * 0.50, glowW * 0.46, fontSize * 0.20);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px "XiangqiCalligraphy", "STKaiti", "Kaiti SC", "KaiTi", "Noto Serif SC", "Songti SC", serif`;

    chars.forEach((ch, idx) => {
      const ox = idx * spacing - totalW * 0.5;
      const oy = (idx % 2 === 0 ? -2.5 : 2.5);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate((idx - (chars.length - 1) * 0.5) * 0.028 - 0.025);

      for (let d = 6; d >= 1; d--) {
        ctx.fillStyle = isCyanPhase
          ? (d > 3 ? '#082f49' : '#0369a1')
          : (d > 3 ? '#270e04' : '#78350f');
        ctx.fillText(ch, d * 1.3, d * 1.8);
      }

      ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 5;
      ctx.lineWidth = Math.max(5, fontSize * 0.09);
      ctx.strokeStyle = isCyanPhase ? '#082f49' : '#3b1106';
      ctx.strokeText(ch, 0, 0);

      ctx.shadowColor = isCyanPhase ? '#38bdf8' : accentColor;
      ctx.shadowBlur = 22;
      const g = ctx.createLinearGradient(0, -fontSize * 0.50, 0, fontSize * 0.50);
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

      ctx.lineWidth = Math.max(1.5, fontSize * 0.022);
      ctx.strokeStyle = isCyanPhase ? '#e0f2fe' : '#fffbeb';
      ctx.strokeText(ch, -1, -1.5);
      ctx.restore();
    });

    if (subText) {
      const subSize = Math.max(13, Math.round(fontSize * 0.22));
      ctx.font = `bold ${subSize}px "XiangqiCalligraphy", "Noto Serif SC", serif`;
      ctx.fillStyle = '#fef3c7';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      ctx.fillText(`◆ ${subText} ◆`, 0, fontSize * 0.78);
    }
    ctx.restore();
  },

  /*************************************************************************
   * REUSABLE MULTI-PART ARTICULATED 3D MODELS FOR CHECKMATE CUTSCENES
   *************************************************************************/

  /**
   * 精细可动 3D 战马模型（包含躯干、马鞍、可动脖颈/马头/鬃毛、四条独立关节马腿与马蹄、飘扬马尾）
   */
  createArticulated3DWarHorse(bodyMat, armorMat, glowMat) {
    const horse = new THREE.Group();

    // 1. 肌肉感马身与胸腹
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 1.15, 16), bodyMat);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.72, 0);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 14), bodyMat);
    chest.position.set(0, 0.76, 0.50);
    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 14), bodyMat);
    hip.position.set(0, 0.74, -0.50);
    horse.add(torso, chest, hip);

    // 2. 金甲马鞍与护胸甲
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.54), armorMat);
    saddle.position.set(0, 0.96, 0.02);
    const bardingFront = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.32, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9), armorMat);
    bardingFront.position.set(0, 0.74, 0.42);
    horse.add(saddle, bardingFront);

    // 3. 可动脖颈与昂首马头关节 (neckPivot)
    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.86, 0.46);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.68, 14), bodyMat);
    neck.position.set(0, 0.28, 0.16);
    neck.rotation.x = 0.48;
    neckPivot.add(neck);

    // 火焰鬃毛
    for (let m = 0; m < 5; m++) {
      const maneFin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), glowMat);
      maneFin.position.set(0, 0.12 + m * 0.11, 0.02 + m * 0.04);
      maneFin.rotation.x = -0.65;
      neckPivot.add(maneFin);
    }

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.58, 0.32);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.34), bodyMat);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.36, 12), bodyMat);
    snout.rotation.x = Math.PI / 2 + 0.22;
    snout.position.set(0, -0.05, 0.26);
    const chanfron = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.46), armorMat);
    chanfron.position.set(0, 0.09, 0.14);
    chanfron.rotation.x = 0.22;

    [-0.08, 0.08].forEach(ex => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), bodyMat);
      ear.position.set(ex, 0.18, -0.06);
      ear.rotation.x = -0.2;
      headGroup.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), glowMat);
      eye.position.set(ex * 1.45, 0.04, 0.08);
      headGroup.add(eye);
    });
    headGroup.add(skull, snout, chanfron);
    neckPivot.add(headGroup);
    horse.add(neckPivot);

    // 4. 四条可动关节马腿 (大腿 + 小腿 + 金铁马蹄)
    const createLeg = (lx, lz, isFront) => {
      const hipJoint = new THREE.Group();
      hipJoint.position.set(lx, 0.64, lz);
      const upperLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.38, 10), bodyMat);
      upperLeg.position.y = -0.18;
      hipJoint.add(upperLeg);

      const kneeJoint = new THREE.Group();
      kneeJoint.position.y = -0.36;
      const lowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.36, 10), bodyMat);
      lowerLeg.position.y = -0.17;
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.10, 10), armorMat);
      hoof.position.y = -0.35;
      kneeJoint.add(lowerLeg, hoof);
      hipJoint.add(kneeJoint);
      horse.add(hipJoint);
      return { hipJoint, kneeJoint, isFront };
    };

    const flLeg = createLeg(-0.19, 0.44, true);
    const frLeg = createLeg(0.19, 0.44, true);
    const blLeg = createLeg(-0.19, -0.44, false);
    const brLeg = createLeg(0.19, -0.44, false);

    // 5. 飘扬马尾关节
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.78, -0.62);
    const tailMain = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.68, 10), glowMat);
    tailMain.rotation.x = -Math.PI * 0.68;
    tailMain.position.set(0, -0.12, -0.28);
    tailPivot.add(tailMain);
    horse.add(tailPivot);

    horse.userData = {
      neckPivot,
      headGroup,
      tailPivot,
      legs: [flLeg, frLeg, blLeg, brLeg],
      animateGallop(time, rearUp = 0) {
        horse.rotation.x = -rearUp * 0.62;
        neckPivot.rotation.x = Math.sin(time * 14) * 0.14 + rearUp * 0.32;
        headGroup.rotation.x = Math.cos(time * 14) * 0.12;
        tailPivot.rotation.x = Math.sin(time * 16) * 0.25 + rearUp * 0.35;
        flLeg.hipJoint.rotation.x = Math.sin(time * 15) * 0.68 - rearUp * 0.55;
        flLeg.kneeJoint.rotation.x = Math.max(0, Math.cos(time * 15) * 0.65) + rearUp * 0.75;
        frLeg.hipJoint.rotation.x = Math.sin(time * 15 + Math.PI * 0.6) * 0.68 - rearUp * 0.45;
        frLeg.kneeJoint.rotation.x = Math.max(0, Math.cos(time * 15 + Math.PI * 0.6) * 0.65) + rearUp * 0.65;
        blLeg.hipJoint.rotation.x = Math.sin(time * 15 + Math.PI) * 0.58 + rearUp * 0.42;
        blLeg.kneeJoint.rotation.x = -Math.max(0, Math.sin(time * 15) * 0.45);
        brLeg.hipJoint.rotation.x = Math.sin(time * 15 + Math.PI * 1.6) * 0.58 + rearUp * 0.42;
        brLeg.kneeJoint.rotation.x = -Math.max(0, Math.sin(time * 15 + 0.6) * 0.45);
      }
    };
    return horse;
  },

  /**
   * 精细可动 3D 古代重甲战车模型（带双辐条旋转战轮、车舆护栏、华盖/战旗、双车辕与飞转轮刃）
   */
  createArticulated3DWarChariot(woodMat, goldMat, ironMat, glowMat) {
    const chariot = new THREE.Group();

    // 车舆底盘与雕花护栏
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.16, 1.24), woodMat);
    base.position.y = 0.46;
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.52, 0.12), woodMat);
    frontWall.position.set(0, 0.74, 0.56);
    const frontShield = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.38, 0.16), goldMat);
    frontShield.position.set(0, 0.74, 0.58);
    chariot.add(base, frontWall, frontShield);

    [-0.56, 0.56].forEach(sx => {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.44, 1.16), woodMat);
      sideWall.position.set(sx, 0.70, 0);
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 1.22), goldMat);
      topRail.position.set(sx, 0.94, 0);
      chariot.add(sideWall, topRail);
    });

    // 双车辕与前冲战戟锋刃
    [-0.36, 0.36].forEach(px => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.45, 10), goldMat);
      pole.rotation.x = Math.PI / 2;
      pole.position.set(px, 0.48, 1.15);
      const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 4), glowMat);
      spearTip.rotation.x = Math.PI / 2;
      spearTip.position.set(px, 0.48, 1.98);
      chariot.add(pole, spearTip);
    });

    // 战车后置迎风双战旗
    const banners = [-0.42, 0.42].map(bx => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.65, 8), goldMat);
      mast.position.set(bx, 1.25, -0.52);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.75, 4, 4), glowMat);
      flag.position.set(bx, 1.62, -0.82);
      flag.rotation.y = Math.PI / 2;
      chariot.add(mast, flag);
      return flag;
    });

    // 8辐条双大轮 + 轮毂黄金撞针
    const wheels = [-0.68, 0.68].map(wx => {
      const wGroup = new THREE.Group();
      wGroup.position.set(wx, 0.48, 0);
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.055, 12, 32), goldMat);
      tire.rotation.y = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 14), ironMat);
      hub.rotation.z = Math.PI / 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 8), goldMat);
      spike.rotation.z = wx < 0 ? Math.PI / 2 : -Math.PI / 2;
      spike.position.x = wx < 0 ? -0.22 : 0.22;
      wGroup.add(tire, hub, spike);

      for (let s = 0; s < 8; s++) {
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.88, 6), woodMat);
        spoke.rotation.x = (s * Math.PI) / 4;
        wGroup.add(spoke);
      }
      chariot.add(wGroup);
      return wGroup;
    });

    chariot.userData = {
      wheels,
      banners,
      spinWheels(deltaSpin, time = 0) {
        wheels.forEach(w => { w.rotation.x += deltaSpin; });
        banners.forEach((f, idx) => { f.rotation.z = Math.sin(time * 16 + idx) * 0.18; });
      }
    };
    return chariot;
  },

  /**
   * 精细可动 3D 龙首重炮模型（带四轮炮架、俯仰炮管、龙角浮雕与后坐力动画）
   */
  createArticulated3DCannon(woodMat, goldMat, ironMat, glowMat) {
    const cannon = new THREE.Group();

    // 炮车底座与四轮
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.28, 1.28), woodMat);
    carriage.position.y = 0.28;
    cannon.add(carriage);

    const wheels = [];
    [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.10, 18), ironMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.24, wz);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 20), goldMat);
      rim.rotation.y = Math.PI / 2;
      rim.position.set(wx + (wx > 0 ? 0.05 : -0.05), 0.24, wz);
      cannon.add(w, rim);
      wheels.push(w);
    });

    // 可俯仰与后坐力的多节箍环炮管 (barrelGroup)
    const barrelPivot = new THREE.Group();
    barrelPivot.position.set(0, 0.50, 0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.27, 1.65, 24), ironMat);
    barrel.rotation.x = Math.PI / 2;
    barrelPivot.add(barrel);

    [-0.55, -0.15, 0.25, 0.68].forEach(bz => {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.23 - bz * 0.03, 0.038, 10, 24), goldMat);
      band.position.z = bz;
      barrelPivot.add(band);
    });

    // 炮口火焰光环与炮尾金球
    const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.045, 12, 24), glowMat);
    muzzleRing.position.z = 0.84;
    const Knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), goldMat);
    Knob.position.z = -0.92;
    barrelPivot.add(muzzleRing, Knob);
    barrelPivot.rotation.x = -0.28;
    cannon.add(barrelPivot);

    cannon.userData = { barrelPivot, muzzleRing, wheels };
    return cannon;
  },

  /**
   * 精细可动 3D 金甲帝王神将模型（对面笑 / 双将 / 列马车）
   */
  createArticulated3DGeneral(goldMat, crimsonMat, ironMat, glowMat) {
    const general = new THREE.Group();

    // 战袍下摆与胸甲
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.54, 1.15, 16), crimsonMat);
    robe.position.y = 0.62;
    const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.85, 16), goldMat);
    cuirass.position.y = 1.38;
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), glowMat);
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(0, 1.46, 0.38);
    general.add(robe, cuirass, mirror);

    // 披风
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.65, 6, 6), crimsonMat);
    cape.position.set(0, 1.18, -0.38);
    cape.rotation.x = 0.22;
    general.add(cape);

    // 凤翅兜鍪金盔与头部
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), goldMat);
    head.position.y = 2.04;
    const helmetDome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), ironMat);
    helmetDome.position.y = 2.08;
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 8), crimsonMat);
    plume.position.set(0, 2.52, -0.08);
    plume.rotation.x = -0.35;
    general.add(head, helmetDome, plume);

    [-1, 1].forEach(dir => {
      const wing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 16, Math.PI * 0.75), goldMat);
      wing.position.set(dir * 0.26, 2.22, 0);
      wing.rotation.z = dir * 0.45;
      general.add(wing);

      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), goldMat);
      pauldron.position.set(dir * 0.54, 1.72, 0);
      pauldron.rotation.z = -dir * 0.45;
      general.add(pauldron);
    });

    // 可挥砍的右臂与帝王轩辕巨剑 (swordArmPivot)
    const swordArmPivot = new THREE.Group();
    swordArmPivot.position.set(0.56, 1.68, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.65, 10), goldMat);
    arm.position.set(0, -0.25, 0.22);
    arm.rotation.x = Math.PI / 3;
    swordArmPivot.add(arm);

    const swordGroup = new THREE.Group();
    swordGroup.position.set(0, -0.45, 0.48);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.45, 10), crimsonMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.10, 0.16), goldMat);
    guard.position.y = 0.24;
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 2.35, 4), glowMat);
    blade.position.y = 1.42;
    swordGroup.add(hilt, guard, blade);
    swordGroup.rotation.x = Math.PI * 0.38;
    swordArmPivot.add(swordGroup);
    general.add(swordArmPivot);

    general.userData = { swordArmPivot, cape, plume };
    return general;
  },

  /**
   * 构建 17 种古谱杀法的全 3D 精细建模动态演出
   */
  build3DSpectacleForType(vfxType, kPos, cPos, rPos, winnerColor) {
    const group = new THREE.Group();
    this.checkmateVFXGroup.add(group);
    const slashTex = typeof getSlashArcTexture === 'function' ? getSlashArcTexture() : null;

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.48,
      metalness: 0.88,
      roughness: 0.20
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      emissiveIntensity: 0.25,
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
    const bronzeWoodMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      emissive: 0x270e04,
      emissiveIntensity: 0.22,
      metalness: 0.42,
      roughness: 0.38
    });
    const jadeIceMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      metalness: 0.35,
      roughness: 0.15,
      transparent: true,
      opacity: 0.92
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

    // 辅助函数：构建 3D 立体环环相扣铁链
    const create3DChainBetween = (p1, p2, linkCount = 14) => {
      const chainGroup = new THREE.Group();
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      for (let i = 0; i <= linkCount; i++) {
        const f = i / linkCount;
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 16), i % 2 === 0 ? darkIronMat : goldMat);
        link.position.lerpVectors(p1, p2, f);
        link.quaternion.copy(quat);
        if (i % 2 === 1) link.rotateY(Math.PI / 2);
        chainGroup.add(link);
      }
      group.add(chainGroup);
      return { chainGroup, len };
    };

    // =========================================================================
    // 1. 双车错 (Double Chariot): 两辆 3D 重甲战车旋转巨轮交错冲锋 + 交叉刀芒斩将
    // =========================================================================
    if (vfxType === 'double_chariot') {
      const chariots = [-1, 1].map((dir, idx) => {
        const ch = this.createArticulated3DWarChariot(bronzeWoodMat, goldMat, darkIronMat, idx === 0 ? goldGlowMat : crimsonGlowMat);
        ch.scale.setScalar(0.92);
        ch.position.set(kPos.x - dir * 4.2, 0.05, kPos.z + (idx === 0 ? -0.68 : 0.68));
        ch.rotation.y = dir * (Math.PI / 2);
        group.add(ch);
        return { ch, dir, idx };
      });
      const slashPlanes = [-1, 1].map((dir, idx) => {
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(6.2, 1.35),
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
        plane.rotation.z = dir * 0.52;
        plane.position.set(kPos.x, 0.45 + idx * 0.1, kPos.z);
        group.add(plane);
        return plane;
      });
      return (p, dt, fade = 1) => {
        const rush = Math.min(1, p / 0.48);
        const ease = 1 - Math.pow(1 - rush, 3);
        chariots.forEach(({ ch, dir }) => {
          ch.position.x = THREE.MathUtils.lerp(kPos.x - dir * 4.2, kPos.x + dir * 1.15, ease);
          ch.userData.spinWheels(dt * 18, p * 4);
          ch.scale.setScalar(0.92 * fade);
        });
        slashPlanes.forEach((pl, i) => {
          pl.material.opacity = Math.sin(Math.min(1, p * 1.25) * Math.PI) * 0.90 * fade;
          pl.scale.set(0.5 + ease * 1.35, 0.7 + ease * 0.55, 1);
          pl.rotation.z += (i === 0 ? 1 : -1) * dt * 1.5;
        });
      };
    }

    // =========================================================================
    // 2. 闷宫 (Smothered Palace): 四面 3D 玄铁宫墙拔地而起 + 四方 3D 立体铁链锁死 + 镇宫金印天降
    // =========================================================================
    if (vfxType === 'smothered_palace') {
      const walls = [];
      const offsets = [
        { x: -1.45, z: 0, ry: Math.PI / 2 },
        { x: 1.45, z: 0, ry: Math.PI / 2 },
        { x: 0, z: -1.45, ry: 0 },
        { x: 0, z: 1.45, ry: 0 }
      ];
      offsets.forEach(o => {
        const wGroup = new THREE.Group();
        const wall = new THREE.Mesh(new THREE.BoxGeometry(2.75, 1.65, 0.28), darkIronMat);
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.26, 0.38), goldMat);
        topBeam.position.y = 0.88;
        for (let b = -2; b <= 2; b++) {
          const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.34), crimsonLacquerMat);
          merlon.position.set(b * 0.52, 1.12, 0);
          wGroup.add(merlon);
        }
        wGroup.add(wall, topBeam);
        wGroup.position.set(kPos.x + o.x, -1.2, kPos.z + o.z);
        wGroup.rotation.y = o.ry;
        group.add(wGroup);
        walls.push(wGroup);
      });

      const chains = [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]].map(([cx, cz]) =>
        create3DChainBetween(
          new THREE.Vector3(kPos.x + cx, 2.2, kPos.z + cz),
          new THREE.Vector3(kPos.x, 0.85, kPos.z),
          12
        )
      );

      const sealRoof = new THREE.Group();
      const pyramid = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.65, 0.65, 4), goldMat);
      pyramid.rotation.y = Math.PI / 4;
      const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), crimsonLacquerMat);
      finial.position.y = 0.55;
      sealRoof.add(pyramid, finial);
      sealRoof.position.set(kPos.x, 6.5, kPos.z);
      group.add(sealRoof);

      return (p, dt, fade = 1) => {
        const rise = Math.min(1, p / 0.34);
        const ease = 1 - Math.pow(1 - rise, 3);
        walls.forEach(w => {
          w.position.y = THREE.MathUtils.lerp(-1.2, 0.82, ease);
          w.scale.y = fade;
        });
        chains.forEach(({ chainGroup }) => {
          chainGroup.scale.setScalar(Math.min(1, p * 2.5) * fade);
        });
        const drop = Math.min(1, Math.max(0, (p - 0.22) / 0.34));
        sealRoof.position.y = THREE.MathUtils.lerp(6.5, 1.95, drop * drop);
        sealRoof.rotation.y = p * 2.2;
        sealRoof.scale.setScalar(fade);
      };
    }

    // =========================================================================
    // 3. 对面笑 (Royal Gaze): 3D 金甲帝王神将法相巍然耸立 + 挥动轩辕巨剑贯通九宫光桥
    // =========================================================================
    if (vfxType === 'royal_gaze') {
      const dist = Math.hypot(kPos.x - rPos.x, kPos.z - rPos.z) || 8;
      const midX = (kPos.x + rPos.x) * 0.5;
      const midZ = (kPos.z + rPos.z) * 0.5;

      const general3D = this.createArticulated3DGeneral(goldMat, crimsonLacquerMat, darkIronMat, goldGlowMat);
      general3D.position.set(kPos.x, 0.05, kPos.z + (kPos.z < 0 ? -1.45 : 1.45));
      general3D.rotation.y = kPos.z < 0 ? 0 : Math.PI;
      general3D.scale.setScalar(1.15);
      group.add(general3D);

      const bridgeBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, dist, 16, 1, true),
        goldGlowMat.clone()
      );
      bridgeBeam.rotation.x = Math.PI / 2;
      bridgeBeam.position.set(midX, 0.62, midZ);
      group.add(bridgeBeam);

      const gates = [0.25, 0.5, 0.75].map((frac) => {
        const gRing = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.065, 12, 32), goldMat);
        gRing.position.set(
          THREE.MathUtils.lerp(rPos.x, kPos.x, frac),
          0.92,
          THREE.MathUtils.lerp(rPos.z, kPos.z, frac)
        );
        group.add(gRing);
        return gRing;
      });

      return (p, dt, fade = 1) => {
        const appear = Math.min(1, p / 0.26);
        general3D.scale.setScalar(1.18 * appear * fade);
        const slashP = Math.min(1, Math.max(0, (p - 0.18) / 0.34));
        general3D.userData.swordArmPivot.rotation.x = THREE.MathUtils.lerp(-1.25, 0.95, slashP * slashP);
        general3D.userData.cape.rotation.x = 0.25 + Math.sin(p * 18) * 0.14;

        const beamP = Math.min(1, p / 0.30);
        bridgeBeam.scale.set(beamP * (0.85 + Math.sin(p * 28) * 0.2), 1, beamP);
        bridgeBeam.material.opacity = 0.88 * fade;
        gates.forEach((g, idx) => {
          const gp = Math.min(1, Math.max(0, (p - idx * 0.08) / 0.25));
          g.scale.setScalar(gp * fade);
          g.rotation.z += dt * (idx % 2 === 0 ? 2.5 : -2.5);
        });
      };
    }

    // =========================================================================
    // 4. 重炮 (Double Cannon): 3D 城墙垛口升起 + 双尊 3D 龙首巨炮先后齐射与后坐力震动
    // =========================================================================
    if (vfxType === 'double_cannon') {
      const startZ = kPos.z + (kPos.z < 0 ? 3.8 : -3.8);
      const dirSign = kPos.z < 0 ? -1 : 1;

      // 3D 城墙垛口基座
      const rampart = new THREE.Group();
      rampart.position.set(kPos.x, 0.22, startZ);
      const wallBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.55, 1.45), bronzeWoodMat);
      rampart.add(wallBody);
      for (let m = -3; m <= 3; m++) {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.24), goldMat);
        merlon.position.set(m * 0.48, 0.38, dirSign * 0.62);
        rampart.add(merlon);
      }
      group.add(rampart);

      const batteries = [-0.95, 0.95].map((ox, idx) => {
        const cModel = this.createArticulated3DCannon(crimsonLacquerMat, goldMat, darkIronMat, goldGlowMat);
        cModel.position.set(kPos.x + ox, 0.45, startZ);
        if (dirSign < 0) cModel.rotation.y = Math.PI;
        group.add(cModel);

        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), crimsonGlowMat.clone());
        group.add(shell);
        return { cModel, shell, ox, delay: idx * 0.16 };
      });

      return (p, dt, fade = 1) => {
        rampart.scale.setScalar(fade);
        batteries.forEach(({ cModel, shell, ox, delay }) => {
          cModel.scale.setScalar(0.95 * fade);
          const sp = Math.max(0, Math.min(1, (p - delay) / 0.46));
          shell.position.set(
            THREE.MathUtils.lerp(kPos.x + ox, kPos.x + ox * 0.15, sp),
            0.75 + Math.sin(sp * Math.PI) * 2.95,
            THREE.MathUtils.lerp(startZ, kPos.z, sp)
          );
          const active = sp > 0.02 && sp < 0.98;
          shell.scale.setScalar(active ? 1.22 * fade : 0.001);
          const recoil = (sp > 0 && sp < 0.28) ? Math.sin(sp * 3.5 * Math.PI) * 0.32 : 0;
          cModel.position.z = startZ - dirSign * recoil;
          cModel.userData.barrelPivot.rotation.x = -0.28 - recoil * 0.45;
        });
      };
    }

    // =========================================================================
    // 5. 马后炮 (Horse Cannon): 前方 3D 金甲战马扬蹄咆哮锁宫 + 后方 3D 巨炮隔马轰顶
    // =========================================================================
    if (vfxType === 'horse_cannon') {
      const startZ = kPos.z + (kPos.z < 0 ? 4.2 : -4.2);
      const dirSign = kPos.z < 0 ? -1 : 1;

      const warHorse = this.createArticulated3DWarHorse(goldMat, crimsonLacquerMat, goldGlowMat);
      warHorse.position.set(cPos.x, 0.05, cPos.z);
      warHorse.lookAt(kPos.x, 0.05, kPos.z);
      group.add(warHorse);

      const rearCannon = this.createArticulated3DCannon(bronzeWoodMat, goldMat, darkIronMat, crimsonGlowMat);
      rearCannon.position.set(kPos.x, 0.08, startZ);
      if (dirSign < 0) rearCannon.rotation.y = Math.PI;
      group.add(rearCannon);

      const lockChain = create3DChainBetween(
        new THREE.Vector3(cPos.x, 0.55, cPos.z),
        new THREE.Vector3(kPos.x, 0.45, kPos.z),
        10
      );

      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), crimsonGlowMat.clone());
      group.add(shell);

      return (p, dt, fade = 1) => {
        const rearUp = Math.sin(Math.min(1, p * 1.6) * Math.PI);
        warHorse.userData.animateGallop(p * 3, rearUp * 0.85);
        warHorse.position.y = 0.05 + rearUp * 0.35;
        warHorse.scale.setScalar(fade);

        rearCannon.scale.setScalar(fade);
        lockChain.chainGroup.scale.setScalar(fade);

        const sp = Math.min(1, Math.max(0, (p - 0.14) / 0.48));
        shell.position.set(
          THREE.MathUtils.lerp(kPos.x, kPos.x, sp),
          0.65 + Math.sin(sp * Math.PI) * 3.2,
          THREE.MathUtils.lerp(startZ, kPos.z, sp)
        );
        shell.scale.setScalar((sp > 0 && sp < 0.98) ? 1.25 * fade : 0.001);
      };
    }

    // =========================================================================
    // 6. 铁门栓 (Iron Bolt): 3D 朱漆椒图宫门合拢 + 3D 巨型玄铁门栓落锁 + 3D 铁链缠绕与重车撞门
    // =========================================================================
    if (vfxType === 'iron_bolt') {
      const gateZ = kPos.z + (kPos.z < 0 ? 1.28 : -1.28);
      const leftDoor = new THREE.Group();
      const rightDoor = new THREE.Group();
      [-1, 1].forEach((dir) => {
        const dGroup = dir === -1 ? leftDoor : rightDoor;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.38, 2.55, 0.22), crimsonLacquerMat);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.46, 2.65, 0.16), goldMat);
        const knocker = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 10, 20), goldMat);
        knocker.position.set(-dir * 0.32, 0.1, 0.14);
        dGroup.add(frame, panel, knocker);
        for (let r = -1; r <= 1; r++) {
          for (let c = -1; c <= 1; c += 2) {
            const stud = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), goldMat);
            stud.position.set(c * 0.36, r * 0.68, 0.13);
            dGroup.add(stud);
          }
        }
        dGroup.position.set(kPos.x + dir * 2.35, 1.32, gateZ);
        group.add(dGroup);
      });

      const ironBolt = new THREE.Group();
      const boltBar = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.36, 0.32), darkIronMat);
      const boltTrim = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.14, 0.36), goldMat);
      ironBolt.add(boltBar, boltTrim);
      ironBolt.position.set(kPos.x, 5.2, gateZ + (kPos.z < 0 ? 0.22 : -0.22));
      group.add(ironBolt);

      const crossChain1 = create3DChainBetween(
        new THREE.Vector3(kPos.x - 1.4, 2.3, gateZ + 0.25),
        new THREE.Vector3(kPos.x + 1.4, 0.3, gateZ + 0.25),
        12
      );
      const crossChain2 = create3DChainBetween(
        new THREE.Vector3(kPos.x + 1.4, 2.3, gateZ + 0.25),
        new THREE.Vector3(kPos.x - 1.4, 0.3, gateZ + 0.25),
        12
      );

      return (p, dt, fade = 1) => {
        const closeP = Math.min(1, p / 0.28);
        const easeC = 1 - Math.pow(1 - closeP, 3);
        leftDoor.position.x = THREE.MathUtils.lerp(kPos.x - 2.35, kPos.x - 0.72, easeC);
        rightDoor.position.x = THREE.MathUtils.lerp(kPos.x + 2.35, kPos.x + 0.72, easeC);
        const boltP = Math.min(1, Math.max(0, (p - 0.22) / 0.22));
        ironBolt.position.y = THREE.MathUtils.lerp(5.2, 1.32, boltP * boltP);
        const chainS = Math.min(1, Math.max(0, (p - 0.32) / 0.22)) * fade;
        crossChain1.chainGroup.scale.setScalar(chainS);
        crossChain2.chainGroup.scale.setScalar(chainS);
        leftDoor.scale.setScalar(fade);
        rightDoor.scale.setScalar(fade);
        ironBolt.scale.setScalar(fade);
      };
    }

    // =========================================================================
    // 7. 侧面虎 (Side Tiger): 3D 斑斓金甲猛虎模型从侧翼飞扑而下 + 巨型3D虎爪撕裂九宫
    // =========================================================================
    if (vfxType === 'side_tiger') {
      const tigerGroup = new THREE.Group();
      const tBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 1.35, 16), goldMat);
      tBody.rotation.z = Math.PI / 2;
      tigerGroup.add(tBody);

      // 猛虎黑纹箍环
      [-0.4, -0.1, 0.2, 0.45].forEach(bx => {
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 8, 20), darkIronMat);
        stripe.rotation.y = Math.PI / 2;
        stripe.position.x = bx;
        tigerGroup.add(stripe);
      });

      // 咆哮虎首与獠牙
      const tHead = new THREE.Group();
      tHead.position.set(0.78, 0.18, 0);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 14), goldMat);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.30), crimsonLacquerMat);
      jaw.position.set(0.18, -0.14, 0);
      [-0.10, 0.10].forEach(fz => {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), goldGlowMat);
        fang.rotation.x = Math.PI;
        fang.position.set(0.28, -0.06, fz);
        tHead.add(fang);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), crimsonGlowMat);
        eye.position.set(0.24, 0.12, fz * 1.6);
        tHead.add(eye);
      });
      tHead.add(skull, jaw);
      tigerGroup.add(tHead);

      // 扑击前爪
      [-0.28, 0.28].forEach(pz => {
        const paw = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.22), goldMat);
        paw.position.set(0.85, -0.22, pz);
        paw.rotation.z = -0.35;
        tigerGroup.add(paw);
      });

      tigerGroup.position.set(kPos.x - 3.6, 2.8, kPos.z);
      group.add(tigerGroup);

      const claws = [];
      for (let i = -2; i <= 2; i++) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(1.75, 0.075, 10, 32, Math.PI * 0.82),
          i % 2 === 0 ? goldGlowMat.clone() : crimsonGlowMat.clone()
        );
        arc.position.set(kPos.x + i * 0.32, 0.95, kPos.z);
        arc.rotation.y = 0.65;
        arc.rotation.x = 0.45;
        group.add(arc);
        claws.push({ arc, i });
      }
      return (p, dt, fade = 1) => {
        const pounce = Math.min(1, p / 0.38);
        const ease = 1 - Math.pow(1 - pounce, 3);
        tigerGroup.position.x = THREE.MathUtils.lerp(kPos.x - 3.6, kPos.x - 0.35, ease);
        tigerGroup.position.y = THREE.MathUtils.lerp(2.8, 0.85, ease) + Math.sin(ease * Math.PI) * 0.95;
        tigerGroup.rotation.z = THREE.MathUtils.lerp(0.35, -0.28, ease);
        tigerGroup.scale.setScalar(fade);

        claws.forEach(({ arc, i }) => {
          arc.rotation.z = -1.2 + pounce * 2.5 + i * 0.08;
          arc.scale.setScalar((0.65 + pounce * 0.65) * fade);
          arc.material.opacity = Math.sin(Math.min(1, p * 1.2) * Math.PI) * 0.92 * fade;
        });
      };
    }

    // =========================================================================
    // 8. 八角马 (Octagon Horse): 3D 明月升空 + 3D 银甲神驹驻守士角 + 八杆3D蟠龙银枪合围锁宫
    // =========================================================================
    if (vfxType === 'octagon_horse') {
      const moonSphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.15, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xfef9c3, transparent: true, opacity: 0.92 })
      );
      moonSphere.position.set(kPos.x, 3.8, kPos.z + (kPos.z < 0 ? -1.8 : 1.8));
      group.add(moonSphere);

      const octagonHorse = this.createArticulated3DWarHorse(goldMat, darkIronMat, goldGlowMat);
      octagonHorse.position.set(cPos.x, 0.05, cPos.z);
      octagonHorse.lookAt(kPos.x, 0.05, kPos.z);
      group.add(octagonHorse);

      const pillars = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const pGroup = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.8, 12), goldMat);
        const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.38, 10), crimsonLacquerMat);
        tassel.position.y = 1.25;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 6), goldGlowMat.clone());
        tip.position.y = 1.65;
        pGroup.add(shaft, tassel, tip);
        pGroup.position.set(kPos.x + Math.cos(a) * 2.35, 1.4, kPos.z + Math.sin(a) * 2.35);
        group.add(pGroup);
        pillars.push({ pGroup, a });
      }
      const moonHalo = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.06, 12, 48), goldGlowMat.clone());
      moonHalo.rotation.x = Math.PI / 2;
      moonHalo.position.set(kPos.x, 2.45, kPos.z);
      group.add(moonHalo);

      return (p, dt, fade = 1) => {
        octagonHorse.userData.animateGallop(p * 3.5, Math.sin(p * Math.PI) * 0.72);
        octagonHorse.scale.setScalar(fade);
        moonSphere.scale.setScalar((0.85 + Math.sin(p * Math.PI) * 0.25) * fade);

        const lock = Math.min(1, p / 0.38);
        const rad = THREE.MathUtils.lerp(2.55, 1.55, lock);
        pillars.forEach(({ pGroup, a }) => {
          const curA = a + p * 1.4;
          pGroup.position.x = kPos.x + Math.cos(curA) * rad;
          pGroup.position.z = kPos.z + Math.sin(curA) * rad;
          pGroup.scale.setScalar(fade);
        });
        moonHalo.scale.setScalar((rad / 2.15) * fade);
        moonHalo.material.opacity = 0.88 * fade;
      };
    }

    // =========================================================================
    // 9. 钓鱼马 (Fishing Horse): 3D 碧海漩涡巨浪 + 3D 黄金钓竿金钩垂降 + 3D 战马与碧海蛟龙破浪
    // =========================================================================
    if (vfxType === 'fishing_horse') {
      const fishHorse = this.createArticulated3DWarHorse(jadeIceMat, goldMat, goldGlowMat);
      fishHorse.position.set(cPos.x, 0.05, cPos.z);
      fishHorse.lookAt(kPos.x, 0.05, kPos.z);
      group.add(fishHorse);

      const waterRings = [];
      for (let i = 0; i < 5; i++) {
        const wr = new THREE.Mesh(
          new THREE.TorusGeometry(0.60 + i * 0.42, 0.055, 12, 42),
          jadeIceMat
        );
        wr.rotation.x = Math.PI / 2;
        wr.position.set(kPos.x, 0.10 + i * 0.14, kPos.z);
        group.add(wr);
        waterRings.push({ wr, i });
      }

      const rodGroup = new THREE.Group();
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.095, 14, 32, Math.PI * 1.4), goldMat);
      const barb = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 8), goldGlowMat);
      barb.position.set(-0.45, 0.15, 0);
      barb.rotation.z = -0.45;
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.8, 8), goldGlowMat.clone());
      line.position.y = 2.1;
      rodGroup.add(hook, barb, line);
      rodGroup.position.set(kPos.x, 4.8, kPos.z);
      group.add(rodGroup);

      return (p, dt, fade = 1) => {
        fishHorse.userData.animateGallop(p * 3.2, 0.45);
        fishHorse.scale.setScalar(fade);
        waterRings.forEach(({ wr, i }) => {
          wr.rotation.z -= dt * (4.2 - i * 0.5);
          const sc = (0.88 + Math.sin(p * 12 + i) * 0.15) * fade;
          wr.scale.set(sc, sc, 1);
        });
        const drop = p < 0.42 ? (p / 0.42) : (1 - (p - 0.42) * 0.55);
        rodGroup.position.y = THREE.MathUtils.lerp(4.8, 0.85, Math.min(1, Math.max(0, drop)));
        rodGroup.rotation.y += dt * 2.5;
        rodGroup.scale.setScalar(fade);
      };
    }

    // =========================================================================
    // 10. 列马车 (Standing Horse Chariot): 3D 断崖石台与赤日 + 3D 战马与 3D 战车并列冲锋斩将
    // =========================================================================
    if (vfxType === 'standing_horse_chariot') {
      const sunSphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.25, 24, 24),
        crimsonGlowMat.clone()
      );
      sunSphere.position.set(kPos.x, 3.4, kPos.z + (kPos.z < 0 ? -1.8 : 1.8));
      group.add(sunSphere);

      const horse3D = this.createArticulated3DWarHorse(crimsonLacquerMat, goldMat, goldGlowMat);
      horse3D.position.set(kPos.x - 1.05, 0.05, kPos.z + (kPos.z < 0 ? 3.2 : -3.2));
      horse3D.lookAt(kPos.x - 0.65, 0.05, kPos.z);
      group.add(horse3D);

      const chariot3D = this.createArticulated3DWarChariot(bronzeWoodMat, goldMat, darkIronMat, crimsonGlowMat);
      chariot3D.position.set(kPos.x + 1.05, 0.05, kPos.z + (kPos.z < 0 ? 3.2 : -3.2));
      chariot3D.lookAt(kPos.x + 0.65, 0.05, kPos.z);
      group.add(chariot3D);

      return (p, dt, fade = 1) => {
        const strike = Math.min(1, p / 0.42);
        const ease = 1 - Math.pow(1 - strike, 3);
        const startZ = kPos.z + (kPos.z < 0 ? 3.2 : -3.2);
        const endZ = kPos.z + (kPos.z < 0 ? 0.85 : -0.85);

        horse3D.position.z = THREE.MathUtils.lerp(startZ, endZ, ease);
        horse3D.userData.animateGallop(p * 4, strike > 0.7 ? 0.75 : 0.2);
        horse3D.scale.setScalar(fade);

        chariot3D.position.z = THREE.MathUtils.lerp(startZ, endZ, ease);
        chariot3D.userData.spinWheels(dt * 18, p * 4);
        chariot3D.scale.setScalar(0.88 * fade);

        sunSphere.scale.setScalar((0.88 + Math.sin(p * Math.PI) * 0.28) * fade);
      };
    }

    // =========================================================================
    // 11. 双将 (Double Check): 3D 擂鼓瓮金双锤 + 3D 轩辕黄金巨剑同时从两路轰砸将门
    // =========================================================================
    if (vfxType === 'double_check') {
      const weapons = [-1, 1].map((dir, idx) => {
        const wGroup = new THREE.Group();
        if (idx === 0) {
          // 擂鼓瓮金锤
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 14), goldMat);
          const studRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 20), crimsonLacquerMat);
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 12), bronzeWoodMat);
          shaft.position.y = -1.4;
          wGroup.add(head, studRing, shaft);
        } else {
          // 黄金破城巨剑
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.8, 4), goldMat);
          blade.rotation.x = Math.PI;
          const guard = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.20, 0.30), crimsonLacquerMat);
          guard.position.y = 1.35;
          const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.85, 10), goldMat);
          hilt.position.y = 1.85;
          wGroup.add(blade, guard, hilt);
        }
        wGroup.position.set(kPos.x + dir * 2.8, 4.2, kPos.z);
        group.add(wGroup);
        return { wGroup, dir };
      });
      return (p, dt, fade = 1) => {
        const strike = Math.min(1, p / 0.34);
        const ease = strike * strike;
        weapons.forEach(({ wGroup, dir }) => {
          wGroup.position.x = THREE.MathUtils.lerp(kPos.x + dir * 2.8, kPos.x + dir * 0.55, ease);
          wGroup.position.y = THREE.MathUtils.lerp(4.2, 1.15, ease);
          wGroup.rotation.z = dir * (1 - ease) * 0.95;
          wGroup.scale.setScalar(fade);
        });
      };
    }

    // =========================================================================
    // 12. 夹车炮 (Chariot Cannon Clamp): 左路 3D 重甲战车与右路 3D 龙首巨炮 + 3D 巨型黄金虎钳合击
    // =========================================================================
    if (vfxType === 'chariot_cannon_clamp') {
      const chariot = this.createArticulated3DWarChariot(bronzeWoodMat, goldMat, darkIronMat, goldGlowMat);
      chariot.position.set(kPos.x - 3.6, 0.05, kPos.z);
      chariot.rotation.y = Math.PI / 2;
      group.add(chariot);

      const cannon = this.createArticulated3DCannon(crimsonLacquerMat, goldMat, darkIronMat, crimsonGlowMat);
      cannon.position.set(kPos.x + 3.6, 0.05, kPos.z);
      cannon.rotation.y = -Math.PI / 2;
      group.add(cannon);

      const jaws = [-1, 1].map((dir) => {
        const jGroup = new THREE.Group();
        const arc = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.19, 14, 32, Math.PI * 0.85), goldMat);
        arc.rotation.x = Math.PI / 2;
        arc.rotation.z = dir === 1 ? -Math.PI * 0.42 : Math.PI * 0.58;
        jGroup.add(arc);
        jGroup.position.set(kPos.x + dir * 2.6, 0.52, kPos.z);
        group.add(jGroup);
        return { jGroup, dir };
      });
      return (p, dt, fade = 1) => {
        const clamp = Math.min(1, p / 0.38);
        const ease = 1 - Math.pow(1 - clamp, 3);
        chariot.position.x = THREE.MathUtils.lerp(kPos.x - 3.6, kPos.x - 1.45, ease);
        chariot.userData.spinWheels(dt * 16, p * 4);
        chariot.scale.setScalar(0.85 * fade);

        cannon.position.x = THREE.MathUtils.lerp(kPos.x + 3.6, kPos.x + 1.45, ease);
        cannon.scale.setScalar(0.88 * fade);

        jaws.forEach(({ jGroup, dir }) => {
          jGroup.position.x = THREE.MathUtils.lerp(kPos.x + dir * 2.6, kPos.x + dir * 0.42, ease);
          jGroup.scale.setScalar(fade);
        });
      };
    }

    // =========================================================================
    // 13. 卧槽马 (Trough Horse): 3D 雕梁金门马槽 + 3D 赤兔神驹腾空跃槽踏碎木栅 + 镇国金印轰落
    // =========================================================================
    if (vfxType === 'trough_horse') {
      const troughHorse = this.createArticulated3DWarHorse(crimsonLacquerMat, goldMat, goldGlowMat);
      troughHorse.position.set(cPos.x, 0.05, cPos.z);
      troughHorse.lookAt(kPos.x, 0.05, kPos.z);
      group.add(troughHorse);

      const sealGroup = new THREE.Group();
      const sealBlock = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.92, 1.36), goldMat);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 14), crimsonLacquerMat);
      knob.position.y = 0.62;
      sealGroup.add(sealBlock, knob);
      sealGroup.position.set(kPos.x, 6.4, kPos.z);
      group.add(sealGroup);

      const troughBars = [-0.85, 0.85].map((oz) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.24, 0.24), bronzeWoodMat);
        bar.position.set(kPos.x, 0.35, kPos.z + oz);
        group.add(bar);
        return { bar, oz };
      });

      return (p, dt, fade = 1) => {
        const leap = Math.min(1, p / 0.45);
        troughHorse.position.lerpVectors(
          new THREE.Vector3(cPos.x, 0.05, cPos.z),
          new THREE.Vector3(kPos.x, 0.05, kPos.z + (kPos.z < 0 ? 0.95 : -0.95)),
          leap
        );
        troughHorse.position.y = 0.05 + Math.sin(leap * Math.PI) * 1.85;
        troughHorse.userData.animateGallop(p * 4, Math.sin(leap * Math.PI) * 0.65);
        troughHorse.scale.setScalar(fade);

        const slam = Math.min(1, Math.max(0, (p - 0.18) / 0.30));
        sealGroup.position.y = THREE.MathUtils.lerp(6.4, 1.28, slam * slam);
        sealGroup.rotation.y = p * 1.8;
        sealGroup.scale.setScalar(fade);

        troughBars.forEach(({ bar, oz }) => {
          if (p > 0.28) {
            const burst = (p - 0.28) / 0.72;
            bar.position.z = kPos.z + oz * (1 + burst * 1.6);
            bar.position.y = 0.35 + Math.sin(burst * Math.PI) * 0.85;
            bar.rotation.x = burst * 4.2;
          }
          bar.scale.setScalar(fade);
        });
      };
    }

    // =========================================================================
    // 14. 闷杀 (Smothered Kill): 3D 玄铁陨星重锤带立体锁链轰然砸落 + 四周玄铁尖刺合拢
    // =========================================================================
    if (vfxType === 'smothered_kill') {
      const cageGroup = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.22, 1), darkIronMat);
      const wire = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.28, 1),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.92 })
      );
      cageGroup.add(core, wire);
      cageGroup.position.set(kPos.x, 7.6, kPos.z);
      group.add(cageGroup);

      const topChain = create3DChainBetween(
        new THREE.Vector3(kPos.x, 9.5, kPos.z),
        new THREE.Vector3(kPos.x, 2.2, kPos.z),
        14
      );

      return (p, dt, fade = 1) => {
        const fall = Math.min(1, p / 0.34);
        cageGroup.position.y = THREE.MathUtils.lerp(7.6, 1.55, fall * fall);
        cageGroup.rotation.y += dt * 3.2;
        cageGroup.rotation.x += dt * 2.1;
        cageGroup.scale.setScalar(fade);
        topChain.chainGroup.scale.setScalar(fall * fade);
      };
    }

    // =========================================================================
    // 15. 天地炮 (Heaven Earth Cannon): 中路与底线双尊 3D 巨炮 + 九天乾坤火轮与十字天火光柱
    // =========================================================================
    if (vfxType === 'heaven_earth_cannon') {
      const skyCannon = this.createArticulated3DCannon(crimsonLacquerMat, goldMat, darkIronMat, goldGlowMat);
      skyCannon.position.set(kPos.x, 0.05, kPos.z + (kPos.z < 0 ? 3.6 : -3.6));
      if (kPos.z < 0) skyCannon.rotation.y = Math.PI;
      group.add(skyCannon);

      const earthCannon = this.createArticulated3DCannon(bronzeWoodMat, goldMat, darkIronMat, crimsonGlowMat);
      earthCannon.position.set(kPos.x + 3.2, 0.05, kPos.z);
      earthCannon.rotation.y = -Math.PI / 2;
      group.add(earthCannon);

      const skyRing = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.09, 12, 48), goldGlowMat.clone());
      skyRing.rotation.x = Math.PI / 2;
      skyRing.position.set(kPos.x, 3.6, kPos.z);

      const verticalPillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.85, 6.5, 24, 1, true),
        crimsonGlowMat.clone()
      );
      verticalPillar.position.set(kPos.x, 3.25, kPos.z);

      const crossX = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.20, 0.38), crimsonGlowMat.clone());
      crossX.position.set(kPos.x, 0.24, kPos.z);
      const crossZ = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.20, 9.2), goldGlowMat.clone());
      crossZ.position.set(kPos.x, 0.26, 0);
      group.add(skyRing, verticalPillar, crossX, crossZ);

      return (p, dt, fade = 1) => {
        skyCannon.scale.setScalar(0.88 * fade);
        earthCannon.scale.setScalar(0.88 * fade);
        skyRing.rotation.z -= dt * 3.8;
        skyRing.position.y = THREE.MathUtils.lerp(4.2, 0.45, Math.min(1, p * 1.6));
        skyRing.scale.setScalar((0.8 + p * 0.9) * fade);

        const pulse = (0.72 + Math.sin(p * 26) * 0.28) * fade;
        verticalPillar.scale.set(pulse, 1, pulse);
        verticalPillar.material.opacity = 0.72 * fade;
        crossX.scale.set(1, pulse, pulse);
        crossZ.scale.set(pulse, pulse, 1);
        crossX.material.opacity = 0.88 * fade;
        crossZ.material.opacity = 0.88 * fade;
      };
    }

    // =========================================================================
    // 16. 困毙 (Stalemate Trap): 八座 3D 浮雕八卦石碑升起合拢 + 顶部八卦乾坤金环旋转镇压
    // =========================================================================
    if (vfxType === 'stalemate_trap') {
      const monoliths = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const slab = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 2.35, 0.28), darkIronMat);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.22, 0.34), goldMat);
        trim.position.y = 1.12;
        const trigramBar = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.32), goldGlowMat);
        trigramBar.position.y = 0.35;
        slab.add(body, trim, trigramBar);
        slab.position.set(kPos.x + Math.cos(a) * 2.55, 1.18, kPos.z + Math.sin(a) * 2.55);
        slab.rotation.y = -a + Math.PI / 2;
        group.add(slab);
        monoliths.push({ slab, a });
      }
      const topOctagon = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.55, 8), goldMat);
      topOctagon.rotation.x = -Math.PI / 2;
      topOctagon.position.set(kPos.x, 2.45, kPos.z);
      group.add(topOctagon);

      return (p, dt, fade = 1) => {
        const closeIn = Math.min(1, p / 0.46);
        const rad = THREE.MathUtils.lerp(2.65, 1.36, closeIn);
        monoliths.forEach(({ slab, a }) => {
          slab.position.x = kPos.x + Math.cos(a) * rad;
          slab.position.z = kPos.z + Math.sin(a) * rad;
          slab.scale.setScalar(fade);
        });
        topOctagon.rotation.z += dt * 1.8;
        topOctagon.scale.setScalar((rad / 1.55) * fade);
      };
    }

    // =========================================================================
    // 17. 海底捞月 (Frost Lotus Strike): 多层 3D 冰晶莲花花瓣绽放 + 3D 沧海明月自海底升起
    // =========================================================================
    const lotusGroup = new THREE.Group();
    lotusGroup.position.set(kPos.x, 0.12, kPos.z);
    group.add(lotusGroup);

    const innerPetals = [];
    const outerPetals = [];
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const pInner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.85, 6), jadeIceMat);
      pInner.position.set(Math.cos(a) * 0.95, 0.65, Math.sin(a) * 0.95);
      pInner.rotation.z = -Math.cos(a) * 0.42;
      pInner.rotation.x = Math.sin(a) * 0.42;
      lotusGroup.add(pInner);
      innerPetals.push({ mesh: pInner, a });

      const pOuter = new THREE.Mesh(new THREE.ConeGeometry(0.30, 2.35, 6), i % 2 === 0 ? jadeIceMat : goldMat);
      pOuter.position.set(Math.cos(a + Math.PI / 12) * 1.55, 0.55, Math.sin(a + Math.PI / 12) * 1.55);
      pOuter.rotation.z = -Math.cos(a + Math.PI / 12) * 0.72;
      pOuter.rotation.x = Math.sin(a + Math.PI / 12) * 0.72;
      lotusGroup.add(pOuter);
      outerPetals.push({ mesh: pOuter, a: a + Math.PI / 12 });
    }

    const risingMoon = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 24, 24),
      goldGlowMat.clone()
    );
    risingMoon.position.set(kPos.x, 0.2, kPos.z);
    group.add(risingMoon);

    return (p, dt, fade = 1) => {
      const bloom = Math.min(1, p / 0.38);
      lotusGroup.rotation.y += dt * 1.2;
      lotusGroup.scale.setScalar(bloom * fade);
      risingMoon.position.y = THREE.MathUtils.lerp(0.2, 2.35, bloom);
      risingMoon.scale.setScalar((0.85 + Math.sin(p * 14) * 0.15) * fade);
    };
  },

  triggerCheckmateVFX(pattern, winnerColor) {
    this.clearCheckmateVFX();
    this.lastCheckmatePattern = pattern;
    this.lastWinnerColor = winnerColor;

    const vfxType = (pattern.vfxType === 'sea_bottom_moon' ? 'frost_lotus_strike' : pattern.vfxType) || 'frost_lotus_strike';
    const stampTitle = pattern.stampText || (pattern.title || '绝杀').replace(/\s*·.*$/, '');
    const subBannerText = pattern.subBanner || pattern.badge || '古谱名局杀法 · 雷霆绝杀';

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

    const focusX = (cPos.x * 0.28 + kPos.x * 0.72);
    const focusZ = (cPos.z * 0.28 + kPos.z * 0.72);
    const baseTheta = this._savedCamBeforeVFX.spherical.theta;

    const vfxLight = new THREE.PointLight(0xffb700, 4.2, 24, 1.5);
    vfxLight.position.set(kPos.x, 3.8, kPos.z);
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

    const spawn3DBurst = (wx, wy, wz, primaryHex = 0xff5500, secondaryHex = 0xfef08a, count = 56) => {
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

    const sparks2D = Array.from({ length: 64 }, (_, i) => {
      const ang = (i / 64) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const spd = 120 + Math.random() * 420;
      return {
        ang,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 55,
        size: 3.0 + Math.random() * 8.0,
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
            THREE.MathUtils.lerp(0, focusX, ease1 * 0.92),
            THREE.MathUtils.lerp(0, 0.55, ease1),
            THREE.MathUtils.lerp(0.3, focusZ, ease1 * 0.92)
          );
          this.desiredSpherical.radius = THREE.MathUtils.lerp(this._savedCamBeforeVFX.spherical.radius, 9.8, ease1);
          this.desiredSpherical.phi = THREE.MathUtils.lerp(this._savedCamBeforeVFX.spherical.phi, 1.02, ease1);
          this.desiredSpherical.theta = baseTheta + ease1 * 0.22;

          this._activeCheckerMeshes.forEach((item, idx) => {
            if (!item.mesh) return;
            const lift = Math.sin(ease1 * Math.PI * 0.5) * (item.isKing ? 0.35 : 0.92);
            item.mesh.position.set(item.basePos.x, lift, item.basePos.z);
            item.mesh.rotation.y = ease1 * Math.PI * (idx % 2 === 0 ? 2 : -2);
          });

          const shockScale = 1 + ease1 * 8.5;
          groundShockRing.scale.set(shockScale, shockScale, 1);
          groundShockRing.material.opacity = Math.sin(p1 * Math.PI) * 0.90;
          baguaOuter.material.opacity = ease1 * 0.78;
          baguaOuter.rotation.z += dt * 2.2;

          this.drawImperialTopCinematicBar(ctx, w * 0.5, h * 0.11, subBannerText, ease1, '#f59e0b');
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
            spawn3DBurst(kPos.x, 0.35, kPos.z, primaryColor, 0xfef08a, 64);
          }

          // 3D 特写运镜环绕，全方位展现 3D 建模精细动作
          this.desiredSpherical.radius = 9.4 + Math.sin(p2 * Math.PI) * 0.8;
          this.desiredSpherical.phi = 0.98 + Math.cos(p2 * Math.PI) * 0.08;
          this.desiredSpherical.theta = baseTheta + 0.22 + Math.sin(p2 * Math.PI * 1.5) * 0.28;
          crackDisc.material.opacity = Math.min(0.86, p2 * 2.4) * (1 - p2 * 0.22);
          baguaOuter.material.opacity = 0.78 * (1 - p2 * 0.18);
          baguaOuter.rotation.z += dt * 1.6;
          if (updateCustom3D) updateCustom3D(p2, dt, 1.0);

          this.renderImperialHUD2D(ctx, w, h, p2, vfxType, stampTitle, subBannerText);
        } else {
          const p3 = (sec - 2.58) / Math.max(0.01, TOTAL_DURATION - 2.58);
          const ease3 = 1 - Math.pow(1 - p3, 3);
          if (!stage3Triggered) {
            stage3Triggered = true;
            this.triggerScreenFlash();
            this.cameraShake = 0.78;
            spawn3DBurst(kPos.x, 0.45, kPos.z, 0xfbbf24, 0xef4444, 54);
          }

          this.camTarget.lerpVectors(new THREE.Vector3(focusX, 0.55, focusZ), this._savedCamBeforeVFX.target, ease3);
          this.desiredSpherical.radius = THREE.MathUtils.lerp(9.8, this._savedCamBeforeVFX.spherical.radius, ease3);
          this.desiredSpherical.phi = THREE.MathUtils.lerp(1.02, this._savedCamBeforeVFX.spherical.phi, ease3);
          this.desiredSpherical.theta = THREE.MathUtils.lerp(baseTheta + 0.22, this._savedCamBeforeVFX.spherical.theta, ease3);

          const fade3D = Math.max(0, 1 - p3 * 1.45);
          crackDisc.material.opacity = fade3D * 0.75;
          baguaOuter.material.opacity = fade3D * 0.75;
          if (updateCustom3D) updateCustom3D(1.0, dt, fade3D);

          this.renderImperialFinalJueshaSeal2D(ctx, w, h, p3, stampTitle, subBannerText, sparks2D, vfxType);
        }

        vfxLight.intensity = (1 - normT * 0.55) * (4.0 + Math.sin(normT * 36) * 0.9);
        ctx.restore();
      }
    });
  },

  /**
   * 透明 HUD 字幕层：绝不遮挡中央 3D 建模演出，仅在画面四周渲染柔和电影暗角、顶部铭牌与底部 3D 书法杀法名号
   */
  renderImperialHUD2D(ctx, w, h, p, vfxType, stampTitle, subBannerText) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const minDim = Math.min(w, h);

    ctx.save();
    const isIceOrWater = vfxType === 'fishing_horse' || vfxType === 'frost_lotus_strike';
    const vig = ctx.createRadialGradient(cx, cy, minDim * 0.36, cx, cy, Math.max(w, h) * 0.78);
    vig.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.65, 'rgba(0, 0, 0, 0.08)');
    vig.addColorStop(1.0, isIceOrWater ? 'rgba(4, 22, 42, 0.55)' : 'rgba(12, 6, 8, 0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    const accent = isIceOrWater ? '#38bdf8' : '#f59e0b';
    const topBarAlpha = p > 0.86 ? Math.max(0, (1 - p) / 0.14) : Math.min(1, p / 0.14);
    this.drawImperialTopCinematicBar(ctx, cx, h * 0.10, subBannerText, topBarAlpha, accent);

    const slamT = Math.min(1, p / 0.16);
    const slamScale = slamT < 1
      ? THREE.MathUtils.lerp(2.25, 0.98, slamT * slamT)
      : 1.0 + Math.sin((p - 0.16) * 14) * 0.02;
    const titleAlpha = p > 0.86 ? Math.max(0, (1 - p) / 0.14) : 1.0;
    const fontSize = Math.round(Math.min(w * 0.12, h * 0.095, 82));
    const colorPhase = vfxType === 'fishing_horse' ? p : 1.0;
    this.drawImperialBrushTitle(ctx, cx, h * 0.78, stampTitle, fontSize, slamScale, titleAlpha, '', accent, colorPhase);

    ctx.restore();
  },

  renderImperialFinalJueshaSeal2D(ctx, w, h, p3, stampTitle, subBannerText, sparks2D, vfxType = '') {
    const cx = w * 0.5;
    const cy = h * 0.48;
    const fadeOut = p3 > 0.72 ? Math.max(0, 1 - (p3 - 0.72) / 0.28) : 1.0;
    if (fadeOut <= 0.01) return;

    const isIceOrWater = vfxType === 'fishing_horse' || vfxType === 'frost_lotus_strike';

    ctx.save();
    ctx.globalAlpha = fadeOut;

    const ringR = Math.min(w, h) * (0.14 + p3 * 0.42);
    ctx.strokeStyle = isIceOrWater
      ? `rgba(186, 230, 253, ${(1 - p3) * 0.85})`
      : `rgba(254, 240, 138, ${(1 - p3) * 0.85})`;
    ctx.lineWidth = 5 * (1 - p3 * 0.55);
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
      ? THREE.MathUtils.lerp(2.65, 0.96, slamT * slamT)
      : 1.0 + Math.sin((p3 - 0.16) * 18) * 0.018;
    const bigFontSize = Math.round(Math.min(w * 0.19, h * 0.14, 118));
    const finalText = '绝杀';
    const caption = stampTitle && stampTitle !== '绝杀' ? `${stampTitle} · ${subBannerText}` : subBannerText;
    this.drawImperialBrushTitle(ctx, cx, cy, finalText, bigFontSize, slamScale, fadeOut, caption, '#f59e0b', 1.0);

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
