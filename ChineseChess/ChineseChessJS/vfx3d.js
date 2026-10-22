/*************************************************************************
 * 3D ARTICULATED ULTIMATE CHECKMATE CINEMATICS, FULL-SCREEN 3D COLOR
 * GRADING, PIECE-VFX INTERACTION & GRANDMASTER HINT TRAJECTORY MODULE
 * (古谱十七大杀法 · 纯3D精细建模与柔和电影级光影调色演武系统)
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
          opacity: 0.90,
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

  /**
   * 辅助函数：仅在水平面 (Y轴) 朝向目标点，严禁使用 lookAt 造成 X/Z 轴 180度翻转使得战马或猛虎倒立
   */
  faceTargetHorizontally(obj, tx, tz) {
    if (!obj) return;
    const dx = tx - obj.position.x;
    const dz = tz - obj.position.z;
    if (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4) {
      obj.rotation.set(0, Math.atan2(dx, dz), 0);
    } else {
      obj.rotation.set(0, 0, 0);
    }
  },

  /**
   * 17 种绝杀专属 3D 全屏光影调色配置（柔和电影级光感：降低刺眼曝光与高光强度，凸显3D模型层次与古风质感）
   */
  getVFXAtmosphereProfile(vfxType) {
    const profiles = {
      double_chariot: {
        bgHex: 0x1c0a05,
        fogHex: 0x2a1008,
        sunHex: 0xffcf70,
        sunIntensity: 0.78,
        hemiSky: 0xfde68a,
        hemiGround: 0x5c2410,
        hemiIntensity: 0.50,
        pointHex: 0xf97316,
        rimHex: 0xfde047,
        accent: '#f59e0b',
        tintInner: 'rgba(251, 191, 36, 0.05)',
        tintOuter: 'rgba(48, 10, 8, 0.62)',
        cssFilter: 'saturate(1.16) contrast(1.05) brightness(0.95)'
      },
      smothered_palace: {
        bgHex: 0x130d1c,
        fogHex: 0x1e142d,
        sunHex: 0xfbbf24,
        sunIntensity: 0.74,
        hemiSky: 0xfde68a,
        hemiGround: 0x2e104b,
        hemiIntensity: 0.48,
        pointHex: 0xd97706,
        rimHex: 0xc084fc,
        accent: '#fbbf24',
        tintInner: 'rgba(245, 158, 11, 0.05)',
        tintOuter: 'rgba(20, 10, 36, 0.64)',
        cssFilter: 'saturate(1.14) contrast(1.06) brightness(0.94)'
      },
      royal_gaze: {
        bgHex: 0x201105,
        fogHex: 0x311a08,
        sunHex: 0xffe8a3,
        sunIntensity: 0.82,
        hemiSky: 0xfef08a,
        hemiGround: 0x6b300c,
        hemiIntensity: 0.52,
        pointHex: 0xf59e0b,
        rimHex: 0xfef3c7,
        accent: '#fbbf24',
        tintInner: 'rgba(254, 240, 138, 0.06)',
        tintOuter: 'rgba(52, 24, 6, 0.60)',
        cssFilter: 'saturate(1.18) contrast(1.05) brightness(0.95)'
      },
      double_cannon: {
        bgHex: 0x1e0707,
        fogHex: 0x300a0a,
        sunHex: 0xf97316,
        sunIntensity: 0.78,
        hemiSky: 0xfde047,
        hemiGround: 0x5c1515,
        hemiIntensity: 0.48,
        pointHex: 0xdc2626,
        rimHex: 0xfbbf24,
        accent: '#f97316',
        tintInner: 'rgba(239, 68, 68, 0.06)',
        tintOuter: 'rgba(54, 8, 8, 0.64)',
        cssFilter: 'saturate(1.18) contrast(1.06) brightness(0.94)'
      },
      horse_cannon: {
        bgHex: 0x1d0906,
        fogHex: 0x2e100a,
        sunHex: 0xfb923c,
        sunIntensity: 0.76,
        hemiSky: 0xfde68a,
        hemiGround: 0x5c2210,
        hemiIntensity: 0.48,
        pointHex: 0xea580c,
        rimHex: 0xfde047,
        accent: '#f59e0b',
        tintInner: 'rgba(249, 115, 22, 0.05)',
        tintOuter: 'rgba(48, 10, 8, 0.62)',
        cssFilter: 'saturate(1.16) contrast(1.05) brightness(0.95)'
      },
      iron_bolt: {
        bgHex: 0x101420,
        fogHex: 0x192034,
        sunHex: 0xfbbf24,
        sunIntensity: 0.74,
        hemiSky: 0xcbd5e1,
        hemiGround: 0x1e293b,
        hemiIntensity: 0.48,
        pointHex: 0xd97706,
        rimHex: 0x38bdf8,
        accent: '#f59e0b',
        tintInner: 'rgba(251, 191, 36, 0.05)',
        tintOuter: 'rgba(15, 23, 42, 0.64)',
        cssFilter: 'saturate(1.14) contrast(1.06) brightness(0.94)'
      },
      side_tiger: {
        bgHex: 0x1d0c04,
        fogHex: 0x2e1407,
        sunHex: 0xf59e0b,
        sunIntensity: 0.80,
        hemiSky: 0xfde68a,
        hemiGround: 0x5c2210,
        hemiIntensity: 0.50,
        pointHex: 0xea580c,
        rimHex: 0xfde047,
        accent: '#f59e0b',
        tintInner: 'rgba(245, 158, 11, 0.06)',
        tintOuter: 'rgba(52, 16, 6, 0.62)',
        cssFilter: 'saturate(1.18) contrast(1.06) brightness(0.95)'
      },
      octagon_horse: {
        bgHex: 0x091222,
        fogHex: 0x0f1e3a,
        sunHex: 0xbae6fd,
        sunIntensity: 0.76,
        hemiSky: 0xfef3c7,
        hemiGround: 0x172554,
        hemiIntensity: 0.50,
        pointHex: 0x3b82f6,
        rimHex: 0xfde68a,
        accent: '#7dd3fc',
        tintInner: 'rgba(125, 211, 252, 0.06)',
        tintOuter: 'rgba(10, 20, 46, 0.64)',
        cssFilter: 'saturate(1.15) contrast(1.05) brightness(0.95)'
      },
      fishing_horse: {
        bgHex: 0x041624,
        fogHex: 0x07253b,
        sunHex: 0x38bdf8,
        sunIntensity: 0.76,
        hemiSky: 0xbae6fd,
        hemiGround: 0x0c4a6e,
        hemiIntensity: 0.50,
        pointHex: 0x0284c7,
        rimHex: 0xfde68a,
        accent: '#38bdf8',
        tintInner: 'rgba(56, 189, 248, 0.06)',
        tintOuter: 'rgba(4, 24, 42, 0.64)',
        cssFilter: 'saturate(1.16) contrast(1.05) brightness(0.95)'
      },
      standing_horse_chariot: {
        bgHex: 0x200808,
        fogHex: 0x330c0c,
        sunHex: 0xf97316,
        sunIntensity: 0.78,
        hemiSky: 0xfde047,
        hemiGround: 0x5c1616,
        hemiIntensity: 0.50,
        pointHex: 0xdc2626,
        rimHex: 0xfbbf24,
        accent: '#f97316',
        tintInner: 'rgba(239, 68, 68, 0.06)',
        tintOuter: 'rgba(54, 10, 10, 0.64)',
        cssFilter: 'saturate(1.18) contrast(1.06) brightness(0.94)'
      },
      double_check: {
        bgHex: 0x1e0d04,
        fogHex: 0x301406,
        sunHex: 0xfacc15,
        sunIntensity: 0.80,
        hemiSky: 0xfef08a,
        hemiGround: 0x5c2210,
        hemiIntensity: 0.52,
        pointHex: 0xd97706,
        rimHex: 0xef4444,
        accent: '#fde047',
        tintInner: 'rgba(250, 204, 21, 0.06)',
        tintOuter: 'rgba(52, 18, 6, 0.62)',
        cssFilter: 'saturate(1.18) contrast(1.06) brightness(0.95)'
      },
      chariot_cannon_clamp: {
        bgHex: 0x1d0f05,
        fogHex: 0x2e1808,
        sunHex: 0xf59e0b,
        sunIntensity: 0.76,
        hemiSky: 0xfde68a,
        hemiGround: 0x5c280c,
        hemiIntensity: 0.48,
        pointHex: 0xea580c,
        rimHex: 0xfde047,
        accent: '#f59e0b',
        tintInner: 'rgba(245, 158, 11, 0.05)',
        tintOuter: 'rgba(48, 22, 8, 0.62)',
        cssFilter: 'saturate(1.16) contrast(1.05) brightness(0.95)'
      },
      trough_horse: {
        bgHex: 0x1d0906,
        fogHex: 0x2f0f0a,
        sunHex: 0xf59e0b,
        sunIntensity: 0.78,
        hemiSky: 0xfde68a,
        hemiGround: 0x5c1616,
        hemiIntensity: 0.50,
        pointHex: 0xd97706,
        rimHex: 0xef4444,
        accent: '#fbbf24',
        tintInner: 'rgba(251, 191, 36, 0.06)',
        tintOuter: 'rgba(52, 10, 10, 0.62)',
        cssFilter: 'saturate(1.16) contrast(1.05) brightness(0.95)'
      },
      smothered_kill: {
        bgHex: 0x11081a,
        fogHex: 0x1b0e29,
        sunHex: 0xf59e0b,
        sunIntensity: 0.74,
        hemiSky: 0xfde047,
        hemiGround: 0x2e094e,
        hemiIntensity: 0.48,
        pointHex: 0xdc2626,
        rimHex: 0xfbbf24,
        accent: '#f59e0b',
        tintInner: 'rgba(239, 68, 68, 0.05)',
        tintOuter: 'rgba(20, 8, 36, 0.64)',
        cssFilter: 'saturate(1.15) contrast(1.06) brightness(0.94)'
      },
      heaven_earth_cannon: {
        bgHex: 0x210604,
        fogHex: 0x360906,
        sunHex: 0xf97316,
        sunIntensity: 0.80,
        hemiSky: 0xfde68a,
        hemiGround: 0x5c1414,
        hemiIntensity: 0.52,
        pointHex: 0xea580c,
        rimHex: 0xfde047,
        accent: '#f97316',
        tintInner: 'rgba(249, 115, 22, 0.06)',
        tintOuter: 'rgba(56, 8, 8, 0.64)',
        cssFilter: 'saturate(1.18) contrast(1.06) brightness(0.94)'
      },
      stalemate_trap: {
        bgHex: 0x0e151f,
        fogHex: 0x172130,
        sunHex: 0xfbbf24,
        sunIntensity: 0.74,
        hemiSky: 0xcbd5e1,
        hemiGround: 0x1e293b,
        hemiIntensity: 0.48,
        pointHex: 0xd97706,
        rimHex: 0x94a3b8,
        accent: '#fbbf24',
        tintInner: 'rgba(251, 191, 36, 0.05)',
        tintOuter: 'rgba(15, 23, 42, 0.64)',
        cssFilter: 'saturate(1.12) contrast(1.05) brightness(0.94)'
      },
      frost_lotus_strike: {
        bgHex: 0x051624,
        fogHex: 0x09243b,
        sunHex: 0x7dd3fc,
        sunIntensity: 0.76,
        hemiSky: 0xe0f2fe,
        hemiGround: 0x0c4a6e,
        hemiIntensity: 0.50,
        pointHex: 0x0284c7,
        rimHex: 0xfde68a,
        accent: '#38bdf8',
        tintInner: 'rgba(56, 189, 248, 0.06)',
        tintOuter: 'rgba(6, 24, 40, 0.64)',
        cssFilter: 'saturate(1.16) contrast(1.05) brightness(0.95)'
      }
    };
    return profiles[vfxType] || profiles.double_chariot;
  },

  clearCheckmateVFX() {
    this._vfxCustomColorGrading = false;
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
    const boardRooks = [];
    const boardCannons = [];
    const boardHorses = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = this.engine.board[r][c];
        if (!p) continue;
        if (p.type === 'k') {
          if (p.color === BLACK) { kr = r; kc = c; }
          else { wkr = r; wkc = c; }
        } else if (p.color === RED) {
          if (p.type === 'r') boardRooks.push({ r, c, char: p.char || '俥', type: 'r' });
          else if (p.type === 'c') boardCannons.push({ r, c, char: p.char || '炮', type: 'c' });
          else if (p.type === 'n') boardHorses.push({ r, c, char: p.char || '傌', type: 'n' });
        }
      }
    }
    const meta = (typeof CheckmateClassifier !== 'undefined' && CheckmateClassifier.getMetaByType)
      ? CheckmateClassifier.getMetaByType(vfxType)
      : { title: title || '绝杀', stampText: stampText || '绝杀', subBanner: badge || '雷霆绝杀', badge: badge || '绝杀', vfxType };

    const sampleCheckersByType = {
      double_chariot: boardRooks.length >= 2
        ? [boardRooks[0], boardRooks[1]]
        : [{ r: 0, c: 1, char: '俥', type: 'r' }, { r: 1, c: 7, char: '俥', type: 'r' }],
      smothered_palace: [{ r: 1, c: 2, char: '傌', type: 'n' }, { r: 0, c: 3, char: '士', type: 'a' }],
      royal_gaze: [{ r: 1, c: 3, char: '俥', type: 'r' }, { r: wkr, c: wkc, char: '帥', type: 'k' }],
      double_cannon: [{ r: 6, c: 4, char: '炮', type: 'c' }, { r: 3, c: 4, char: '炮', type: 'c' }],
      horse_cannon: [{ r: 2, c: 4, char: '傌', type: 'n' }, { r: 5, c: 4, char: '炮', type: 'c' }],
      iron_bolt: [{ r: 0, c: 8, char: '俥', type: 'r' }, { r: 6, c: 4, char: '炮', type: 'c' }],
      side_tiger: [{ r: 2, c: 6, char: '傌', type: 'n' }, { r: 0, c: 7, char: '俥', type: 'r' }],
      octagon_horse: [{ r: 2, c: 5, char: '傌', type: 'n' }, { r: 0, c: 8, char: '俥', type: 'r' }],
      fishing_horse: [{ r: 2, c: 6, char: '傌', type: 'n' }, { r: 0, c: 8, char: '俥', type: 'r' }],
      standing_horse_chariot: [{ r: 2, c: 3, char: '傌', type: 'n' }, { r: 0, c: 3, char: '俥', type: 'r' }],
      double_check: [{ r: 3, c: 3, char: '俥', type: 'r' }, { r: 7, c: 4, char: '炮', type: 'c' }],
      chariot_cannon_clamp: [{ r: 1, c: 2, char: '俥', type: 'r' }, { r: 0, c: 1, char: '炮', type: 'c' }],
      trough_horse: [{ r: 1, c: 2, char: '傌', type: 'n' }, { r: 1, c: 6, char: '俥', type: 'r' }],
      smothered_kill: [{ r: 0, c: 7, char: '炮', type: 'c' }],
      heaven_earth_cannon: [{ r: 5, c: 4, char: '炮', type: 'c' }, { r: 0, c: 7, char: '炮', type: 'c' }],
      stalemate_trap: [{ r: 1, c: 4, char: '兵', type: 'p' }],
      frost_lotus_strike: [{ r: 0, c: 3, char: '兵', type: 'p' }, { r: 7, c: 4, char: '俥', type: 'r' }]
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

    const barW = Math.min(520, window.innerWidth * 0.86);
    const barH = 36;
    const grad = ctx.createLinearGradient(-barW * 0.5, 0, barW * 0.5, 0);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
    grad.addColorStop(0.18, 'rgba(18, 12, 10, 0.85)');
    grad.addColorStop(0.5, 'rgba(56, 14, 14, 0.92)');
    grad.addColorStop(0.82, 'rgba(18, 12, 10, 0.85)');
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
    glowGrad.addColorStop(0, isCyanPhase ? 'rgba(56, 189, 248, 0.24)' : 'rgba(245, 158, 11, 0.22)');
    glowGrad.addColorStop(0.55, isCyanPhase ? 'rgba(14, 116, 144, 0.10)' : 'rgba(180, 83, 9, 0.10)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, glowW * 0.55, fontSize * 0.62, -0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = isCyanPhase ? '#7dd3fc' : '#fef08a';
    ctx.shadowColor = isCyanPhase ? '#0284c7' : accentColor;
    ctx.shadowBlur = 12;
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

      ctx.shadowColor = 'rgba(0, 0, 0, 0.90)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 5;
      ctx.lineWidth = Math.max(5, fontSize * 0.09);
      ctx.strokeStyle = isCyanPhase ? '#082f49' : '#3b1106';
      ctx.strokeText(ch, 0, 0);

      ctx.shadowColor = isCyanPhase ? '#38bdf8' : accentColor;
      ctx.shadowBlur = 14;
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

  createArticulated3DWarHorse(bodyMat, armorMat, glowMat) {
    const horse = new THREE.Group();
    const bodyPivot = new THREE.Group();
    horse.add(bodyPivot);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 1.15, 16), bodyMat);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.72, 0);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 14), bodyMat);
    chest.position.set(0, 0.76, 0.50);
    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 14), bodyMat);
    hip.position.set(0, 0.74, -0.50);
    bodyPivot.add(torso, chest, hip);

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.54), armorMat);
    saddle.position.set(0, 0.96, 0.02);
    const saddleCloth = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.28, 0.62), glowMat);
    saddleCloth.position.set(0, 0.84, 0.02);
    const bardingFront = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.35, 0.34, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9), armorMat);
    bardingFront.position.set(0, 0.74, 0.42);
    bodyPivot.add(saddle, saddleCloth, bardingFront);

    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.86, 0.46);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.23, 0.68, 14), bodyMat);
    neck.position.set(0, 0.28, 0.16);
    neck.rotation.x = 0.48;
    neckPivot.add(neck);

    for (let m = 0; m < 6; m++) {
      const maneFin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 6), glowMat);
      maneFin.position.set(0, 0.10 + m * 0.10, 0.01 + m * 0.04);
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
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), glowMat);
      eye.position.set(ex * 1.45, 0.04, 0.08);
      headGroup.add(eye);
    });
    headGroup.add(skull, snout, chanfron);
    neckPivot.add(headGroup);
    bodyPivot.add(neckPivot);

    const createLeg = (lx, lz, isFront) => {
      const hipJoint = new THREE.Group();
      hipJoint.position.set(lx, 0.64, lz);
      const upperLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.072, 0.38, 10), bodyMat);
      upperLeg.position.y = -0.18;
      hipJoint.add(upperLeg);

      const kneeJoint = new THREE.Group();
      kneeJoint.position.y = -0.36;
      const lowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.055, 0.36, 10), bodyMat);
      lowerLeg.position.y = -0.17;
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.098, 0.10, 10), armorMat);
      hoof.position.y = -0.35;
      kneeJoint.add(lowerLeg, hoof);
      hipJoint.add(kneeJoint);
      bodyPivot.add(hipJoint);
      return { hipJoint, kneeJoint, isFront };
    };

    const flLeg = createLeg(-0.19, 0.44, true);
    const frLeg = createLeg(0.19, 0.44, true);
    const blLeg = createLeg(-0.19, -0.44, false);
    const brLeg = createLeg(0.19, -0.44, false);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.78, -0.62);
    const tailMain = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.72, 10), glowMat);
    tailMain.rotation.x = -Math.PI * 0.68;
    tailMain.position.set(0, -0.12, -0.28);
    tailPivot.add(tailMain);
    bodyPivot.add(tailPivot);

    horse.userData = {
      bodyPivot,
      neckPivot,
      headGroup,
      tailPivot,
      legs: [flLeg, frLeg, blLeg, brLeg],
      animateGallop(time, rearUp = 0) {
        const clampedRear = Math.max(-0.35, Math.min(1.1, rearUp));
        bodyPivot.rotation.set(-clampedRear * 0.56, 0, 0);
        bodyPivot.position.set(0, Math.max(0, clampedRear) * 0.24, 0);
        neckPivot.rotation.x = Math.sin(time * 14) * 0.14 + clampedRear * 0.28;
        headGroup.rotation.x = Math.cos(time * 14) * 0.12;
        tailPivot.rotation.x = Math.sin(time * 16) * 0.25 + clampedRear * 0.32;
        flLeg.hipJoint.rotation.x = Math.sin(time * 15) * 0.65 - clampedRear * 0.52;
        flLeg.kneeJoint.rotation.x = Math.max(0, Math.cos(time * 15) * 0.62) + clampedRear * 0.72;
        frLeg.hipJoint.rotation.x = Math.sin(time * 15 + Math.PI * 0.6) * 0.65 - clampedRear * 0.42;
        frLeg.kneeJoint.rotation.x = Math.max(0, Math.cos(time * 15 + Math.PI * 0.6) * 0.62) + clampedRear * 0.62;
        blLeg.hipJoint.rotation.x = Math.sin(time * 15 + Math.PI) * 0.55 + clampedRear * 0.40;
        blLeg.kneeJoint.rotation.x = -Math.max(0, Math.sin(time * 15) * 0.45);
        brLeg.hipJoint.rotation.x = Math.sin(time * 15 + Math.PI * 1.6) * 0.55 + clampedRear * 0.40;
        brLeg.kneeJoint.rotation.x = -Math.max(0, Math.sin(time * 15 + 0.6) * 0.45);
      }
    };
    return horse;
  },

  createArticulated3DTiger(goldMat, stripeMat, crimsonMat, fangMat, glowMat) {
    const tiger = new THREE.Group();
    const bodyPivot = new THREE.Group();
    tiger.add(bodyPivot);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 16), goldMat);
    chest.scale.set(1.05, 1.08, 1.22);
    chest.position.set(0, 0.78, 0.48);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.30, 1.22, 18), goldMat);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.78, -0.02);

    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 14), goldMat);
    pelvis.scale.set(1.0, 1.04, 1.15);
    pelvis.position.set(0, 0.78, -0.56);

    for (let s = 0; s < 5; s++) {
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.18, 6), glowMat);
      spine.position.set(0, 1.12 - s * 0.015, 0.45 - s * 0.22);
      spine.rotation.x = -0.35;
      bodyPivot.add(spine);
    }

    [-0.46, -0.30, -0.14, 0.02, 0.18, 0.34, 0.50].forEach((bz, idx) => {
      const r = bz > 0.2 ? 0.37 : (bz < -0.25 ? 0.32 : 0.34);
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.032, 8, 24, Math.PI * 1.35),
        stripeMat
      );
      stripe.rotation.z = Math.PI * 0.32 + (idx % 2 === 0 ? 0.08 : -0.08);
      stripe.position.set(0, 0.79, bz);
      bodyPivot.add(stripe);
    });
    bodyPivot.add(chest, torso, pelvis);

    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.88, 0.76);
    bodyPivot.add(neckPivot);

    const neckMane = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.40, 0.32, 16), goldMat);
    neckMane.rotation.x = Math.PI / 2 - 0.25;
    neckMane.position.set(0, 0.04, 0.10);
    neckPivot.add(neckMane);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.10, 0.26);
    neckPivot.add(headGroup);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 16), goldMat);
    cranium.scale.set(1.14, 0.98, 1.05);
    headGroup.add(cranium);

    [-1, 1].forEach(side => {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 12), goldMat);
      cheek.scale.set(1.15, 0.88, 0.85);
      cheek.position.set(side * 0.22, -0.06, 0.12);
      headGroup.add(cheek);

      for (let t = 0; t < 3; t++) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 5), goldMat);
        tuft.position.set(side * (0.34 + t * 0.02), -0.02 - t * 0.06, 0.02);
        tuft.rotation.z = -side * (1.15 + t * 0.15);
        headGroup.add(tuft);
      }

      const earOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14), goldMat);
      earOuter.rotation.x = Math.PI / 2;
      earOuter.rotation.z = -side * 0.35;
      earOuter.position.set(side * 0.25, 0.28, -0.06);
      const earInner = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.075, 12), crimsonMat);
      earInner.rotation.x = Math.PI / 2;
      earInner.rotation.z = -side * 0.35;
      earInner.position.set(side * 0.25, 0.28, -0.05);
      headGroup.add(earOuter, earInner);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.048, 0.08), stripeMat);
      brow.position.set(side * 0.15, 0.14, 0.28);
      brow.rotation.z = -side * 0.32;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), glowMat);
      eye.position.set(side * 0.15, 0.07, 0.29);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), stripeMat);
      pupil.position.set(side * 0.15, 0.07, 0.33);
      headGroup.add(brow, eye, pupil);

      for (let w = 0; w < 3; w++) {
        const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.34, 6), fangMat);
        whisker.rotation.z = side * (Math.PI / 2 - 0.15 - w * 0.12);
        whisker.rotation.y = side * 0.25;
        whisker.position.set(side * 0.28, -0.06 - w * 0.03, 0.30);
        headGroup.add(whisker);
      }
    });

    const snoutBridge = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.30), goldMat);
    snoutBridge.position.set(0, -0.02, 0.26);
    snoutBridge.rotation.x = 0.18;
    const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.08, 4), crimsonMat);
    noseTip.rotation.x = Math.PI / 2;
    noseTip.rotation.y = Math.PI / 4;
    noseTip.position.set(0, 0.03, 0.42);
    headGroup.add(snoutBridge, noseTip);

    [0.24, 0.19, 0.14].forEach((wy, idx) => {
      const wLen = idx === 1 ? 0.18 : 0.24;
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(wLen, 0.026, 0.04), stripeMat);
      hBar.position.set(0, wy, 0.29 + (2 - idx) * 0.015);
      hBar.rotation.x = -0.35;
      headGroup.add(hBar);
    });
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.13, 0.042), stripeMat);
    vBar.position.set(0, 0.19, 0.305);
    vBar.rotation.x = -0.35;
    headGroup.add(vBar);

    [-0.10, 0.10].forEach(fx => {
      const upperFang = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.20, 8), fangMat);
      upperFang.rotation.x = Math.PI - 0.12;
      upperFang.position.set(fx, -0.15, 0.35);
      headGroup.add(upperFang);
    });

    const jawPivot = new THREE.Group();
    jawPivot.position.set(0, -0.12, 0.14);
    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 0.28), goldMat);
    lowerJaw.position.set(0, -0.04, 0.12);
    const mouthCavity = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.05, 0.24), crimsonMat);
    mouthCavity.position.set(0, 0.01, 0.12);
    [-0.08, 0.08].forEach(fx => {
      const lowerFang = new THREE.Mesh(new THREE.ConeGeometry(0.030, 0.13, 8), fangMat);
      lowerFang.position.set(fx, 0.05, 0.22);
      jawPivot.add(lowerFang);
    });
    jawPivot.add(lowerJaw, mouthCavity);
    jawPivot.rotation.x = 0.48;
    headGroup.add(jawPivot);

    const createTigerLeg = (lx, lz, isFront) => {
      const shoulderJoint = new THREE.Group();
      shoulderJoint.position.set(lx, 0.68, lz);

      const upperLimb = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.105, 0.42, 12), goldMat);
      upperLimb.position.y = -0.18;
      shoulderJoint.add(upperLimb);

      const legStripe = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 16), stripeMat);
      legStripe.rotation.x = Math.PI / 2;
      legStripe.position.y = -0.16;
      shoulderJoint.add(legStripe);

      const elbowJoint = new THREE.Group();
      elbowJoint.position.y = -0.36;
      const lowerLimb = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.085, 0.36, 12), goldMat);
      lowerLimb.position.y = -0.16;
      elbowJoint.add(lowerLimb);

      const pawGroup = new THREE.Group();
      pawGroup.position.set(0, -0.34, 0.05);
      const pawPad = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), goldMat);
      pawPad.scale.set(1.15, 0.55, 1.30);
      pawGroup.add(pawPad);

      [-0.075, -0.025, 0.025, 0.075].forEach(cx => {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.14, 6), fangMat);
        claw.rotation.x = Math.PI * 0.42;
        claw.position.set(cx, -0.01, 0.14);
        pawGroup.add(claw);
      });
      elbowJoint.add(pawGroup);
      shoulderJoint.add(elbowJoint);
      bodyPivot.add(shoulderJoint);
      return { shoulderJoint, elbowJoint, pawGroup, isFront };
    };

    const flLeg = createTigerLeg(-0.26, 0.46, true);
    const frLeg = createTigerLeg(0.26, 0.46, true);
    const blLeg = createTigerLeg(-0.24, -0.50, false);
    const brLeg = createTigerLeg(0.24, -0.50, false);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.84, -0.78);
    const tailSeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.052, 0.55, 10), goldMat);
    tailSeg1.rotation.x = -Math.PI * 0.36;
    tailSeg1.position.set(0, 0.12, -0.24);
    const tailSeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.035, 0.48, 10), stripeMat);
    tailSeg2.rotation.x = -Math.PI * 0.18;
    tailSeg2.position.set(0, 0.34, -0.56);
    tailPivot.add(tailSeg1, tailSeg2);
    bodyPivot.add(tailPivot);

    tiger.userData = {
      bodyPivot,
      neckPivot,
      headGroup,
      jawPivot,
      tailPivot,
      legs: [flLeg, frLeg, blLeg, brLeg],
      animatePounce(time, pouncePhase = 0, swipePhase = 0) {
        const pitch = Math.sin(pouncePhase * Math.PI) * -0.46 + (pouncePhase > 0.65 ? 0.24 : 0);
        bodyPivot.rotation.set(pitch, 0, 0);
        jawPivot.rotation.x = 0.38 + Math.abs(Math.sin(time * 12)) * 0.36;
        neckPivot.rotation.x = -0.15 + Math.sin(time * 10) * 0.12;
        tailPivot.rotation.y = Math.sin(time * 16) * 0.38;
        tailPivot.rotation.x = Math.cos(time * 14) * 0.22;

        flLeg.shoulderJoint.rotation.x = -0.75 - Math.sin(swipePhase * Math.PI) * 0.55;
        flLeg.elbowJoint.rotation.x = 0.45 + Math.cos(swipePhase * Math.PI * 2) * 0.35;
        frLeg.shoulderJoint.rotation.x = -0.65 - Math.cos(swipePhase * Math.PI) * 0.55;
        frLeg.elbowJoint.rotation.x = 0.40 + Math.sin(swipePhase * Math.PI * 2) * 0.35;

        blLeg.shoulderJoint.rotation.x = 0.58 + Math.sin(pouncePhase * Math.PI) * 0.35;
        blLeg.elbowJoint.rotation.x = -0.35;
        brLeg.shoulderJoint.rotation.x = 0.52 + Math.sin(pouncePhase * Math.PI) * 0.35;
        brLeg.elbowJoint.rotation.x = -0.35;
      }
    };
    return tiger;
  },

  createArticulated3DWarChariot(woodMat, goldMat, ironMat, glowMat) {
    const chariot = new THREE.Group();

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

    [-0.36, 0.36].forEach(px => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.45, 10), goldMat);
      pole.rotation.x = Math.PI / 2;
      pole.position.set(px, 0.48, 1.15);
      const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 4), glowMat);
      spearTip.rotation.x = Math.PI / 2;
      spearTip.position.set(px, 0.48, 1.98);
      chariot.add(pole, spearTip);
    });

    const banners = [-0.42, 0.42].map(bx => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.65, 8), goldMat);
      mast.position.set(bx, 1.25, -0.52);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.75, 4, 4), glowMat);
      flag.position.set(bx, 1.62, -0.82);
      flag.rotation.y = Math.PI / 2;
      chariot.add(mast, flag);
      return flag;
    });

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

  createArticulated3DCannon(woodMat, goldMat, ironMat, glowMat) {
    const cannon = new THREE.Group();

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

  createArticulated3DGeneral(goldMat, crimsonMat, ironMat, glowMat) {
    const general = new THREE.Group();

    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.54, 1.15, 16), crimsonMat);
    robe.position.y = 0.62;
    const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.85, 16), goldMat);
    cuirass.position.y = 1.38;
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), glowMat);
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(0, 1.46, 0.38);
    general.add(robe, cuirass, mirror);

    const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.65, 6, 6), crimsonMat);
    cape.position.set(0, 1.18, -0.38);
    cape.rotation.x = 0.22;
    general.add(cape);

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
   * 优化重点：创建时默认设置 group.visible = false，杜绝在第一阶段镜头推近期间提前将3D模型暴露在棋盘上；
   * 仅在进入第二阶段演武时才由主控函数激活 visible = true 并配合入场缓动展开！
   */
  build3DSpectacleForType(vfxType, kPos, cPos, rPos, winnerColor, pattern = null) {
    const group = new THREE.Group();
    group.visible = false;
    this.checkmateVFXGroup.add(group);
    const slashTex = typeof getSlashArcTexture === 'function' ? getSlashArcTexture() : null;

    const wrapUpdater = (fn) => {
      const wrapped = (p, dt, fade = 1) => {
        if (!group.visible && fade > 0.001) group.visible = true;
        fn(p, dt, fade);
      };
      wrapped.spectacleGroup = group;
      return wrapped;
    };

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0x92400e,
      emissiveIntensity: 0.26,
      metalness: 0.86,
      roughness: 0.22
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      emissiveIntensity: 0.18,
      metalness: 0.82,
      roughness: 0.28
    });
    const crimsonLacquerMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0x450a0a,
      emissiveIntensity: 0.24,
      metalness: 0.36,
      roughness: 0.32
    });
    const bronzeWoodMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      emissive: 0x270e04,
      emissiveIntensity: 0.18,
      metalness: 0.42,
      roughness: 0.38
    });
    const ivoryFangMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfef3c7,
      emissiveIntensity: 0.20,
      metalness: 0.22,
      roughness: 0.18
    });
    const jadeIceMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.32,
      metalness: 0.32,
      roughness: 0.18,
      transparent: true,
      opacity: 0.88
    });
    const crimsonGlowMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const goldGlowMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const checkersList = Array.isArray(pattern?.checkers) ? pattern.checkers : [];
    const findCheckerPosByType = (typeChar, fallbackPos) => {
      const found = checkersList.find(ch => ch && ch.type === typeChar && typeof ch.r === 'number' && typeof ch.c === 'number');
      if (found) return gridToWorld(found.r, found.c);
      if (this.engine?.board) {
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 9; c++) {
            const p = this.engine.board[r][c];
            if (p && p.color === winnerColor && (p.isHidden ? (p.posType || p.type) : p.type) === typeChar) {
              return gridToWorld(r, c);
            }
          }
        }
      }
      return fallbackPos;
    };

    const create3DChainBetween = (p1, p2, linkCount = 14) => {
      const chainGroup = new THREE.Group();
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      const normDir = len > 1e-4 ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normDir);
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
    // 1. 双车错 (Double Chariot): 两辆 3D 重甲战车直接从棋盘上两个“车”棋子坐标出发，沿交错弧线疾驰斩将！
    // =========================================================================
    if (vfxType === 'double_chariot') {
      const rookCheckers = checkersList.filter(ch => ch && ch.type === 'r' && typeof ch.r === 'number');
      if (rookCheckers.length < 2 && this.engine?.board) {
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 9; c++) {
            const p = this.engine.board[r][c];
            if (p && p.color === winnerColor && (p.isHidden ? (p.posType || p.type) : p.type) === 'r') {
              if (!rookCheckers.some(rc => rc.r === r && rc.c === c)) {
                rookCheckers.push({ r, c, type: 'r' });
              }
            }
          }
        }
      }

      const startWorld0 = rookCheckers[0]
        ? gridToWorld(rookCheckers[0].r, rookCheckers[0].c)
        : new THREE.Vector3(cPos.x, 0.05, cPos.z);
      const startWorld1 = rookCheckers[1]
        ? gridToWorld(rookCheckers[1].r, rookCheckers[1].c)
        : new THREE.Vector3(kPos.x + (cPos.x <= kPos.x ? 3.2 : -3.2), 0.05, kPos.z + 1.0);

      const chariotUnits = [startWorld0, startWorld1].map((sWorld, idx) => {
        const sign = idx === 0 ? -1 : 1;
        const startV = new THREE.Vector3(sWorld.x, 0.05, sWorld.z);
        const toKing = new THREE.Vector3(kPos.x - startV.x, 0, kPos.z - startV.z);
        if (toKing.length() < 0.8) toKing.set(sign * 2.4, 0, 0.8);
        const dirNorm = toKing.clone().normalize();
        const perpNorm = new THREE.Vector3(-dirNorm.z * sign, 0, dirNorm.x * sign);

        const midV = new THREE.Vector3(
          (startV.x + kPos.x) * 0.5 + perpNorm.x * 1.15,
          0.05,
          (startV.z + kPos.z) * 0.5 + perpNorm.z * 1.15
        );
        const endV = new THREE.Vector3(
          kPos.x + dirNorm.x * 1.15 - perpNorm.x * 0.42,
          0.05,
          kPos.z + dirNorm.z * 1.15 - perpNorm.z * 0.42
        );

        const pathCurve = new THREE.QuadraticBezierCurve3(startV, midV, endV);

        const originPad = new THREE.Mesh(
          new THREE.RingGeometry(0.32, 0.72, 32),
          idx === 0 ? goldGlowMat.clone() : crimsonGlowMat.clone()
        );
        originPad.rotation.x = -Math.PI / 2;
        originPad.position.set(startV.x, 0.038, startV.z);
        group.add(originPad);

        const trackMesh = new THREE.Mesh(
          new THREE.TubeGeometry(pathCurve, 36, 0.075, 8, false),
          (idx === 0 ? goldGlowMat : crimsonGlowMat).clone()
        );
        group.add(trackMesh);

        const ch = this.createArticulated3DWarChariot(
          bronzeWoodMat,
          goldMat,
          darkIronMat,
          idx === 0 ? goldGlowMat : crimsonGlowMat
        );
        ch.scale.setScalar(0.90);
        ch.position.copy(startV);
        const initTan = pathCurve.getTangent(0.02);
        this.faceTargetHorizontally(ch, startV.x + initTan.x, startV.z + initTan.z);
        group.add(ch);

        return { ch, pathCurve, originPad, trackMesh, idx };
      });

      const slashPlanes = [-1, 1].map((dir, idx) => {
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(5.6, 1.35),
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
        plane.rotation.z = dir * 0.58;
        plane.position.set(kPos.x, 0.48 + idx * 0.1, kPos.z);
        group.add(plane);
        return plane;
      });

      return wrapUpdater((p, dt, fade = 1) => {
        const rush = Math.min(1, p / 0.54);
        const ease = 1 - Math.pow(1 - rush, 3);
        chariotUnits.forEach(({ ch, pathCurve, originPad, trackMesh, idx }) => {
          const curPt = pathCurve.getPoint(ease);
          const tan = pathCurve.getTangent(Math.min(0.99, ease));
          ch.position.copy(curPt);
          this.faceTargetHorizontally(ch, curPt.x + tan.x, curPt.z + tan.z);
          ch.userData.spinWheels(dt * 20, p * 4.5);
          ch.scale.setScalar(0.90 * fade);

          originPad.scale.setScalar((1 + Math.sin(p * 14 + idx) * 0.22) * fade);
          originPad.material.opacity = 0.65 * fade;
          trackMesh.material.opacity = Math.sin(Math.min(1, p * 1.35) * Math.PI) * 0.62 * fade;
        });
        slashPlanes.forEach((pl, i) => {
          pl.material.opacity = Math.sin(Math.min(1, Math.max(0, (p - 0.18) * 1.4)) * Math.PI) * 0.68 * fade;
          pl.scale.set(0.55 + ease * 1.35, 0.75 + ease * 0.55, 1);
          pl.rotation.z += (i === 0 ? 1 : -1) * dt * 1.2;
        });
      });
    }

    // =========================================================================
    // 2. 闷宫 (Smothered Palace): 四面 3D 玄铁宫墙拔地而起 + 四方玄铁顶盖不旋转稳稳垂直扣死九宫！
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
        const wall = new THREE.Mesh(new THREE.BoxGeometry(2.86, 1.72, 0.30), darkIronMat);
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.26, 0.40), goldMat);
        topBeam.position.y = 0.90;
        for (let b = -2; b <= 2; b++) {
          const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.34), crimsonLacquerMat);
          merlon.position.set(b * 0.54, 1.14, 0);
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
          new THREE.Vector3(kPos.x + cx, 2.15, kPos.z + cz),
          new THREE.Vector3(kPos.x, 0.85, kPos.z),
          12
        )
      );

      const sealRoof = new THREE.Group();
      const roofRimFrame = new THREE.Mesh(new THREE.BoxGeometry(3.18, 0.24, 3.18), goldMat);
      roofRimFrame.position.y = -0.26;
      const roofInnerPlate = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.20, 2.96), darkIronMat);
      roofInnerPlate.position.y = -0.18;

      const pyramid = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 2.08, 0.72, 4), goldMat);
      pyramid.rotation.y = Math.PI / 4;
      pyramid.position.y = 0.22;

      const topSealBox = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.42, 0.82), crimsonLacquerMat);
      topSealBox.position.y = 0.72;
      const finial = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.46), goldMat);
      finial.position.y = 1.02;

      [[-1.42, -1.42], [1.42, -1.42], [-1.42, 1.42], [1.42, 1.42]].forEach(([px, pz]) => {
        const cornerLatch = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.36), goldMat);
        cornerLatch.position.set(px, -0.32, pz);
        sealRoof.add(cornerLatch);
      });

      sealRoof.add(roofRimFrame, roofInnerPlate, pyramid, topSealBox, finial);
      sealRoof.position.set(kPos.x, 6.2, kPos.z);
      sealRoof.rotation.set(0, 0, 0);
      group.add(sealRoof);

      const sealLockWave = new THREE.Mesh(
        new THREE.RingGeometry(1.4, 2.2, 4),
        goldGlowMat.clone()
      );
      sealLockWave.rotation.x = -Math.PI / 2;
      sealLockWave.rotation.z = Math.PI / 4;
      sealLockWave.position.set(kPos.x, 1.72, kPos.z);
      sealLockWave.material.opacity = 0;
      group.add(sealLockWave);

      return wrapUpdater((p, dt, fade = 1) => {
        const rise = Math.min(1, p / 0.30);
        const easeRise = 1 - Math.pow(1 - rise, 3);
        walls.forEach(w => {
          w.position.y = THREE.MathUtils.lerp(-1.2, 0.84, easeRise);
          w.scale.y = fade;
        });
        chains.forEach(({ chainGroup }) => {
          chainGroup.scale.setScalar(Math.min(1, p * 2.5) * fade);
        });
        const dropRaw = Math.min(1, Math.max(0, (p - 0.24) / 0.32));
        const dropEase = dropRaw < 0.88
          ? (dropRaw / 0.88) * (dropRaw / 0.88)
          : 1.0 - Math.sin(((dropRaw - 0.88) / 0.12) * Math.PI) * 0.03;
        sealRoof.position.set(kPos.x, THREE.MathUtils.lerp(6.2, 1.98, dropEase), kPos.z);
        sealRoof.rotation.set(0, 0, 0);
        sealRoof.scale.setScalar(fade);

        if (dropRaw >= 0.85) {
          const waveP = Math.min(1, (p - 0.50) / 0.35);
          sealLockWave.scale.setScalar((1 + waveP * 1.45) * fade);
          sealLockWave.material.opacity = (1 - waveP) * 0.65 * fade;
        }
      });
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
      this.faceTargetHorizontally(general3D, rPos.x, rPos.z);
      general3D.scale.setScalar(1.15);
      group.add(general3D);

      const bridgeBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.20, 0.20, dist, 16, 1, true),
        goldGlowMat.clone()
      );
      bridgeBeam.rotation.x = Math.PI / 2;
      bridgeBeam.position.set(midX, 0.62, midZ);
      group.add(bridgeBeam);

      const gates = [0.25, 0.5, 0.75].map((frac) => {
        const gRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 12, 32), goldMat);
        gRing.position.set(
          THREE.MathUtils.lerp(rPos.x, kPos.x, frac),
          0.92,
          THREE.MathUtils.lerp(rPos.z, kPos.z, frac)
        );
        group.add(gRing);
        return gRing;
      });

      return wrapUpdater((p, dt, fade = 1) => {
        const appear = Math.min(1, p / 0.26);
        general3D.scale.setScalar(1.18 * appear * fade);
        const slashP = Math.min(1, Math.max(0, (p - 0.18) / 0.34));
        general3D.userData.swordArmPivot.rotation.x = THREE.MathUtils.lerp(-1.25, 0.95, slashP * slashP);
        general3D.userData.cape.rotation.x = 0.25 + Math.sin(p * 18) * 0.14;

        const beamP = Math.min(1, p / 0.30);
        bridgeBeam.scale.set(beamP * (0.85 + Math.sin(p * 28) * 0.16), 1, beamP);
        bridgeBeam.material.opacity = 0.62 * fade;
        gates.forEach((g, idx) => {
          const gp = Math.min(1, Math.max(0, (p - idx * 0.08) / 0.25));
          g.scale.setScalar(gp * fade);
          g.rotation.z += dt * (idx % 2 === 0 ? 2.5 : -2.5);
        });
      });
    }

    // =========================================================================
    // 4. 重炮 (Double Cannon): 3D 城墙垛口升起 + 双尊 3D 龙首巨炮先后齐射与后坐力震动
    // =========================================================================
    if (vfxType === 'double_cannon') {
      const startZ = kPos.z + (kPos.z < 0 ? 3.8 : -3.8);
      const dirSign = kPos.z < 0 ? -1 : 1;

      const rampart = new THREE.Group();
      rampart.position.set(kPos.x, 0.22, startZ);
      const wallBody = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.58, 1.48), bronzeWoodMat);
      rampart.add(wallBody);
      for (let m = -3; m <= 3; m++) {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.24), goldMat);
        merlon.position.set(m * 0.48, 0.40, dirSign * 0.62);
        rampart.add(merlon);
      }
      group.add(rampart);

      const batteries = [-0.95, 0.95].map((ox, idx) => {
        const cModel = this.createArticulated3DCannon(crimsonLacquerMat, goldMat, darkIronMat, goldGlowMat);
        cModel.position.set(kPos.x + ox, 0.45, startZ);
        this.faceTargetHorizontally(cModel, kPos.x + ox * 0.15, kPos.z);
        group.add(cModel);

        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), crimsonGlowMat.clone());
        group.add(shell);
        return { cModel, shell, ox, delay: idx * 0.16 };
      });

      return wrapUpdater((p, dt, fade = 1) => {
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
          shell.scale.setScalar(active ? 1.18 * fade : 0.001);
          const recoil = (sp > 0 && sp < 0.28) ? Math.sin(sp * 3.5 * Math.PI) * 0.34 : 0;
          cModel.position.z = startZ - dirSign * recoil;
          cModel.userData.barrelPivot.rotation.x = -0.28 - recoil * 0.45;
        });
      });
    }

    // =========================================================================
    // 5. 马后炮 (Horse Cannon): 前方 3D 金甲战马扬蹄咆哮锁宫 + 后方 3D 巨炮隔马轰顶
    // =========================================================================
    if (vfxType === 'horse_cannon') {
      const horseOrigin = findCheckerPosByType('n', cPos);
      const cannonOrigin = findCheckerPosByType('c', new THREE.Vector3(kPos.x, 0.05, kPos.z + (kPos.z < 0 ? 4.2 : -4.2)));

      const warHorse = this.createArticulated3DWarHorse(goldMat, crimsonLacquerMat, goldGlowMat);
      warHorse.position.set(horseOrigin.x, 0.05, horseOrigin.z);
      this.faceTargetHorizontally(warHorse, kPos.x, kPos.z);
      group.add(warHorse);

      const rearCannon = this.createArticulated3DCannon(bronzeWoodMat, goldMat, darkIronMat, crimsonGlowMat);
      rearCannon.position.set(cannonOrigin.x, 0.08, cannonOrigin.z);
      this.faceTargetHorizontally(rearCannon, kPos.x, kPos.z);
      group.add(rearCannon);

      const lockChain = create3DChainBetween(
        new THREE.Vector3(horseOrigin.x, 0.55, horseOrigin.z),
        new THREE.Vector3(kPos.x, 0.45, kPos.z),
        10
      );

      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 16), crimsonGlowMat.clone());
      group.add(shell);

      return wrapUpdater((p, dt, fade = 1) => {
        const rearUp = Math.sin(Math.min(1, p * 1.5) * Math.PI) * 0.85;
        warHorse.userData.animateGallop(p * 3.2, rearUp);
        warHorse.position.y = 0.05 + rearUp * 0.30;
        warHorse.scale.setScalar(fade);

        rearCannon.scale.setScalar(fade);
        lockChain.chainGroup.scale.setScalar(fade);

        const sp = Math.min(1, Math.max(0, (p - 0.14) / 0.48));
        shell.position.set(
          THREE.MathUtils.lerp(cannonOrigin.x, kPos.x, sp),
          0.65 + Math.sin(sp * Math.PI) * 3.25,
          THREE.MathUtils.lerp(cannonOrigin.z, kPos.z, sp)
        );
        shell.scale.setScalar((sp > 0 && sp < 0.98) ? 1.20 * fade : 0.001);
        const recoil = (sp > 0 && sp < 0.25) ? Math.sin(sp * 4 * Math.PI) * 0.32 : 0;
        rearCannon.userData.barrelPivot.rotation.x = -0.28 - recoil * 0.5;
      });
    }

    // =========================================================================
    // 6. 铁门栓 (Iron Bolt): 3D 朱漆椒图宫门合拢 + 3D 巨型玄铁门栓落锁 + 3D 铁链缠绕
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

      return wrapUpdater((p, dt, fade = 1) => {
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
      });
    }

    // =========================================================================
    // 7. 侧面虎 (Side Tiger): 精细多关节 3D 斑斓猛虎模型从马位飞扑将门！
    // =========================================================================
    if (vfxType === 'side_tiger') {
      const horseOrigin = findCheckerPosByType('n', new THREE.Vector3(kPos.x + 2.6, 0.05, kPos.z + (kPos.z < 0 ? 1.8 : -1.8)));
      const sideSign = horseOrigin.x >= kPos.x ? 1 : -1;
      const startPos = new THREE.Vector3(
        horseOrigin.x + sideSign * 0.45,
        0.55,
        horseOrigin.z
      );
      const landPos = new THREE.Vector3(
        kPos.x + sideSign * 0.38,
        0.10,
        kPos.z + (kPos.z < 0 ? 0.32 : -0.32)
      );

      const cliffGroup = new THREE.Group();
      cliffGroup.position.set(startPos.x, 0.02, startPos.z);
      for (let rk = 0; rk < 4; rk++) {
        const rock = new THREE.Mesh(
          new THREE.ConeGeometry(0.48 - rk * 0.06, 0.95 + rk * 0.22, 6),
          rk % 2 === 0 ? darkIronMat : bronzeWoodMat
        );
        rock.position.set((rk - 1.5) * 0.28, 0.42, (rk % 2 === 0 ? -0.18 : 0.18));
        cliffGroup.add(rock);
      }
      group.add(cliffGroup);

      const tiger3D = this.createArticulated3DTiger(
        goldMat,
        darkIronMat,
        crimsonLacquerMat,
        ivoryFangMat,
        goldGlowMat
      );
      tiger3D.scale.setScalar(1.18);
      tiger3D.position.copy(startPos);
      this.faceTargetHorizontally(tiger3D, kPos.x, kPos.z);
      group.add(tiger3D);

      const claws = [];
      for (let i = -2; i <= 2; i++) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(1.68, 0.065, 10, 32, Math.PI * 0.84),
          i % 2 === 0 ? goldGlowMat.clone() : crimsonGlowMat.clone()
        );
        arc.position.set(kPos.x + i * 0.28, 0.92, kPos.z);
        arc.rotation.y = sideSign * 0.65;
        arc.rotation.x = 0.45;
        group.add(arc);
        claws.push({ arc, i });
      }

      const roarRings = [0, 1, 2].map(idx => {
        const rr = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 32), goldGlowMat.clone());
        rr.position.set(kPos.x, 0.95, kPos.z);
        rr.rotation.x = -Math.PI / 3;
        group.add(rr);
        return { rr, idx };
      });

      return wrapUpdater((p, dt, fade = 1) => {
        const pounce = Math.min(1, p / 0.44);
        const ease = 1 - Math.pow(1 - pounce, 3);
        const swipe = Math.max(0, (p - 0.32) / 0.68);

        tiger3D.position.x = THREE.MathUtils.lerp(startPos.x, landPos.x, ease);
        tiger3D.position.z = THREE.MathUtils.lerp(startPos.z, landPos.z, ease);
        tiger3D.position.y = THREE.MathUtils.lerp(startPos.y, landPos.y, ease) + Math.sin(ease * Math.PI) * 1.95;
        this.faceTargetHorizontally(tiger3D, kPos.x, kPos.z);
        tiger3D.userData.animatePounce(p * 3.8, ease, swipe);
        tiger3D.scale.setScalar(1.18 * fade);
        cliffGroup.scale.setScalar(fade);

        claws.forEach(({ arc, i }) => {
          const cp = Math.max(0, Math.min(1, (p - 0.22) / 0.48));
          arc.rotation.z = -1.25 + cp * 2.6 + i * 0.08;
          arc.scale.setScalar((0.55 + cp * 0.78) * fade);
          arc.material.opacity = Math.sin(cp * Math.PI) * 0.68 * fade;
        });

        roarRings.forEach(({ rr, idx }) => {
          const rp = Math.max(0, Math.min(1, (p - 0.28 - idx * 0.10) / 0.42));
          rr.scale.setScalar((0.6 + rp * 3.2) * fade);
          rr.material.opacity = Math.sin(rp * Math.PI) * 0.58 * fade;
        });
      });
    }

    // =========================================================================
    // 8. 八角马 (Octagon Horse): 3D 明月升空 + 3D 银甲神驹驻守士角 + 八杆3D蟠龙银枪合围锁宫
    // =========================================================================
    if (vfxType === 'octagon_horse') {
      const horseOrigin = findCheckerPosByType('n', cPos);
      const moonSphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.10, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.78 })
      );
      moonSphere.position.set(kPos.x, 3.8, kPos.z + (kPos.z < 0 ? -1.8 : 1.8));
      group.add(moonSphere);

      const octagonHorse = this.createArticulated3DWarHorse(goldMat, darkIronMat, goldGlowMat);
      octagonHorse.position.set(horseOrigin.x, 0.05, horseOrigin.z);
      this.faceTargetHorizontally(octagonHorse, kPos.x, kPos.z);
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
      const moonHalo = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.055, 12, 48), goldGlowMat.clone());
      moonHalo.rotation.x = Math.PI / 2;
      moonHalo.position.set(kPos.x, 2.45, kPos.z);
      group.add(moonHalo);

      return wrapUpdater((p, dt, fade = 1) => {
        octagonHorse.userData.animateGallop(p * 3.5, Math.sin(p * Math.PI) * 0.72);
        octagonHorse.scale.setScalar(fade);
        moonSphere.scale.setScalar((0.85 + Math.sin(p * Math.PI) * 0.22) * fade);

        const lock = Math.min(1, p / 0.38);
        const rad = THREE.MathUtils.lerp(2.55, 1.55, lock);
        pillars.forEach(({ pGroup, a }) => {
          const curA = a + p * 1.4;
          pGroup.position.x = kPos.x + Math.cos(curA) * rad;
          pGroup.position.z = kPos.z + Math.sin(curA) * rad;
          pGroup.scale.setScalar(fade);
        });
        moonHalo.scale.setScalar((rad / 2.15) * fade);
        moonHalo.material.opacity = 0.65 * fade;
      });
    }

    // =========================================================================
    // 9. 钓鱼马 (Fishing Horse): 3D 碧海漩涡巨浪 + 3D 黄金钓竿金钩垂降 + 3D 战马破浪
    // =========================================================================
    if (vfxType === 'fishing_horse') {
      const horseOrigin = findCheckerPosByType('n', cPos);
      const fishHorse = this.createArticulated3DWarHorse(jadeIceMat, goldMat, goldGlowMat);
      fishHorse.position.set(horseOrigin.x, 0.05, horseOrigin.z);
      this.faceTargetHorizontally(fishHorse, kPos.x, kPos.z);
      group.add(fishHorse);

      const waterRings = [];
      for (let i = 0; i < 6; i++) {
        const wr = new THREE.Mesh(
          new THREE.TorusGeometry(0.55 + i * 0.42, 0.055, 12, 42),
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

      return wrapUpdater((p, dt, fade = 1) => {
        fishHorse.userData.animateGallop(p * 3.2, Math.sin(p * Math.PI) * 0.62);
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
      });
    }

    // =========================================================================
    // 10. 列马车 (Standing Horse Chariot): 3D 断崖石台与赤日 + 3D 战马与 3D 战车并列冲锋斩将
    // =========================================================================
    if (vfxType === 'standing_horse_chariot') {
      const sunSphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.18, 24, 24),
        crimsonGlowMat.clone()
      );
      sunSphere.position.set(kPos.x, 3.4, kPos.z + (kPos.z < 0 ? -1.8 : 1.8));
      group.add(sunSphere);

      const startZ = kPos.z + (kPos.z < 0 ? 3.2 : -3.2);
      const endZ = kPos.z + (kPos.z < 0 ? 0.85 : -0.85);

      const horse3D = this.createArticulated3DWarHorse(crimsonLacquerMat, goldMat, goldGlowMat);
      horse3D.position.set(kPos.x - 1.05, 0.05, startZ);
      this.faceTargetHorizontally(horse3D, kPos.x - 0.65, kPos.z);
      group.add(horse3D);

      const chariot3D = this.createArticulated3DWarChariot(bronzeWoodMat, goldMat, darkIronMat, crimsonGlowMat);
      chariot3D.position.set(kPos.x + 1.05, 0.05, startZ);
      this.faceTargetHorizontally(chariot3D, kPos.x + 0.65, kPos.z);
      group.add(chariot3D);

      return wrapUpdater((p, dt, fade = 1) => {
        const strike = Math.min(1, p / 0.42);
        const ease = 1 - Math.pow(1 - strike, 3);

        horse3D.position.z = THREE.MathUtils.lerp(startZ, endZ, ease);
        horse3D.userData.animateGallop(p * 4, strike > 0.65 ? Math.sin((strike - 0.65) / 0.35 * Math.PI) * 0.78 : 0.22);
        horse3D.scale.setScalar(fade);

        chariot3D.position.z = THREE.MathUtils.lerp(startZ, endZ, ease);
        chariot3D.userData.spinWheels(dt * 18, p * 4);
        chariot3D.scale.setScalar(0.88 * fade);

        sunSphere.scale.setScalar((0.88 + Math.sin(p * Math.PI) * 0.22) * fade);
      });
    }

    // =========================================================================
    // 11. 双将 (Double Check): 从两个将军棋子位置同时激射两柄 3D 蟠龙方天画戟 + 九天轩辕巨剑与八柄飞剑贯顶 + 黑曜金岩崩裂
    // =========================================================================
    if (vfxType === 'double_check') {
      const origin0 = checkersList[0]
        ? gridToWorld(checkersList[0].r, checkersList[0].c)
        : new THREE.Vector3(kPos.x - 3.2, 0.05, kPos.z + 2.2);
      const origin1 = checkersList[1]
        ? gridToWorld(checkersList[1].r, checkersList[1].c)
        : new THREE.Vector3(kPos.x + 3.2, 0.05, kPos.z + 2.2);

      const dualHalberds = [origin0, origin1].map((orig, idx) => {
        const hGroup = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 2.8, 12), goldMat);
        shaft.rotation.x = Math.PI / 2;
        const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.68, 4), goldGlowMat);
        spearTip.rotation.x = Math.PI / 2;
        spearTip.position.z = 1.65;
        [-1, 1].forEach(side => {
          const crescent = new THREE.Mesh(
            new THREE.TorusGeometry(0.34, 0.05, 8, 20, Math.PI * 0.85),
            idx === 0 ? goldMat : crimsonLacquerMat
          );
          crescent.rotation.x = Math.PI / 2;
          crescent.rotation.z = side === 1 ? -Math.PI * 0.42 : Math.PI * 0.58;
          crescent.position.set(side * 0.14, 0, 1.15);
          hGroup.add(crescent);
        });
        hGroup.add(shaft, spearTip);
        hGroup.position.set(orig.x, 0.72, orig.z);
        this.faceTargetHorizontally(hGroup, kPos.x, kPos.z);
        group.add(hGroup);

        const beamCurve = new THREE.LineCurve3(
          new THREE.Vector3(orig.x, 0.22, orig.z),
          new THREE.Vector3(kPos.x, 0.22, kPos.z)
        );
        const beamMesh = new THREE.Mesh(
          new THREE.TubeGeometry(beamCurve, 16, 0.075, 8, false),
          (idx === 0 ? goldGlowMat : crimsonGlowMat).clone()
        );
        group.add(beamMesh);

        return { hGroup, orig, beamMesh, idx };
      });

      const sovereignSword = new THREE.Group();
      const mainBlade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 3.85, 4), goldMat);
      mainBlade.rotation.x = Math.PI;
      mainBlade.scale.set(1.35, 1, 0.38);
      const bladeCoreGlow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 3.65, 4), goldGlowMat.clone());
      bladeCoreGlow.rotation.x = Math.PI;
      bladeCoreGlow.position.y = -0.05;

      const crossGuard = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.26, 0.42), crimsonLacquerMat);
      crossGuard.position.y = 1.92;
      [-1, 1].forEach(dir => {
        const wingHorn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 6), goldMat);
        wingHorn.position.set(dir * 0.96, 2.08, 0);
        wingHorn.rotation.z = -dir * 0.78;
        sovereignSword.add(wingHorn);
      });
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.05, 12), darkIronMat);
      grip.position.y = 2.55;
      const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 1), goldMat);
      pommel.position.y = 3.18;
      sovereignSword.add(mainBlade, bladeCoreGlow, crossGuard, grip, pommel);
      sovereignSword.position.set(kPos.x, 7.2, kPos.z);
      group.add(sovereignSword);

      const spiritSwords = Array.from({ length: 8 }, (_, i) => {
        const sGroup = new THREE.Group();
        const sBlade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1.55, 4), i % 2 === 0 ? goldGlowMat : crimsonGlowMat);
        sBlade.rotation.x = Math.PI;
        const sGuard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.12), goldMat);
        sGuard.position.y = 0.78;
        sGroup.add(sBlade, sGuard);
        group.add(sGroup);
        return { sGroup, baseAngle: (i * Math.PI) / 4 };
      });

      const boulders = Array.from({ length: 16 }, (_, i) => {
        const ang = (i / 16) * Math.PI * 2;
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.22 + (i % 3) * 0.08, 0),
          i % 3 === 0 ? goldMat : (i % 2 === 0 ? darkIronMat : crimsonLacquerMat)
        );
        rock.position.set(kPos.x + Math.cos(ang) * 0.45, 0.18, kPos.z + Math.sin(ang) * 0.45);
        group.add(rock);
        return {
          rock,
          ang,
          spd: 2.2 + (i % 4) * 0.65,
          lift: 1.8 + (i % 3) * 0.75
        };
      });

      return wrapUpdater((p, dt, fade = 1) => {
        const lungeP = Math.min(1, p / 0.34);
        const lungeEase = 1 - Math.pow(1 - lungeP, 3);
        dualHalberds.forEach(({ hGroup, orig, beamMesh }) => {
          hGroup.position.x = THREE.MathUtils.lerp(orig.x, kPos.x, lungeEase * 0.78);
          hGroup.position.z = THREE.MathUtils.lerp(orig.z, kPos.z, lungeEase * 0.78);
          this.faceTargetHorizontally(hGroup, kPos.x, kPos.z);
          hGroup.scale.setScalar(fade);
          beamMesh.material.opacity = Math.sin(Math.min(1, p * 1.6) * Math.PI) * 0.62 * fade;
        });

        const slamP = Math.min(1, Math.max(0, (p - 0.16) / 0.28));
        const slamEase = slamP * slamP;
        sovereignSword.position.y = THREE.MathUtils.lerp(7.2, 1.85, slamEase);
        sovereignSword.scale.setScalar(fade);

        spiritSwords.forEach(({ sGroup, baseAngle }, idx) => {
          const curA = baseAngle + p * 4.5;
          const rad = THREE.MathUtils.lerp(2.4, 1.25, slamEase);
          sGroup.position.set(
            kPos.x + Math.cos(curA) * rad,
            THREE.MathUtils.lerp(5.8 + (idx % 2) * 0.6, 1.35, slamEase),
            kPos.z + Math.sin(curA) * rad
          );
          sGroup.scale.setScalar(fade);
        });

        const burstP = Math.max(0, (p - 0.36) / 0.64);
        boulders.forEach(({ rock, ang, spd, lift }) => {
          if (burstP <= 0) {
            rock.scale.setScalar(0.001);
          } else {
            const dist = 0.45 + burstP * spd;
            rock.position.x = kPos.x + Math.cos(ang) * dist;
            rock.position.z = kPos.z + Math.sin(ang) * dist;
            rock.position.y = Math.max(0.14, 0.25 + Math.sin(burstP * Math.PI) * lift);
            rock.rotation.x += dt * 6;
            rock.rotation.z += dt * 5;
            rock.scale.setScalar((1 - burstP * 0.35) * fade);
          }
        });
      });
    }

    // =========================================================================
    // 12. 夹车炮 (Chariot Cannon Clamp): 左路 3D 重甲战车与右路 3D 龙首巨炮 + 3D 巨型黄金虎钳合击
    // =========================================================================
    if (vfxType === 'chariot_cannon_clamp') {
      const chariot = this.createArticulated3DWarChariot(bronzeWoodMat, goldMat, darkIronMat, goldGlowMat);
      chariot.position.set(kPos.x - 3.6, 0.05, kPos.z);
      this.faceTargetHorizontally(chariot, kPos.x, kPos.z);
      group.add(chariot);

      const cannon = this.createArticulated3DCannon(crimsonLacquerMat, goldMat, darkIronMat, crimsonGlowMat);
      cannon.position.set(kPos.x + 3.6, 0.05, kPos.z);
      this.faceTargetHorizontally(cannon, kPos.x, kPos.z);
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
      return wrapUpdater((p, dt, fade = 1) => {
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
      });
    }

    // =========================================================================
    // 13. 卧槽马 (Trough Horse): 3D 雕梁金门马槽 + 3D 赤兔神驹从马位腾空跃槽踏碎木栅 + 镇国金印轰落
    // =========================================================================
    if (vfxType === 'trough_horse') {
      const horseOrigin = findCheckerPosByType('n', cPos);
      const troughHorse = this.createArticulated3DWarHorse(crimsonLacquerMat, goldMat, goldGlowMat);
      troughHorse.position.set(horseOrigin.x, 0.05, horseOrigin.z);
      this.faceTargetHorizontally(troughHorse, kPos.x, kPos.z);
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

      const targetHorsePos = new THREE.Vector3(kPos.x, 0.05, kPos.z + (kPos.z < 0 ? 0.95 : -0.95));

      return wrapUpdater((p, dt, fade = 1) => {
        const leap = Math.min(1, p / 0.45);
        troughHorse.position.lerpVectors(
          new THREE.Vector3(horseOrigin.x, 0.05, horseOrigin.z),
          targetHorsePos,
          leap
        );
        troughHorse.position.y = 0.05 + Math.sin(leap * Math.PI) * 1.85;
        this.faceTargetHorizontally(troughHorse, kPos.x, kPos.z);
        troughHorse.userData.animateGallop(p * 4, Math.sin(leap * Math.PI) * 0.65);
        troughHorse.scale.setScalar(fade);

        const slam = Math.min(1, Math.max(0, (p - 0.18) / 0.30));
        sealGroup.position.y = THREE.MathUtils.lerp(6.4, 1.28, slam * slam);
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
      });
    }

    // =========================================================================
    // 14. 闷杀 (Smothered Kill): 3D 玄铁陨星重锤带立体锁链轰然砸落 + 四周玄铁尖刺合拢
    // =========================================================================
    if (vfxType === 'smothered_kill') {
      const cageGroup = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.22, 1), darkIronMat);
      const wire = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.28, 1),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.72 })
      );
      cageGroup.add(core, wire);
      cageGroup.position.set(kPos.x, 7.6, kPos.z);
      group.add(cageGroup);

      const topChain = create3DChainBetween(
        new THREE.Vector3(kPos.x, 9.5, kPos.z),
        new THREE.Vector3(kPos.x, 2.2, kPos.z),
        14
      );

      return wrapUpdater((p, dt, fade = 1) => {
        const fall = Math.min(1, p / 0.34);
        cageGroup.position.y = THREE.MathUtils.lerp(7.6, 1.55, fall * fall);
        cageGroup.rotation.y += dt * 3.2;
        cageGroup.rotation.x += dt * 2.1;
        cageGroup.scale.setScalar(fade);
        topChain.chainGroup.scale.setScalar(fall * fade);
      });
    }

    // =========================================================================
    // 15. 天地炮 (Heaven Earth Cannon): 中路天门与底线地户双尊 3D 巨炮齐射 + 火山群峰 + 九天星盘 + 乾坤十字激光
    // =========================================================================
    if (vfxType === 'heaven_earth_cannon') {
      const cannonCheckers = checkersList.filter(ch => ch && ch.type === 'c' && typeof ch.r === 'number');
      const centralC = cannonCheckers.find(ch => ch.c === 4) || cannonCheckers[0];
      const bottomC = cannonCheckers.find(ch => ch !== centralC) || cannonCheckers[1];

      const skyCannonPos = centralC
        ? gridToWorld(centralC.r, centralC.c)
        : new THREE.Vector3(kPos.x, 0.05, kPos.z + (kPos.z < 0 ? 3.8 : -3.8));
      const earthCannonPos = bottomC
        ? gridToWorld(bottomC.r, bottomC.c)
        : new THREE.Vector3(kPos.x + 3.2, 0.05, kPos.z);

      const cannonSetups = [
        { pos: skyCannonPos, mat: crimsonLacquerMat, glow: goldGlowMat, delay: 0.0 },
        { pos: earthCannonPos, mat: bronzeWoodMat, glow: crimsonGlowMat, delay: 0.10 }
      ].map(({ pos, mat, glow, delay }) => {
        const bastion = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.05, 0.24, 8), darkIronMat);
        bastion.position.set(pos.x, 0.12, pos.z);
        const bastionRim = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.05, 8, 24), goldMat);
        bastionRim.rotation.x = Math.PI / 2;
        bastionRim.position.set(pos.x, 0.24, pos.z);
        group.add(bastion, bastionRim);

        const cModel = this.createArticulated3DCannon(mat, goldMat, darkIronMat, glow);
        cModel.position.set(pos.x, 0.22, pos.z);
        this.faceTargetHorizontally(cModel, kPos.x, kPos.z);
        group.add(cModel);

        const shellGroup = new THREE.Group();
        const shellCore = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), goldGlowMat.clone());
        const shellHalo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 14), crimsonGlowMat.clone());
        shellGroup.add(shellCore, shellHalo);
        group.add(shellGroup);

        return { cModel, bastion, bastionRim, shellGroup, pos, delay };
      });

      const volcanoPeaks = Array.from({ length: 8 }, (_, i) => {
        const ang = (i / 8) * Math.PI * 2 + 0.2;
        const rad = 5.2 + (i % 2) * 0.6;
        const vGroup = new THREE.Group();
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.2 + (i % 3) * 0.45, 7), darkIronMat);
        const lavaRim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 8, 16), crimsonGlowMat);
        lavaRim.rotation.x = Math.PI / 2;
        lavaRim.position.y = 0.85;
        vGroup.add(cone, lavaRim);
        vGroup.position.set(kPos.x + Math.cos(ang) * rad, -1.2, kPos.z + Math.sin(ang) * rad);
        group.add(vGroup);
        return { vGroup, targetY: 0.85 + (i % 3) * 0.15 };
      });

      const astrolabe = new THREE.Group();
      astrolabe.position.set(kPos.x, 4.4, kPos.z);
      const outerWheel = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.08, 12, 48), goldMat);
      outerWheel.rotation.x = Math.PI / 2;
      const midWheel = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.065, 12, 36), crimsonLacquerMat);
      midWheel.rotation.x = Math.PI / 2;
      const innerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.06, 10, 24), goldGlowMat.clone());
      innerWheel.rotation.x = Math.PI / 2;
      astrolabe.add(outerWheel, midWheel, innerWheel);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 4.2), goldMat);
        spoke.rotation.y = a;
        const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), goldGlowMat);
        node.position.set(Math.cos(a) * 2.15, 0, Math.sin(a) * 2.15);
        astrolabe.add(spoke, node);
      }
      group.add(astrolabe);

      const magmaSpikes = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 1.55 + (i % 2) * 0.45, 5),
          i % 2 === 0 ? goldMat : crimsonLacquerMat
        );
        spike.position.set(kPos.x + Math.cos(a) * 1.25, -0.8, kPos.z + Math.sin(a) * 1.25);
        spike.rotation.z = -Math.cos(a) * 0.32;
        spike.rotation.x = Math.sin(a) * 0.32;
        group.add(spike);
        return spike;
      });

      const innerCorePillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.48, 7.2, 24, 1, true),
        goldGlowMat.clone()
      );
      innerCorePillar.position.set(kPos.x, 3.6, kPos.z);
      const outerFirePillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 1.05, 7.2, 24, 1, true),
        crimsonGlowMat.clone()
      );
      outerFirePillar.position.set(kPos.x, 3.6, kPos.z);

      const crossX = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.20, 0.36), crimsonGlowMat.clone());
      crossX.position.set(kPos.x, 0.26, kPos.z);
      const crossZ = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.20, 10.0), goldGlowMat.clone());
      crossZ.position.set(kPos.x, 0.28, 0);
      group.add(innerCorePillar, outerFirePillar, crossX, crossZ);

      return wrapUpdater((p, dt, fade = 1) => {
        cannonSetups.forEach(({ cModel, bastion, bastionRim, shellGroup, pos, delay }) => {
          cModel.scale.setScalar(0.92 * fade);
          bastion.scale.setScalar(fade);
          bastionRim.scale.setScalar(fade);

          const sp = Math.max(0, Math.min(1, (p - delay) / 0.38));
          shellGroup.position.set(
            THREE.MathUtils.lerp(pos.x, kPos.x, sp),
            0.65 + Math.sin(sp * Math.PI) * 3.4,
            THREE.MathUtils.lerp(pos.z, kPos.z, sp)
          );
          const active = sp > 0.01 && sp < 0.98;
          shellGroup.scale.setScalar(active ? 1.18 * fade : 0.001);

          const recoil = (sp > 0 && sp < 0.30) ? Math.sin(sp * 3.3 * Math.PI) * 0.36 : 0;
          cModel.userData.barrelPivot.rotation.x = -0.32 - recoil * 0.48;
        });

        const mountRise = Math.min(1, p / 0.32);
        volcanoPeaks.forEach(({ vGroup, targetY }) => {
          vGroup.position.y = THREE.MathUtils.lerp(-1.2, targetY, mountRise);
          vGroup.scale.setScalar(fade);
        });

        astrolabe.rotation.y += dt * 3.2;
        midWheel.rotation.z -= dt * 4.5;
        astrolabe.position.y = THREE.MathUtils.lerp(4.8, 2.25, Math.min(1, p * 1.45));
        astrolabe.scale.setScalar((0.85 + Math.sin(p * 12) * 0.12) * fade);

        const eruptP = Math.max(0, Math.min(1, (p - 0.26) / 0.26));
        magmaSpikes.forEach(spike => {
          spike.position.y = THREE.MathUtils.lerp(-0.8, 0.68, eruptP);
          spike.scale.setScalar(fade);
        });

        const pulse = eruptP * (0.76 + Math.sin(p * 28) * 0.18) * fade;
        innerCorePillar.scale.set(pulse, eruptP, pulse);
        outerFirePillar.scale.set(pulse * 1.12, eruptP, pulse * 1.12);
        innerCorePillar.material.opacity = 0.58 * eruptP * fade;
        outerFirePillar.material.opacity = 0.46 * eruptP * fade;

        crossX.scale.set(eruptP, pulse, pulse);
        crossZ.scale.set(pulse, pulse, eruptP);
        crossX.material.opacity = 0.62 * eruptP * fade;
        crossZ.material.opacity = 0.62 * eruptP * fade;
      });
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

      return wrapUpdater((p, dt, fade = 1) => {
        const closeIn = Math.min(1, p / 0.46);
        const rad = THREE.MathUtils.lerp(2.65, 1.36, closeIn);
        monoliths.forEach(({ slab, a }) => {
          slab.position.x = kPos.x + Math.cos(a) * rad;
          slab.position.z = kPos.z + Math.sin(a) * rad;
          slab.scale.setScalar(fade);
        });
        topOctagon.rotation.z += dt * 1.8;
        topOctagon.scale.setScalar((rad / 1.55) * fade);
      });
    }

    // =========================================================================
    // 17. 海底捞月 (Frost Lotus Strike): 多层 3D 冰晶莲花花瓣绽放 + 3D 沧海明月自海底升起
    // =========================================================================
    const lotusGroup = new THREE.Group();
    lotusGroup.position.set(kPos.x, 0.12, kPos.z);
    group.add(lotusGroup);

    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const pInner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.85, 6), jadeIceMat);
      pInner.position.set(Math.cos(a) * 0.95, 0.65, Math.sin(a) * 0.95);
      pInner.rotation.z = -Math.cos(a) * 0.42;
      pInner.rotation.x = Math.sin(a) * 0.42;
      lotusGroup.add(pInner);

      const pOuter = new THREE.Mesh(new THREE.ConeGeometry(0.30, 2.35, 6), i % 2 === 0 ? jadeIceMat : goldMat);
      pOuter.position.set(Math.cos(a + Math.PI / 12) * 1.55, 0.55, Math.sin(a + Math.PI / 12) * 1.55);
      pOuter.rotation.z = -Math.cos(a + Math.PI / 12) * 0.72;
      pOuter.rotation.x = Math.sin(a + Math.PI / 12) * 0.72;
      lotusGroup.add(pOuter);
    }

    const risingMoon = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 24, 24),
      goldGlowMat.clone()
    );
    risingMoon.position.set(kPos.x, 0.2, kPos.z);
    group.add(risingMoon);

    return wrapUpdater((p, dt, fade = 1) => {
      const bloom = Math.min(1, p / 0.38);
      lotusGroup.rotation.y += dt * 1.2;
      lotusGroup.scale.setScalar(bloom * fade);
      risingMoon.position.y = THREE.MathUtils.lerp(0.2, 2.35, bloom);
      risingMoon.scale.setScalar((0.85 + Math.sin(p * 14) * 0.12) * fade);
    });
  },

  triggerCheckmateVFX(pattern, winnerColor) {
    this.clearCheckmateVFX();
    this.lastCheckmatePattern = pattern;
    this.lastWinnerColor = winnerColor;

    const vfxType = (pattern.vfxType === 'sea_bottom_moon' ? 'frost_lotus_strike' : pattern.vfxType) || 'frost_lotus_strike';
    const stampTitle = pattern.stampText || (pattern.title || '绝杀').replace(/\s*·.*$/, '');
    const subBannerText = pattern.subBanner || pattern.badge || '古谱名局杀法 · 雷霆绝杀';
    const atmos = this.getVFXAtmosphereProfile(vfxType);

    this.sfx.playCheckmateVFXSound(vfxType);

    const TOTAL_DURATION = 3.90;
    this.vfxAtmosphereDuration = TOTAL_DURATION;
    this.vfxAtmosphereTimer = TOTAL_DURATION;
    this._vfxCustomColorGrading = true;

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

    const addInteractivePieceByCoord = (coord, forceRole = null) => {
      if (!coord || typeof coord.r !== 'number' || typeof coord.c !== 'number') return;
      const p = this.engine?.board?.[coord.r]?.[coord.c];
      const m = p ? this.pieceMeshes.get(p.id) : null;
      if (m && !this._activeCheckerMeshes.some(x => x.mesh === m)) {
        const isKing = forceRole === 'king' || (p.type === 'k' && p.color !== winnerColor);
        const isAttacker = p.color === winnerColor;
        this._activeCheckerMeshes.push({
          mesh: m,
          piece: p,
          coord: { r: coord.r, c: coord.c },
          basePos: m.position.clone(),
          isKing,
          isAttacker
        });
      }
    };

    addInteractivePieceByCoord(kCoord, 'king');
    if (Array.isArray(pattern.checkers)) {
      pattern.checkers.forEach(ch => addInteractivePieceByCoord(ch));
    }
    highlightList.forEach(coord => addInteractivePieceByCoord(coord));

    this._savedCamBeforeVFX = {
      spherical: { ...this.desiredSpherical },
      target: this.camTarget.clone()
    };

    const focusX = (cPos.x * 0.26 + kPos.x * 0.74);
    const focusZ = (cPos.z * 0.26 + kPos.z * 0.74);
    const baseTheta = this._savedCamBeforeVFX.spherical.theta;

    // 柔和戏剧光效（调低点光源强度，避免棋盘及模型过曝刺眼）
    const vfxLight = new THREE.PointLight(atmos.pointHex, 1.55, 22, 1.6);
    vfxLight.position.set(kPos.x, 3.8, kPos.z);
    const vfxRimLight = new THREE.PointLight(atmos.rimHex, 1.05, 20, 1.7);
    vfxRimLight.position.set(cPos.x, 2.8, cPos.z);
    this.checkmateVFXGroup.add(vfxLight, vfxRimLight);

    const baguaTex = getBaguaMagicTexture();
    const crackTex = getMagmaCrackTexture();
    const glowTex = getGlowParticleTexture();

    const horizonPillars = Array.from({ length: 10 }, (_, i) => {
      const ang = (i / 10) * Math.PI * 2;
      const dist = 8.2;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.34, 8.8, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? atmos.pointHex : atmos.rimHex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      beam.position.set(kPos.x + Math.cos(ang) * dist, 4.0, kPos.z + Math.sin(ang) * dist);
      this.checkmateVFXGroup.add(beam);
      return { beam, i };
    });

    const attackerPieceHalos = [];
    this._activeCheckerMeshes.forEach((item, idx) => {
      if (item.isKing || !item.isAttacker) return;
      const haloRing = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.74, 32),
        new THREE.MeshBasicMaterial({
          color: idx % 2 === 0 ? atmos.rimHex : atmos.pointHex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      haloRing.rotation.x = -Math.PI / 2;
      haloRing.position.set(item.basePos.x, 0.04, item.basePos.z);
      this.checkmateVFXGroup.add(haloRing);

      const linkCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(item.basePos.x, 0.45, item.basePos.z),
        new THREE.Vector3((item.basePos.x + kPos.x) * 0.5, 1.55 + idx * 0.35, (item.basePos.z + kPos.z) * 0.5),
        new THREE.Vector3(kPos.x, 0.38, kPos.z)
      );
      const linkTube = new THREE.Mesh(
        new THREE.TubeGeometry(linkCurve, 24, 0.040, 8, false),
        new THREE.MeshBasicMaterial({
          color: atmos.rimHex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.checkmateVFXGroup.add(linkTube);
      attackerPieceHalos.push({ item, haloRing, linkTube, idx });
    });

    const kingBurstRaysGroup = new THREE.Group();
    kingBurstRaysGroup.position.set(kPos.x, 0.28, kPos.z);
    kingBurstRaysGroup.visible = false;
    this.checkmateVFXGroup.add(kingBurstRaysGroup);
    const kingBurstRays = Array.from({ length: 10 }, (_, i) => {
      const ang = (i / 10) * Math.PI * 2;
      const ray = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 2.2, 6, 1, true),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xfde047 : atmos.pointHex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      ray.position.set(Math.cos(ang) * 0.42, 0.85, Math.sin(ang) * 0.42);
      ray.rotation.z = -Math.cos(ang) * 0.62;
      ray.rotation.x = Math.sin(ang) * 0.62;
      kingBurstRaysGroup.add(ray);
      return ray;
    });

    const groundShockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.78, 64),
      new THREE.MeshBasicMaterial({
        color: atmos.rimHex,
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
        color: atmos.pointHex,
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
        color: atmos.rimHex,
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

    const updateCustom3D = this.build3DSpectacleForType(vfxType, kPos, cPos, rPos, winnerColor, pattern);
    // 确保第一阶段期间 3D 演武模型隐藏，不提前出现在棋盘上
    if (updateCustom3D && updateCustom3D.spectacleGroup) {
      updateCustom3D.spectacleGroup.visible = false;
    }

    const spawn3DBurst = (wx, wy, wz, primaryHex = 0xff5500, secondaryHex = 0xfef08a, count = 38) => {
      for (let i = 0; i < count; i++) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            color: i % 2 === 0 ? primaryHex : secondaryHex,
            transparent: true,
            opacity: 0.72,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        const initScale = 0.30 + Math.random() * 0.36;
        sprite.scale.set(initScale, initScale, 1);
        sprite.position.set(wx + (Math.random() - 0.5) * 0.35, wy + Math.random() * 0.25, wz + (Math.random() - 0.5) * 0.35);
        this.checkmateVFXGroup.add(sprite);

        const angle = Math.random() * Math.PI * 2;
        const speedXZ = 2.2 + Math.random() * 6.5;
        const speedY = 3.0 + Math.random() * 6.8;
        this.checkmateVFXAnimations.push({
          elapsed: 0,
          duration: 1.0 + Math.random() * 0.5,
          update: (t, dt) => {
            sprite.position.x += Math.cos(angle) * speedXZ * dt;
            sprite.position.z += Math.sin(angle) * speedXZ * dt;
            sprite.position.y += (speedY - t * 10.5) * dt;
            if (sprite.position.y < 0.08) sprite.position.y = 0.08;
            sprite.material.opacity = Math.max(0, 0.72 * (1 - Math.pow(t, 1.35)));
          }
        });
      }
    };

    const sparks2D = Array.from({ length: 52 }, (_, i) => {
      const ang = (i / 52) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const spd = 120 + Math.random() * 400;
      return {
        ang,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 50,
        size: 3.0 + Math.random() * 7.2,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 9,
        color: i % 4 === 0 ? '#fffbeb' : (i % 2 === 0 ? '#fde68a' : atmos.accent)
      };
    });

    const baseSceneCfg = this.getActiveSceneConfig?.() || {
      bgHex: 0xdbe9dc,
      sunColor: 0xfff8eb,
      sunIntensity: 0.88,
      hemiSky: 0xfffdf6,
      hemiGround: 0x5c7a58,
      hemiIntensity: 0.62
    };
    const dayBgColor = new THREE.Color(baseSceneCfg.bgHex || 0xdbe9dc);
    const vfxBgColor = new THREE.Color(atmos.bgHex);
    const vfxFogColor = new THREE.Color(atmos.fogHex);
    const daySunColor = new THREE.Color(baseSceneCfg.sunColor || 0xfff8eb);
    const vfxSunColor = new THREE.Color(atmos.sunHex);
    const dayHemiSky = new THREE.Color(baseSceneCfg.hemiSky || 0xfffdf6);
    const vfxHemiSky = new THREE.Color(atmos.hemiSky);
    const dayHemiGround = new THREE.Color(baseSceneCfg.hemiGround || 0x5c7a58);
    const vfxHemiGround = new THREE.Color(atmos.hemiGround);

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

        let gradeFactor = 0;
        if (normT < 0.14) gradeFactor = normT / 0.14;
        else if (normT < 0.82) gradeFactor = 1.0;
        else gradeFactor = Math.max(0, 1 - (normT - 0.82) / 0.18);

        if (this.scene) {
          this.scene.background.copy(dayBgColor).lerp(vfxBgColor, gradeFactor * 0.88);
          if (this.scene.fog) {
            this.scene.fog.color.copy(dayBgColor).lerp(vfxFogColor, gradeFactor * 0.88);
          }
        }
        if (this.sunLight) {
          this.sunLight.color.copy(daySunColor).lerp(vfxSunColor, gradeFactor);
          this.sunLight.intensity = THREE.MathUtils.lerp(baseSceneCfg.sunIntensity || 0.88, atmos.sunIntensity, gradeFactor);
        }
        if (this.hemiLight) {
          this.hemiLight.color.copy(dayHemiSky).lerp(vfxHemiSky, gradeFactor);
          this.hemiLight.groundColor.copy(dayHemiGround).lerp(vfxHemiGround, gradeFactor);
          this.hemiLight.intensity = THREE.MathUtils.lerp(baseSceneCfg.hemiIntensity || 0.62, atmos.hemiIntensity, gradeFactor);
        }
        if (this.container) {
          this.container.style.filter = gradeFactor > 0.05 ? atmos.cssFilter : '';
        }

        horizonPillars.forEach(({ beam, i }) => {
          beam.material.opacity = gradeFactor * (0.11 + Math.sin(normT * 16 + i) * 0.04);
          beam.rotation.y += dt * 0.7;
        });

        if (sec < 0.62) {
          const p1 = sec / 0.62;
          const ease1 = 1 - Math.pow(1 - p1, 3);

          // 第一阶段严格隐藏 3D 演武模型，避免提前加载在棋盘上造成突兀感
          if (updateCustom3D && updateCustom3D.spectacleGroup) {
            updateCustom3D.spectacleGroup.visible = false;
          }
          kingBurstRaysGroup.visible = false;

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
            if (item.isKing) {
              const tremor = Math.sin(p1 * 44) * 0.035 * ease1;
              item.mesh.position.set(item.basePos.x + tremor, ease1 * 0.10, item.basePos.z + tremor);
            } else {
              const lift = Math.sin(ease1 * Math.PI * 0.5) * 0.92;
              item.mesh.position.set(item.basePos.x, lift, item.basePos.z);
              item.mesh.rotation.y = ease1 * Math.PI * (idx % 2 === 0 ? 2 : -2);
              const sc = 1 + ease1 * 0.14;
              item.mesh.scale.set(sc, sc, sc);
            }
          });

          attackerPieceHalos.forEach(({ item, haloRing, linkTube, idx }) => {
            haloRing.position.y = item.mesh ? item.mesh.position.y + 0.04 : 0.04;
            haloRing.scale.setScalar(1 + ease1 * 0.55);
            haloRing.rotation.z += dt * (idx % 2 === 0 ? 4 : -4);
            haloRing.material.opacity = ease1 * 0.65;
            linkTube.material.opacity = ease1 * 0.58;
          });

          const shockScale = 1 + ease1 * 8.2;
          groundShockRing.scale.set(shockScale, shockScale, 1);
          groundShockRing.material.opacity = Math.sin(p1 * Math.PI) * 0.55;
          baguaOuter.material.opacity = ease1 * 0.52;
          baguaOuter.rotation.z += dt * 2.0;

          this.drawImperialTopCinematicBar(ctx, w * 0.5, h * 0.11, subBannerText, ease1, atmos.accent);
        } else if (sec < 2.58) {
          const p2 = (sec - 0.62) / 1.96;
          if (!stage2Triggered) {
            stage2Triggered = true;
            this.triggerScreenFlash();
            this.cameraShake = 0.76;
            spawn3DBurst(kPos.x, 0.35, kPos.z, atmos.pointHex, atmos.rimHex, 42);
            if (updateCustom3D && updateCustom3D.spectacleGroup) {
              updateCustom3D.spectacleGroup.visible = true;
            }
            kingBurstRaysGroup.visible = true;
          }

          this.desiredSpherical.radius = 9.4 + Math.sin(p2 * Math.PI) * 0.8;
          this.desiredSpherical.phi = 0.98 + Math.cos(p2 * Math.PI) * 0.08;
          this.desiredSpherical.theta = baseTheta + 0.22 + Math.sin(p2 * Math.PI * 1.5) * 0.28;
          crackDisc.material.opacity = Math.min(0.58, p2 * 1.8) * (1 - p2 * 0.18);
          baguaOuter.material.opacity = 0.52 * (1 - p2 * 0.15);
          baguaOuter.rotation.z += dt * 1.6;

          const impactHit = Math.max(0, Math.min(1, (p2 - 0.22) / 0.55));
          this._activeCheckerMeshes.forEach((item, idx) => {
            if (!item.mesh) return;
            if (item.isKing) {
              const shakeAmp = (0.05 + impactHit * 0.10) * (1 - p2 * 0.25);
              const jx = Math.sin(p2 * 90) * shakeAmp;
              const jz = Math.cos(p2 * 84) * shakeAmp;
              const knockUp = Math.sin(impactHit * Math.PI) * 0.32;
              item.mesh.position.set(item.basePos.x + jx, 0.08 + knockUp, item.basePos.z + jz);
              item.mesh.rotation.set(
                Math.sin(p2 * 40) * 0.20 + impactHit * 0.24,
                Math.sin(p2 * 22) * 0.15,
                Math.cos(p2 * 36) * 0.20
              );
            } else {
              const hoverY = 0.30 + Math.sin(p2 * 14 + idx) * 0.12;
              item.mesh.position.set(item.basePos.x, hoverY, item.basePos.z);
              item.mesh.rotation.set(Math.sin(p2 * 10 + idx) * 0.10, p2 * Math.PI * 2, 0);
              const pulseSc = 1.10 + Math.sin(p2 * 16 + idx) * 0.05;
              item.mesh.scale.set(pulseSc, pulseSc, pulseSc);
            }
          });

          attackerPieceHalos.forEach(({ item, haloRing, linkTube, idx }) => {
            haloRing.position.y = item.mesh ? item.mesh.position.y - 0.05 : 0.05;
            haloRing.rotation.z += dt * (idx % 2 === 0 ? 4.5 : -4.5);
            haloRing.scale.setScalar(1.18 + Math.sin(p2 * 14 + idx) * 0.18);
            haloRing.material.opacity = 0.58;
            linkTube.material.opacity = 0.38 + Math.sin(p2 * 22 + idx) * 0.18;
          });

          kingBurstRaysGroup.rotation.y += dt * 2.2;
          kingBurstRays.forEach((ray, i) => {
            const rayShow = Math.sin(impactHit * Math.PI);
            ray.scale.set(1, 0.35 + rayShow * (1.05 + (i % 3) * 0.28), 1);
            ray.material.opacity = rayShow * 0.48;
          });

          // 3D 模型平滑入场过渡 (enterFade)，彻底消除一瞬间突兀跳出的生硬感
          const enterT = Math.min(1, p2 / 0.16);
          const enterFade = 1 - Math.pow(1 - enterT, 3);
          if (updateCustom3D) updateCustom3D(p2, dt, enterFade);

          this.renderImperialHUD2D(ctx, w, h, p2, vfxType, stampTitle, subBannerText, atmos);
        } else {
          const p3 = (sec - 2.58) / Math.max(0.01, TOTAL_DURATION - 2.58);
          const ease3 = 1 - Math.pow(1 - p3, 3);
          if (!stage3Triggered) {
            stage3Triggered = true;
            this.triggerScreenFlash();
            this.cameraShake = 0.68;
            spawn3DBurst(kPos.x, 0.45, kPos.z, atmos.rimHex, atmos.pointHex, 36);
            this.spawnShatterFragments?.(kPos.x, kPos.z, winnerColor === RED ? BLACK : RED);
          }

          this._activeCheckerMeshes.forEach((item) => {
            if (!item.mesh || !item.basePos) return;
            const settle = Math.min(1, p3 * 1.8);
            item.mesh.position.lerpVectors(item.mesh.position, item.basePos, settle);
            item.mesh.rotation.set(
              item.mesh.rotation.x * (1 - settle),
              item.mesh.rotation.y * (1 - settle),
              item.mesh.rotation.z * (1 - settle)
            );
            const sc = THREE.MathUtils.lerp(item.mesh.scale.x, 1, settle);
            item.mesh.scale.set(sc, sc, sc);
          });

          const fade3D = Math.max(0, 1 - p3 * 1.45);
          attackerPieceHalos.forEach(({ haloRing, linkTube }) => {
            haloRing.material.opacity = fade3D * 0.45;
            linkTube.material.opacity = fade3D * 0.38;
          });
          kingBurstRays.forEach(ray => {
            ray.material.opacity = fade3D * 0.35;
          });

          this.camTarget.lerpVectors(new THREE.Vector3(focusX, 0.55, focusZ), this._savedCamBeforeVFX.target, ease3);
          this.desiredSpherical.radius = THREE.MathUtils.lerp(9.8, this._savedCamBeforeVFX.spherical.radius, ease3);
          this.desiredSpherical.phi = THREE.MathUtils.lerp(1.02, this._savedCamBeforeVFX.spherical.phi, ease3);
          this.desiredSpherical.theta = THREE.MathUtils.lerp(baseTheta + 0.22, this._savedCamBeforeVFX.spherical.theta, ease3);

          crackDisc.material.opacity = fade3D * 0.48;
          baguaOuter.material.opacity = fade3D * 0.48;
          if (updateCustom3D) {
            if (fade3D <= 0.01 && updateCustom3D.spectacleGroup) {
              updateCustom3D.spectacleGroup.visible = false;
            } else {
              updateCustom3D(1.0, dt, fade3D);
            }
          }

          this.renderImperialFinalJueshaSeal2D(ctx, w, h, p3, stampTitle, subBannerText, sparks2D, vfxType, atmos);
        }

        vfxLight.intensity = (1 - normT * 0.45) * (1.55 + Math.sin(normT * 32) * 0.28);
        vfxRimLight.intensity = (1 - normT * 0.45) * (1.05 + Math.cos(normT * 26) * 0.20);
        ctx.restore();
      }
    });
  },

  renderImperialHUD2D(ctx, w, h, p, vfxType, stampTitle, subBannerText, atmos = null) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const minDim = Math.min(w, h);
    const prof = atmos || this.getVFXAtmosphereProfile(vfxType);

    ctx.save();
    const vig = ctx.createRadialGradient(cx, cy, minDim * 0.30, cx, cy, Math.max(w, h) * 0.78);
    vig.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.60, prof.tintInner);
    vig.addColorStop(1.0, prof.tintOuter);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    const accent = prof.accent || '#f59e0b';
    const topBarAlpha = p > 0.86 ? Math.max(0, (1 - p) / 0.14) : Math.min(1, p / 0.14);
    this.drawImperialTopCinematicBar(ctx, cx, h * 0.10, subBannerText, topBarAlpha, accent);

    const slamT = Math.min(1, p / 0.16);
    const slamScale = slamT < 1
      ? THREE.MathUtils.lerp(2.25, 0.98, slamT * slamT)
      : 1.0 + Math.sin((p - 0.16) * 14) * 0.02;
    const titleAlpha = p > 0.86 ? Math.max(0, (1 - p) / 0.14) : 1.0;
    const fontSize = Math.round(Math.min(w * 0.12, h * 0.095, 82));
    const colorPhase = (vfxType === 'fishing_horse' || vfxType === 'frost_lotus_strike') ? 0.2 : 1.0;
    this.drawImperialBrushTitle(ctx, cx, h * 0.78, stampTitle, fontSize, slamScale, titleAlpha, '', accent, colorPhase);

    ctx.restore();
  },

  renderImperialFinalJueshaSeal2D(ctx, w, h, p3, stampTitle, subBannerText, sparks2D, vfxType = '', atmos = null) {
    const cx = w * 0.5;
    const cy = h * 0.48;
    const fadeOut = p3 > 0.72 ? Math.max(0, 1 - (p3 - 0.72) / 0.28) : 1.0;
    if (fadeOut <= 0.01) return;

    const isIceOrWater = vfxType === 'fishing_horse' || vfxType === 'frost_lotus_strike';
    const prof = atmos || this.getVFXAtmosphereProfile(vfxType);

    ctx.save();
    ctx.globalAlpha = fadeOut;

    const ringR = Math.min(w, h) * (0.14 + p3 * 0.42);
    ctx.strokeStyle = isIceOrWater
      ? `rgba(186, 230, 253, ${(1 - p3) * 0.68})`
      : `rgba(254, 240, 138, ${(1 - p3) * 0.68})`;
    ctx.lineWidth = 4.5 * (1 - p3 * 0.55);
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
    this.drawImperialBrushTitle(ctx, cx, cy, finalText, bigFontSize, slamScale, fadeOut, caption, prof.accent || '#f59e0b', 1.0);

    ctx.restore();
  },

  /**
   * 加强版行棋流光轨迹与起跳涟漪特效（双层立体流光丝带 + 沿途星芒粒子 + 起点聚气金环）
   */
  spawnMoveTrailRibbon(startPos, endPos, color, isCapture = false, pieceType = 'r') {
    if (!this.scene) return;
    const isRed = color === RED;
    const dx = endPos.x - startPos.x;
    const dz = endPos.z - startPos.z;
    const midX = (startPos.x + endPos.x) * 0.5;
    const midZ = (startPos.z + endPos.z) * 0.5;
    const peakY = isCapture
      ? (pieceType === 'c' ? 1.85 : (pieceType === 'n' ? 1.55 : 1.12))
      : (pieceType === 'n' ? 1.28 : 0.78);

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(startPos.x, 0.16, startPos.z),
      new THREE.Vector3(midX, peakY, midZ),
      new THREE.Vector3(endPos.x, 0.16, endPos.z)
    );

    if (!this.impactWaves) this.impactWaves = [];

    // 1. 内层高亮流光核心束
    const coreGeo = new THREE.TubeGeometry(curve, 32, isCapture ? 0.062 : 0.044, 10, false);
    const coreMat = new THREE.MeshBasicMaterial({
      color: isCapture ? 0xfef08a : (isRed ? 0xff6b6b : 0xfbbf24),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.scene.add(coreMesh);
    this.impactWaves.push({
      mesh: coreMesh,
      age: 0,
      maxAge: isCapture ? 0.52 : 0.40,
      maxScale: 1.0,
      isTrail: true
    });

    // 2. 外层柔和晕染剑气光带
    const auraGeo = new THREE.TubeGeometry(curve, 24, isCapture ? 0.13 : 0.09, 8, false);
    const auraMat = new THREE.MeshBasicMaterial({
      color: isRed ? 0xef4444 : 0xd97706,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    this.scene.add(auraMesh);
    this.impactWaves.push({
      mesh: auraMesh,
      age: 0,
      maxAge: isCapture ? 0.58 : 0.44,
      maxScale: 1.0,
      isTrail: true
    });

    // 3. 起点腾空助推涟漪环
    const launchRing = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.42, 32),
      new THREE.MeshBasicMaterial({
        color: isRed ? 0xf87171 : 0xfbbf24,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    launchRing.rotation.x = -Math.PI / 2;
    launchRing.position.set(startPos.x, 0.024, startPos.z);
    this.scene.add(launchRing);
    this.impactWaves.push({
      mesh: launchRing,
      age: 0,
      maxAge: 0.34,
      maxScale: 1.65
    });

    // 4. 沿途飘散的星芒微粒
    const glowTex = typeof getGlowParticleTexture === 'function' ? getGlowParticleTexture() : null;
    if (glowTex && this.shatterParticles) {
      const moteCount = isCapture ? 10 : 6;
      for (let i = 1; i <= moteCount; i++) {
        const pt = curve.getPoint(i / (moteCount + 1));
        const spMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: i % 2 === 0 ? 0xfef08a : (isRed ? 0xf87171 : 0xfbbf24),
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const sp = new THREE.Sprite(spMat);
        const sc = isCapture ? 0.28 : 0.22;
        sp.scale.set(sc, sc, 1);
        sp.position.set(pt.x + (Math.random() - 0.5) * 0.16, pt.y, pt.z + (Math.random() - 0.5) * 0.16);
        this.scene.add(sp);
        this.shatterParticles.push({
          mesh: sp,
          vx: (Math.random() - 0.5) * 0.8 + dx * 0.12,
          vy: 0.6 + Math.random() * 1.1,
          vz: (Math.random() - 0.5) * 0.8 + dz * 0.12,
          life: 0,
          maxLife: 0.45 + Math.random() * 0.18
        });
      }
    }
  },

  spawnMoveImpactWave(worldX, worldZ, isCapture = false) {
    if (!this.scene) return;
    if (!this.impactWaves) this.impactWaves = [];
    const markerTex = typeof getBoardMarkerTexture === 'function'
      ? getBoardMarkerTexture(isCapture ? 'warning' : 'last_to')
      : null;
    const mat = new THREE.MeshBasicMaterial({
      map: markerTex || null,
      color: isCapture ? 0xffef8a : 0xfde047,
      transparent: true,
      opacity: isCapture ? 0.88 : 0.78,
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
    this.impactWaves.push({
      mesh: waveMesh,
      age: 0,
      maxAge: isCapture ? 0.56 : 0.42,
      maxScale: isCapture ? 2.45 : 1.75
    });

    // 第二道外扩激波金环，使落子瞬间更具分量感与节奏感
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.48, 36),
      new THREE.MeshBasicMaterial({
        color: isCapture ? 0xef4444 : 0xf59e0b,
        transparent: true,
        opacity: isCapture ? 0.72 : 0.54,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.set(worldX, 0.028, worldZ);
    this.scene.add(outerRing);
    this.impactWaves.push({
      mesh: outerRing,
      age: 0,
      maxAge: isCapture ? 0.48 : 0.34,
      maxScale: isCapture ? 2.85 : 2.05
    });
  },

  spawnShatterFragments(worldX, worldZ, color, dirX = 0, dirZ = 0) {
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
          opacity: 0.88,
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

    // 碎片顺着进攻方向迸射飞散，呈现真实的撞击击飞物理效果
    for (let i = 0; i < 20; i++) {
      const fragMat = new THREE.MeshStandardMaterial({
        color: isRed ? 0xe6d5b8 : 0x090d16,
        emissive: isRed ? 0xf59e0b : 0xfbbf24,
        emissiveIntensity: 0.38,
        roughness: 0.18,
        metalness: 0.38,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.075 + Math.random() * 0.045, 0), fragMat);
      mesh.position.set(worldX + dirX * 0.12, 0.24, worldZ + dirZ * 0.12);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(mesh);
      this.shatterParticles.push({
        mesh,
        vx: (Math.random() - 0.5) * 5.2 + dirX * 2.4,
        vy: 3.4 + Math.random() * 4.0,
        vz: (Math.random() - 0.5) * 5.2 + dirZ * 2.4,
        life: 0,
        maxLife: 0.85
      });
    }

    if (glowTex) {
      for (let i = 0; i < 14; i++) {
        const spMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: i % 2 === 0 ? 0xfef08a : (isRed ? 0xef4444 : 0xf59e0b),
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const sp = new THREE.Sprite(spMat);
        sp.scale.set(0.38, 0.38, 1);
        sp.position.set(worldX, 0.28, worldZ);
        this.scene.add(sp);
        this.shatterParticles.push({
          mesh: sp,
          vx: (Math.random() - 0.5) * 5.5 + dirX * 1.8,
          vy: 2.8 + Math.random() * 4.2,
          vz: (Math.random() - 0.5) * 5.5 + dirZ * 1.8,
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
        opacity: 0.92,
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
          opacity: 0.94,
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
