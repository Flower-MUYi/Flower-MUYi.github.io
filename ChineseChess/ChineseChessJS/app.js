/*************************************************************************
 * CORE 3D SCENE, PARK ENVIRONMENT & MAIN GAME CONTROLLER
 * Modularized Architecture:
 *   - constants.js : Piece tables & Path2D calligraphic vector glyphs
 *   - textures.js  : 2D Canvas procedural textures & carved piece medallions
 *   - vfx3d.js     : 18 Classic Checkmate 3D VFX & Hint trajectory
 *   - online.js    : PeerJS multiplayer, rematch/play-again consent, in-page modals
 *   - share-qr.js  : Endgame Workshop, newly redrawn scroll poster, social share, QR scanner
 *   - replay.js    : Treasure Box Replay ("复盘") & final-board replay sharing
 *************************************************************************/

class Xiangqi3DApp {
  constructor() {
    window.gameApp = this;
    this.container = document.getElementById('canvas-container');
    this.sfx = new SoundEffects();
    this.engine = new XiangqiEngine();

    this.gameMode = 'inferno';
    this.isBusy = false;
    this.gameOver = false;
    this.endgameReasonText = null;
    this.endgameEditor = false;
    this.replayMode = false;
    this.editorPiece = { color: RED, type: 'k' };
    this.editorErase = false;
    this.customEndgameSnapshot = null;
    this.editorFirstTurn = RED;

    this.peer = null;
    this.conn = null;
    this.onlineRole = null;
    this.roomCode = null;
    this.pendingUndoRequest = false;
    this.pendingDrawRequest = false;
    this.pendingRematchRequest = false;

    // 移动端默认收起吃子浮层以绝不遮挡棋盘；桌面端在左右两侧博古架展示，同样绝不遮挡棋盘
    this.capturedTrayCollapsed = window.innerWidth < 1024;

    this.selectedSquare = null;
    this.legalMovesForSelected = [];

    this.pieceMeshes = new Map();
    this.activeAnimations = [];
    this.shatterParticles = [];
    this.impactWaves = [];
    this.checkmateHighlightRings = [];
    this.illegalWarningRings = [];
    this.illegalToastTimer = null;
    this.cycleBannerTimer = null;
    this.checkmateVFXAnimations = [];
    this.vfxAtmosphereTimer = 0;
    this.vfxAtmosphereDuration = 0;
    this.lastCheckmatePattern = null;
    this.lastWinnerColor = null;
    this.currentCamPreset = 'red';

    this.initAIWorker();
    this.initThree();
    this.buildParkEnvironment();
    this.buildChessboard3D();
    this.buildInteractionMarkers();
    this.checkmateVFXGroup = new THREE.Group();
    this.scene.add(this.checkmateVFXGroup);
    this.syncPiecesFromEngine();
    this.setupControlsAndEvents();

    // 初始化默认标准对局的复盘会话
    this.initReplaySession?.(this.engine.board, this.engine.turn, 'standard');
    this.updateRestartButtonLabel();
    this.updateUI();
    this.checkURLParams();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initAIWorker() {
    this.aiWorker = null;
    this.aiCallback = null;
    try {
      this.aiWorker = new Worker('ChineseChessJS/ai-worker.js?v=20261021');
      this.aiWorker.onmessage = (e) => {
        const data = e.data;
        if (data.type === 'progress') {
          this.updateTelemetryUI(data.depth, data.nodes, data.score, this.engine.turn);
        } else if (data.type === 'result') {
          this.updateTelemetryUI(data.depth, data.nodes, data.score, this.engine.turn);
          if (this.aiCallback) {
            const cb = this.aiCallback;
            this.aiCallback = null;
            cb(data.move);
          }
        }
      };
      this.aiWorker.onerror = (err) => {
        console.warn('AI Worker 切换至主线程宗师引擎回退：', err);
        const cb = this.aiCallback;
        const reqPayload = this.lastAIPayload;
        this.aiCallback = null;
        try { this.aiWorker.terminate(); } catch (_) { }
        this.aiWorker = null;
        if (cb && reqPayload) {
          this.runMainThreadAIFallback(reqPayload, cb);
        }
      };
    } catch (err) {
      console.warn('Web Worker fallback active:', err);
    }
  }

  runMainThreadAIFallback(payload, callback) {
    setTimeout(() => {
      if (typeof window.runXiangqiAIEngine === 'function') {
        const res = window.runXiangqiAIEngine(payload, (prog) => {
          this.updateTelemetryUI(prog.depth, prog.nodes, prog.score, payload.turn);
        });
        this.updateTelemetryUI(res.depth, res.nodes, res.score, payload.turn);
        callback(res.move);
        return;
      }
      const forbiddenMoves = payload.forbiddenMoves || [];
      const allMoves = this.engine.getAllLegalMoves(payload.turn);
      const safeMoves = allMoves.filter(
        m => !forbiddenMoves.some(f => f.fr === m.fr && f.fc === m.fc && f.tr === m.tr && f.tc === m.tc)
      );
      callback((safeMoves.length > 0 ? safeMoves : allMoves)[0] || null);
    }, 30);
  }

  updateTelemetryUI(depth, nodes, scoreFromMover, moverColor) {
    const redScore = moverColor === RED ? scoreFromMover : -scoreFromMover;
    const clamped = Math.max(-2500, Math.min(2500, redScore));
    const pct = Math.round(50 + (clamped / 2500) * 45);
    const barEl = document.getElementById('eval-bar-red');
    if (barEl) barEl.style.width = `${pct}%`;

    const telEl = document.getElementById('ai-telemetry-text');
    if (!telEl) return;

    const nodesStr = nodes >= 1000 ? `${(nodes / 1000).toFixed(1)}k` : `${nodes}`;
    if (Math.abs(scoreFromMover) > 25000) {
      const matePly = Math.max(1, Math.ceil((29000 - Math.abs(scoreFromMover)) / 40));
      const winnerName = (scoreFromMover > 0 ? moverColor : (moverColor === RED ? BLACK : RED)) === RED ? '红方' : '黑方';
      telEl.textContent = `${depth} · ${nodesStr}节点 · ${winnerName}必胜 M${matePly}`;
    } else {
      const adv = Math.abs(redScore) < 60 ? '均势' : (redScore > 0 ? `红优 +${Math.round(redScore / 100)}` : `黑优 +${Math.round(-redScore / 100)}`);
      telEl.textContent = depth === '开局库' ? `开局库 · ${adv}` : `深${depth} · ${nodesStr}节点 · ${adv}`;
    }
  }

  requestAIMove(color, difficulty, callback) {
    const historyMoves = this.engine.history.map(h => h.move);
    const forbiddenMoves = this.engine.getForbiddenRepetitionMoves(color);

    const historyBoards = [];
    if (this.replaySnapshots && this.replaySnapshots.length > 0) {
      const recentSnaps = this.replaySnapshots.slice(-20);
      for (const s of recentSnaps) {
        const parsed = this.parseFENToBoard?.(s.fen);
        if (parsed) historyBoards.push(parsed);
      }
    }

    const payload = {
      board: this.engine.board,
      turn: color,
      difficulty,
      historyMoves,
      useBook: difficulty !== 'easy',
      forbiddenMoves,
      historyBoards
    };
    this.lastAIPayload = payload;

    if (!this.aiWorker) {
      this.initAIWorker();
    }
    if (this.aiWorker) {
      this.aiCallback = callback;
      try {
        this.aiWorker.postMessage(payload);
        const workerAtRequest = this.aiWorker;
        const callbackAtRequest = callback;
        const timeoutMs = (difficulty === 'inferno' || difficulty === 'grandmaster_hint') ? 10000 : 5000;
        setTimeout(() => {
          if (this.aiWorker === workerAtRequest && this.aiCallback === callbackAtRequest) {
            this.aiCallback = null;
            try { workerAtRequest.terminate(); } catch (_) { }
            this.aiWorker = null;
            this.initAIWorker();
            this.runMainThreadAIFallback(payload, callbackAtRequest);
          }
        }, timeoutMs);
      } catch (err) {
        this.aiCallback = null;
        this.runMainThreadAIFallback(payload, callback);
      }
    } else {
      this.runMainThreadAIFallback(payload, callback);
    }
  }

  /**
   * 支招功能（极高水准，兼顾残局破解与全局推演，弹窗提示中无“宗师支招：”前缀）
   */
  requestRedGrandmasterMove() {
    const side = this.engine.turn;
    if (this.isBusy || this.gameOver || this.onlineRole || this.replayMode) return;
    if (this.gameMode !== 'pvp' && side !== RED) return;
    this.sfx.playSelect();
    this.isBusy = true;
    this.clearLegalMoveIndicators();
    this.clearGrandmasterHint3D?.();
    this.selectedSquare = null;

    const badge = document.getElementById('ai-thinking');
    const label = document.getElementById('ai-thinking-label');
    badge?.classList.remove('hidden');
    badge?.classList.add('inline-flex');
    if (label) label.textContent = '深度推演支招中…';

    this.requestAIMove(side, 'grandmaster_hint', (move) => {
      badge?.classList.add('hidden');
      badge?.classList.remove('inline-flex');
      if (!move || this.gameOver) {
        this.isBusy = false;
        this.updateUI(this.engine.isInCheck(this.engine.turn));
        return;
      }
      const notation = this.formatChineseMoveNotation(move);
      const mover = this.engine.board[move.fr]?.[move.fc];
      const target = this.engine.board[move.tr]?.[move.tc];
      let tactic = target ? `争取吃子：${target.char || '子'}` : '锦囊妙手';
      try {
        const after = this.engine.cloneBoard(this.engine.board);
        after[move.tr][move.tc] = mover;
        after[move.fr][move.fc] = null;
        const a = this.engine.classifyMoveAction?.(move, mover, this.engine.board, after);
        if (a?.type === 'jiang') tactic = '雷霆叫将';
        else if (a?.type === 'sha') tactic = '致命叫杀';
        else if (a?.desc) tactic = a.desc;
      } catch (_) { }

      this.showGrandmasterHint3D?.(move);
      this.showCenterCallout(`【${notation}】· ${tactic}`, side);

      setTimeout(() => {
        if (this.gameOver) {
          this.clearGrandmasterHint3D?.();
          this.isBusy = false;
          return;
        }
        this.executeMoveAnimated(move, () => setTimeout(() => this.clearGrandmasterHint3D?.(), 800));
      }, 650);
    });
  }

  formatChineseMoveNotation(move) {
    const p = this.engine.board[move.fr]?.[move.fc];
    if (!p) return '妙手';
    const red = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const black = ['１', '２', '３', '４', '５', '６', '７', '８', '９'];
    const col = c => p.color === RED ? red[8 - c] : black[c];
    const step = n => p.color === RED ? red[Math.max(0, n - 1)] : black[Math.max(0, n - 1)];
    const dr = move.tr - move.fr;
    let action = '平', target = col(move.tc);
    if (dr !== 0) {
      action = (p.color === RED ? dr < 0 : dr > 0) ? '进' : '退';
      target = ['n', 'b', 'a'].includes(p.type) ? col(move.tc) : step(Math.abs(dr));
    }
    return `${p.char || PIECE_CHARS[p.color]?.[p.type] || '子'}${col(move.fc)}${action}${target}`;
  }

  updateViewportScale(animate = true) {
    const w = Math.max(320, window.innerWidth || 1024);
    const h = Math.max(320, window.innerHeight || 768);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const portraitScale = aspect < 0.85 ? THREE.MathUtils.clamp(0.85 / aspect, 1.0, 1.68) : 1.0;
    this.camera.fov = aspect < 0.85 ? 46 : 42;
    this.camera.updateProjectionMatrix();

    const baseRadius = this.basePresetRadius || 17.5;
    this.desiredSpherical.radius = THREE.MathUtils.clamp(baseRadius * portraitScale, 9.5, 32.0);
    if (!animate) {
      this.camSpherical.radius = this.desiredSpherical.radius;
    }
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdce8dc);
    this.scene.fog = new THREE.FogExp2(0xdce8dc, 0.015);

    const w = Math.max(320, window.innerWidth || 1024);
    const h = Math.max(320, window.innerHeight || 768);
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 150);

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (_) {
      this.renderer = new THREE.WebGLRenderer({ antialias: false });
    }
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.container.appendChild(this.renderer.domElement);

