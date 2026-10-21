/*************************************************************************
 * 3D ULTIMATE CHECKMATE VFX, MOVE IMPACT RIPPLES & GRANDMASTER HINT TRAJECTORY MODULE
 * Extends Xiangqi3DApp.prototype
 *************************************************************************/

Object.assign(Xiangqi3DApp.prototype, {
  clearCheckmateHighlights() {
    for (const ring of this.checkmateHighlightRings) this.scene.remove(ring);
    this.checkmateHighlightRings = [];
  },

  showCheckmateHighlights(coords) {
    this.clearCheckmateHighlights();
    if (!coords || !coords.length) return;
    const warnTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('warning') : null;
    const goldTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('selected') : null;

    coords.forEach((pt, idx) => {
      const pos = gridToWorld(pt.r, pt.c);
      const tex = idx === 0 ? warnTex : goldTex;
      const ring = new THREE.Mesh(
         tex ? new THREE.PlaneGeometry(1.42, 1.42) : new THREE.RingGeometry(0.48, 0.62, 48),
        new THREE.MeshBasicMaterial({
          map: tex || null,
          color: tex ? 0xffffff : (idx === 0 ? 0xdc2626 : 0xf59e0b),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.96,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.032, pos.z);
      this.scene.add(ring);
      this.checkmateHighlightRings.push(ring);
    });
  },

  clearCheckmateVFX() {
    if (!this.checkmateVFXGroup) return;
    while (this.checkmateVFXGroup.children.length > 0) {
      this.checkmateVFXGroup.remove(this.checkmateVFXGroup.children[0]);
    }
    this.checkmateVFXAnimations = [];
    this.vfxAtmosphereTimer = 0;
    if (this.scene && this.sunLight && this.hemiLight) {
      const sc = this.getActiveSceneConfig?.() || {
        bgHex: 0xdce8dc,
        sunColor: 0xfff5e0,
        sunIntensity: 1.15,
        hemiSky: 0xfef9e7,
        hemiGround: 0x688264,
        hemiIntensity: 0.75
      };
      this.scene.background.setHex(sc.bgHex);
      if (this.scene.fog) this.scene.fog.color.setHex(sc.bgHex);
      this.sunLight.color.setHex(sc.sunColor || 0xfff5e0);
      this.sunLight.intensity = sc.sunIntensity || 1.15;
      this.hemiLight.color.setHex(sc.hemiSky || 0xfef9e7);
      this.hemiLight.groundColor.setHex(sc.hemiGround || 0x688264);
      this.hemiLight.intensity = sc.hemiIntensity || 0.75;
    }
  },

  toggleVFXDrawer(forceState) {
    if (this.onlineRole && forceState !== false) {
      this.showCenterCallout('联机对局中不可使用绝杀大招', this.onlineRole);
      return;
    }
    const drawer = document.getElementById('vfx-drawer');
    if (!drawer) return;
    const willShow = typeof forceState === 'boolean' ? forceState : drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !willShow);
    if (willShow) this.sfx.playSelect();
  },

  previewUltimateVFX(vfxType, title, badge) {
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
    const mockPattern = { title, badge, vfxType, kingCoord: { r: kr, c: kc }, royalCoord: { r: wkr, c: wkc }, highlightCoords: [{ r: kr, c: kc }] };
    this.showCheckmateHighlights(mockPattern.highlightCoords);
    this.triggerCheckmateVFX(mockPattern, RED);
    this.showCenterCallout(title, RED);
  },

  replayCheckmateVFX() {
    if (!this.lastCheckmatePattern) return;
    this.closeModalOnly();
    this.triggerCheckmateVFX(this.lastCheckmatePattern, this.lastWinnerColor);
    this.showCenterCallout(this.lastCheckmatePattern.title, this.lastWinnerColor);
  },

  triggerScreenFlash() {
    const flashEl = document.getElementById('vfx-screen-flash');
    if (!flashEl) return;
    flashEl.classList.remove('vfx-flash-active');
    void flashEl.offsetWidth;
    flashEl.classList.add('vfx-flash-active');
  },

  triggerCheckmateVFX(pattern, winnerColor) {
    this.clearCheckmateVFX();
    this.lastCheckmatePattern = pattern;
    this.lastWinnerColor = winnerColor;

    const vfxType = pattern.vfxType || 'heart_blade';
    this.sfx.playCheckmateVFXSound(vfxType);
    this.triggerScreenFlash();
    this.cameraShake = 0.75;

    this.vfxAtmosphereDuration = 3.8;
    this.vfxAtmosphereTimer = 3.8;

    const kCoord = pattern.kingCoord || { r: 0, c: 4 };
    const kPos = gridToWorld(kCoord.r, kCoord.c);
    const checker = (pattern.checkers && pattern.checkers[0])
      ? pattern.checkers[0]
      : { r: Math.min(9, kCoord.r + 3), c: kCoord.c };
    const cPos = gridToWorld(checker.r, checker.c);

    const vfxLight = new THREE.PointLight(0xffaa00, 4.8, 22, 1.5);
    vfxLight.position.set(kPos.x, 2.8, kPos.z);
    this.checkmateVFXGroup.add(vfxLight);
    this.checkmateVFXAnimations.push({
      elapsed: 0,
      duration: 4.5,
      update: (t) => {
        vfxLight.intensity = (1 - t * 0.75) * (4.2 + Math.sin(t * 35) * 1.2);
      }
    });

    const baguaTex = getBaguaMagicTexture();
    const crackTex = getMagmaCrackTexture();
    const glowTex = getGlowParticleTexture();

    const crackDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 4.2),
      new THREE.MeshBasicMaterial({
        map: crackTex,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    crackDisc.rotation.x = -Math.PI / 2;
    crackDisc.position.set(kPos.x, 0.025, kPos.z);
    this.checkmateVFXGroup.add(crackDisc);

    const baguaOuter = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 5.2),
      new THREE.MeshBasicMaterial({
        map: baguaTex,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    baguaOuter.rotation.x = -Math.PI / 2;
    baguaOuter.position.set(kPos.x, 0.04, kPos.z);

    const baguaInner = new THREE.Mesh(
      new THREE.PlaneGeometry(3.1, 3.1),
      new THREE.MeshBasicMaterial({
        map: baguaTex,
        color: 0xff4444,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    baguaInner.rotation.x = -Math.PI / 2;
    baguaInner.position.set(kPos.x, 0.06, kPos.z);

    const coronaTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('selected') : null;
    const skyHalo = new THREE.Mesh(
      coronaTex ? new THREE.PlaneGeometry(3.4, 3.4) : new THREE.RingGeometry(1.45, 1.68, 48),
      new THREE.MeshBasicMaterial({
        map: coronaTex || null,
        color: 0xfef08a,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    skyHalo.rotation.x = -Math.PI / 2;
    skyHalo.position.set(kPos.x, 0.65, kPos.z);

    this.checkmateVFXGroup.add(baguaOuter, baguaInner, skyHalo);
    this.checkmateVFXAnimations.push({
      elapsed: 0,
      duration: 12.0,
      update: (t, dt) => {
        const popScale = t < 0.04 ? (t / 0.04) * 1.15 : 1 + Math.sin(t * 16) * 0.05;
        baguaOuter.scale.setScalar(popScale);
        baguaOuter.rotation.z += dt * 1.1;
        baguaInner.rotation.z -= dt * 2.1;
        skyHalo.rotation.z += dt * 3.0;
        skyHalo.position.y = 0.55 + Math.sin(t * 12) * 0.25;
        crackDisc.material.opacity = 0.65 + Math.sin(t * 24) * 0.3;
      }
    });

    const holoTex = createHoloKillBannerTexture(pattern.title, pattern.badge);
    const holoSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: holoTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    holoSprite.position.set(kPos.x, 3.6, kPos.z);
    holoSprite.scale.set(6.5, 3.25, 1);
    this.checkmateVFXGroup.add(holoSprite);
    this.checkmateVFXAnimations.push({
      elapsed: 0,
      duration: 4.2,
      update: (t) => {
        if (t < 0.12) {
          const p = t / 0.12;
          holoSprite.material.opacity = p;
          const s = THREE.MathUtils.lerp(11.0, 5.4, p);
          holoSprite.scale.set(s, s * 0.5, 1);
        } else if (t < 0.78) {
          holoSprite.material.opacity = 0.95;
          holoSprite.position.y = 3.5 + Math.sin(t * 10) * 0.16;
        } else {
          const fade = 1 - (t - 0.78) / 0.22;
          holoSprite.material.opacity = Math.max(0, fade);
          holoSprite.position.y += 0.02;
        }
      }
    });

    const spawnSupernovaExplosion = (wx, wy, wz, primaryHex = 0xff5500, secondaryHex = 0xfef08a, count = 110) => {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5),
        new THREE.MeshBasicMaterial({
          color: primaryHex,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      dome.position.set(wx, 0.02, wz);
      this.checkmateVFXGroup.add(dome);

      const shockTorus = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.09, 16, 48),
        new THREE.MeshBasicMaterial({
          color: secondaryHex,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      shockTorus.rotation.x = Math.PI / 2;
      shockTorus.position.set(wx, 0.12, wz);
      this.checkmateVFXGroup.add(shockTorus);

      this.checkmateVFXAnimations.push({
        elapsed: 0,
        duration: 1.05,
        update: (t) => {
          const easeOut = 1 - Math.pow(1 - t, 3);
          const dScale = 1 + easeOut * 8.5;
          dome.scale.set(dScale, 1 + easeOut * 5.5, dScale);
          dome.material.opacity = Math.max(0, (1 - t) * 0.75);

          const tScale = 1 + easeOut * 9.5;
          shockTorus.scale.set(tScale, tScale, 1);
          shockTorus.material.opacity = Math.max(0, 1 - t);
        }
      });

      for (let i = 0; i < count; i++) {
        const isSpark = i % 3 !== 0;
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
        const initScale = isSpark ? (0.35 + Math.random() * 0.45) : (0.7 + Math.random() * 0.65);
        sprite.scale.set(initScale, initScale, 1);
        sprite.position.set(
          wx + (Math.random() - 0.5) * 0.4,
          wy + Math.random() * 0.3,
          wz + (Math.random() - 0.5) * 0.4
        );
        this.checkmateVFXGroup.add(sprite);

        const angle = Math.random() * Math.PI * 2;
        const speedXZ = isSpark ? (2.2 + Math.random() * 7.5) : (0.6 + Math.random() * 2.5);
        const speedY = isSpark ? (3.5 + Math.random() * 8.5) : (2.5 + Math.random() * 5.0);
        const gravity = isSpark ? 11.5 : -1.5;

        this.checkmateVFXAnimations.push({
          elapsed: 0,
          duration: 1.1 + Math.random() * 0.9,
          update: (t, dt) => {
            sprite.position.x += Math.cos(angle) * speedXZ * dt;
            sprite.position.z += Math.sin(angle) * speedXZ * dt;
            sprite.position.y += (speedY - t * gravity) * dt;
            if (sprite.position.y < 0.08) sprite.position.y = 0.08;
            sprite.material.opacity = Math.max(0, 1 - Math.pow(t, 1.5));
            const s = initScale * (1 - t * 0.5);
            sprite.scale.set(s, s, 1);
          }
        });
      }
    };

    const spawnSpiralRibbons = (wx, wz, color1, color2, height = 6.5, radius = 1.25) => {
      for (let strand = 0; strand < 2; strand++) {
        const pts = [];
        const segs = 64;
        for (let i = 0; i <= segs; i++) {
          const f = i / segs;
          const ang = f * Math.PI * 6 + strand * Math.PI;
          const r = radius * (1 - f * 0.35);
          pts.push(new THREE.Vector3(Math.cos(ang) * r, f * height, Math.sin(ang) * r));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 64, 0.07, 8, false),
          new THREE.MeshBasicMaterial({
            color: strand === 0 ? color1 : color2,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        tube.position.set(wx, 0.05, wz);
        this.checkmateVFXGroup.add(tube);

        this.checkmateVFXAnimations.push({
          elapsed: 0,
          duration: 3.5,
          update: (t, dt) => {
            tube.rotation.y -= dt * 4.5;
            tube.material.opacity = t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.35) : 0.9;
          }
        });
      }
    };

    if (vfxType === 'iron_bolt') {
      const gateGroup = new THREE.Group();
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0xb91c1c,
        emissive: 0xd97706,
        emissiveIntensity: 0.75,
        metalness: 0.88,
        roughness: 0.18
      });
      [-1.55, 1.55].forEach(offsetX => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 4.2, 16), pillarMat);
        pillar.position.set(kPos.x + offsetX, 2.1, kPos.z);
        const cap = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          new THREE.MeshBasicMaterial({ color: 0xfef08a, blending: THREE.AdditiveBlending })
        );
        cap.position.set(kPos.x + offsetX, 4.35, kPos.z);
        gateGroup.add(pillar, cap);
      });

      const centralBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.52, 7.5),
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xdc2626,
          emissiveIntensity: 0.9,
          metalness: 0.95,
          roughness: 0.1
        })
      );
      centralBeam.position.set(kPos.x, 0.55, kPos.z + (kCoord.r < 5 ? 2.4 : -2.4));

      const crossBolt = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 0.62, 0.62),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xf59e0b,
          emissiveIntensity: 1.0,
          metalness: 0.95,
          roughness: 0.1
        })
      );
      crossBolt.position.set(kPos.x, 1.15, kPos.z);
      gateGroup.add(centralBeam, crossBolt);
      gateGroup.position.y = 11.0;
      this.checkmateVFXGroup.add(gateGroup);

      spawnSpiralRibbons(kPos.x, kPos.z, 0xf59e0b, 0xef4444, 5.5, 1.6);

      let impacted = false;
      this.checkmateVFXAnimations.push({
        elapsed: 0,
        duration: 3.8,
        update: (t) => {
          if (t < 0.14) {
            const p = t / 0.14;
            gateGroup.position.y = 11.0 * (1 - p * p * p);
          } else {
            gateGroup.position.y = 0;
            if (!impacted) {
              impacted = true;
              this.cameraShake = 0.95;
              spawnSupernovaExplosion(kPos.x, 0.35, kPos.z, 0xf59e0b, 0xef4444, 120);
            }
          }
        }
      });
    } else if (vfxType === 'heart_blade') {
      const swordGroup = new THREE.Group();

      const coreBlade = new THREE.Mesh(
        new THREE.ConeGeometry(0.75, 6.2, 4),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending
        })
      );
      coreBlade.rotation.z = Math.PI;
      coreBlade.scale.set(1.6, 1, 0.28);
      coreBlade.position.y = 3.1;

      const auraBlade = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 6.6, 4),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      auraBlade.rotation.z = Math.PI;
      auraBlade.scale.set(1.8, 1, 0.35);
      auraBlade.position.y = 3.2;

      const wingGuard = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.32, 0.65),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.9, metalness: 0.95, roughness: 0.1 })
      );
      wingGuard.position.y = 6.2;

      const hilt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 1.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0xf59e0b, emissiveIntensity: 0.5 })
      );
      hilt.position.y = 7.1;

      swordGroup.add(coreBlade, auraBlade, wingGuard, hilt);
      swordGroup.position.set(kPos.x, 12.5, kPos.z);
      this.checkmateVFXGroup.add(swordGroup);

      const spiritSwords = [];
      for (let i = 0; i < 12; i++) {
        const mini = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 1.8, 4),
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0xfef08a : 0xf97316,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
          })
        );
        mini.rotation.z = Math.PI;
        this.checkmateVFXGroup.add(mini);
        spiritSwords.push({ mesh: mini, angle: (i / 12) * Math.PI * 2, delay: i * 0.025 });
      }

      spawnSpiralRibbons(kPos.x, kPos.z, 0xef4444, 0xfef08a, 7.0, 1.4);

      let impacted = false;
      this.checkmateVFXAnimations.push({
        elapsed: 0,
        duration: 3.8,
        update: (t, dt) => {
          if (t < 0.15) {
            const p = t / 0.15;
            swordGroup.position.y = 12.5 * (1 - p * p * p);
          } else {
            swordGroup.position.y = 0.1 + Math.sin(t * 22) * 0.05;
            if (!impacted) {
              impacted = true;
              this.cameraShake = 1.05;
              spawnSupernovaExplosion(kPos.x, 0.4, kPos.z, 0xef4444, 0xfef08a, 135);
            }
          }

          spiritSwords.forEach(s => {
            s.angle += dt * 4.5;
            const r = 1.85 + Math.sin(t * 10 + s.delay * 10) * 0.25;
            const dropP = Math.min(1, Math.max(0, (t - s.delay) / 0.22));
            const sy = THREE.MathUtils.lerp(9.5, 1.1, dropP * dropP);
            s.mesh.position.set(kPos.x + Math.cos(s.angle) * r, sy, kPos.z + Math.sin(s.angle) * r);
          });
        }
      });
    } else if (vfxType === 'horse_cannon' || vfxType === 'double_cannon' || vfxType === 'cannon_barrage') {
      const mCoord = pattern.mountCoord || { r: Math.floor((checker.r + kCoord.r) / 2), c: kCoord.c };
      const mPos = gridToWorld(mCoord.r, mCoord.c);

      const bridgeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cPos.x, 0.35, cPos.z),
        new THREE.Vector3(mPos.x, 1.35, mPos.z),
        new THREE.Vector3(kPos.x, 0.35, kPos.z)
      ]);
      const bridgeTube = new THREE.Mesh(
        new THREE.TubeGeometry(bridgeCurve, 40, 0.11, 12, false),
        new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.checkmateVFXGroup.add(bridgeTube);

      for (let sIdx = 0; sIdx < 5; sIdx++) {
        const launchDelay = sIdx * 0.09;
        const startX = sIdx === 0 ? cPos.x : cPos.x + (Math.random() - 0.5) * 2.2;
        const startZ = sIdx === 0 ? cPos.z : cPos.z + (Math.random() - 0.5) * 2.2;
        const peakHeight = 4.8 + sIdx * 0.55;

        const meteor = new THREE.Mesh(
          new THREE.SphereGeometry(0.38, 20, 20),
          new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending })
        );
        const meteorAura = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            color: 0xff4500,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        meteorAura.scale.set(2.2, 2.2, 1);
        meteor.add(meteorAura);
        meteor.visible = false;
        this.checkmateVFXGroup.add(meteor);

        let det = false;
        this.checkmateVFXAnimations.push({
          elapsed: -launchDelay,
          duration: 1.5,
          update: (t) => {
            if (t < 0) return;
            if (t < 0.32) {
              meteor.visible = true;
              const p = t / 0.32;
              meteor.position.x = THREE.MathUtils.lerp(startX, kPos.x, p);
              meteor.position.z = THREE.MathUtils.lerp(startZ, kPos.z, p);
              meteor.position.y = 0.35 + Math.sin(p * Math.PI) * peakHeight;

              const trail = new THREE.Sprite(
                new THREE.SpriteMaterial({
                  map: glowTex,
                  color: 0xfbbf24,
                  transparent: true,
                  opacity: 0.85,
                  blending: THREE.AdditiveBlending,
                  depthWrite: false
                })
              );
              trail.position.copy(meteor.position);
              trail.scale.set(0.95, 0.95, 1);
              this.checkmateVFXGroup.add(trail);
              this.checkmateVFXAnimations.push({
                elapsed: 0,
                duration: 0.35,
                update: (tt) => {
                  trail.material.opacity = (1 - tt) * 0.8;
                  const ts = 0.95 * (1 - tt * 0.7);
                  trail.scale.set(ts, ts, 1);
                }
              });
            } else if (!det) {
              det = true;
              meteor.visible = false;
              this.cameraShake = 0.85;
              spawnSupernovaExplosion(
                kPos.x + (sIdx === 0 ? 0 : (Math.random() - 0.5) * 0.6),
                0.35,
                kPos.z + (sIdx === 0 ? 0 : (Math.random() - 0.5) * 0.6),
                0xff3300,
                0xfef08a,
                sIdx === 0 ? 95 : 40
              );
            }
          }
        });
      }
    } else if (vfxType === 'heaven_earth') {
      const skyPortal = new THREE.Mesh(
        new THREE.PlaneGeometry(8.5, 8.5),
        new THREE.MeshBasicMaterial({
          map: baguaTex,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      skyPortal.rotation.x = Math.PI / 2;
      skyPortal.position.set(kPos.x, 10.5, kPos.z);

      const corePillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.65, 14, 32, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      corePillar.position.set(kPos.x, 7.0, kPos.z);

      const outerPillar = new THREE.Mesh(
        new THREE.CylinderGeometry(1.45, 1.45, 14, 32, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      outerPillar.position.set(kPos.x, 7.0, kPos.z);

      const crossBeamV = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 13.5, 16),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      crossBeamV.rotation.x = Math.PI / 2;
      crossBeamV.position.set(kPos.x, 0.35, 0);

      const crossBeamH = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 11.5, 16),
        new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      crossBeamH.rotation.z = Math.PI / 2;
      crossBeamH.position.set(0, 0.35, kPos.z);

      this.checkmateVFXGroup.add(skyPortal, corePillar, outerPillar, crossBeamV, crossBeamH);
      spawnSpiralRibbons(kPos.x, kPos.z, 0xfef08a, 0xef4444, 10.5, 1.75);
      spawnSupernovaExplosion(kPos.x, 0.4, kPos.z, 0xf59e0b, 0xffffff, 130);

      this.checkmateVFXAnimations.push({
        elapsed: 0,
        duration: 3.6,
        update: (t, dt) => {
          skyPortal.rotation.z -= dt * 2.5;
          const pulse = 1 + Math.sin(t * 30) * 0.28;
          corePillar.scale.set(pulse, 1, pulse);
          outerPillar.scale.set(1 / pulse, 1, 1 / pulse);
          const fade = t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.35) : 1;
          corePillar.material.opacity = fade * 0.95;
          outerPillar.material.opacity = fade * 0.55;
          crossBeamV.material.opacity = fade * 0.9;
          crossBeamH.material.opacity = fade * 0.9;
          skyPortal.material.opacity = fade * 0.9;
        }
      });
    } else if (vfxType === 'smothered_cage' || vfxType === 'stalemate_vortex') {
      const cageGroup = new THREE.Group();
      cageGroup.position.set(kPos.x, 0, kPos.z);

      const obelisks = [];
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const ob = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.18, 3.6, 6),
          new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            emissive: 0xf59e0b,
            emissiveIntensity: 0.75,
            metalness: 0.95,
            roughness: 0.15
          })
        );
        cageGroup.add(ob);
        obelisks.push({ mesh: ob, ang });
      }

      const geoDome = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.35, 1),
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          wireframe: true,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending
        })
      );
      geoDome.position.y = 1.2;
      cageGroup.add(geoDome);

      this.checkmateVFXGroup.add(cageGroup);
      spawnSpiralRibbons(kPos.x, kPos.z, 0xd97706, 0x7c2d12, 4.2, 1.35);

      let slammed = false;
      this.checkmateVFXAnimations.push({
        elapsed: 0,
        duration: 4.0,
        update: (t, dt) => {
          const p = Math.min(1, t / 0.2);
          const radius = THREE.MathUtils.lerp(2.2, 0.82, p * p);
          const yPos = THREE.MathUtils.lerp(6.5, 1.6, p * p);
          obelisks.forEach(o => {
            o.mesh.position.set(Math.cos(o.ang) * radius, yPos, Math.sin(o.ang) * radius);
            o.mesh.rotation.z = Math.cos(o.ang) * 0.18;
            o.mesh.rotation.x = -Math.sin(o.ang) * 0.18;
          });
          geoDome.scale.setScalar(THREE.MathUtils.lerp(1.8, 0.88, p));
          geoDome.rotation.y += dt * 1.8;
          cageGroup.rotation.y -= dt * 0.9;
          if (p >= 1 && !slammed) {
            slammed = true;
            this.cameraShake = 0.85;
            spawnSupernovaExplosion(kPos.x, 0.3, kPos.z, 0xd97706, 0xfef08a, 95);
          }
        }
      });
    } else if (vfxType === 'double_chariot' || vfxType === 'bottom_tidal') {
      const slashGroup = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const crescent = new THREE.Mesh(
          new THREE.TorusGeometry(2.6, 0.18, 16, 48, Math.PI * 1.15),
          new THREE.MeshBasicMaterial({
            color: i === 0 ? 0xef4444 : 0xfef08a,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        crescent.rotation.x = Math.PI / 2;
        crescent.rotation.z = i === 0 ? 0 : Math.PI;
        crescent.position.set(i === 0 ? -7 : 7, 0.45 + i * 0.2, i === 0 ? kPos.z : cPos.z);
        slashGroup.add(crescent);
      }
      this.checkmateVFXGroup.add(slashGroup);

      for (let col = 0; col < 9; col++) {
        const pPos = gridToWorld(kCoord.r, col);
        const delay = Math.abs(col - 4) * 0.045;
        const flameCol = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.42, 4.5, 16, 1, true),
          new THREE.MeshBasicMaterial({
            color: col % 2 === 0 ? 0xff4500 : 0xfbbf24,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
          })
        );
        flameCol.position.set(pPos.x, 2.25, pPos.z);
        this.checkmateVFXGroup.add(flameCol);

        this.checkmateVFXAnimations.push({
          elapsed: -delay,
          duration: 1.8,
          update: (t, dt) => {
            if (t < 0) return;
            flameCol.rotation.y += dt * 6;
            const appear = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
            flameCol.material.opacity = appear * 0.85;
            flameCol.scale.set(1 + t * 0.8, appear, 1 + t * 0.8);
          }
        });
      }

      spawnSupernovaExplosion(kPos.x, 0.4, kPos.z, 0xff3300, 0xfef08a, 125);
      this.checkmateVFXAnimations.push({
        elapsed: 0,
        duration: 1.8,
        update: (t) => {
          const p = Math.min(1, t / 0.24);
          slashGroup.children[0].position.x = THREE.MathUtils.lerp(-7, 3, p);
          slashGroup.children[1].position.x = THREE.MathUtils.lerp(7, -3, p);
          const fade = t > 0.35 ? Math.max(0, 1 - (t - 0.35) / 0.65) : 1;
          slashGroup.children[0].material.opacity = fade;
          slashGroup.children[1].material.opacity = fade;
        }
      });
    } else if (vfxType === 'royal_gaze') {
      const rCoord = pattern.royalCoord || { r: 9 - kCoord.r, c: kCoord.c };
      const rPos = gridToWorld(rCoord.r, rCoord.c);
      const dist = Math.max(3.5, Math.hypot(kPos.x - rPos.x, kPos.z - rPos.z));
      const midX = (kPos.x + rPos.x) / 2;
      const midZ = (kPos.z + rPos.z) / 2;

      const sealCube = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.9, 1.1),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xd97706,
          emissiveIntensity: 0.9,
          metalness: 0.9,
          roughness: 0.12
        })
      );
      sealCube.position.set(rPos.x, 1.85, rPos.z);
      this.checkmateVFXGroup.add(sealCube);

      const coreBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, dist, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      coreBeam.rotation.x = Math.PI / 2;
      coreBeam.position.set(midX, 0.52, midZ);

      const auraBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78, 0.78, dist, 24),
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      auraBeam.rotation.x = Math.PI / 2;
      auraBeam.position.set(midX, 0.52, midZ);
      this.checkmateVFXGroup.add(coreBeam, auraBeam);

      for (let i = 0; i < 8; i++) {
        const f = (i + 1) / 9;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.75, 0.06, 12, 32),
          new THREE.MeshBasicMaterial({
            color: 0xfef08a,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        ring.position.set(rPos.x, 0.52, THREE.MathUtils.lerp(rPos.z, kPos.z, f));
        this.checkmateVFXGroup.add(ring);
        this.checkmateVFXAnimations.push({
          elapsed: 0,
          duration: 2.5,
          update: (t, dt) => {
            ring.rotation.z += dt * 5;
            const s = 1 + Math.sin(t * 25 - i * 0.6) * 0.35;
            ring.scale.set(s, s, 1);
            ring.material.opacity = Math.max(0, 1 - t * 0.7);
          }
        });
      }

      spawnSupernovaExplosion(kPos.x, 0.5, kPos.z, 0xf59e0b, 0xffffff, 130);
      this.checkmateVFXAnimations.push({
        elapsed: 0,
        duration: 3.0,
        update: (t, dt) => {
          sealCube.rotation.y += dt * 2.5;
          const s = 1 + Math.sin(t * 32) * 0.35;
          coreBeam.scale.set(s, 1, s);
          auraBeam.scale.set(1 / s, 1, 1 / s);
          const fade = Math.max(0, 1 - t * 0.65);
          coreBeam.material.opacity = fade;
          auraBeam.material.opacity = fade * 0.6;
        }
      });
    } else if (vfxType === 'double_lightning') {
      const buildThickBolt = (sx, sy, sz, ex, ey, ez, colorHex, thickness = 0.09) => {
        const pts = [];
        const segs = 14;
        for (let i = 0; i <= segs; i++) {
          const f = i / segs;
          const j = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 1.15;
          pts.push(new THREE.Vector3(
            THREE.MathUtils.lerp(sx, ex, f) + j,
            THREE.MathUtils.lerp(sy, ey, f),
            THREE.MathUtils.lerp(sz, ez, f) + j
          ));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        return new THREE.Mesh(
          new THREE.TubeGeometry(curve, 28, thickness, 6, false),
          new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
      };

      const bolts = [];
      const boltColors = [0xffffff, 0x38bdf8, 0xc084fc, 0xfef08a];
      for (let i = 0; i < 12; i++) {
        const b = buildThickBolt(
          kPos.x + (Math.random() - 0.5) * 4.5,
          11.5,
          kPos.z + (Math.random() - 0.5) * 4.5,
          kPos.x + (Math.random() - 0.5) * 0.8,
          0.1,
          kPos.z + (Math.random() - 0.5) * 0.8,
          boltColors[i % boltColors.length],
          i < 4 ? 0.11 : 0.055
        );
        this.checkmateVFXGroup.add(b);
        bolts.push(b);
      }

      if (pattern.checkers) {
        pattern.checkers.forEach((ch, idx) => {
          const cp = gridToWorld(ch.r, ch.c);
          const arc = buildThickBolt(cp.x, 0.45, cp.z, kPos.x, 0.45, kPos.z, idx === 0 ? 0xfef08a : 0x38bdf8, 0.08);
          this.checkmateVFXGroup.add(arc);
          bolts.push(arc);
        });
      }

      spawnSupernovaExplosion(kPos.x, 0.4, kPos.z, 0x38bdf8, 0xc084fc, 135);
      this.checkmateVFXAnimations.push({
        elapsed: 0,
        duration: 2.6,
        update: (t) => {
          bolts.forEach((b, idx) => {
            b.visible = Math.sin(t * 65 + idx * 2.1) > -0.25;
            b.material.opacity = Math.max(0, (1 - t * 0.65));
          });
        }
      });
    } else if (vfxType === 'horse_stomp') {
      const leapCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(cPos.x, 0.35, cPos.z),
        new THREE.Vector3((cPos.x + kPos.x) / 2, 4.2, (cPos.z + kPos.z) / 2),
        new THREE.Vector3(kPos.x, 0.35, kPos.z)
      );
      const rainbowTube = new THREE.Mesh(
        new THREE.TubeGeometry(leapCurve, 36, 0.14, 12, false),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.checkmateVFXGroup.add(rainbowTube);

      const spears = [];
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const spear = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 3.8, 6),
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0xfbbf24 : 0xef4444,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
          })
        );
        spear.position.set(kPos.x + Math.cos(ang) * 1.15, -2.0, kPos.z + Math.sin(ang) * 1.15);
        spear.rotation.z = -Math.cos(ang) * 0.25;
        spear.rotation.x = Math.sin(ang) * 0.25;
        this.checkmateVFXGroup.add(spear);
        spears.push(spear);
      }

      spawnSupernovaExplosion(kPos.x, 0.35, kPos.z, 0xfbbf24, 0xef4444, 115);
      this.checkmateVFXAnimations.push({
        elapsed: 0,
        duration: 3.2,
        update: (t) => {
          const p = Math.min(1, t / 0.18);
          spears.forEach(s => {
            s.position.y = THREE.MathUtils.lerp(-1.5, 1.65, p * p);
            if (t > 0.65) s.material.opacity = Math.max(0, 1 - (t - 0.65) / 0.35);
          });
        }
      });
    } else {
      spawnSpiralRibbons(kPos.x - 1.15, kPos.z, 0x10b981, 0xfef08a, 6.2, 0.85);
      spawnSpiralRibbons(kPos.x + 1.15, kPos.z, 0xef4444, 0xfef08a, 6.2, 0.85);

      const crown = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.65, 0.14, 64, 16),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending
        })
      );
      crown.position.set(kPos.x, 1.85, kPos.z);
      this.checkmateVFXGroup.add(crown);

      spawnSupernovaExplosion(kPos.x, 0.4, kPos.z, 0x10b981, 0xfef08a, 125);
      this.checkmateVFXAnimations.push({
        elapsed: 0,
        duration: 4.5,
        update: (t, dt) => {
          crown.rotation.y += dt * 3.2;
          crown.rotation.x += dt * 1.5;
          crown.position.y = 1.65 + Math.sin(t * 10) * 0.2;
        }
      });
    }
  },

  /**
   * 美化升级：落子/吃子水墨流光涟漪与玉石崩裂星芒粒子
   */
  spawnMoveImpactWave(worldX, worldZ, isCapture = false) {
    if (!this.scene) return;
    const markerTex = typeof getBoardMarkerTexture === 'function'
      ? getBoardMarkerTexture(isCapture ? 'warning' : 'last_to')
      : null;
    const mat = new THREE.MeshBasicMaterial({
      map: markerTex || null,
      color: isCapture ? 0xfef08a : 0xfde68a,
      transparent: true,
      opacity: isCapture ? 0.95 : 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const waveMesh = new THREE.Mesh(
      markerTex ? new THREE.PlaneGeometry(1.0, 1.0) : new THREE.RingGeometry(0.32, 0.46, 36),
      mat
    );
    waveMesh.rotation.x = -Math.PI / 2;
    waveMesh.position.set(worldX, 0.024, worldZ);
    this.scene.add(waveMesh);
    if (!this.impactWaves) this.impactWaves = [];
    this.impactWaves.push({
      mesh: waveMesh,
      age: 0,
      maxAge: isCapture ? 0.65 : 0.48,
      maxScale: isCapture ? 2.45 : 1.65
    });
  },

  spawnShatterFragments(worldX, worldZ, color) {
    const isRed = color === RED;
    this.spawnMoveImpactWave(worldX, worldZ, true);
    const glowTex = typeof getGlowParticleTexture === 'function' ? getGlowParticleTexture() : null;

    for (let i = 0; i < 16; i++) {
      const fragMat = new THREE.MeshStandardMaterial({
        color: isRed ? 0xf5ecd9 : 0x1e293b,
        emissive: isRed ? 0xd97706 : 0x38bdf8,
        emissiveIntensity: 0.35,
        roughness: 0.22,
        metalness: 0.3,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.04, 0), fragMat);
      mesh.position.set(worldX, 0.22, worldZ);
      this.scene.add(mesh);
      this.shatterParticles.push({
        mesh,
        vx: (Math.random() - 0.5) * 4.6,
        vy: 3.2 + Math.random() * 3.4,
        vz: (Math.random() - 0.5) * 4.6,
        life: 0,
        maxLife: 0.95
      });
    }

    if (glowTex) {
      for (let i = 0; i < 12; i++) {
        const spMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: i % 2 === 0 ? 0xfef08a : (isRed ? 0xef4444 : 0x38bdf8),
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const sp = new THREE.Sprite(spMat);
        sp.scale.set(0.42, 0.42, 1);
        sp.position.set(worldX, 0.25, worldZ);
        this.scene.add(sp);
        this.shatterParticles.push({
          mesh: sp,
          vx: (Math.random() - 0.5) * 5.2,
          vy: 2.5 + Math.random() * 4.0,
          vz: (Math.random() - 0.5) * 5.2,
          life: 0,
          maxLife: 0.75
        });
      }
    }
  },

  /**
   * 美化升级：宗师支招 3D 流光虹桥与落点灵柱特效
   */
  showGrandmasterHint3D(move) {
    this.clearGrandmasterHint3D();
    if (!this.scene || !window.THREE) return;
    this.hintVFXGroup = new THREE.Group();
    this.scene.add(this.hintVFXGroup);
    const a = gridToWorld(move.fr, move.fc);
    const b = gridToWorld(move.tr, move.tc);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(a.x, 0.36, a.z),
      new THREE.Vector3((a.x + b.x) / 2, 1.55, (a.z + b.z) / 2),
      new THREE.Vector3(b.x, 0.26, b.z)
    );

    // 内核金芒虹管 + 外层柔光晕管
    const coreTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 44, 0.042, 12, false),
      new THREE.MeshBasicMaterial({
        color: 0xfef9c3,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    const auraTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 44, 0.095, 12, false),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.hintVFXGroup.add(coreTube, auraTube);

    const startTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('selected') : null;
    const endTex = typeof getMoveIndicatorTexture === 'function' ? getMoveIndicatorTexture('capture_safe') : null;

    [a, b].forEach((pos, i) => {
      const tex = i === 0 ? startTex : endTex;
      const ring = new THREE.Mesh(
        tex ? new THREE.PlaneGeometry(1.36, 1.36) : new THREE.RingGeometry(0.38, 0.54, 36),
        new THREE.MeshBasicMaterial({
          map: tex || null,
          color: tex ? 0xffffff : (i ? 0x10b981 : 0xf59e0b),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.038, pos.z);
      this.hintVFXGroup.add(ring);
    });

    // 落点接引光柱
    const safeAura = typeof getTacticalAuraTextures === 'function' ? getTacticalAuraTextures('safe') : null;
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.42, 1.25, 24, 1, true),
      new THREE.MeshBasicMaterial({
        map: safeAura ? safeAura.cylinderMap : null,
        color: 0x6ee7b7,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    beacon.position.set(b.x, 0.64, b.z);
    this.hintVFXGroup.add(beacon);
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