    this.camTarget = new THREE.Vector3(0, 0, 0.3);
    this.camSpherical = { radius: 17.5, phi: 0.72, theta: 0 };
    this.desiredSpherical = { ...this.camSpherical };
    this.cameraShake = 0;

    this.hemiLight = new THREE.HemisphereLight(0xfef9e7, 0x688264, 0.75);
    this.hemiLight.position.set(0, 30, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.15);
    this.sunLight.position.set(12, 22, 14);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 55;
    const d = 16;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.45);
    fillLight.position.set(-14, 12, -10);
    this.scene.add(fillLight);

    this.basePresetRadius = 17.5;
    this.updateViewportScale(false);
  }

  buildParkEnvironment() {
    this.parkGroup = new THREE.Group();
    this.scene.add(this.parkGroup);

    const groundGeo = new THREE.CylinderGeometry(55, 55, 1, 64);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x8fb381 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -4.8;
    ground.receiveShadow = true;
    this.parkGroup.add(ground);

    const patioGeo = new THREE.CylinderGeometry(9.5, 9.8, 0.25, 48);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5cf,
      roughness: 0.85,
      metalness: 0.05
    });
    const patio = new THREE.Mesh(patioGeo, stoneMat);
    patio.position.y = -4.25;
    patio.receiveShadow = true;
    this.parkGroup.add(patio);

    for (let i = 0; i < 6; i++) {
      const stepGeo = new THREE.CylinderGeometry(1.3, 1.4, 0.2, 7);
      const step = new THREE.Mesh(stepGeo, stoneMat);
      const angle = 0.8 + i * 0.22;
      const dist = 11.2 + i * 2.6;
      step.position.set(Math.cos(angle) * dist, -4.25, Math.sin(angle) * dist);
      step.rotation.y = i;
      step.receiveShadow = true;
      this.parkGroup.add(step);
    }

    const tableTopMat = new THREE.MeshStandardMaterial({
      color: 0x949e99,
      roughness: 0.65,
      metalness: 0.1
    });
    const tableDarkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x737d78,
      roughness: 0.8,
      metalness: 0.08
    });

    const slabGeo = new THREE.CylinderGeometry(7.9, 7.6, 0.75, 48);
    const slab = new THREE.Mesh(slabGeo, tableTopMat);
    slab.position.y = -0.62;
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.parkGroup.add(slab);

    const rimGeo = new THREE.TorusGeometry(7.72, 0.16, 12, 64);
    const rim = new THREE.Mesh(rimGeo, tableDarkStoneMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.45;
    this.parkGroup.add(rim);

    const pillarGeo = new THREE.CylinderGeometry(2.4, 3.1, 3.6, 24);
    const pillar = new THREE.Mesh(pillarGeo, tableDarkStoneMat);
    pillar.position.y = -2.6;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    this.parkGroup.add(pillar);

    const stoolPositions = [
      { x: 0, z: 9.2 },
      { x: 0, z: -9.2 },
      { x: 9.2, z: 0 },
      { x: -9.2, z: 0 }
    ];
    stoolPositions.forEach(pos => {
      const stoolGroup = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.55, 0.45, 24), tableTopMat);
      seat.position.y = -2.1;
      seat.castShadow = true;
      seat.receiveShadow = true;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 1.9, 16), tableDarkStoneMat);
      base.position.y = -3.25;
      base.castShadow = true;
      base.receiveShadow = true;
      stoolGroup.add(seat, base);
      stoolGroup.position.set(pos.x, 0, pos.z);
      this.parkGroup.add(stoolGroup);
    });

    this.trees = [];
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6d543e });
    const foliageColors = [0x4d7c5d, 0x5c9269, 0x74a678, 0xd48c96];

    const treeConfigs = [
      { x: -13.5, z: -11.5, scale: 1.35, colorIdx: 0 },
      { x: 14.0, z: -10.5, scale: 1.5, colorIdx: 1 },
      { x: -15.0, z: 9.5, scale: 1.2, colorIdx: 2 },
      { x: 13.0, z: 11.5, scale: 1.25, colorIdx: 3 },
      { x: -6.5, z: -16.5, scale: 1.1, colorIdx: 1 },
      { x: 7.5, z: -17.0, scale: 1.4, colorIdx: 0 },
      { x: 18.5, z: 1.0, scale: 1.15, colorIdx: 2 }
    ];

    treeConfigs.forEach((cfg, idx) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 4.5, 7), trunkMat);
      trunk.position.y = -2.0;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      const crownGroup = new THREE.Group();
      const leafMat = new THREE.MeshLambertMaterial({ color: foliageColors[cfg.colorIdx] });

      for (let tier = 0; tier < 3; tier++) {
        const radius = (2.8 - tier * 0.65);
        const height = (3.2 - tier * 0.45);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), leafMat);
        cone.position.y = 0.8 + tier * 1.75;
        cone.rotation.y = tier * 0.6;
        cone.castShadow = true;
        cone.receiveShadow = true;
        crownGroup.add(cone);
      }

      tree.add(crownGroup);
      tree.position.set(cfg.x, 0, cfg.z);
      tree.scale.setScalar(cfg.scale);
      this.parkGroup.add(tree);
      this.trees.push({ group: crownGroup, phase: idx * 1.3 });
    });

    this.dappledCanopy = new THREE.Group();
    const canopyGeo = new THREE.DodecahedronGeometry(1.6, 0);
    const highBranchMat = new THREE.MeshLambertMaterial({ color: 0x5c9269 });
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(canopyGeo, highBranchMat);
      puff.position.set(7.5 + i * 1.1, 10.5 + (i % 2) * 0.8, 6.5 - i * 0.9);
      puff.scale.set(1.2, 0.4, 1.2);
      puff.castShadow = true;
      this.dappledCanopy.add(puff);
    }
    this.scene.add(this.dappledCanopy);

    this.breezeParticles = [];
    const petalGeo = new THREE.PlaneGeometry(0.18, 0.12);
    const petalMat = new THREE.MeshBasicMaterial({
      color: 0xffe4e6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });

    for (let i = 0; i < 42; i++) {
      const p = new THREE.Mesh(petalGeo, petalMat);
      p.position.set(
        (Math.random() - 0.5) * 26,
        Math.random() * 10 - 1,
        (Math.random() - 0.5) * 26
      );
      p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(p);
      this.breezeParticles.push({
        mesh: p,
        speedY: 0.4 + Math.random() * 0.5,
        speedX: 0.5 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  buildChessboard3D() {
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    const boardOuterW = BOARD_WIDTH + 1.8;
    const boardOuterH = BOARD_HEIGHT + 1.8;
    const boardThickness = 0.44;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.45 });
    const topTex = createChessboardTexture();
    const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.38 });

    const materials = [frameMat, frameMat, topMat, frameMat, frameMat, frameMat];
    const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(boardOuterW, boardThickness, boardOuterH), materials);
    boardMesh.position.y = -boardThickness / 2;
    boardMesh.castShadow = true;
    boardMesh.receiveShadow = true;
    this.boardGroup.add(boardMesh);
  }

  buildInteractionMarkers() {
    this.markersGroup = new THREE.Group();
    this.scene.add(this.markersGroup);

    const selGeo = new THREE.RingGeometry(0.45, 0.56, 32);
    const selMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    this.selectedRing = new THREE.Mesh(selGeo, selMat);
    this.selectedRing.rotation.x = -Math.PI / 2;
    this.selectedRing.position.y = 0.02;
    this.selectedRing.visible = false;
    this.scene.add(this.selectedRing);

    const lastGeo = new THREE.RingGeometry(0.42, 0.49, 32);
    const lastMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
    this.lastFromRing = new THREE.Mesh(lastGeo, lastMat);
    this.lastFromRing.rotation.x = -Math.PI / 2;
    this.lastFromRing.position.y = 0.015;
    this.lastFromRing.visible = false;

    this.lastToRing = new THREE.Mesh(lastGeo, lastMat);
    this.lastToRing.rotation.x = -Math.PI / 2;
    this.lastToRing.position.y = 0.015;
    this.lastToRing.visible = false;
    this.scene.add(this.lastFromRing, this.lastToRing);

    this.moveIndicators = [];
  }

  createPieceMesh(pieceData, r, c) {
    const group = new THREE.Group();
    const isRed = pieceData.color === RED;

    const bodyMat = isRed
      ? new THREE.MeshPhysicalMaterial({ color: 0xfaf3e3, roughness: 0.22, metalness: 0.03, clearcoat: 0.65 })
      : new THREE.MeshPhysicalMaterial({ color: 0x131924, roughness: 0.08, metalness: 0.22, clearcoat: 1.0 });

    const height = 0.34;
    const radius = 0.44;

    const cylMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.94, radius, height, 36), bodyMat);
    cylMesh.position.y = height / 2;
    cylMesh.castShadow = true;
    group.add(cylMesh);

    const rimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.92, 0.028, 12, 36),
      new THREE.MeshStandardMaterial({ color: isRed ? 0xd4af37 : 0x94a3b8, metalness: 0.85 })
    );
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = height - 0.01;
    group.add(rimMesh);

    const { map, bumpMap } = getPieceMedallionTextures(pieceData.color, pieceData.char);
    const topDisc = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.91, 36),
      new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 0.028 })
    );
    topDisc.rotation.x = -Math.PI / 2;
    const flipForBlack = (this.onlineRole === BLACK) || (!this.onlineRole && this.gameMode === 'pvp' && pieceData.color === BLACK);
    topDisc.rotation.z = flipForBlack ? Math.PI : 0;
    topDisc.position.y = height + 0.002;
    group.add(topDisc);

    const auraRing = new THREE.Mesh(
      new THREE.RingGeometry(0.44, 0.51, 32),
      new THREE.MeshBasicMaterial({ color: isRed ? 0xef4444 : 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.0 })
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.01;
    group.add(auraRing);

    const pos = gridToWorld(r, c);
    group.position.set(pos.x, 0, pos.z);
    group.userData = { pieceId: pieceData.id, color: pieceData.color, type: pieceData.type, r, c, auraMat: auraRing.material, topDisc };
    this.scene.add(group);
    return group;
  }

  syncPiecesFromEngine() {
    for (const mesh of this.pieceMeshes.values()) this.scene.remove(mesh);
    this.pieceMeshes.clear();
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = this.engine.board[r][c];
        if (p) this.pieceMeshes.set(p.id, this.createPieceMesh(p, r, c));
      }
    }
  }

  updatePiecesOrientation() {
    for (const mesh of this.pieceMeshes.values()) {
      if (!mesh.userData?.topDisc) continue;
      const flipForBlack = (this.onlineRole === BLACK) || (!this.onlineRole && this.gameMode === 'pvp' && mesh.userData.color === BLACK);
      mesh.userData.topDisc.rotation.z = flipForBlack ? Math.PI : 0;
    }
  }

  clearLegalMoveIndicators() {
    for (const m of this.moveIndicators) this.markersGroup.remove(m);
    this.moveIndicators = [];
    this.selectedRing.visible = false;
  }

  clearIllegalWarningRings() {
    if (!this.illegalWarningRings) return;
    for (const item of this.illegalWarningRings) this.scene.remove(item.mesh);
    this.illegalWarningRings = [];
  }

  hideIllegalMovePrompt() {
    const toastEl = document.getElementById('illegal-move-toast');
    if (toastEl) {
      toastEl.dataset.forceHidden = 'true';
      toastEl.classList.add('toast-hidden');
      toastEl.style.display = 'none';
    }
    if (this.illegalToastTimer) {
      clearTimeout(this.illegalToastTimer);
      this.illegalToastTimer = null;
    }
  }

  showIllegalMovePrompt(diagnosis, duration = 2500) {
    if (!diagnosis) return;
    this.sfx.playIllegal();
    this.cameraShake = 0.12;

    const toastEl = document.getElementById('illegal-move-toast');
    const iconEl = document.getElementById('illegal-toast-icon');
    const titleEl = document.getElementById('illegal-toast-title');
    const descEl = document.getElementById('illegal-toast-desc');
    const barEl = document.getElementById('illegal-toast-bar');

    if (toastEl && titleEl && descEl) {
      if (iconEl) iconEl.textContent = diagnosis.icon || 'gpp_maybe';
      titleEl.textContent = diagnosis.title || '禁着提示';
      descEl.textContent = diagnosis.message || '该步违反走子规则，请重新选择落点。';

      if (barEl) {
        barEl.style.setProperty('--toast-duration', `${duration}ms`);
        barEl.style.animation = 'none';
        void barEl.offsetWidth;
        barEl.style.animation = '';
      }

      delete toastEl.dataset.forceHidden;
      toastEl.style.removeProperty('display');
      toastEl.classList.remove('toast-hidden');
      if (this.illegalToastTimer) clearTimeout(this.illegalToastTimer);
      this.illegalToastTimer = setTimeout(() => this.hideIllegalMovePrompt(), duration);
    }

    this.clearIllegalWarningRings();
    if (Array.isArray(diagnosis.highlightSquares)) {
      diagnosis.highlightSquares.forEach((sq, idx) => {
        if (!sq || typeof sq.r !== 'number' || typeof sq.c !== 'number') return;
        const pos = gridToWorld(sq.r, sq.c);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.42, 0.56, 32),
          new THREE.MeshBasicMaterial({ color: idx === 0 ? 0xef4444 : 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(pos.x, 0.036, pos.z);
        this.scene.add(ring);
        this.illegalWarningRings.push({ mesh: ring, age: 0, maxAge: 1.6 });
      });
    }
  }

  showLegalMoveIndicators(r, c, moves) {
    this.clearLegalMoveIndicators();
    const selPos = gridToWorld(r, c);
    this.selectedRing.position.set(selPos.x, 0.022, selPos.z);
    this.selectedRing.visible = true;

    for (const m of moves) {
      const pos = gridToWorld(m.tr, m.tc);
      const isCapture = Boolean(m.capture);
      const holder = new THREE.Group();
      holder.position.set(pos.x, 0.025, pos.z);
      holder.userData = { isCapture };

      if (isCapture) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.45, 0.56, 32),
          new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        holder.add(ring);
      } else {
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(0.18, 24),
          new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
        );
        dot.rotation.x = -Math.PI / 2;
        holder.add(dot);
      }

      const hitMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.62, 0.55, 16),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.position.y = 0.2;
      hitMesh.userData = { isMoveTarget: true, move: m };
      holder.add(hitMesh);

      this.markersGroup.add(holder);
      this.moveIndicators.push(holder);
    }
  }

  toggleMoreMenu(forceState) {
    const menu = document.getElementById('more-tools-menu');
    if (!menu) return;
    const willShow = typeof forceState === 'boolean' ? forceState : menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !willShow);
    if (willShow) {
      this.sfx.playSelect();
      document.getElementById('custom-endgame-panel')?.classList.add('hidden');
      document.getElementById('vfx-drawer')?.classList.add('hidden');
      document.getElementById('online-modal')?.classList.add('hidden');
    }
  }

  executeMoveAnimated(move, onComplete, isRemote = false) {
    this.hideIllegalMovePrompt();
    this.isBusy = true;
    this.clearLegalMoveIndicators();
    this.selectedSquare = null;

    const movingPiece = this.engine.board[move.fr][move.fc];
    const targetPiece = this.engine.board[move.tr][move.tc];
    const movingMesh = this.pieceMeshes.get(movingPiece.id);
    const targetMesh = targetPiece ? this.pieceMeshes.get(targetPiece.id) : null;

    const startPos = gridToWorld(move.fr, move.fc);
    const endPos = gridToWorld(move.tr, move.tc);
    const isCapture = Boolean(targetPiece);

    if (this.gameMode !== 'pvp' && movingPiece.color === BLACK) {
      this.sfx.playPickUp(movingPiece.color, true);
    }

    const notation = this.formatChineseMoveNotation(move);
    const moverColor = this.engine.turn;
    const moveRes = this.engine.makeMove(move);

    this.recordReplayStep?.(move, notation, moverColor, moveRes.actionTag);

    if (!isRemote && this.conn?.open) {
      this.conn.send({ type: 'move', move: { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc } });
    }

    this.lastFromRing.position.set(startPos.x, 0.015, startPos.z);
    this.lastFromRing.visible = true;
    this.lastToRing.position.set(endPos.x, 0.015, endPos.z);
    this.lastToRing.visible = true;

    this.activeAnimations.push({
      mesh: movingMesh,
      elapsed: 0,
      duration: isCapture ? 0.5 : 0.34,
      update: (t) => {
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        movingMesh.position.x = THREE.MathUtils.lerp(startPos.x, endPos.x, ease);
        movingMesh.position.z = THREE.MathUtils.lerp(startPos.z, endPos.z, ease);
        movingMesh.position.y = Math.sin(ease * Math.PI) * 0.8;
      },
      complete: () => {
        movingMesh.position.set(endPos.x, 0, endPos.z);
        movingMesh.rotation.set(0, 0, 0);
        movingMesh.userData.r = move.tr;
        movingMesh.userData.c = move.tc;
        if (isCapture && targetMesh) {
          this.scene.remove(targetMesh);
          this.pieceMeshes.delete(targetPiece.id);
          this.spawnShatterFragments(endPos.x, endPos.z, targetPiece.color);
          this.sfx.playAttackShatter();
        } else {
          this.sfx.playMove(movingPiece.color, movingPiece.type);
        }
        this.onTurnFinished();
        if (onComplete) onComplete();
      }
    });
  }

  hideCycleWarningBanner() {
    const banner = document.getElementById('cycle-warning-banner');
    if (banner) {
      banner.dataset.forceHidden = 'true';
      banner.classList.add('hidden');
      banner.classList.remove('flex');
      banner.style.display = 'none';
    }
    if (this.cycleBannerTimer) {
      clearTimeout(this.cycleBannerTimer);
      this.cycleBannerTimer = null;
    }
  }

  updateCycleWarningUI(cycleStatus) {
    const banner = document.getElementById('cycle-warning-banner');
    if (!banner) return;

    if (this.cycleBannerTimer) {
      clearTimeout(this.cycleBannerTimer);
      this.cycleBannerTimer = null;
    }

    if (!cycleStatus || cycleStatus.remainingSteps <= 0) {
      banner.dataset.forceHidden = 'true';
      banner.classList.add('hidden');
      banner.classList.remove('flex');
      banner.style.display = 'none';
      return;
    }

    document.getElementById('cycle-red-tag').textContent = cycleStatus.redInfo.fullLabel;
    document.getElementById('cycle-black-tag').textContent = cycleStatus.blackInfo.fullLabel;
    document.getElementById('cycle-rule-desc').textContent = cycleStatus.ruleExplanation;
    document.getElementById('cycle-countdown-badge').textContent = `⚠️ 再走 ${cycleStatus.remainingSteps} 步判负`;

    delete banner.dataset.forceHidden;
    banner.style.removeProperty('display');
    banner.style.display = 'flex';
    banner.classList.remove('hidden');
    banner.classList.add('flex');

    this.cycleBannerTimer = setTimeout(() => {
      this.hideCycleWarningBanner();
    }, 3500);
  }

  triggerRuleAdjudication(cycleStatus) {
    this.gameOver = true;
    this.isBusy = false;
    this.hideCycleWarningBanner();
    let winnerColor = 'draw';
    let calloutTitle = '双方不变 · 判和！';
    if (cycleStatus.verdict === 'RED_LOSE') { winnerColor = BLACK; calloutTitle = '红方循环不变 · 判负！'; }
    else if (cycleStatus.verdict === 'BLACK_LOSE') { winnerColor = RED; calloutTitle = '黑方循环不变 · 判负！'; }

    const rulePattern = {
      title: calloutTitle,
      badge: `竞赛循环裁决 · ${cycleStatus.verdictShort}`,
      poem: '“天道有常须变着，执迷不悟判负还。”',
      analysis: cycleStatus.ruleExplanation,
      highlightCoords: [],
      vfxType: 'stalemate_vortex'
    };
    this.recordReplayOutcome?.(winnerColor, calloutTitle);
    this.updateRestartButtonLabel();
    this.updateUI(this.engine.isInCheck(this.engine.turn));
    this.sfx.playVictorySeal();
    this.showCenterCallout(calloutTitle, winnerColor === 'draw' ? RED : winnerColor);
    setTimeout(() => { if (this.gameOver) this.showGameOverModal(winnerColor, rulePattern); }, 1450);
  }

  onTurnFinished() {
    const currentTurn = this.engine.turn;
    const inCheck = this.engine.isInCheck(currentTurn);
    const legalMoves = this.engine.getAllLegalMoves(currentTurn);

    this.updateUI(inCheck);

    if (legalMoves.length === 0) {
      this.gameOver = true;
      this.isBusy = false;
      this.hideCycleWarningBanner();
      const winner = currentTurn === RED ? BLACK : RED;
      const pattern = CheckmateClassifier.classify(this.engine, currentTurn);
      this.recordReplayOutcome?.(winner, pattern.title);
      this.updateRestartButtonLabel();
      this.updateUI(inCheck);
      this.showCheckmateHighlights(pattern.highlightCoords);
      this.triggerCheckmateVFX(pattern, winner);
      this.showCenterCallout(pattern.title, winner);
      setTimeout(() => { if (this.gameOver) this.showGameOverModal(winner, pattern); }, 2100);
      return;
    }

    const cycleStatus = this.engine.analyzeCycleStatus();
    if (cycleStatus) {
      if (cycleStatus.remainingSteps === 0) {
        this.triggerRuleAdjudication(cycleStatus);
        return;
      }
      this.updateCycleWarningUI(cycleStatus);
      if (cycleStatus.remainingSteps === cycleStatus.period || cycleStatus.remainingSteps <= 2) {
        this.showIllegalMovePrompt({ icon: 'gavel', title: `循环裁决警告 (${cycleStatus.remainingSteps}步)`, message: cycleStatus.ruleExplanation }, 3000);
      }
    } else {
      this.hideCycleWarningBanner();
    }

    if (inCheck) {
      this.sfx.playCheck();
      this.showCenterCallout('将军！', currentTurn === RED ? BLACK : RED);
    }

    if (this.gameMode !== 'pvp' && currentTurn === BLACK && !this.gameOver) {
      this.isBusy = true;
      const aiBadge = document.getElementById('ai-thinking');
      const aiLabel = document.getElementById('ai-thinking-label');
      aiBadge?.classList.remove('hidden');
      aiBadge?.classList.add('inline-flex');
      if (aiLabel) aiLabel.textContent = this.gameMode === 'inferno' ? '宗师推演中...' : 'AI 思考中...';

      this.requestAIMove(BLACK, this.gameMode, (aiMove) => {
        aiBadge?.classList.add('hidden');
        aiBadge?.classList.remove('inline-flex');
        if (aiMove && !this.gameOver) this.executeMoveAnimated(aiMove);
        else { this.isBusy = false; this.updateUI(this.engine.isInCheck(this.engine.turn)); }
      });
    } else {
      this.isBusy = false;
      this.updateUI(inCheck);
    }
  }

  handleBoardClick(clientX, clientY) {
    // 移动端点击棋盘时若吃子浮层展开，自动收起以保持视野清爽无遮挡
    if (window.innerWidth < 1024 && !this.capturedTrayCollapsed) {
      this.capturedTrayCollapsed = true;
      this.syncCapturedTrayVisibility();
    }

    if (this.isBusy || this.replayMode || (this.gameOver && !this.endgameEditor)) return;
    if (!this.endgameEditor && this.gameMode !== 'pvp' && this.engine.turn === BLACK) return;
    if (!this.endgameEditor && this.onlineRole && this.engine.turn !== this.onlineRole) return;

    if (this.checkmateVFXGroup && this.checkmateVFXGroup.children.length > 0) {
      this.clearCheckmateVFX();
      this.clearCheckmateHighlights();
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    if (this.selectedSquare && this.moveIndicators.length > 0) {
      const hitTargets = [];
      this.moveIndicators.forEach(group => {
        group.children.forEach(ch => {
          if (ch.userData && (ch.userData.isMoveTarget || ch.userData.isForbiddenTarget)) hitTargets.push(ch);
        });
      });
      const moveHits = raycaster.intersectObjects(hitTargets, false);
      if (moveHits.length > 0) {
        const hitData = moveHits[0].object.userData;
        if (hitData.isMoveTarget) {
          this.clearIllegalWarningRings();
          this.executeMoveAnimated(hitData.move);
          return;
        } else if (hitData.isForbiddenTarget) {
          const diagnosis = this.engine.diagnoseIllegalMove(hitData.move.fr, hitData.move.fc, hitData.move.tr, hitData.move.tc);
          this.showIllegalMovePrompt(diagnosis);
          return;
        }
      }
    }

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.15);
    const intersectPt = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPt);

    if (intersectPt) {
      const c = Math.round(intersectPt.x / CELL_SIZE + 4);
      const r = Math.round(intersectPt.z / CELL_SIZE + 4.5);
      if (this.engine.inBounds(r, c)) {
        if (this.endgameEditor) { this.editBoardSquare(r, c); return; }
        const clickedPiece = this.engine.board[r][c];

        if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
          if (clickedPiece) this.sfx.playMove(clickedPiece.color, clickedPiece.type);
          this.selectedSquare = null;
          this.legalMovesForSelected = [];
          this.clearLegalMoveIndicators();
          return;
        }

        if (clickedPiece && clickedPiece.color === this.engine.turn) {
          this.clearIllegalWarningRings();
          this.sfx.playPickUp(clickedPiece.color, false);
          this.selectedSquare = { r, c };
          this.legalMovesForSelected = this.engine.getLegalMoves(r, c);
          this.showLegalMoveIndicators(r, c, this.legalMovesForSelected);
          return;
        }

        if (this.selectedSquare) {
          const matchingMove = this.legalMovesForSelected.find(m => m.tr === r && m.tc === c);
          if (matchingMove) {
            this.clearIllegalWarningRings();
            this.executeMoveAnimated(matchingMove);
            return;
          }
          const diagnosis = this.engine.diagnoseIllegalMove(this.selectedSquare.r, this.selectedSquare.c, r, c);
          this.showIllegalMovePrompt(diagnosis);
          return;
        }
      }
    }

    if (this.selectedSquare) {
      const prevPiece = this.engine.board[this.selectedSquare.r]?.[this.selectedSquare.c];
      if (prevPiece) this.sfx.playMove(prevPiece.color, prevPiece.type);
    }
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.clearLegalMoveIndicators();
  }

  setupControlsAndEvents() {
    const dom = this.renderer.domElement;
    const activePointers = new Map();
    let primaryDownPos = { x: 0, y: 0 };
    let primaryDownTime = 0;
    let maxMoveDistance = 0;
    let lastPinchDist = 0;
    let hadMultiTouch = false;

    const getPinchDistance = () => {
      const pts = Array.from(activePointers.values());
      return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    dom.addEventListener('contextmenu', e => e.preventDefault());
    dom.addEventListener('pointerdown', e => {
      this.sfx.init();
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 1) {
        primaryDownPos = { x: e.clientX, y: e.clientY };
        primaryDownTime = performance.now();
        maxMoveDistance = 0;
        hadMultiTouch = false;
      } else if (activePointers.size === 2) {
        hadMultiTouch = true;
        lastPinchDist = getPinchDistance();
      }
    });

    window.addEventListener('pointermove', e => {
      if (!activePointers.has(e.pointerId)) return;
      const prev = activePointers.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1 && !hadMultiTouch) {
        maxMoveDistance = Math.max(maxMoveDistance, Math.hypot(e.clientX - primaryDownPos.x, e.clientY - primaryDownPos.y));
        const isTouch = e.pointerType === 'touch';
        if (maxMoveDistance > (isTouch ? 6 : 2)) {
          const rotSpeed = isTouch ? 0.0085 : 0.007;
          this.desiredSpherical.theta -= dx * rotSpeed;
          this.desiredSpherical.phi = THREE.MathUtils.clamp(this.desiredSpherical.phi - dy * (rotSpeed * 0.85), 0.12, 1.28);
        }
      } else if (activePointers.size === 2) {
        const curDist = getPinchDistance();
        if (lastPinchDist > 0 && curDist > 0) {
          this.desiredSpherical.radius = THREE.MathUtils.clamp(this.desiredSpherical.radius + (lastPinchDist - curDist) * 0.045, 9.5, 32.0);
        }
        lastPinchDist = curDist;
      }
    }, { passive: true });

    const onPointerEnd = e => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) lastPinchDist = 0;
      if (activePointers.size === 0 && !hadMultiTouch && e.type === 'pointerup') {
        if (maxMoveDistance < (e.pointerType === 'touch' ? 14 : 6) && performance.now() - primaryDownTime < 550) {
          this.handleBoardClick(e.clientX, e.clientY);
        }
      }
    };

    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    dom.addEventListener('wheel', e => {
      e.preventDefault();
      this.desiredSpherical.radius = THREE.MathUtils.clamp(this.desiredSpherical.radius + e.deltaY * 0.012, 9.5, 32.0);
    }, { passive: false });

    window.addEventListener('resize', () => {
      this.updateViewportScale(true);
      this.syncCapturedTrayVisibility();
    });
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.getElapsedTime();

    this.camSpherical.radius = THREE.MathUtils.lerp(this.camSpherical.radius, this.desiredSpherical.radius, 0.1);
    this.camSpherical.phi = THREE.MathUtils.lerp(this.camSpherical.phi, this.desiredSpherical.phi, 0.1);
    this.camSpherical.theta = THREE.MathUtils.lerp(this.camSpherical.theta, this.desiredSpherical.theta, 0.1);

    const sinPhi = Math.sin(this.camSpherical.phi);
    const camX = this.camTarget.x + this.camSpherical.radius * sinPhi * Math.sin(this.camSpherical.theta);
    const camY = this.camTarget.y + this.camSpherical.radius * Math.cos(this.camSpherical.phi);
    const camZ = this.camTarget.z + this.camSpherical.radius * sinPhi * Math.cos(this.camSpherical.theta);

    if (this.cameraShake > 0.005) {
      const shakeOffset = (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.set(camX + shakeOffset, camY + shakeOffset, camZ + shakeOffset);
      this.cameraShake *= 0.85;
    } else {
      this.camera.position.set(camX, camY, camZ);
      this.cameraShake = 0;
    }
    this.camera.lookAt(this.camTarget);

    for (const mesh of this.pieceMeshes.values()) {
      if (this.activeAnimations.some(a => a.mesh === mesh)) continue;
      const { r, c, color, auraMat } = mesh.userData;
      const isSelected = this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c;
      const isTurnSide = color === this.engine.turn && !this.gameOver && !this.replayMode;

      if (isSelected) {
        mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.32 + Math.sin(elapsed * 5.0) * 0.07, 0.18);
        auraMat.opacity = 0.75 + Math.sin(elapsed * 5.0) * 0.2;
      } else {
        if (Math.abs(mesh.position.y) > 0.001) mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0, 0.22);
        auraMat.opacity = isTurnSide ? (0.18 + Math.sin(elapsed * 2.6 + r * 0.5) * 0.1) : 0.0;
      }
    }

    if (this.selectedRing.visible) {
      const s = 1 + Math.sin(elapsed * 5) * 0.06;
      this.selectedRing.scale.set(s, s, 1);
    }
    for (const ind of this.moveIndicators) {
      if (ind.userData.isCapture) {
        const s = 1 + Math.sin(elapsed * 6) * 0.08;
        ind.scale.set(s, 1, s);
      }
    }

    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      const anim = this.activeAnimations[i];
      anim.elapsed += dt;
      const t = Math.min(anim.elapsed / anim.duration, 1);
      anim.update(t);
      if (t >= 1) {
        this.activeAnimations.splice(i, 1);
        if (anim.complete) anim.complete();
      }
    }

    if (this.vfxAtmosphereTimer > 0) {
      this.vfxAtmosphereTimer = Math.max(0, this.vfxAtmosphereTimer - dt);
      const progress = 1 - (this.vfxAtmosphereTimer / (this.vfxAtmosphereDuration || 3.8));
      let eclipseFactor = 0;
      if (progress < 0.12) eclipseFactor = progress / 0.12;
      else if (progress < 0.72) eclipseFactor = 1;
      else eclipseFactor = 1 - (progress - 0.72) / 0.28;
      const dayColor = new THREE.Color(0xdce8dc);
      dayColor.lerp(new THREE.Color(0x13111c), Math.max(0, Math.min(1, eclipseFactor)) * 0.86);
      this.scene.background.copy(dayColor);
      if (this.scene.fog) this.scene.fog.color.copy(dayColor);
      if (this.sunLight) this.sunLight.intensity = THREE.MathUtils.lerp(1.15, 0.22, eclipseFactor);
      if (this.hemiLight) this.hemiLight.intensity = THREE.MathUtils.lerp(0.75, 0.18, eclipseFactor);
    }
    for (let i = this.checkmateVFXAnimations.length - 1; i >= 0; i--) {
      const vfx = this.checkmateVFXAnimations[i];
      vfx.elapsed += dt;
      const t = Math.min(vfx.elapsed / vfx.duration, 1);
      vfx.update(t, dt);
      if (t >= 1) this.checkmateVFXAnimations.splice(i, 1);
    }
    if (
      this.vfxAtmosphereDuration > 0 &&
      this.vfxAtmosphereTimer <= 0 &&
      this.checkmateVFXAnimations.length === 0 &&
      this.checkmateVFXGroup &&
      this.checkmateVFXGroup.children.length > 0
    ) {
      this.clearCheckmateVFX();
      this.vfxAtmosphereDuration = 0;
    }
    for (let i = this.shatterParticles.length - 1; i >= 0; i--) {
      const p = this.shatterParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.shatterParticles.splice(i, 1);
        continue;
      }
      p.vy -= 14.5 * dt;
      p.mesh.position.addScaledVector(new THREE.Vector3(p.vx, p.vy, p.vz), dt);
      if (p.mesh.position.y < 0.04) { p.mesh.position.y = 0.04; p.vy = -p.vy * 0.42; }
      p.mesh.material.opacity = Math.max(0, 1 - p.life / p.maxLife);
    }

    this.trees.forEach(t => {
      t.group.rotation.z = Math.sin(elapsed * 1.2 + t.phase) * 0.035;
      t.group.rotation.x = Math.cos(elapsed * 0.9 + t.phase) * 0.025;
    });
    this.dappledCanopy.position.x = Math.sin(elapsed * 1.1) * 0.35;
    this.dappledCanopy.position.z = Math.cos(elapsed * 0.9) * 0.35;

    this.breezeParticles.forEach(bp => {
      bp.mesh.position.y -= bp.speedY * dt;
      bp.mesh.position.x += Math.sin(elapsed * 0.8 + bp.phase) * bp.speedX * dt;
      bp.mesh.position.z += Math.cos(elapsed * 0.6 + bp.phase) * 0.3 * dt;
      bp.mesh.rotation.x += dt * 1.2;
      bp.mesh.rotation.y += dt * 0.9;

      if (bp.mesh.position.y < -3.5) {
        bp.mesh.position.y = 9.5;
        bp.mesh.position.x = (Math.random() - 0.5) * 26;
        bp.mesh.position.z = (Math.random() - 0.5) * 26;
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 统一管理底部“新局 / 重置残局 / 重新对局 / 再来一局”按钮文本与图标
   */
  updateRestartButtonLabel() {
    const restartLabel = document.getElementById('restart-label');
    const restartIcon = document.getElementById('restart-icon');
    if (!restartLabel) return;

    const inRoom = Boolean(this.onlineRole);
    if (this.gameOver) {
      restartLabel.textContent = '再来一局';
      if (restartIcon) restartIcon.textContent = 'replay';
    } else if (inRoom) {
      restartLabel.textContent = '重新对局';
      if (restartIcon) restartIcon.textContent = 'restart_alt';
    } else if (this.customEndgameSnapshot) {
      restartLabel.textContent = '重置残局';
      if (restartIcon) restartIcon.textContent = 'restart_alt';
    } else {
      restartLabel.textContent = '新局';
      if (restartIcon) restartIcon.textContent = 'restart_alt';
    }
  }

  /**
   * 渲染聚合式精雕微缩棋子（相同兵种合并显示 ×N 角标，彻底杜绝冗长遮挡）
   */
  renderGroupedCapturedChips(piecesList, chipClass) {
    if (!piecesList || piecesList.length === 0) return '';
    const order = { r: 1, n: 2, c: 3, b: 4, a: 5, p: 6, k: 0 };
    const grouped = new Map();
    for (const p of piecesList) {
      const key = p.type || p.char;
      if (!grouped.has(key)) {
        grouped.set(key, { char: p.char, type: p.type, count: 0 });
      }
      grouped.get(key).count++;
    }
    const sorted = Array.from(grouped.values()).sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
    return sorted.map(item => {
      const badge = item.count > 1 ? `<em class="chip-count-badge">×${item.count}</em>` : '';
      return `<span class="captured-chip ${chipClass} serif-cn">${item.char}${badge}</span>`;
    }).join('');
  }

  syncCapturedTrayVisibility() {
    const hasRedCaptures = this.engine.capturedBlack.length > 0;
    const hasBlackCaptures = this.engine.capturedRed.length > 0;
    const hasAny = hasRedCaptures || hasBlackCaptures;

    const toggleBtn = document.getElementById('captured-toggle');
    const contentEl = document.getElementById('captured-content');
    const redCard = document.getElementById('captured-red-card');
    const blackCard = document.getElementById('captured-black-card');
    const capturedRow = document.getElementById('captured-row');

    if (toggleBtn) {
      toggleBtn.classList.toggle('hidden', !hasAny);
      const arrow = this.capturedTrayCollapsed ? '▸' : '▾';
      toggleBtn.innerHTML = `<span class="serif-cn">战果</span> <span class="text-red-700">红${this.engine.capturedBlack.length}</span>·<span class="text-slate-800">黑${this.engine.capturedRed.length}</span> ${arrow}`;
    }

    if (redCard) redCard.classList.toggle('hidden', !hasRedCaptures);
    if (blackCard) blackCard.classList.toggle('hidden', !hasBlackCaptures);

    if (capturedRow) {
      capturedRow.classList.toggle('hidden', !hasAny || this.capturedTrayCollapsed);
    }
    if (contentEl) {
      contentEl.classList.toggle('hidden', this.capturedTrayCollapsed);
    }
  }

  updateUI(inCheck = false) {
    const turnDot = document.getElementById('turn-dot');
    const turnText = document.getElementById('turn-text');
    const checkBadge = document.getElementById('check-badge');
    const btnUndo = document.getElementById('btn-undo');
    const btnHint = document.getElementById('btn-hint');
    const btnDraw = document.getElementById('btn-offer-draw');
    const btnResign = document.getElementById('btn-resign');

    if (this.gameOver && !this.replayMode) {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-600 ring-4 ring-amber-600/20';
      turnText.className = 'serif-cn font-bold text-xs text-amber-900';
      turnText.textContent = this.endgameReasonText || '终局棋盘展示';
    } else if (this.engine.turn === RED) {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-red-600 ring-4 ring-red-600/20';
      turnText.className = 'serif-cn font-bold text-xs text-red-800';
      turnText.textContent = '红方走棋';
    } else {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-900 ring-4 ring-slate-900/20';
      turnText.className = 'serif-cn font-bold text-xs text-slate-900';
      const modeLabels = { pvp: '黑方走棋', easy: '简单AI', hard: '困难AI', inferno: '宗师AI' };
      turnText.textContent = modeLabels[this.gameMode] || 'AI';
    }

    if (inCheck && !this.gameOver) {
      checkBadge.classList.remove('hidden');
      checkBadge.classList.add('flex');
    } else {
      checkBadge.classList.add('hidden');
      checkBadge.classList.remove('flex');
    }

    const isOnline = Boolean(this.onlineRole && (this.isOnlineConnected || this.conn?.open));
    ['mode-pvp', 'mode-easy', 'mode-hard', 'mode-inferno'].forEach(id => {
      document.getElementById(id)?.toggleAttribute('disabled', Boolean(this.onlineRole) || this.replayMode);
    });

    // “求和”和“认输”按钮只在联机状态下才会出现
    btnDraw?.classList.toggle('hidden', !isOnline);
    btnResign?.classList.toggle('hidden', !isOnline);

    ['btn-endgame-editor', 'btn-vfx-panel', 'btn-standard-new-game'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = Boolean(this.onlineRole);
        el.classList.toggle('opacity-45', Boolean(this.onlineRole));
        el.classList.toggle('cursor-not-allowed', Boolean(this.onlineRole));
        el.title = this.onlineRole ? '联机对局中不可使用此功能，请先退出房间' : '';
      }
    });

    if (btnUndo) {
      btnUndo.disabled = this.engine.history.length === 0 || this.isBusy || this.gameOver || this.replayMode || Boolean(this.pendingUndoRequest);
    }
    if (btnHint) {
      btnHint.disabled = this.isBusy || this.gameOver || this.replayMode || (this.gameMode !== 'pvp' && this.engine.turn !== RED) || Boolean(this.onlineRole);
    }
    if (btnDraw) {
      btnDraw.disabled = !isOnline || this.isBusy || this.gameOver || this.replayMode;
    }
    if (btnResign) {
      btnResign.disabled = !isOnline || this.isBusy || this.gameOver || this.replayMode;
    }

    this.updateRestartButtonLabel();

    const redTray = document.getElementById('captured-by-red');
    const blackTray = document.getElementById('captured-by-black');
    const redCountEl = document.getElementById('captured-red-count');
    const blackCountEl = document.getElementById('captured-black-count');

    const hasRedCaptures = this.engine.capturedBlack.length > 0;
    const hasBlackCaptures = this.engine.capturedRed.length > 0;

    if (redCountEl) redCountEl.textContent = `${this.engine.capturedBlack.length}子`;
    if (blackCountEl) blackCountEl.textContent = `${this.engine.capturedRed.length}子`;

    if (redTray) {
      redTray.innerHTML = hasRedCaptures
        ? this.renderGroupedCapturedChips(this.engine.capturedBlack, 'chip-obsidian')
        : '';
    }
    if (blackTray) {
      blackTray.innerHTML = hasBlackCaptures
        ? this.renderGroupedCapturedChips(this.engine.capturedRed, 'chip-ivory')
        : '';
    }

    this.syncCapturedTrayVisibility();
  }

  toggleCapturedTray() {
    this.sfx.playSelect();
    this.capturedTrayCollapsed = !this.capturedTrayCollapsed;
    this.syncCapturedTrayVisibility();
  }

  showCenterCallout(text, color) {
    const container = document.getElementById('center-callout');
    const inner = document.getElementById('center-callout-inner');
    if (!container || !inner) return;
    inner.textContent = text;
    inner.className = color === RED
      ? 'serif-cn px-7 py-3.5 rounded-3xl text-2xl md:text-4xl font-black tracking-widest shadow-2xl border-2 bg-red-700/95 text-amber-50 border-amber-300 text-center'
      : 'serif-cn px-7 py-3.5 rounded-3xl text-2xl md:text-4xl font-black tracking-widest shadow-2xl border-2 bg-slate-900/95 text-amber-400 border-slate-500 text-center';

    container.classList.remove('hidden', 'callout-animate');
    void container.offsetWidth;
    container.classList.add('callout-animate');
    setTimeout(() => container.classList.add('hidden'), 1750);
  }

  showGameOverModal(winnerColor, pattern) {
    const modal = document.getElementById('gameover-modal');
    const icon = document.getElementById('winner-icon');
    const title = document.getElementById('winner-title');
    const subtitle = document.getElementById('winner-subtitle');
    const badgeText = document.getElementById('checkmate-badge-text');
    const poemEl = document.getElementById('checkmate-poem');
    const descEl = document.getElementById('winner-desc');
    const btnReplayVfx = document.getElementById('btn-modal-replay-vfx');

    const rounds = Math.max(1, Math.ceil(this.engine.history.length / 2));
    if (winnerColor === 'draw') {
      icon.textContent = '和';
      icon.className = 'w-14 h-14 rounded-2xl bg-amber-700 text-amber-50 flex items-center justify-center serif-cn text-2xl font-black shadow-lg shrink-0';
      subtitle.textContent = `双方和棋 · 共 ${rounds} 回合`;
    } else if (winnerColor === RED) {
      icon.textContent = '帥';
      icon.className = 'w-14 h-14 rounded-2xl bg-red-700 text-amber-100 flex items-center justify-center serif-cn text-2xl font-black shadow-lg shrink-0';
      subtitle.textContent = `红方获胜 · 共 ${rounds} 回合`;
    } else {
      icon.textContent = '將';
      icon.className = 'w-14 h-14 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center serif-cn text-2xl font-black shadow-lg shrink-0';
      subtitle.textContent = `黑方获胜 · 共 ${rounds} 回合`;
    }

    title.textContent = pattern.title || '绝杀获胜！';
    badgeText.textContent = pattern.badge || '古谱绝杀判定';
    poemEl.textContent = pattern.poem || '“运筹帷幄决千里，一着绝杀定乾坤。”';
    descEl.textContent = pattern.analysis || '精彩对局！';

    if (btnReplayVfx) {
      btnReplayVfx.classList.toggle('hidden', Boolean(pattern.isDrawOrResign));
    }

    this.updateRestartButtonLabel();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeModalOnly() {
    document.getElementById('gameover-modal')?.classList.add('hidden');
    document.getElementById('gameover-modal')?.classList.remove('flex');
    this.updateRestartButtonLabel();
  }

  setGameMode(mode) {
    if (this.isBusy || (this.onlineRole && mode !== 'pvp')) return;
    this.gameMode = mode;
    this.updatePiecesOrientation();
    ['pvp', 'easy', 'hard', 'inferno'].forEach(m => {
      const btn = document.getElementById(`mode-${m}`);
      if (!btn) return;
      btn.classList.remove('seg-active', 'seg-inferno-active');
      if (m === mode) btn.classList.add(mode === 'inferno' ? 'seg-inferno-active' : 'seg-active');
    });
    this.sfx.playSelect();
    if (this.gameMode !== 'pvp' && this.engine.turn === BLACK && !this.gameOver && !this.replayMode) {
      this.onTurnFinished();
    } else {
      this.updateUI(this.engine.isInCheck(this.engine.turn));
    }
  }

  undoMove(isRemoteApproved = false) {
    if (this.isBusy || this.engine.history.length === 0 || this.replayMode) return;
    if (this.onlineRole && this.conn?.open && !isRemoteApproved) {
      if (this.pendingUndoRequest) return;
      this.pendingUndoRequest = true;
      this.sfx.playSelect();
      try {
        this.conn.send({ type: 'undo_request' });
        this.showCenterCallout('已发送悔棋申请', this.onlineRole);
        this.undoRequestTimeout = setTimeout(() => {
          if (!this.pendingUndoRequest) return;
          this.pendingUndoRequest = false;
          this.showCenterCallout('悔棋申请暂无回应', this.onlineRole);
          this.updateUI(this.engine.isInCheck(this.engine.turn));
        }, 15000);
      } catch (err) {
        this.pendingUndoRequest = false;
        this.updateOnlineStatusUI('悔棋申请发送失败，请检查联机状态', false);
      }
      this.updateUI(this.engine.isInCheck(this.engine.turn));
      return;
    }
    this.pendingUndoRequest = false;
    clearTimeout(this.undoRequestTimeout);
    this.sfx.playSelect();
    this.gameOver = false;
    this.endgameReasonText = null;
    this.closeModalOnly();
    this.clearCheckmateHighlights();
    this.clearCheckmateVFX();
    this.clearLegalMoveIndicators();
    this.selectedSquare = null;

    if (!this.onlineRole && this.gameMode !== 'pvp' && this.engine.turn === RED && this.engine.history.length >= 2) {
      this.engine.undoLastMove();
      this.popReplayStep?.();
      this.engine.undoLastMove();
      this.popReplayStep?.();
    } else {
      this.engine.undoLastMove();
      this.popReplayStep?.();
    }
    this.syncPiecesFromEngine();
    this.updateRestartButtonLabel();
    this.updateUI(this.engine.isInCheck(this.engine.turn));
  }

  respondUndoRequest(approved) {
    document.getElementById('undo-request-modal')?.classList.add('hidden');
    if (!this.conn?.open) return;
    if (approved) {
      this.conn.send({ type: 'undo_accept' });
      this.undoMove(true);
      this.showCenterCallout('已同意悔棋', this.onlineRole || RED);
    } else {
      this.conn.send({ type: 'undo_reject' });
      this.sfx.playSelect();
    }
  }

  /**
   * 底部“新局 / 重置残局 / 重新对局 / 再来一局”按钮与终局弹窗“再来一局”按钮的统一入口
   */
  handleRestartButton() {
    if (this.replayMode) {
      this.exitReplayMode(true);
    }

    if (this.gameOver) {
      this.handlePlayAgain();
      return;
    }

    if (this.onlineRole) {
      this.requestRematchOnline(false);
      return;
    }

    if (this.customEndgameSnapshot) {
      this.replayEndgame();
      return;
    }
    this.restartGame();
  }

  /**
   * 点击“再来一局”：
   * 联机状态下需要向对方发送再来一局申请，经对方同意后双方同步重置棋盘！
   */
  handlePlayAgain() {
    if (this.onlineRole) {
      this.requestRematchOnline(true);
      return;
    }
    if (this.customEndgameSnapshot) {
      this.replayEndgame();
    } else {
      this.restartGame();
    }
  }

  restartStandardGame(isRemote = false) {
    if (this.onlineRole && this.conn?.open && !isRemote) {
      this.showCenterCallout('联机对局中请使用「重新对局」按钮向对方发起请求', this.onlineRole);
      return;
    }
    this.customEndgameSnapshot = null;
    this.endgameEditor = false;
    document.getElementById('custom-endgame-panel')?.classList.add('hidden');
    this.restartGame();
  }

  replayEndgame(isRemote = false) {
    if (!this.customEndgameSnapshot) {
      this.restartGame();
      return;
    }
    this.hideCycleWarningBanner();
    this.hideIllegalMovePrompt();
    this.hideAllActionModals?.();
    this.sfx.playSelect();
    this.isBusy = false;
    this.aiCallback = null;
    this.activeAnimations = [];
    this.closeModalOnly();
    this.toggleVFXDrawer(false);
    this.clearCheckmateHighlights();
    this.clearCheckmateVFX();
    if (this.lastFromRing) this.lastFromRing.visible = false;
    if (this.lastToRing) this.lastToRing.visible = false;
    this.gameOver = false;
    this.endgameReasonText = null;
    this.endgameEditor = false;
    this.selectedSquare = null;
    this.clearLegalMoveIndicators();
    this.engine.board = this.customEndgameSnapshot.map(row => row.map(p => p ? { ...p } : null));
    this.engine.turn = this.editorFirstTurn || RED;
    this.engine.clearCapturesAndHistory?.();

    this.initReplaySession?.(this.engine.board, this.engine.turn, 'endgame');

    this.syncPiecesFromEngine();
    this.setGameMode(this.onlineRole ? 'pvp' : this.gameMode);
    this.updateRestartButtonLabel();
    this.updateUI(this.engine.isInCheck(this.engine.turn));
    if (!isRemote && this.conn?.open) {
      this.conn.send({
        type: 'sync_board',
        fen: this.exportBoardToFEN(this.engine.board, this.engine.turn),
        isCustomEndgame: true
      });
    }
  }

  restartGame() {
    this.hideCycleWarningBanner();
    this.hideIllegalMovePrompt();
    this.hideAllActionModals?.();
    this.sfx.playSelect();
    this.isBusy = false;
    this.aiCallback = null;
    this.activeAnimations = [];
    this.closeModalOnly();
    this.toggleVFXDrawer(false);
    this.clearCheckmateHighlights();
    this.clearCheckmateVFX();
    if (this.lastFromRing) this.lastFromRing.visible = false;
    if (this.lastToRing) this.lastToRing.visible = false;
    this.gameOver = false;
    this.endgameReasonText = null;
    this.selectedSquare = null;
    this.clearLegalMoveIndicators();
    this.engine.reset();

    this.initReplaySession?.(this.engine.board, this.engine.turn, 'standard');

    this.syncPiecesFromEngine();
    this.updateRestartButtonLabel();
    this.updateUI(this.engine.isInCheck(this.engine.turn));
  }

  cycleCameraPreset() {
    const order = ['red', 'top', 'orbit'];
    const labels = { red: '正视', top: '俯视', orbit: '环绕' };
    const icons = { red: 'visibility', top: 'grid_on', orbit: '3d_rotation' };
    this.currentCamPreset = order[(order.indexOf(this.currentCamPreset || 'red') + 1) % order.length];
    this.setCameraPreset(this.currentCamPreset);

    document.getElementById('cam-cycle-label').textContent = labels[this.currentCamPreset];
    document.getElementById('cam-cycle-icon').textContent = icons[this.currentCamPreset];
  }

  setCameraPreset(preset) {
    this.sfx.playSelect();
    const baseTheta = this.onlineRole === BLACK ? Math.PI : 0;
    if (preset === 'red') {
      this.basePresetRadius = 17.5;
      this.desiredSpherical = { radius: 17.5, phi: 0.72, theta: baseTheta };
    } else if (preset === 'top') {
      const topRadius = window.innerWidth >= 768 ? 20.5 : 16.5;
      this.basePresetRadius = topRadius;
      this.desiredSpherical = { radius: topRadius, phi: 0.14, theta: baseTheta };
    } else if (preset === 'orbit') {
      this.basePresetRadius = 20.5;
      this.desiredSpherical = { radius: 20.5, phi: 0.85, theta: baseTheta + 0.65 };
    }
    this.updateViewportScale(true);
  }

  checkURLParams() {
    const params = new URLSearchParams(window.location.search);
    const fen = params.get('fen');
    const room = params.get('room');
    const replay = params.get('replay');
    const mode = params.get('mode');

    if (replay) {
      setTimeout(() => {
        if (!this.loadSharedReplayFromParam?.(replay) && fen) {
          this.loadBoardFromFEN(fen);
        }
      }, 120);
      return;
    }

    if (fen) {
      this.loadBoardFromFEN(fen);
      if (mode && ['pvp', 'easy', 'hard', 'inferno'].includes(mode)) {
        this.setGameMode(mode);
      }
    }
    if (room) {
      this.onlineRole = BLACK;
      this.updateRestartButtonLabel();
      setTimeout(() => this.joinOnlineRoom(room.trim().toUpperCase()), 250);
    }
  }

  toggleSound() {
    this.sfx.enabled = !this.sfx.enabled;
    document.getElementById('icon-sound').textContent = this.sfx.enabled ? 'volume_up' : 'volume_off';
    if (this.sfx.enabled) this.sfx.playSelect();
  }
}

function initXiangqiAppOnce() {
  if (window.gameApp) return;
  window.gameApp = new Xiangqi3DApp();

  ['custom-endgame-panel', 'replay-panel'].forEach(panelId => {
    const panel = document.getElementById(panelId);
    const header = panel?.firstElementChild;
    if (!panel || !header) return;
    header.style.cursor = 'grab';
    header.style.touchAction = 'none';
    let drag = null;
    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const rect = panel.getBoundingClientRect();
      drag = { pointerId: e.pointerId, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      header.style.cursor = 'grabbing';
      try { header.setPointerCapture(e.pointerId); } catch (_) { }
      e.preventDefault();
    });
    header.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      panel.style.left = `${Math.min(Math.max(0, window.innerWidth - panel.offsetWidth), Math.max(0, e.clientX - drag.dx))}px`;
      panel.style.top = `${Math.min(Math.max(0, window.innerHeight - panel.offsetHeight), Math.max(0, e.clientY - drag.dy))}px`;
    });
    const stopDrag = (e) => {
      if (drag && (!e || e.pointerId === drag.pointerId)) {
        drag = null;
        header.style.cursor = 'grab';
      }
    };
    header.addEventListener('pointerup', stopDrag);
    header.addEventListener('pointercancel', stopDrag);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initXiangqiAppOnce);
} else {
  setTimeout(initXiangqiAppOnce, 0);
}
window.addEventListener('load', initXiangqiAppOnce);
