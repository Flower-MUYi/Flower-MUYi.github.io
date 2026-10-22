class Xiangqi3DApp {
  constructor() {
    window.gameApp = this;
    this.container = document.getElementById('canvas-container');
    this.sfx = new SoundEffects();
    this.engine = new XiangqiEngine();

    this.gameMode = 'inferno';
    this.variantMode = 'xiangqi';
    this.variantRegistry = [
      {
        id: 'xiangqi',
        name: '象棋',
        badge: '传统国粹',
        desc: '三十二子明置排阵，依传统规则博弈',
        icon: 'chess'
      },
      {
        id: 'jieqi',
        name: '揭棋',
        badge: '暗子奇谋',
        desc: '将帅明置，十五子暗布；暗子依初位行棋翻明，相仕可过河',
        icon: 'style'
      }
    ];
    this.currentSceneId = 'bamboo_park';
    this.sceneRegistry = [
      {
        id: 'bamboo_park',
        name: '翠竹石案',
        badge: '听泉雅集',
        desc: '晴日翠竹、青瓷香炉、温润石案与落英微风',
        icon: 'park',
        bgHex: 0xddece0,
        bodyCss: '#ddece0',
        fogDensity: 0.009,
        sunColor: 0xfff8eb,
        sunIntensity: 0.86,
        hemiSky: 0xffffff,
        hemiGround: 0x5c7c58,
        hemiIntensity: 0.66
      },
      {
        id: 'ancient_battlefield',
        name: '楚汉将台',
        badge: '赤壁烽火',
        desc: '暖金斜阳、玄铁将台、青铜火鼎与猎猎战旗',
        icon: 'local_fire_department',
        bgHex: 0x36231a,
        bodyCss: '#36231a',
        fogDensity: 0.009,
        sunColor: 0xffe0b5,
        sunIntensity: 0.88,
        hemiSky: 0xffd2a6,
        hemiGround: 0x4a2f21,
        hemiIntensity: 0.62
      },
      {
        id: 'imperial_study',
        name: '瑶台揽月',
        badge: '云海星宫',
        desc: '白玉莲台、九天皎月、重檐星阁、流云仙雾与临水河灯',
        icon: 'nights_stay',
        bgHex: 0x0d182e,
        bodyCss: '#0d182e',
        fogDensity: 0.0082,
        sunColor: 0xfff4d6,
        sunIntensity: 0.88,
        hemiSky: 0xdbeafe,
        hemiGround: 0x1e293b,
        hemiIntensity: 0.66
      }
    ];
    this.isBusy = false;
    this.gameOver = false;
    this.endgameReasonText = null;
    this.endgameEditor = false;
    this.replayMode = false;
    this.replayBranchActive = false;
    this.replayTrialCheckmated = false;
    this.editorPiece = { color: RED, type: 'k' };
    this.editorErase = false;
    this.customEndgameSnapshot = null;
    this.editorFirstTurn = RED;
    this.threatenedFriendlyIds = new Set();
    this.safeCapturableEnemyIds = new Set();

    this.peer = null;
    this.conn = null;
    this.onlineRole = null;
    this.roomCode = null;
    this.pendingUndoRequest = false;
    this.pendingDrawRequest = false;
    this.pendingRematchRequest = false;

    this.capturedTrayCollapsed = window.innerWidth < 1024;

    this.selectedSquare = null;
    this.legalMovesForSelected = [];

    this.pieceMeshes = new Map();
    this.sharedPieceAssets = null;
    this.sharedIndicatorAssets = null;
    this.activeAnimations = [];
    this.shatterParticles = [];
    this.impactWaves = [];
    this.checkmateHighlightRings = [];
    this.illegalWarningRings = [];
    this.illegalToastTimer = null;
    this.cycleBannerTimer = null;
    this.calloutHideTimer = null;
    this.actionBurstTimer = null;
    this.checkmateVFXAnimations = [];
    this.vfxAtmosphereTimer = 0;
    this.vfxAtmosphereDuration = 0;
    this.lastCheckmatePattern = null;
    this.lastWinnerColor = null;
    this.currentCamPreset = 'red';

    this._raycaster = new THREE.Raycaster();
    this._mouseVec = new THREE.Vector2();
    this._boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.15);
    this._intersectPt = new THREE.Vector3();
    this._tempVec3 = new THREE.Vector3();
    this.lastMoveCoords = null;
    this._tempDayColor = new THREE.Color(0xddece0);
    this._tempNightColor = new THREE.Color(0x161224);

    this.initAIWorker();
    this.initThree();
    this.buildParkEnvironment();
    this.buildBattlefieldEnvironment();
    this.buildImperialStudyEnvironment();
    this.buildChessboard3D();
    this.buildInteractionMarkers();
    this.piecesGroup = new THREE.Group();
    this.scene.add(this.piecesGroup);
    this.checkmateVFXGroup = new THREE.Group();
    this.scene.add(this.checkmateVFXGroup);
    this.syncPiecesFromEngine();
    this.setupControlsAndEvents();

    this.initReplaySession?.(this.engine.board, this.engine.turn, 'standard');
    this.updateRestartButtonLabel();
    this.updateUI();
    this.checkURLParams();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  createBlobAIWorker() {
    if (typeof window.__xiangqiAIWorkerBootstrap !== 'function') return null;
    try {
      const src = `(${window.__xiangqiAIWorkerBootstrap.toString()})();`;
      const blob = new Blob([src], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const worker = new Worker(blobUrl);
      worker._isBlobWorker = true;
      return worker;
    } catch (_) {
      return null;
    }
  }

  bindAIWorkerEvents(worker) {
    if (!worker) return;
    worker.onmessage = (e) => {
      this.aiWorkerVerified = true;
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
    worker.onerror = () => {
      const cb = this.aiCallback;
      const reqPayload = this.lastAIPayload;
      const wasBlob = Boolean(worker._isBlobWorker);
      try { worker.terminate(); } catch (_) { }
      if (this.aiWorker === worker) {
        this.aiWorker = null;
      }
      if (!wasBlob) {
        const blobWorker = this.createBlobAIWorker();
        if (blobWorker) {
          this.aiWorker = blobWorker;
          this.bindAIWorkerEvents(blobWorker);
          if (cb && reqPayload) {
            try {
              blobWorker.postMessage(reqPayload);
              return;
            } catch (_) { }
          }
          return;
        }
      }
      this.aiCallback = null;
      if (cb && reqPayload) {
        this.runMainThreadAIFallback(reqPayload, cb);
      }
    };
  }

  initAIWorker() {
    this.aiWorker = null;
    this.aiCallback = null;
    this.aiWorkerVerified = false;
    const isFileProtocol = true;
    if (isFileProtocol) {
      const blobWorker = this.createBlobAIWorker();
      if (blobWorker) {
        this.aiWorker = blobWorker;
        this.bindAIWorkerEvents(blobWorker);
        return;
      }
    }
    try {
      this.aiWorker = new Worker('ChineseChessJS/ai-worker.js?v=20261021');
      this.bindAIWorkerEvents(this.aiWorker);
    } catch (_) {
      const blobWorker = this.createBlobAIWorker();
      if (blobWorker) {
        this.aiWorker = blobWorker;
        this.bindAIWorkerEvents(blobWorker);
      }
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
      telEl.textContent = `${depth} · ${nodesStr} · ${winnerName}胜定 M${matePly}`;
    } else {
      const adv = Math.abs(redScore) < 60 ? '均势' : (redScore > 0 ? `红优 +${Math.round(redScore / 100)}` : `黑优 +${Math.round(-redScore / 100)}`);
      telEl.textContent = depth === '开局库' ? `库着 · ${adv}` : `深${depth} · ${nodesStr} · ${adv}`;
    }
  }

  resetTelemetryUI(customText = null) {
    const barEl = document.getElementById('eval-bar-red');
    if (barEl) barEl.style.width = '50%';
    const telEl = document.getElementById('ai-telemetry-text');
    if (!telEl) return;
    if (customText) {
      telEl.textContent = customText;
      return;
    }
    const isJieqi = (this.engine?.variantMode || this.variantMode) === 'jieqi';
    const modeNames = { pvp: '双人对弈', easy: '简单AI', hard: '困难AI', inferno: '宗师AI' };
    const modeLabel = this.onlineRole ? '联机对弈' : (modeNames[this.gameMode] || '宗师AI');
    if (this.endgameEditor) {
      telEl.textContent = '残局工坊 · 自由布阵';
    } else if (this.replayMode && !this.replayBranchActive) {
      telEl.textContent = `复盘演武 · ${modeLabel}`;
    } else if (this.gameMode === 'pvp' || this.onlineRole) {
      telEl.textContent = `${modeLabel} · 均势`;
    } else if (isJieqi) {
      telEl.textContent = `${modeLabel} · 均势`;
    } else {
      telEl.textContent = `库着就绪 · 均势`;
    }
  }

  getActiveSceneConfig() {
    return this.sceneRegistry.find(s => s.id === this.currentSceneId) || this.sceneRegistry[0];
  }

  requestAIMove(color, difficulty, callback) {
    const historyMoves = this.engine.history.map(h => h.move);
    const forbiddenMoves = this.engine.getForbiddenRepetitionMoves(color);

    const historyBoards = [];
    if (this.replaySnapshots && this.replaySnapshots.length > 0) {
      const startIdx = Math.max(0, this.replaySnapshots.length - 20);
      for (let i = startIdx; i < this.replaySnapshots.length; i++) {
        const s = this.replaySnapshots[i];
        if (s && s.board && s.turn) {
          historyBoards.push({ board: s.board, turn: s.turn });
        } else if (s && s.fen) {
          const parsed = this.parseFENToBoard?.(s.fen);
          if (parsed) historyBoards.push(parsed);
        }
      }
    }

    const isJieqi = this.engine.variantMode === 'jieqi';
    const aiBoard = this.engine.board.map(row => row.map(cell => {
      if (!cell) return null;
      if (cell.isHidden) {
        return {
          id: cell.id,
          color: cell.color,
          type: cell.posType || cell.type,
          posType: cell.posType || cell.type,
          char: cell.char,
          isHidden: true
        };
      }
      return { ...cell };
    }));

    const payload = {
      board: aiBoard,
      turn: color,
      difficulty,
      variantMode: this.engine.variantMode || 'xiangqi',
      historyMoves,
      useBook: !isJieqi && difficulty !== 'easy',
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
      } catch (_) {
        this.aiCallback = null;
        this.runMainThreadAIFallback(payload, callback);
      }
    } else {
      this.runMainThreadAIFallback(payload, callback);
    }
  }

  requestRedGrandmasterMove() {
    const side = this.engine.turn;
    if (this.isBusy || (this.gameOver && !this.replayMode) || this.onlineRole || this.replayTrialCheckmated) return;
    if (!this.replayMode && this.gameMode !== 'pvp' && side !== RED) return;
    if (this.replayMode) {
      this.stopReplayAutoPlay?.();
    }
    this.sfx.playHint ? this.sfx.playHint() : this.sfx.playSelect();
    this.isBusy = true;
    this.clearLegalMoveIndicators();
    this.clearGrandmasterHint3D?.();
    this.selectedSquare = null;

    const badge = document.getElementById('ai-thinking');
    const label = document.getElementById('ai-thinking-label');
    badge?.classList.remove('hidden');
    badge?.classList.add('inline-flex');
    if (label) label.textContent = '推演妙手…';

    this.requestAIMove(side, 'grandmaster_hint', (move) => {
      badge?.classList.add('hidden');
      badge?.classList.remove('inline-flex');
      if (!move || (this.gameOver && !this.replayMode)) {
        this.isBusy = false;
        this.updateUI(this.engine.isInCheck(this.engine.turn));
        return;
      }
      const notation = this.formatChineseMoveNotation(move);
      const mover = this.engine.board[move.fr]?.[move.fc];
      const target = this.engine.board[move.tr]?.[move.tc];
      let tactic = target ? `破阵取${target.char || '子'}` : '锦囊妙手';
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
      this.showCenterCallout(`${notation} · ${tactic}`, side, '锦囊支招');

      setTimeout(() => {
        if (this.gameOver && !this.replayMode) {
          this.clearGrandmasterHint3D?.();
          this.isBusy = false;
          return;
        }
        if (this.replayMode) {
          this.replayHumanColor = side;
          this.prepareReplayBranchAtCurrentStep?.(side);
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
    const activeType = p.isHidden ? (p.posType || p.type) : p.type;
    let action = '平', target = col(move.tc);
    if (dr !== 0) {
      action = (p.color === RED ? dr < 0 : dr > 0) ? '进' : '退';
      target = ['n', 'b', 'a'].includes(activeType) ? col(move.tc) : step(Math.abs(dr));
    }
    if (p.isHidden) {
      const revealChar = p.realChar || PIECE_CHARS[p.color]?.[p.realType] || '子';
      return `揭${revealChar}${col(move.fc)}${action}${target}`;
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
    this.scene.background = new THREE.Color(0xddece0);
    this.scene.fog = new THREE.FogExp2(0xddece0, 0.009);

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

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x5c7c58, 0.66);
    this.hemiLight.position.set(0, 30, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff8eb, 0.86);
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

    const fillLight = new THREE.DirectionalLight(0xfff7e6, 0.24);
    fillLight.position.set(-14, 12, -10);
    this.scene.add(fillLight);

    this.boardGlowLight = null;

    this.basePresetRadius = 17.5;
    this.updateViewportScale(false);
  }

  buildParkEnvironment() {
    this.parkGroup = new THREE.Group();
    this.scene.add(this.parkGroup);

    // 1. 远山层峦与碧水荷塘地面
    const groundGeo = new THREE.CylinderGeometry(58, 58, 1, 64);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x7ca972, roughness: 0.88, metalness: 0.04 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -4.85;
    ground.receiveShadow = true;
    this.parkGroup.add(ground);

    // 环绕式碧玉荷塘水面
    const pondGeo = new THREE.RingGeometry(10.2, 23.5, 64);
    const pondMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a64,
      roughness: 0.16,
      metalness: 0.35,
      transparent: true,
      opacity: 0.90,
      side: THREE.DoubleSide
    });
    const pond = new THREE.Mesh(pondGeo, pondMat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.y = -4.28;
    pond.receiveShadow = true;
    this.parkGroup.add(pond);

    // 远景青黛群山 3D 建模
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x4b745d, roughness: 0.85, metalness: 0.05 });
    const mistMountainMat = new THREE.MeshStandardMaterial({ color: 0x628c74, roughness: 0.82, metalness: 0.05 });
    const mountainConfigs = [
      { x: -28, z: -32, r: 14, h: 16, mat: mountainMat },
      { x: -12, z: -38, r: 18, h: 22, mat: mistMountainMat },
      { x: 14, z: -36, r: 16, h: 19, mat: mountainMat },
      { x: 32, z: -26, r: 15, h: 15, mat: mistMountainMat },
      { x: -35, z: 12, r: 14, h: 14, mat: mistMountainMat },
      { x: 34, z: 16, r: 15, h: 16, mat: mountainMat }
    ];
    mountainConfigs.forEach(mc => {
      const mGroup = new THREE.Group();
      const mainPeak = new THREE.Mesh(new THREE.ConeGeometry(mc.r, mc.h, 9), mc.mat);
      mainPeak.position.y = mc.h * 0.5 - 4.5;
      const subPeak = new THREE.Mesh(new THREE.ConeGeometry(mc.r * 0.68, mc.h * 0.72, 8), mc.mat);
      subPeak.position.set(mc.r * 0.45, mc.h * 0.36 - 4.5, mc.r * 0.2);
      mGroup.add(mainPeak, subPeak);
      mGroup.position.set(mc.x, 0, mc.z);
      this.parkGroup.add(mGroup);
    });

    // 2. 汉白玉雕花石台与青玉嵌环
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xdbe5de, roughness: 0.65, metalness: 0.10 });
    const carvedStoneMat = new THREE.MeshStandardMaterial({ color: 0xbac7bf, roughness: 0.58, metalness: 0.14 });
    const jadeMat = new THREE.MeshStandardMaterial({ color: 0x3b8a6b, roughness: 0.22, metalness: 0.18 });
    const bronzeAccentMat = new THREE.MeshStandardMaterial({ color: 0xc89838, roughness: 0.28, metalness: 0.86 });

    const patio = new THREE.Mesh(new THREE.CylinderGeometry(10.0, 10.6, 0.36, 48), stoneMat);
    patio.position.y = -4.22;
    patio.receiveShadow = true;
    this.parkGroup.add(patio);

    const patioStep = new THREE.Mesh(new THREE.CylinderGeometry(8.9, 9.3, 0.22, 48), carvedStoneMat);
    patioStep.position.y = -4.02;
    patioStep.receiveShadow = true;
    this.parkGroup.add(patioStep);

    const jadeInlayRing = new THREE.Mesh(new THREE.TorusGeometry(8.7, 0.10, 12, 64), jadeMat);
    jadeInlayRing.rotation.x = Math.PI / 2;
    jadeInlayRing.position.y = -3.90;
    this.parkGroup.add(jadeInlayRing);

    // 汉白玉石栏望柱（环绕平台）
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (Math.abs(Math.sin(a)) < 0.28 && Math.cos(a) > 0) continue; // 留出石桥通道
      const postGroup = new THREE.Group();
      const postShaft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.95, 0.32), stoneMat);
      postShaft.position.y = 0.48;
      const postCap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), jadeMat);
      postCap.position.y = 1.05;
      postGroup.add(postShaft, postCap);
      postGroup.position.set(Math.cos(a) * 9.8, -4.05, Math.sin(a) * 9.8);
      postGroup.castShadow = true;
      this.parkGroup.add(postGroup);
    }

    // 3. 精雕青石棋案、束腰须弥座与桌上茶具香炉
    const tableTopMat = new THREE.MeshStandardMaterial({ color: 0x9fb0a8, roughness: 0.48, metalness: 0.15 });
    const tableDarkStoneMat = new THREE.MeshStandardMaterial({ color: 0x62706a, roughness: 0.68, metalness: 0.14 });

    const slab = new THREE.Mesh(new THREE.CylinderGeometry(8.12, 7.82, 0.78, 48), tableTopMat);
    slab.position.y = -0.62;
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.parkGroup.add(slab);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(7.98, 0.16, 14, 64), tableDarkStoneMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.44;
    this.parkGroup.add(rim);

    const bronzeRim = new THREE.Mesh(new THREE.TorusGeometry(8.12, 0.06, 12, 64), bronzeAccentMat);
    bronzeRim.rotation.x = Math.PI / 2;
    bronzeRim.position.y = -0.34;
    this.parkGroup.add(bronzeRim);

    // 束腰莲瓣须弥座石柱
    const pillarUpper = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.2, 1.4, 24), tableDarkStoneMat);
    pillarUpper.position.y = -1.65;
    const pillarWaist = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.7, 20), carvedStoneMat);
    pillarWaist.position.y = -2.55;
    const pillarLower = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 1.4, 24), tableDarkStoneMat);
    pillarLower.position.y = -3.45;
    const waistRing = new THREE.Mesh(new THREE.TorusGeometry(2.18, 0.08, 10, 32), bronzeAccentMat);
    waistRing.rotation.x = Math.PI / 2;
    waistRing.position.y = -2.55;
    this.parkGroup.add(pillarUpper, pillarWaist, pillarLower, waistRing);

    // 案头三足青瓷香炉与袅袅青烟建模
    const censerGroup = new THREE.Group();
    censerGroup.position.set(-6.35, -0.23, -4.65);
    const celadonMat = new THREE.MeshStandardMaterial({ color: 0x7eb8a2, roughness: 0.20, metalness: 0.16 });
    const censerBody = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 18), celadonMat);
    censerBody.scale.set(1, 0.70, 1);
    censerBody.position.y = 0.30;
    const censerNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.14, 20), celadonMat);
    censerNeck.position.y = 0.56;
    const censerRim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.045, 10, 24), bronzeAccentMat);
    censerRim.rotation.x = Math.PI / 2;
    censerRim.position.y = 0.62;
    for (let l = 0; l < 3; l++) {
      const la = (l * Math.PI * 2) / 3;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.28, 10), bronzeAccentMat);
      leg.position.set(Math.cos(la) * 0.26, 0.12, Math.sin(la) * 0.26);
      censerGroup.add(leg);
    }
    this.incenseSmokeRings = [];
    for (let s = 0; s < 5; s++) {
      const smokeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.10 + s * 0.04, 0.022, 8, 20),
        new THREE.MeshBasicMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.38 - s * 0.06, depthWrite: false })
      );
      smokeRing.rotation.x = Math.PI / 2;
      smokeRing.position.y = 0.75 + s * 0.26;
      censerGroup.add(smokeRing);
      this.incenseSmokeRings.push({ mesh: smokeRing, baseOffset: s * 0.26, phase: s * 1.1 });
    }
    censerGroup.add(censerBody, censerNeck, censerRim);
    this.parkGroup.add(censerGroup);

    // 案头汝窑青瓷茶壶与对弈双茶盏建模
    const teaGroup = new THREE.Group();
    teaGroup.position.set(6.25, -0.23, 4.45);
    const teapotBody = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), celadonMat);
    teapotBody.scale.set(1, 0.78, 1);
    teapotBody.position.y = 0.26;
    const teapotLid = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 16), celadonMat);
    teapotLid.position.y = 0.52;
    const lidFinial = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), bronzeAccentMat);
    lidFinial.position.y = 0.58;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.32, 10), celadonMat);
    spout.position.set(-0.36, 0.32, 0);
    spout.rotation.z = 0.85;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16, Math.PI), celadonMat);
    handle.position.set(0.30, 0.30, 0);
    handle.rotation.z = -Math.PI / 2;
    teaGroup.add(teapotBody, teapotLid, lidFinial, spout, handle);
    [[-0.58, 0.48], [0.46, -0.52]].forEach(([cx, cz]) => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.10, 0.16, 16), celadonMat);
      cup.position.set(cx, 0.08, cz);
      teaGroup.add(cup);
    });
    this.parkGroup.add(teaGroup);

    // 四方鼓形雕花石凳
    const stoolPositions = [
      { x: 0, z: 9.2 },
      { x: 0, z: -9.2 },
      { x: 9.2, z: 0 },
      { x: -9.2, z: 0 }
    ];
    stoolPositions.forEach(pos => {
      const stoolGroup = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.48, 0.42, 24), tableTopMat);
      seat.position.y = -2.08;
      seat.castShadow = true;
      const drumBelly = new THREE.Mesh(new THREE.SphereGeometry(1.38, 20, 16), carvedStoneMat);
      drumBelly.scale.set(1, 0.85, 1);
      drumBelly.position.y = -2.95;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.48, 0.55, 20), tableDarkStoneMat);
      base.position.y = -3.82;
      stoolGroup.add(seat, drumBelly, base);
      stoolGroup.position.set(pos.x, 0, pos.z);
      stoolGroup.rotation.y = Math.atan2(pos.x, pos.z);
      this.parkGroup.add(stoolGroup);
    });

    // 4. 远景古典六角飞檐听泉亭 3D 建模
    const pavilionGroup = new THREE.Group();
    pavilionGroup.position.set(-16.5, -4.15, -15.5);
    const pavWoodMat = new THREE.MeshStandardMaterial({ color: 0x6e2c1b, roughness: 0.45, metalness: 0.12 });
    const pavRoofMat = new THREE.MeshStandardMaterial({ color: 0x2c3e35, roughness: 0.52, metalness: 0.22 });
    const pavFloor = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.45, 6), stoneMat);
    pavFloor.position.y = 0.22;
    pavilionGroup.add(pavFloor);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 4.6, 12), pavWoodMat);
      col.position.set(Math.cos(a) * 3.4, 2.6, Math.sin(a) * 3.4);
      col.castShadow = true;
      pavilionGroup.add(col);
      // 飞檐翘角脊兽
      const eaveSpur = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2, 4), bronzeAccentMat);
      eaveSpur.position.set(Math.cos(a) * 4.8, 5.15, Math.sin(a) * 4.8);
      eaveSpur.rotation.z = -Math.cos(a) * 1.1;
      eaveSpur.rotation.x = Math.sin(a) * 1.1;
      pavilionGroup.add(eaveSpur);
    }
    const roofLower = new THREE.Mesh(new THREE.ConeGeometry(5.2, 1.8, 6), pavRoofMat);
    roofLower.position.y = 5.4;
    const roofUpper = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.5, 6), pavRoofMat);
    roofUpper.position.y = 6.65;
    const roofFinial = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), bronzeAccentMat);
    roofFinial.position.y = 7.55;
    pavilionGroup.add(roofLower, roofUpper, roofFinial);
    this.parkGroup.add(pavilionGroup);

    // 5. 荷塘汉白玉拱桥、游弋 3D 锦鲤与盛开荷花荷叶
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(14.5, -4.1, 4.2);
    bridgeGroup.rotation.y = 0.35;
    for (let s = -4; s <= 4; s++) {
      const archY = Math.cos((s / 5) * (Math.PI / 2)) * 1.35;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 2.6), stoneMat);
      plank.position.set(s * 0.78, archY, 0);
      bridgeGroup.add(plank);
      [-1.15, 1.15].forEach(rz => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), carvedStoneMat);
        post.position.set(s * 0.78, archY + 0.42, rz);
        bridgeGroup.add(post);
      });
    }
    this.parkGroup.add(bridgeGroup);

    // 荷塘立体荷叶与多层花瓣荷花
    const lotusLeafMat = new THREE.MeshStandardMaterial({ color: 0x2e6f40, roughness: 0.65, side: THREE.DoubleSide });
    const lotusPetalMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, emissive: 0xf472b6, emissiveIntensity: 0.12, roughness: 0.35 });
    const lotusCoords = [
      { x: -11.5, z: 6.5, s: 1.1, hasFlower: true },
      { x: -13.2, z: 4.8, s: 0.85, hasFlower: false },
      { x: 11.8, z: -7.5, s: 1.2, hasFlower: true },
      { x: 13.5, z: -5.8, s: 0.9, hasFlower: false },
      { x: -8.5, z: -12.8, s: 1.05, hasFlower: true },
      { x: 8.8, z: 12.6, s: 1.15, hasFlower: true }
    ];
    lotusCoords.forEach(lc => {
      const lGroup = new THREE.Group();
      lGroup.position.set(lc.x, -4.22, lc.z);
      lGroup.scale.setScalar(lc.s);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20, 0, Math.PI * 1.92), lotusLeafMat);
      pad.rotation.x = -Math.PI / 2;
      lGroup.add(pad);
      if (lc.hasFlower) {
        const flower = new THREE.Group();
        flower.position.set(0.15, 0.08, 0.1);
        for (let p = 0; p < 8; p++) {
          const pa = (p * Math.PI) / 4;
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 5), lotusPetalMat);
          petal.position.set(Math.cos(pa) * 0.18, 0.12, Math.sin(pa) * 0.18);
          petal.rotation.z = -Math.cos(pa) * 0.55;
          petal.rotation.x = Math.sin(pa) * 0.55;
          flower.add(petal);
        }
        const pistil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), bronzeAccentMat);
        pistil.position.y = 0.12;
        flower.add(pistil);
        lGroup.add(flower);
      }
      this.parkGroup.add(lGroup);
    });

    // 动态游弋 3D 锦鲤模型
    this.koiFishList = [];
    const koiColors = [0xef4444, 0xf59e0b, 0xffffff, 0xf97316];
    for (let k = 0; k < 6; k++) {
      const koiGroup = new THREE.Group();
      const kMat = new THREE.MeshStandardMaterial({ color: koiColors[k % koiColors.length], roughness: 0.25, metalness: 0.12 });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.72, 12), kMat);
      body.rotation.x = Math.PI / 2;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), kMat);
      tail.rotation.x = -Math.PI / 2;
      tail.position.z = -0.46;
      koiGroup.add(body, tail);
      this.parkGroup.add(koiGroup);
      this.koiFishList.push({
        group: koiGroup,
        tail,
        radius: 12.2 + (k % 3) * 2.4,
        angle: (k / 6) * Math.PI * 2,
        speed: 0.22 + (k % 2) * 0.08,
        phase: k * 1.3
      });
    }

    // 6. 精细分节翠竹林（带竹节环与放射竹叶簇）与太湖奇石
    this.trees = [];
    const bambooCulmMat = new THREE.MeshStandardMaterial({ color: 0x4d8b55, roughness: 0.36, metalness: 0.08 });
    const bambooNodeMat = new THREE.MeshStandardMaterial({ color: 0xc2d8b8, roughness: 0.45 });
    const bambooLeafMat = new THREE.MeshStandardMaterial({ color: 0x366e42, roughness: 0.52, side: THREE.DoubleSide });
    const blossomLeafMat = new THREE.MeshStandardMaterial({ color: 0xe295a6, roughness: 0.48, side: THREE.DoubleSide });

    const bambooClusters = [
      { x: -13.2, z: -10.2, scale: 1.25, isBlossom: false },
      { x: 13.8, z: -10.8, scale: 1.32, isBlossom: false },
      { x: -14.8, z: 9.2, scale: 1.18, isBlossom: false },
      { x: 12.8, z: 11.4, scale: 1.22, isBlossom: true },
      { x: -6.8, z: -16.2, scale: 1.12, isBlossom: false },
      { x: 7.5, z: -16.8, scale: 1.28, isBlossom: false },
      { x: 18.2, z: 0.8, scale: 1.15, isBlossom: false }
    ];

    bambooClusters.forEach((cfg, idx) => {
      const clusterGroup = new THREE.Group();
      clusterGroup.position.set(cfg.x, -4.2, cfg.z);
      clusterGroup.scale.setScalar(cfg.scale);

      // 太湖石底座点缀
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 1), tableDarkStoneMat);
      rock.position.set(0.4, 0.55, -0.3);
      rock.scale.set(1.2, 1.4, 0.9);
      rock.castShadow = true;
      clusterGroup.add(rock);

      const swayGroup = new THREE.Group();
      const culmOffsets = [[0, 0, 0, 1.0], [-0.45, 0.32, 0.06, 0.88], [0.42, -0.28, -0.05, 0.92], [0.18, 0.48, 0.04, 0.80]];
      culmOffsets.forEach(([ox, oz, tilt, hScale]) => {
        const stalkGroup = new THREE.Group();
        stalkGroup.position.set(ox, 0, oz);
        stalkGroup.rotation.z = tilt;
        const segments = 6;
        const segH = 1.35 * hScale;
        for (let s = 0; s < segments; s++) {
          const r = 0.14 * (1 - s * 0.08);
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r, segH, 10), bambooCulmMat);
          seg.position.y = s * segH + segH * 0.5;
          seg.castShadow = true;
          stalkGroup.add(seg);

          const nodeRing = new THREE.Mesh(new THREE.TorusGeometry(r * 1.04, 0.022, 8, 14), bambooNodeMat);
          nodeRing.rotation.x = Math.PI / 2;
          nodeRing.position.y = (s + 1) * segH;
          stalkGroup.add(nodeRing);

          if (s >= 2) {
            for (let b = 0; b < 4; b++) {
              const ba = (b * Math.PI) / 2 + s * 0.7;
              const leaf = new THREE.Mesh(
                new THREE.ConeGeometry(0.24, 1.25, 4),
                cfg.isBlossom && (s + b) % 2 === 0 ? blossomLeafMat : bambooLeafMat
              );
              leaf.scale.set(0.32, 1, 1);
              leaf.position.set(Math.cos(ba) * 0.55, (s + 0.8) * segH, Math.sin(ba) * 0.55);
              leaf.rotation.z = -Math.cos(ba) * 1.15;
              leaf.rotation.x = Math.sin(ba) * 1.15;
              stalkGroup.add(leaf);
            }
          }
        }
        swayGroup.add(stalkGroup);
      });

      clusterGroup.add(swayGroup);
      this.parkGroup.add(clusterGroup);
      this.trees.push({ group: swayGroup, phase: idx * 1.3 });
    });

    this.dappledCanopy = new THREE.Group();
    const canopyGeo = new THREE.DodecahedronGeometry(1.6, 0);
    const highBranchMat = new THREE.MeshLambertMaterial({ color: 0x4c8559 });
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
      opacity: 0.84
    });

    for (let i = 0; i < 44; i++) {
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

  buildBattlefieldEnvironment() {
    this.battlefieldGroup = new THREE.Group();
    this.battlefieldGroup.visible = this.currentSceneId === 'ancient_battlefield';
    this.scene.add(this.battlefieldGroup);

    const groundGeo = new THREE.CylinderGeometry(58, 58, 1, 64);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a2f22, roughness: 0.86, metalness: 0.08 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -4.8;
    ground.receiveShadow = true;
    this.battlefieldGroup.add(ground);

    const outerRingGeo = new THREE.RingGeometry(11.2, 29.0, 48);
    const outerRingMat = new THREE.MeshStandardMaterial({
      color: 0x2c1b13,
      roughness: 0.90,
      side: THREE.DoubleSide
    });
    const outerSandRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerSandRing.rotation.x = -Math.PI / 2;
    outerSandRing.position.y = -4.28;
    outerSandRing.receiveShadow = true;
    this.battlefieldGroup.add(outerSandRing);

    const obsidianStoneMat = new THREE.MeshStandardMaterial({
      color: 0x262322,
      roughness: 0.65,
      metalness: 0.28
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x1b1918,
      roughness: 0.38,
      metalness: 0.72
    });
    const gildedBronzeMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x78350f,
      emissiveIntensity: 0.26,
      roughness: 0.28,
      metalness: 0.88
    });
    const crimsonLacquerMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      roughness: 0.42,
      metalness: 0.24
    });
    const woodBeamMat = new THREE.MeshStandardMaterial({ color: 0x472d1e, roughness: 0.75 });

    // 1. 八角玄铁点将台与饕餮兽首护角
    const daisBase = new THREE.Mesh(new THREE.CylinderGeometry(10.8, 11.8, 0.38, 8), obsidianStoneMat);
    daisBase.position.y = -4.22;
    daisBase.receiveShadow = true;
    this.battlefieldGroup.add(daisBase);

    const daisStep = new THREE.Mesh(new THREE.CylinderGeometry(9.3, 9.9, 0.30, 8), darkIronMat);
    daisStep.position.y = -3.94;
    daisStep.receiveShadow = true;
    this.battlefieldGroup.add(daisStep);

    const daisBronzeRim = new THREE.Mesh(new THREE.TorusGeometry(9.52, 0.12, 12, 8), gildedBronzeMat);
    daisBronzeRim.rotation.x = Math.PI / 2;
    daisBronzeRim.rotation.z = Math.PI / 8;
    daisBronzeRim.position.y = -3.84;
    this.battlefieldGroup.add(daisBronzeRim);

    const tableSlab = new THREE.Mesh(new THREE.CylinderGeometry(8.10, 7.78, 0.80, 32), darkIronMat);
    tableSlab.position.y = -0.62;
    tableSlab.castShadow = true;
    tableSlab.receiveShadow = true;
    this.battlefieldGroup.add(tableSlab);

    const tableBronzeRim = new THREE.Mesh(new THREE.TorusGeometry(7.92, 0.18, 14, 64), gildedBronzeMat);
    tableBronzeRim.rotation.x = Math.PI / 2;
    tableBronzeRim.position.y = -0.44;
    this.battlefieldGroup.add(tableBronzeRim);

    const rivetGeo = new THREE.SphereGeometry(0.14, 12, 12);
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      const rivet = new THREE.Mesh(rivetGeo, gildedBronzeMat);
      rivet.position.set(Math.cos(a) * 7.96, -0.62, Math.sin(a) * 7.96);
      this.battlefieldGroup.add(rivet);
    }

    // 点将台案面虎符令箭架与青铜酒爵建模
    const tallyGroup = new THREE.Group();
    tallyGroup.position.set(-6.35, -0.22, 4.55);
    const tallyStand = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.45), gildedBronzeMat);
    tallyStand.position.y = 0.07;
    const tigerTally = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.22), gildedBronzeMat);
    tigerTally.position.y = 0.22;
    tallyGroup.add(tallyStand, tigerTally);
    this.battlefieldGroup.add(tallyGroup);

    const drumPedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.68, 3.28, 3.5, 24), crimsonLacquerMat);
    drumPedestal.position.y = -2.55;
    drumPedestal.castShadow = true;
    drumPedestal.receiveShadow = true;
    this.battlefieldGroup.add(drumPedestal);

    const drumRingTop = new THREE.Mesh(new THREE.TorusGeometry(2.74, 0.11, 10, 36), gildedBronzeMat);
    drumRingTop.rotation.x = Math.PI / 2;
    drumRingTop.position.y = -1.2;
    const drumRingBot = new THREE.Mesh(new THREE.TorusGeometry(3.18, 0.11, 10, 36), gildedBronzeMat);
    drumRingBot.rotation.x = Math.PI / 2;
    drumRingBot.position.y = -3.6;
    this.battlefieldGroup.add(drumRingTop, drumRingBot);

    const drumStoolCoords = [
      { x: 0, z: 9.2 },
      { x: 0, z: -9.2 },
      { x: 9.2, z: 0 },
      { x: -9.2, z: 0 }
    ];
    drumStoolCoords.forEach(pos => {
      const sg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.48, 1.95, 24), crimsonLacquerMat);
      body.position.y = -2.95;
      body.castShadow = true;
      body.receiveShadow = true;
      const topSeat = new THREE.Mesh(new THREE.CylinderGeometry(1.76, 1.72, 0.32, 24), darkIronMat);
      topSeat.position.y = -1.92;
      topSeat.castShadow = true;
      const goldBand = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.08, 10, 32), gildedBronzeMat);
      goldBand.rotation.x = Math.PI / 2;
      goldBand.position.y = -1.92;
      sg.add(body, topSeat, goldBand);
      sg.position.set(pos.x, 0, pos.z);
      sg.rotation.y = Math.atan2(pos.x, pos.z);
      this.battlefieldGroup.add(sg);
    });

    // 2. 四角三足双耳青铜火鼎与多层动态烈焰
    this.battlefieldFlames = [];
    this.battlefieldLights = [];
    const brazierCoords = [
      { x: -7.8, z: -7.8 },
      { x: 7.8, z: -7.8 },
      { x: -7.8, z: 7.8 },
      { x: 7.8, z: 7.8 }
    ];
    brazierCoords.forEach((bp, idx) => {
      const bg = new THREE.Group();
      bg.position.set(bp.x, 0, bp.z);

      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 0.68, 0.95, 20), darkIronMat);
      bowl.position.y = -1.75;
      bowl.castShadow = true;
      bg.add(bowl);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.10, 12, 28), gildedBronzeMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = -1.28;
      bg.add(rim);

      // 双立耳与三足鼎腿
      [-1.08, 1.08].forEach(ex => {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.36), gildedBronzeMat);
        ear.position.set(ex, -1.06, 0);
        bg.add(ear);
      });
      for (let l = 0; l < 3; l++) {
        const la = (l * Math.PI * 2) / 3 + idx * 0.4;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 2.2, 12), gildedBronzeMat);
        leg.position.set(Math.cos(la) * 0.65, -3.1, Math.sin(la) * 0.65);
        bg.add(leg);
      }

      const coalBed = new THREE.Mesh(
        new THREE.CircleGeometry(0.96, 20),
        new THREE.MeshBasicMaterial({ color: 0xea580c })
      );
      coalBed.rotation.x = -Math.PI / 2;
      coalBed.position.y = -1.29;
      bg.add(coalBed);

      const flameGroup = new THREE.Group();
      flameGroup.position.y = -1.26;
      const outerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.76, 1.95, 12),
        new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      outerFlame.position.y = 0.88;
      const innerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 1.42, 12),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.94,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      innerFlame.position.y = 0.64;
      flameGroup.add(outerFlame, innerFlame);
      bg.add(flameGroup);

      const fireLight = new THREE.PointLight(0xff7b24, 0.48, 16, 1.8);
      fireLight.position.set(0, -0.2, 0);
      bg.add(fireLight);

      this.battlefieldGroup.add(bg);
      this.battlefieldFlames.push({ group: flameGroup, outer: outerFlame, inner: innerFlame, phase: idx * 1.7 });
      this.battlefieldLights.push({ light: fireLight, baseIntensity: 0.48, phase: idx * 2.1 });
    });

    // 3. 远景巍峨城堞箭楼、夔纹巨型战鼓架与十八般兵器架建模
    const wallGroup = new THREE.Group();
    wallGroup.position.set(0, -4.2, -21.5);
    const mainWall = new THREE.Mesh(new THREE.BoxGeometry(28, 5.2, 2.6), obsidianStoneMat);
    mainWall.position.y = 2.6;
    wallGroup.add(mainWall);
    for (let m = -12; m <= 12; m += 2.0) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 0.65), obsidianStoneMat);
      merlon.position.set(m, 5.65, 0.95);
      wallGroup.add(merlon);
    }
    // 城门洞与重檐箭楼
    const gateTower = new THREE.Mesh(new THREE.BoxGeometry(7.6, 3.8, 3.2), crimsonLacquerMat);
    gateTower.position.y = 7.1;
    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.2, 4), darkIronMat);
    towerRoof.rotation.y = Math.PI / 4;
    towerRoof.position.y = 10.1;
    wallGroup.add(gateTower, towerRoof);
    this.battlefieldGroup.add(wallGroup);

    // 夔纹巨型战鼓与动态击鼓槌建模
    this.warDrumGroup = new THREE.Group();
    this.warDrumGroup.position.set(-14.5, -4.15, -4.5);
    this.warDrumGroup.rotation.y = 0.45;
    const drumStandL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 4.5, 10), woodBeamMat);
    drumStandL.position.set(-1.6, 2.25, 0);
    const drumStandR = drumStandL.clone();
    drumStandR.position.x = 1.6;
    const drumCrossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.8, 10), gildedBronzeMat);
    drumCrossbar.rotation.z = Math.PI / 2;
    drumCrossbar.position.y = 4.2;
    const bigDrumBody = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.8, 24), crimsonLacquerMat);
    bigDrumBody.rotation.x = Math.PI / 2;
    bigDrumBody.position.y = 2.6;
    const drumSkin = new THREE.Mesh(new THREE.CircleGeometry(1.22, 24), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.55 }));
    drumSkin.position.set(0, 2.6, 0.92);
    this.warDrumMallet = new THREE.Group();
    this.warDrumMallet.position.set(0, 2.6, 1.45);
    const malletShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), woodBeamMat);
    malletShaft.position.y = -0.35;
    const malletHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), gildedBronzeMat);
    malletHead.position.y = 0.22;
    this.warDrumMallet.add(malletShaft, malletHead);
    this.warDrumGroup.add(drumStandL, drumStandR, drumCrossbar, bigDrumBody, drumSkin, this.warDrumMallet);
    this.battlefieldGroup.add(this.warDrumGroup);

    // 十八般兵器架与方天画戟建模
    const rackGroup = new THREE.Group();
    rackGroup.position.set(14.5, -4.15, -4.2);
    rackGroup.rotation.y = -0.45;
    const rackBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 0.9), woodBeamMat);
    rackBase.position.y = 0.14;
    const rackBar = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.18), gildedBronzeMat);
    rackBar.position.y = 2.2;
    rackGroup.add(rackBase, rackBar);
    for (let w = -2; w <= 2; w++) {
      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 4.4, 8), woodBeamMat);
      spear.position.set(w * 0.55, 2.2, 0);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 4), gildedBronzeMat);
      tip.position.set(w * 0.55, 4.55, 0);
      rackGroup.add(spear, tip);
    }
    this.battlefieldGroup.add(rackGroup);

    // 4. 猎猎战旗（带戟头与横杆）
    this.warBanners = [];
    const bannerConfigs = [
      { x: -13.2, z: -10.8, isRed: false, scale: 1.15 },
      { x: 13.2, z: -10.8, isRed: false, scale: 1.15 },
      { x: -13.2, z: 10.8, isRed: true, scale: 1.15 },
      { x: 13.2, z: 10.8, isRed: true, scale: 1.15 },
      { x: -16.5, z: 2.2, isRed: false, scale: 1.0 },
      { x: 16.5, z: 2.2, isRed: true, scale: 1.0 }
    ];
    bannerConfigs.forEach((cfg, idx) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(cfg.x, 0, cfg.z);
      bGroup.scale.setScalar(cfg.scale);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 10.5, 10), darkIronMat);
      pole.position.y = 1.0;
      pole.castShadow = true;
      bGroup.add(pole);

      const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.85, 6), gildedBronzeMat);
      spearTip.position.y = 6.55;
      bGroup.add(spearTip);

      const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), gildedBronzeMat);
      crossBar.rotation.z = Math.PI / 2;
      crossBar.position.set(1.15, 5.65, 0);
      bGroup.add(crossBar);

      const clothGeo = new THREE.PlaneGeometry(2.3, 4.4, 8, 8);
      const clothMat = new THREE.MeshStandardMaterial({
        color: cfg.isRed ? 0x991b1b : 0x111827,
        emissive: cfg.isRed ? 0x450a0a : 0x090d16,
        emissiveIntensity: 0.35,
        roughness: 0.6,
        side: THREE.DoubleSide
      });
      const cloth = new THREE.Mesh(clothGeo, clothMat);
      cloth.position.set(1.18, 3.35, 0);
      cloth.castShadow = true;
      bGroup.add(cloth);

      this.battlefieldGroup.add(bGroup);
      this.warBanners.push({ mesh: cloth, phase: idx * 1.4, baseX: 1.18 });
    });

    // 拒马鹿角防线
    const barricadeCoords = [
      { x: -11.5, z: -15.5, ry: 0.35 },
      { x: 11.5, z: -15.5, ry: -0.35 },
      { x: -15.8, z: 6.5, ry: 1.1 },
      { x: 15.8, z: -6.5, ry: -1.1 }
    ];
    barricadeCoords.forEach(bc => {
      const bg = new THREE.Group();
      bg.position.set(bc.x, -3.55, bc.z);
      bg.rotation.y = bc.ry;

      const mainLog = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.2, 8), woodBeamMat);
      mainLog.rotation.z = Math.PI / 2;
      bg.add(mainLog);

      for (let i = -1; i <= 1; i++) {
        const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 2.6, 6), woodBeamMat);
        s1.position.x = i * 1.25;
        s1.rotation.x = 0.68;
        const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 2.6, 6), woodBeamMat);
        s2.position.x = i * 1.25;
        s2.rotation.x = -0.68;
        bg.add(s1, s2);
      }
      this.battlefieldGroup.add(bg);
    });

    this.battlefieldEmbers = [];
    const glowTex = typeof getGlowParticleTexture === 'function' ? getGlowParticleTexture() : null;
    for (let i = 0; i < 46; i++) {
      const spMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: i % 3 === 0 ? 0xfef08a : (i % 2 === 0 ? 0xf97316 : 0xef4444),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sp = new THREE.Sprite(spMat);
      const s = 0.18 + Math.random() * 0.26;
      sp.scale.set(s, s, 1);
      sp.position.set(
        (Math.random() - 0.5) * 26,
        Math.random() * 11 - 3.5,
        (Math.random() - 0.5) * 26
      );
      sp.visible = this.currentSceneId === 'ancient_battlefield';
      this.scene.add(sp);
      this.battlefieldEmbers.push({
        sprite: sp,
        baseScale: s,
        speedY: 0.55 + Math.random() * 0.85,
        speedX: 0.35 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  buildImperialStudyEnvironment() {
    this.studyGroup = new THREE.Group();
    this.studyGroup.visible = this.currentSceneId === 'imperial_study';
    this.scene.add(this.studyGroup);

    const mirrorPoolMat = new THREE.MeshStandardMaterial({
      color: 0x0a192f,
      roughness: 0.14,
      metalness: 0.55
    });
    const whiteJadeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe2e8f0,
      emissiveIntensity: 0.08,
      roughness: 0.18,
      metalness: 0.12
    });
    const celadonJadeMat = new THREE.MeshStandardMaterial({
      color: 0xcffafe,
      emissive: 0x0891b2,
      emissiveIntensity: 0.12,
      roughness: 0.20,
      metalness: 0.15
    });
    const gildedMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0x92400e,
      emissiveIntensity: 0.24,
      roughness: 0.20,
      metalness: 0.88
    });
    const vermilionMat = new THREE.MeshStandardMaterial({
      color: 0x881313,
      roughness: 0.32,
      metalness: 0.18
    });
    const sandalwoodMat = new THREE.MeshStandardMaterial({
      color: 0x361c12,
      roughness: 0.26,
      metalness: 0.22
    });
    const darkRoofMat = new THREE.MeshStandardMaterial({
      color: 0x172554,
      roughness: 0.35,
      metalness: 0.35
    });

    // 1. 星河镜池底座与双层太极星轨法阵
    const poolFloor = new THREE.Mesh(new THREE.CylinderGeometry(62, 62, 1, 64), mirrorPoolMat);
    poolFloor.position.y = -4.85;
    poolFloor.receiveShadow = true;
    this.studyGroup.add(poolFloor);

    const carpetTex = typeof getBaguaMagicTexture === 'function' ? getBaguaMagicTexture() : null;
    const starlightAstrolabe = new THREE.Mesh(
      new THREE.CircleGeometry(12.2, 64),
      new THREE.MeshBasicMaterial({
        map: carpetTex,
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    starlightAstrolabe.rotation.x = -Math.PI / 2;
    starlightAstrolabe.position.y = -3.76;
    this.studyGroup.add(starlightAstrolabe);
    this.studyAstrolabe = starlightAstrolabe;

    // 2. 三层汉白玉莲花须弥座、16根雕云望柱栏杆与四方丹陛玉阶
    const daisTier1 = new THREE.Mesh(new THREE.CylinderGeometry(11.4, 12.2, 0.38, 32), whiteJadeMat);
    daisTier1.position.y = -4.18;
    daisTier1.receiveShadow = true;
    const daisTier2 = new THREE.Mesh(new THREE.CylinderGeometry(9.8, 10.4, 0.34, 32), whiteJadeMat);
    daisTier2.position.y = -3.86;
    daisTier2.receiveShadow = true;
    const daisGoldRing = new THREE.Mesh(new THREE.TorusGeometry(9.86, 0.09, 12, 64), gildedMat);
    daisGoldRing.rotation.x = Math.PI / 2;
    daisGoldRing.position.y = -3.72;
    this.studyGroup.add(daisTier1, daisTier2, daisGoldRing);

    // 四方汉白玉丹陛踏步台阶
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(ang => {
      const stairGroup = new THREE.Group();
      stairGroup.rotation.y = ang;
      for (let s = 0; s < 3; s++) {
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 0.18, 0.65),
          s === 1 ? celadonJadeMat : whiteJadeMat
        );
        step.position.set(0, -4.25 + s * 0.16, 10.2 + (2 - s) * 0.55);
        stairGroup.add(step);
      }
      this.studyGroup.add(stairGroup);
    });

    // 16根汉白玉雕花望柱与双层玉栏（留出四方踏步通道）
    const balustradeRadius = 9.65;
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI * 2) / 16;
      const postGroup = new THREE.Group();
      postGroup.position.set(Math.cos(a) * balustradeRadius, -3.70, Math.sin(a) * balustradeRadius);
      const postShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.05, 12), whiteJadeMat);
      postShaft.position.y = 0.52;
      const postCap = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 12), gildedMat);
      postCap.position.y = 1.12;
      postGroup.add(postShaft, postCap);
      this.studyGroup.add(postGroup);

      // 相邻望柱之间的玉石栏板（跳过四个正方向入口）
      if (i % 4 !== 3 && i % 4 !== 0) {
        const nextA = ((i + 1) * Math.PI * 2) / 16;
        const mx = (Math.cos(a) + Math.cos(nextA)) * 0.5 * balustradeRadius;
        const mz = (Math.sin(a) + Math.sin(nextA)) * 0.5 * balustradeRadius;
        const segLen = 2 * balustradeRadius * Math.sin(Math.PI / 16);
        const railGroup = new THREE.Group();
        railGroup.position.set(mx, -3.70, mz);
        railGroup.rotation.y = -((a + nextA) * 0.5) + Math.PI / 2;
        const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, segLen, 8), whiteJadeMat);
        topRail.rotation.z = Math.PI / 2;
        topRail.position.y = 0.86;
        const midPanel = new THREE.Mesh(new THREE.BoxGeometry(segLen * 0.88, 0.42, 0.08), celadonJadeMat);
        midPanel.position.y = 0.44;
        railGroup.add(topRail, midPanel);
        this.studyGroup.add(railGroup);
      }
    }

    // 3. 紫檀嵌金御案、仙鹤博山香炉（带动态青烟环）、白玉酒壶对杯与传国玉玺
    const tableSlab = new THREE.Mesh(new THREE.CylinderGeometry(8.12, 7.82, 0.82, 48), sandalwoodMat);
    tableSlab.position.y = -0.62;
    tableSlab.castShadow = true;
    tableSlab.receiveShadow = true;
    const goldRim = new THREE.Mesh(new THREE.TorusGeometry(7.98, 0.15, 14, 64), gildedMat);
    goldRim.rotation.x = Math.PI / 2;
    goldRim.position.y = -0.42;
    const jadeInlayRim = new THREE.Mesh(new THREE.TorusGeometry(7.55, 0.06, 10, 64), whiteJadeMat);
    jadeInlayRim.rotation.x = Math.PI / 2;
    jadeInlayRim.position.y = -0.20;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 3.35, 3.25, 24), sandalwoodMat);
    pedestal.position.y = -2.42;
    pedestal.castShadow = true;
    const pedestalGoldBand = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.10, 10, 36), gildedMat);
    pedestalGoldBand.rotation.x = Math.PI / 2;
    pedestalGoldBand.position.y = -1.65;
    this.studyGroup.add(tableSlab, goldRim, jadeInlayRim, pedestal, pedestalGoldBand);

    // 仙鹤博山金香炉与袅袅动态青烟环
    const craneCenser = new THREE.Group();
    craneCenser.position.set(-6.35, -0.22, -4.55);
    const craneBase = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.22, 16), gildedMat);
    craneBase.position.y = 0.11;
    const craneBowl = new THREE.Mesh(new THREE.SphereGeometry(0.40, 18, 14), gildedMat);
    craneBowl.scale.set(1, 0.70, 1);
    craneBowl.position.y = 0.38;
    const cranePeak = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.42, 8), gildedMat);
    cranePeak.position.y = 0.72;
    craneCenser.add(craneBase, craneBowl, cranePeak);
    this.studyGroup.add(craneCenser);

    this.studySmokeRings = [];
    for (let s = 0; s < 5; s++) {
      const sRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.022, 8, 24),
        new THREE.MeshBasicMaterial({
          color: 0xbae6fd,
          transparent: true,
          opacity: 0.32,
          depthWrite: false
        })
      );
      sRing.rotation.x = Math.PI / 2;
      sRing.position.set(-6.35, 0.65 + s * 0.25, -4.55);
      this.studyGroup.add(sRing);
      this.studySmokeRings.push({ mesh: sRing, baseOffset: s * 0.28, phase: s * 1.3 });
    }

    // 白玉酒壶与双玉爵对杯
    const jadeWineGroup = new THREE.Group();
    jadeWineGroup.position.set(6.25, -0.22, -4.45);
    const potBody = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), whiteJadeMat);
    potBody.scale.set(1, 1.25, 1);
    potBody.position.y = 0.36;
    const potNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.15, 0.28, 12), whiteJadeMat);
    potNeck.position.y = 0.72;
    const potLid = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), gildedMat);
    potLid.position.y = 0.88;
    jadeWineGroup.add(potBody, potNeck, potLid);
    [-0.52, 0.52].forEach(cx => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.22, 12), celadonJadeMat);
      cup.position.set(cx, 0.11, 0.32);
      jadeWineGroup.add(cup);
    });
    this.studyGroup.add(jadeWineGroup);

    // 传国白玉金纽玺
    const imperialSeal = new THREE.Group();
    imperialSeal.position.set(6.25, -0.22, 4.45);
    const sealBlock = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.36, 0.58), whiteJadeMat);
    sealBlock.position.y = 0.18;
    const sealKnob = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 10, 16, Math.PI), gildedMat);
    sealKnob.position.y = 0.36;
    imperialSeal.add(sealBlock, sealKnob);
    this.studyGroup.add(imperialSeal);

    // 4. 四方完整四足落地紫檀官帽太师椅（含四条椅腿、脚踏横枨、锦垫、S型靠背板、扶手与金箍官帽搭脑）
    const chairCoords = [
      { x: 0, z: 8.8, ry: 0 },
      { x: 0, z: -8.8, ry: Math.PI },
      { x: 8.8, z: 0, ry: Math.PI / 2 },
      { x: -8.8, z: 0, ry: -Math.PI / 2 }
    ];
    chairCoords.forEach(cc => {
      const cg = new THREE.Group();
      cg.position.set(cc.x, 0, cc.z);
      cg.rotation.y = cc.ry;

      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 1.66), sandalwoodMat);
      seat.position.y = -2.12;
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.10, 1.48), vermilionMat);
      cushion.position.y = -1.98;
      cg.add(seat, cushion);

      // 四根落地实木椅腿 + 底部横枨（直达须弥座地面 y = -3.70）
      [[-0.84, -0.72], [0.84, -0.72], [-0.84, 0.72], [0.84, 0.72]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 1.60, 10), sandalwoodMat);
        leg.position.set(lx, -2.92, lz);
        cg.add(leg);
      });
      const frontStretcher = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.68, 8), gildedMat);
      frontStretcher.rotation.z = Math.PI / 2;
      frontStretcher.position.set(0, -3.35, -0.72);
      cg.add(frontStretcher);

      // 左右后立柱、背板与官帽搭脑
      [-0.84, 0.84].forEach(bx => {
        const backPost = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.78, 10), sandalwoodMat);
        backPost.position.set(bx, -1.16, 0.72);
        const armRest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.52), sandalwoodMat);
        armRest.position.set(bx, -1.36, 0.0);
        const armSupport = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.74, 8), sandalwoodMat);
        armSupport.position.set(bx, -1.74, -0.58);
        cg.add(backPost, armRest, armSupport);
      });

      const splat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.68, 0.10), sandalwoodMat);
      splat.position.set(0, -1.16, 0.72);
      const splatJade = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.12, 16), whiteJadeMat);
      splatJade.rotation.x = Math.PI / 2;
      splatJade.position.set(0, -1.08, 0.72);
      const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 2.24, 12), gildedMat);
      topRail.rotation.z = Math.PI / 2;
      topRail.position.set(0, -0.26, 0.72);
      cg.add(splat, splatJade, topRail);
      this.studyGroup.add(cg);
    });

    // 5. 远景九天皎月、重檐飞角摘星仙阁与紫檀六曲云龙画屏
    this.studyMoonGroup = new THREE.Group();
    this.studyMoonGroup.position.set(0, 8.2, -25.5);
    const moonCore = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfef9c3 })
    );
    const moonAura1 = new THREE.Mesh(
      new THREE.RingGeometry(3.65, 4.85, 48),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    const moonAura2 = new THREE.Mesh(
      new THREE.RingGeometry(4.85, 6.8, 48),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.studyMoonGroup.add(moonCore, moonAura1, moonAura2);
    this.studyGroup.add(this.studyMoonGroup);

    // 重檐飞角摘星仙阁
    const pavilionGroup = new THREE.Group();
    pavilionGroup.position.set(0, -4.15, -20.5);
    const pavBase = new THREE.Mesh(new THREE.BoxGeometry(16.5, 1.6, 5.2), whiteJadeMat);
    pavBase.position.y = 0.8;
    const pavHall = new THREE.Mesh(new THREE.BoxGeometry(12.8, 4.4, 4.0), vermilionMat);
    pavHall.position.y = 3.8;
    // 暖光棂窗
    for (let w = -2; w <= 2; w++) {
      const winPane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.45, 2.35),
        new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.82 })
      );
      winPane.position.set(w * 2.2, 3.8, 2.02);
      pavilionGroup.add(winPane);
    }
    const lowerEave = new THREE.Mesh(new THREE.ConeGeometry(10.8, 2.2, 4), darkRoofMat);
    lowerEave.rotation.y = Math.PI / 4;
    lowerEave.scale.set(1.35, 1, 0.58);
    lowerEave.position.y = 6.8;
    const upperHall = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.8, 3.0), vermilionMat);
    upperHall.position.y = 8.4;
    const upperEave = new THREE.Mesh(new THREE.ConeGeometry(8.0, 2.4, 4), darkRoofMat);
    upperEave.rotation.y = Math.PI / 4;
    upperEave.scale.set(1.32, 1, 0.58);
    upperEave.position.y = 10.6;
    const roofFinial = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), gildedMat);
    roofFinial.position.y = 12.1;
    pavilionGroup.add(pavBase, pavHall, lowerEave, upperHall, upperEave, roofFinial);
    this.studyGroup.add(pavilionGroup);

    // 紫檀六曲云龙画屏（含落地铜座）
    const screenGroup = new THREE.Group();
    screenGroup.position.set(0, -3.70, -13.4);
    for (let p = -2.5; p <= 2.5; p += 1.0) {
      const panelGroup = new THREE.Group();
      const angle = (p % 2 === 0 ? 0.16 : -0.16);
      panelGroup.position.set(p * 1.85, 2.45, Math.abs(p) * 0.28);
      panelGroup.rotation.y = angle;
      const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(1.80, 4.9, 0.14), sandalwoodMat);
      const innerSilk = new THREE.Mesh(new THREE.BoxGeometry(1.56, 4.4, 0.16), vermilionMat);
      const goldMedallion = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.18, 20), gildedMat);
      goldMedallion.rotation.x = Math.PI / 2;
      goldMedallion.position.y = 0.42;
      const footStand = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.22, 0.46), gildedMat);
      footStand.position.y = -2.36;
      panelGroup.add(outerFrame, innerSilk, goldMedallion, footStand);
      screenGroup.add(panelGroup);
    }
    this.studyGroup.add(screenGroup);

    // 四根朱漆蟠龙金柱
    const pillarCoords = [
      { x: -13.2, z: -11.2 },
      { x: 13.2, z: -11.2 },
      { x: -13.2, z: 11.2 },
      { x: 13.2, z: 11.2 }
    ];
    pillarCoords.forEach(pc => {
      const pg = new THREE.Group();
      pg.position.set(pc.x, 0, pc.z);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.90, 15.5, 24), vermilionMat);
      col.position.y = 3.2;
      col.castShadow = true;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.44, 0.85, 24), whiteJadeMat);
      base.position.y = -4.25;
      const dragonPoints = [];
      for (let t = 0; t <= 32; t++) {
        const f = t / 32;
        const a = f * Math.PI * 5;
        dragonPoints.push(new THREE.Vector3(Math.cos(a) * 0.90, -3.2 + f * 9.5, Math.sin(a) * 0.90));
      }
      const dragonCurve = new THREE.CatmullRomCurve3(dragonPoints);
      const dragonCoil = new THREE.Mesh(new THREE.TubeGeometry(dragonCurve, 48, 0.08, 8, false), gildedMat);
      pg.add(col, base, dragonCoil);
      this.studyGroup.add(pg);
    });

    // 6. 8盏悬浮八角琉璃宫灯 + 8盏池面漂浮莲花河灯 + 14团瑶台流云 + 40颗漫天星尘微粒
    this.studyLanterns = [];
    const lanternCoords = [
      { x: -8.6, y: 4.8, z: -8.2 },
      { x: 8.6, y: 4.8, z: -8.2 },
      { x: -8.6, y: 4.8, z: 8.2 },
      { x: 8.6, y: 4.8, z: 8.2 },
      { x: -12.4, y: 6.2, z: 0 },
      { x: 12.4, y: 6.2, z: 0 }
    ];
    lanternCoords.forEach((lc, idx) => {
      const lg = new THREE.Group();
      lg.position.set(lc.x, lc.y, lc.z);
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.68, 1.38, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffedd5,
          transparent: true,
          opacity: 0.90
        })
      );
      const topRoof = new THREE.Mesh(new THREE.ConeGeometry(1.02, 0.52, 8), gildedMat);
      topRoof.position.y = 0.92;
      const botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.40, 0.26, 8), gildedMat);
      botCap.position.y = -0.82;
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.92, 10), vermilionMat);
      tassel.rotation.x = Math.PI;
      tassel.position.y = -1.38;
      const ptLight = new THREE.PointLight(0xffb74d, idx < 4 ? 0.48 : 0.28, 16, 1.8);
      lg.add(shade, topRoof, botCap, tassel, ptLight);
      this.studyGroup.add(lg);
      this.studyLanterns.push({ group: lg, tassel, baseY: lc.y, phase: idx * 1.3, light: ptLight });
    });

    // 池面漂浮莲花河灯
    this.studyWaterLanterns = [];
    for (let w = 0; w < 8; w++) {
      const ang = (w / 8) * Math.PI * 2;
      const rad = 13.8 + (w % 2) * 2.2;
      const wlGroup = new THREE.Group();
      const petalBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.28, 0.16, 8), celadonJadeMat);
      const candleCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.20, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      candleCore.position.y = 0.12;
      wlGroup.add(petalBase, candleCore);
      wlGroup.position.set(Math.cos(ang) * rad, -4.28, Math.sin(ang) * rad);
      this.studyGroup.add(wlGroup);
      this.studyWaterLanterns.push({ group: wlGroup, angle: ang, radius: rad, speed: 0.06 + (w % 3) * 0.02, phase: w * 1.1 });
    }

    // 瑶台四周漂浮 3D 流云仙雾
    this.studyClouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.26
    });
    for (let c = 0; c < 12; c++) {
      const ang = (c / 12) * Math.PI * 2;
      const rad = 14.5 + (c % 3) * 2.8;
      const cGroup = new THREE.Group();
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.15 - p * 0.2, 12, 10), cloudMat);
        puff.scale.set(1.6, 0.42, 1.1);
        puff.position.set((p - 1) * 0.95, (p % 2) * 0.18, 0);
        cGroup.add(puff);
      }
      cGroup.position.set(Math.cos(ang) * rad, -3.65 + (c % 2) * 0.55, Math.sin(ang) * rad);
      cGroup.rotation.y = -ang + Math.PI / 2;
      this.studyGroup.add(cGroup);
      this.studyClouds.push({ group: cGroup, baseX: cGroup.position.x, baseZ: cGroup.position.z, phase: c * 0.9 });
    }

    // 漫天星尘流萤微粒
    this.studyStardust = [];
    const glowTex = typeof getGlowParticleTexture === 'function' ? getGlowParticleTexture() : null;
    for (let i = 0; i < 40; i++) {
      const spMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: i % 3 === 0 ? 0x7dd3fc : (i % 2 === 0 ? 0xfef08a : 0xffffff),
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sp = new THREE.Sprite(spMat);
      const s = 0.16 + Math.random() * 0.22;
      sp.scale.set(s, s, 1);
      sp.position.set(
        (Math.random() - 0.5) * 28,
        Math.random() * 11 - 3.2,
        (Math.random() - 0.5) * 28
      );
      this.studyGroup.add(sp);
      this.studyStardust.push({
        sprite: sp,
        speedY: 0.22 + Math.random() * 0.35,
        speedX: 0.18 + Math.random() * 0.28,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  buildChessboard3D() {
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    const boardOuterW = BOARD_WIDTH + 1.84;
    const boardOuterH = BOARD_HEIGHT + 1.84;
    const boardThickness = 0.46;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x4a2812,
      roughness: 0.34,
      metalness: 0.16
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4a338,
      emissive: 0x78350f,
      emissiveIntensity: 0.18,
      roughness: 0.25,
      metalness: 0.88
    });
    const topTex = createChessboardTexture();
    const topMat = new THREE.MeshStandardMaterial({
      map: topTex,
      color: 0xf4e4c8,
      roughness: 0.46,
      metalness: 0.04
    });

    const materials = [frameMat, frameMat, topMat, frameMat, frameMat, frameMat];
    const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(boardOuterW, boardThickness, boardOuterH), materials);
    boardMesh.position.y = -boardThickness / 2;
    boardMesh.castShadow = true;
    boardMesh.receiveShadow = true;
    this.boardGroup.add(boardMesh);

    const subBase = new THREE.Mesh(
      new THREE.BoxGeometry(boardOuterW + 0.34, 0.18, boardOuterH + 0.34),
      frameMat
    );
    subBase.position.y = -boardThickness - 0.08;
    subBase.castShadow = true;
    subBase.receiveShadow = true;
    this.boardGroup.add(subBase);

    const cornerGeo = new THREE.BoxGeometry(0.68, boardThickness + 0.04, 0.68);
    const halfW = boardOuterW / 2 - 0.28;
    const halfH = boardOuterH / 2 - 0.28;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const bracket = new THREE.Mesh(cornerGeo, brassMat);
      bracket.position.set(sx * halfW, -boardThickness / 2 + 0.005, sz * halfH);
      this.boardGroup.add(bracket);
    });
  }

  buildInteractionMarkers() {
    this.markersGroup = new THREE.Group();
    this.scene.add(this.markersGroup);

    const selTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('selected') : null;
    const selMat = new THREE.MeshBasicMaterial({
      map: selTex,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
      depthWrite: false
    });
    this.selectedRing = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 1.16), selMat);
    this.selectedRing.rotation.x = -Math.PI / 2;
    this.selectedRing.position.y = 0.018;
    this.selectedRing.visible = false;
    this.scene.add(this.selectedRing);

    const fromTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('last_from') : null;
    const fromMat = new THREE.MeshBasicMaterial({
      map: fromTex,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.86,
      depthWrite: false
    });
    this.lastFromRing = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), fromMat);
    this.lastFromRing.rotation.x = -Math.PI / 2;
    this.lastFromRing.position.y = 0.012;
    this.lastFromRing.visible = false;
    this.lastFromCoord = null;

    const toTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('last_to') : null;
    const toMat = new THREE.MeshBasicMaterial({
      map: toTex,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.90,
      depthWrite: false
    });
    this.lastToRing = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 1.14), toMat);
    this.lastToRing.rotation.x = -Math.PI / 2;
    this.lastToRing.position.y = 0.013;
    this.lastToRing.visible = false;
    this.lastToCoord = null;
    this.scene.add(this.lastFromRing, this.lastToRing);

    this.moveIndicators = [];
  }

  syncLastMoveMarkerVisibility() {
    if (!this.lastFromRing || !this.lastToRing) return;
    if (!this.lastFromCoord || !this.lastToCoord) {
      this.lastFromRing.visible = false;
      this.lastToRing.visible = false;
      return;
    }
    const sel = this.selectedSquare;
    const hasIndicatorAt = (r, c) => {
      if (!this.moveIndicators || this.moveIndicators.length === 0) return false;
      return this.moveIndicators.some(ind => ind.userData && ind.userData.tr === r && ind.userData.tc === c);
    };

    const hideFrom = (sel && sel.r === this.lastFromCoord.r && sel.c === this.lastFromCoord.c) ||
                     hasIndicatorAt(this.lastFromCoord.r, this.lastFromCoord.c);
    const hideTo = (sel && sel.r === this.lastToCoord.r && sel.c === this.lastToCoord.c) ||
                   hasIndicatorAt(this.lastToCoord.r, this.lastToCoord.c);

    this.lastFromRing.visible = !hideFrom;
    this.lastToRing.visible = !hideTo;
  }

  setLastMoveMarkers(fr, fc, tr, tc) {
    if (typeof fr !== 'number' || typeof tr !== 'number') {
      this.lastFromCoord = null;
      this.lastToCoord = null;
      if (this.lastFromRing) this.lastFromRing.visible = false;
      if (this.lastToRing) this.lastToRing.visible = false;
      return;
    }
    this.lastFromCoord = { r: fr, c: fc };
    this.lastToCoord = { r: tr, c: tc };
    const startPos = gridToWorld(fr, fc);
    const endPos = gridToWorld(tr, tc);
    if (this.lastFromRing) {
      this.lastFromRing.position.set(startPos.x, 0.012, startPos.z);
    }
    if (this.lastToRing) {
      this.lastToRing.position.set(endPos.x, 0.013, endPos.z);
    }
    this.syncLastMoveMarkerVisibility();
  }

  clearAllTransientVFX(clearLastMove = false) {
    this.clearLegalMoveIndicators();
    this.clearIllegalWarningRings();
    this.clearGrandmasterHint3D?.();
    if (this.impactWaves && this.impactWaves.length > 0) {
      for (const w of this.impactWaves) {
        this.scene?.remove(w.mesh);
        w.mesh?.geometry?.dispose?.();
        w.mesh?.material?.dispose?.();
      }
      this.impactWaves = [];
    }
    if (this.shatterParticles && this.shatterParticles.length > 0) {
      for (const sp of this.shatterParticles) {
        this.scene?.remove(sp.mesh);
        sp.mesh?.geometry?.dispose?.();
        sp.mesh?.material?.dispose?.();
      }
      this.shatterParticles = [];
    }
    if (clearLastMove) {
      this.setLastMoveMarkers(null, null, null, null);
    } else {
      this.syncLastMoveMarkerVisibility();
    }
  }

  ensureSharedPieceAssets() {
    if (this.sharedPieceAssets) return this.sharedPieceAssets;
    const height = 0.35;
    const radius = 0.445;

    this.sharedPieceAssets = {
      height,
      radius,
      cylGeo: new THREE.CylinderGeometry(radius * 0.93, radius, height, 40),
      rimGeo: new THREE.TorusGeometry(radius * 0.92, 0.028, 14, 40),
      baseRimGeo: new THREE.TorusGeometry(radius * 0.98, 0.022, 12, 40),
      topDiscGeo: new THREE.CircleGeometry(radius * 0.91, 40),
      redRimMat: new THREE.MeshStandardMaterial({ color: 0xb5852b, metalness: 0.65, roughness: 0.36 }),
      blackRimMat: new THREE.MeshStandardMaterial({ color: 0xc29332, metalness: 0.68, roughness: 0.32 })
    };
    return this.sharedPieceAssets;
  }

  ensureSharedIndicatorAssets() {
    if (this.sharedIndicatorAssets) return this.sharedIndicatorAssets;
    const dotSafeTex = getMoveIndicatorTexture('dot_safe');
    const dotUnsafeTex = getMoveIndicatorTexture('dot_unsafe');
    const capSafeTex = getMoveIndicatorTexture('capture_safe');
    const capUnsafeTex = getMoveIndicatorTexture('capture_unsafe');

    this.sharedIndicatorAssets = {
      captureBaseGeo: new THREE.PlaneGeometry(1.18, 1.18),
      lotusDotGeo: new THREE.PlaneGeometry(0.68, 0.68),
      hitGeo: new THREE.CylinderGeometry(0.56, 0.56, 0.50, 16),
      captureSafeMat: new THREE.MeshBasicMaterial({
        map: capSafeTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
      }),
      captureUnsafeMat: new THREE.MeshBasicMaterial({
        map: capUnsafeTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
      }),
      dotSafeMat: new THREE.MeshBasicMaterial({
        map: dotSafeTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
      }),
      dotUnsafeMat: new THREE.MeshBasicMaterial({
        map: dotUnsafeTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
      }),
      hitMat: new THREE.MeshBasicMaterial({ visible: false })
    };
    return this.sharedIndicatorAssets;
  }

  createPieceMesh(pieceData, r, c) {
    const assets = this.ensureSharedPieceAssets();
    const { height } = assets;
    const group = new THREE.Group();
    const isRed = pieceData.color === RED;
    const isHidden = Boolean(pieceData.isHidden);

    const bodyMat = isRed
      ? new THREE.MeshPhysicalMaterial({
          color: 0xead8be,
          roughness: 0.32,
          metalness: 0.04,
          clearcoat: 0.26,
          clearcoatRoughness: 0.30
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0x0b0f17,
          roughness: 0.22,
          metalness: 0.18,
          clearcoat: 0.42,
          clearcoatRoughness: 0.20
        });

    const cylMesh = new THREE.Mesh(assets.cylGeo, bodyMat);
    cylMesh.position.y = height / 2;
    cylMesh.castShadow = true;
    group.add(cylMesh);

    const rimMat = isRed ? assets.redRimMat : assets.blackRimMat;
    const rimMesh = new THREE.Mesh(assets.rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = height - 0.01;
    group.add(rimMesh);

    const baseRimMesh = new THREE.Mesh(assets.baseRimGeo, rimMat);
    baseRimMesh.rotation.x = Math.PI / 2;
    baseRimMesh.position.y = 0.02;
    group.add(baseRimMesh);

    const topMat = typeof getPieceTopMaterial === 'function'
      ? getPieceTopMaterial(pieceData.color, pieceData.char, isHidden)
      : new THREE.MeshStandardMaterial({ ...getPieceMedallionTextures(pieceData.color, pieceData.char, isHidden), bumpScale: 0.032 });
    const topDisc = new THREE.Mesh(assets.topDiscGeo, topMat);
    topDisc.rotation.x = -Math.PI / 2;
    const flipForBlack = (this.onlineRole === BLACK) || (!this.onlineRole && this.gameMode === 'pvp' && pieceData.color === BLACK);
    topDisc.rotation.z = flipForBlack ? Math.PI : 0;
    topDisc.position.y = height + 0.002;
    group.add(topDisc);

    const backMat = typeof getPieceTopMaterial === 'function'
      ? getPieceTopMaterial(pieceData.color, pieceData.char, true)
      : topMat;
    const bottomDisc = new THREE.Mesh(assets.topDiscGeo, backMat);
    bottomDisc.rotation.x = Math.PI / 2;
    bottomDisc.position.y = -0.002;
    group.add(bottomDisc);

    const pos = gridToWorld(r, c);
    group.position.set(pos.x, 0, pos.z);
    group.userData = {
      pieceId: pieceData.id,
      color: pieceData.color,
      type: pieceData.type,
      char: pieceData.char,
      isHidden,
      r,
      c,
      topDisc,
      bottomDisc,
      bodyMat,
      rimMat,
      tacticalState: null
    };
    if (this.piecesGroup) {
      this.piecesGroup.add(group);
    } else {
      this.scene.add(group);
    }
    return group;
  }

  syncPiecesFromEngine() {
    this.engine?.invalidateTacticalCache?.();
    const activeIds = new Set();
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = this.engine.board[r][c];
        if (p) activeIds.add(p.id);
      }
    }

    for (const [id, mesh] of this.pieceMeshes.entries()) {
      if (!activeIds.has(id)) {
        if (this.piecesGroup) this.piecesGroup.remove(mesh);
        this.scene.remove(mesh);
        this.pieceMeshes.delete(id);
      }
    }

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = this.engine.board[r][c];
        if (!p) continue;
        const existing = this.pieceMeshes.get(p.id);
        if (existing && existing.userData && existing.userData.color === p.color) {
          const ud = existing.userData;
          const pos = gridToWorld(r, c);
          existing.position.set(pos.x, 0, pos.z);
          existing.rotation.set(0, 0, 0);
          existing.scale.set(1, 1, 1);
          ud.r = r;
          ud.c = c;
          ud.type = p.type;
          const nextHidden = Boolean(p.isHidden);
          if (ud.isHidden !== nextHidden || ud.char !== p.char) {
            ud.isHidden = nextHidden;
            ud.char = p.char;
            if (ud.topDisc && typeof getPieceTopMaterial === 'function') {
              ud.topDisc.material = getPieceTopMaterial(p.color, p.char, nextHidden);
            }
          }
          if (ud.topDisc) {
            const flipForBlack = (this.onlineRole === BLACK) || (!this.onlineRole && this.gameMode === 'pvp' && p.color === BLACK);
            ud.topDisc.rotation.z = flipForBlack ? Math.PI : 0;
          }
          if (this.piecesGroup && existing.parent !== this.piecesGroup) {
            this.piecesGroup.add(existing);
          }
        } else {
          if (existing) {
            if (this.piecesGroup) this.piecesGroup.remove(existing);
            this.scene.remove(existing);
          }
          this.pieceMeshes.set(p.id, this.createPieceMesh(p, r, c));
        }
      }
    }
    this.updateTacticalGlowState();
  }

  updateTacticalGlowState() {
    if (!this.engine || !this.pieceMeshes) return;
    this.threatenedFriendlyIds = new Set();
    this.safeCapturableEnemyIds = new Set();
    for (const mesh of this.pieceMeshes.values()) {
      const ud = mesh.userData;
      if (!ud) continue;
      ud.tacticalState = null;
      if (ud.bodyMat) {
        ud.bodyMat.emissive.setHex(0x000000);
        ud.bodyMat.emissiveIntensity = 0.0;
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
    if (this.moveIndicators && this.moveIndicators.length > 0) {
      for (const m of this.moveIndicators) {
        this.markersGroup?.remove(m);
        this.scene?.remove(m);
      }
    }
    this.moveIndicators = [];
    if (this.markersGroup) {
      while (this.markersGroup.children.length > 0) {
        this.markersGroup.remove(this.markersGroup.children[0]);
      }
    }
    if (this.selectedRing) {
      this.selectedRing.visible = false;
    }
    this.syncLastMoveMarkerVisibility();
  }

  clearIllegalWarningRings() {
    if (!this.illegalWarningRings) return;
    for (const item of this.illegalWarningRings) {
      this.scene?.remove(item.mesh);
      item.mesh?.geometry?.dispose?.();
      item.mesh?.material?.dispose?.();
    }
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
    this.clearIllegalWarningRings();
  }

  showIllegalMovePrompt(diagnosis, duration = 2400) {
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
      descEl.textContent = diagnosis.message || '该步违反行棋规则，请另选落点。';

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
      const warnTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('warning') : null;
      const selTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('selected') : null;
      diagnosis.highlightSquares.forEach((sq, idx) => {
        if (!sq || typeof sq.r !== 'number' || typeof sq.c !== 'number') return;
        const pos = gridToWorld(sq.r, sq.c);
        const tex = idx === 0 ? warnTex : selTex;
        const ring = new THREE.Mesh(
          tex ? new THREE.PlaneGeometry(1.18, 1.18) : new THREE.RingGeometry(0.42, 0.54, 32),
          new THREE.MeshBasicMaterial({
            map: tex || null,
            color: tex ? 0xffffff : (idx === 0 ? 0xef4444 : 0xf59e0b),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.92,
            depthWrite: false
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(pos.x, 0.026, pos.z);
        this.scene.add(ring);
        this.illegalWarningRings.push({ mesh: ring, age: 0, maxAge: 1.35 });
      });
    }
  }

  showLegalMoveIndicators(r, c, moves) {
    this.clearLegalMoveIndicators();
    const selPos = gridToWorld(r, c);
    this.selectedRing.position.set(selPos.x, 0.018, selPos.z);
    this.selectedRing.visible = true;

    const indAssets = this.ensureSharedIndicatorAssets();

    for (const m of moves) {
      const pos = gridToWorld(m.tr, m.tc);
      const isCapture = Boolean(m.capture);
      const isUnsafe = this.engine.wouldPieceBeCapturedAfterMove(m, this.engine.board);
      const holder = new THREE.Group();
      holder.position.set(pos.x, 0.016, pos.z);
      holder.userData = { isCapture, isUnsafe, tr: m.tr, tc: m.tc, phase: (m.tr * 0.65 + m.tc * 0.45) };

      if (isCapture) {
        const baseLock = new THREE.Mesh(
          indAssets.captureBaseGeo,
          isUnsafe ? indAssets.captureUnsafeMat : indAssets.captureSafeMat
        );
        baseLock.rotation.x = -Math.PI / 2;
        baseLock.position.y = 0.004;
        holder.add(baseLock);
        holder.userData.baseLock = baseLock;
      } else {
        const lotusDisc = new THREE.Mesh(
          indAssets.lotusDotGeo,
          isUnsafe ? indAssets.dotUnsafeMat : indAssets.dotSafeMat
        );
        lotusDisc.rotation.x = -Math.PI / 2;
        lotusDisc.position.y = 0.002;
        holder.add(lotusDisc);
        holder.userData.lotusDisc = lotusDisc;
      }

      const hitMesh = new THREE.Mesh(indAssets.hitGeo, indAssets.hitMat);
      hitMesh.position.y = 0.2;
      hitMesh.userData = { isMoveTarget: true, move: m };
      holder.add(hitMesh);

      this.markersGroup.add(holder);
      this.moveIndicators.push(holder);
    }
    this.syncLastMoveMarkerVisibility();
    this.updateTacticalGlowState();
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

  showActionBurstPopup(mainText, subText = '', color = RED, styleKind = 'capture') {
    const wrap = document.getElementById('action-burst-popup');
    const mainEl = document.getElementById('action-burst-char');
    const subEl = document.getElementById('action-burst-sub');
    const sealEl = document.getElementById('action-burst-seal');
    if (!wrap || !mainEl) return;

    mainEl.textContent = mainText;
    if (subEl) {
      subEl.textContent = subText;
      subEl.classList.toggle('hidden', !subText);
    }
    if (sealEl) {
      sealEl.textContent = styleKind === 'check' ? '雷霆叫将' : (styleKind === 'capture_check' ? '破阵斩将' : '锋芒夺子');
    }

    wrap.dataset.theme = color === BLACK ? 'black' : 'red';
    wrap.dataset.kind = styleKind;
    wrap.classList.remove('hidden', 'action-burst-active');
    void wrap.offsetWidth;
    wrap.classList.add('action-burst-active');

    if (this.actionBurstTimer) clearTimeout(this.actionBurstTimer);
    this.actionBurstTimer = setTimeout(() => {
      wrap.classList.add('hidden');
      wrap.classList.remove('action-burst-active');
    }, 1350);
  }

  computePieceMotionTransform(pieceType, startPos, endPos, isCapture, wasFlipped, t) {
    const dx = endPos.x - startPos.x;
    const dz = endPos.z - startPos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    const perpX = -dirZ;
    const perpZ = dirX;

    let x = startPos.x;
    let y = 0;
    let z = startPos.z;
    let rx = 0, ry = 0, rz = 0;
    let sx = 1, sy = 1, sz = 1;

    if (wasFlipped) {
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      x = THREE.MathUtils.lerp(startPos.x, endPos.x, ease);
      z = THREE.MathUtils.lerp(startPos.z, endPos.z, ease);
      y = Math.sin(ease * Math.PI) * 1.42;
      rx = ease * Math.PI * 2;
      rz = Math.sin(ease * Math.PI * 2) * 0.26;
      const pulse = 1 + Math.sin(ease * Math.PI) * 0.14;
      sx = pulse; sy = pulse; sz = pulse;
      return { x, y, z, rx, ry, rz, sx, sy, sz };
    }

    if (pieceType === 'n') {
      if (t < 0.13) {
        const p = t / 0.13;
        sy = 1 - p * 0.22;
        sx = 1 + p * 0.11;
        sz = 1 + p * 0.11;
        rx = -dirZ * p * 0.28;
        rz = dirX * p * 0.28;
      } else if (t < 0.86) {
        const p = (t - 0.13) / 0.73;
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const sway = Math.sin(p * Math.PI) * (isCapture ? 0.28 : 0.20);
        x = THREE.MathUtils.lerp(startPos.x, endPos.x, ease) + perpX * sway;
        z = THREE.MathUtils.lerp(startPos.z, endPos.z, ease) + perpZ * sway;
        y = Math.sin(p * Math.PI) * (isCapture ? 1.85 : 1.48);
        const pitch = Math.sin(p * Math.PI * 2) * 0.36;
        rx = dirZ * pitch;
        rz = -dirX * pitch;
        ry = 0;
      } else {
        const p = (t - 0.86) / 0.14;
        x = endPos.x;
        z = endPos.z;
        const bounce = Math.sin(p * Math.PI);
        sy = 1 - bounce * 0.20;
        sx = 1 + bounce * 0.10;
        sz = 1 + bounce * 0.10;
        rx = dirZ * Math.sin(p * Math.PI * 2) * 0.14 * (1 - p);
        rz = -dirX * Math.sin(p * Math.PI * 2) * 0.14 * (1 - p);
      }
      return { x, y, z, rx, ry, rz, sx, sy, sz };
    }

    if (pieceType === 'c') {
      if (isCapture) {
        if (t < 0.15) {
          const p = t / 0.15;
          x = startPos.x - dirX * p * 0.22;
          z = startPos.z - dirZ * p * 0.22;
          y = p * 0.28;
          rx = -dirZ * p * 0.44;
          rz = dirX * p * 0.44;
          sy = 1 - p * 0.15;
          sx = 1 + p * 0.08;
          sz = 1 + p * 0.08;
        } else if (t < 0.78) {
          const p = (t - 0.15) / 0.63;
          const ease = 1 - Math.pow(1 - p, 2.2);
          x = THREE.MathUtils.lerp(startPos.x - dirX * 0.22, endPos.x, ease);
          z = THREE.MathUtils.lerp(startPos.z - dirZ * 0.22, endPos.z, ease);
          y = Math.sin(p * Math.PI) * 2.35 + (1 - p) * 0.28;
          const tilt = Math.cos(p * Math.PI) * -0.58;
          rx = dirZ * tilt;
          rz = -dirX * tilt;
          ry = p * Math.PI;
          const boost = 1 + Math.sin(p * Math.PI) * 0.16;
          sx = boost; sy = boost; sz = boost;
        } else {
          const p = (t - 0.78) / 0.22;
          x = endPos.x;
          z = endPos.z;
          y = Math.max(0, (1 - p * 2.5) * 0.18);
          const squash = Math.sin(p * Math.PI) * 0.24;
          sy = 1 - squash;
          sx = 1 + squash * 0.55;
          sz = 1 + squash * 0.55;
        }
      } else {
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        x = THREE.MathUtils.lerp(startPos.x, endPos.x, ease);
        z = THREE.MathUtils.lerp(startPos.z, endPos.z, ease);
        y = Math.sin(t * Math.PI) * 0.46;
        const tilt = Math.sin(t * Math.PI * 2) * 0.24;
        rx = dirZ * tilt;
        rz = -dirX * tilt;
        ry = Math.sin(t * Math.PI) * 0.28;
      }
      return { x, y, z, rx, ry, rz, sx, sy, sz };
    }

    if (pieceType === 'r') {
      if (t < 0.12) {
        const p = t / 0.12;
        x = startPos.x - dirX * p * 0.16;
        z = startPos.z - dirZ * p * 0.16;
        y = p * 0.14;
        rx = -dirZ * p * 0.24;
        rz = dirX * p * 0.24;
      } else if (t < 0.82) {
        const p = (t - 0.12) / 0.70;
        const ease = 1 - Math.pow(1 - p, 3);
        x = THREE.MathUtils.lerp(startPos.x - dirX * 0.16, endPos.x, ease);
        z = THREE.MathUtils.lerp(startPos.z - dirZ * 0.16, endPos.z, ease);
        y = 0.14 + Math.sin(p * Math.PI) * (isCapture ? 0.34 : 0.18);
        const lean = (1 - p * 0.65) * 0.38;
        rx = dirZ * lean;
        rz = -dirX * lean;
        sx = 1.05; sy = 0.95; sz = 1.05;
      } else {
        const p = (t - 0.82) / 0.18;
        x = endPos.x + dirX * Math.sin(p * Math.PI) * 0.08 * (1 - p);
        z = endPos.z + dirZ * Math.sin(p * Math.PI) * 0.08 * (1 - p);
        y = 0;
        const brake = Math.sin(p * Math.PI) * -0.28 * (1 - p * 0.4);
        rx = dirZ * brake;
        rz = -dirX * brake;
      }
      return { x, y, z, rx, ry, rz, sx, sy, sz };
    }

    if (pieceType === 'b' || pieceType === 'a') {
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const curveOffset = Math.sin(t * Math.PI) * (pieceType === 'b' ? 0.34 : 0.18);
      x = THREE.MathUtils.lerp(startPos.x, endPos.x, ease) + perpX * curveOffset;
      z = THREE.MathUtils.lerp(startPos.z, endPos.z, ease) + perpZ * curveOffset;
      y = Math.sin(t * Math.PI) * (pieceType === 'b' ? 1.15 : 0.72);
      ry = ease * Math.PI * 2;
      const bank = Math.sin(t * Math.PI) * 0.32;
      rx = perpZ * bank + dirZ * Math.sin(t * Math.PI * 2) * 0.16;
      rz = -perpX * bank - dirX * Math.sin(t * Math.PI * 2) * 0.16;
      return { x, y, z, rx, ry, rz, sx, sy, sz };
    }

    if (t < 0.16) {
      const p = t / 0.16;
      y = p * 0.25;
      rx = -dirZ * p * 0.26;
      rz = dirX * p * 0.26;
      sy = 1 - p * 0.12;
      sx = 1 + p * 0.06;
      sz = 1 + p * 0.06;
    } else if (t < 0.82) {
      const p = (t - 0.16) / 0.66;
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      x = THREE.MathUtils.lerp(startPos.x, endPos.x, ease);
      z = THREE.MathUtils.lerp(startPos.z, endPos.z, ease);
      y = 0.25 * (1 - p) + Math.sin(p * Math.PI) * (isCapture ? 1.08 : 0.76);
      const tilt = Math.sin(p * Math.PI) * 0.36;
      rx = dirZ * tilt;
      rz = -dirX * tilt;
    } else {
      const p = (t - 0.82) / 0.18;
      x = endPos.x;
      z = endPos.z;
      y = 0;
      const wobble = Math.sin(p * Math.PI * 2) * 0.15 * (1 - p);
      rx = dirZ * wobble;
      rz = -dirX * wobble;
      const sq = Math.sin(p * Math.PI) * 0.14;
      sy = 1 - sq;
      sx = 1 + sq * 0.5;
      sz = 1 + sq * 0.5;
    }
    return { x, y, z, rx, ry, rz, sx, sy, sz };
  }

  executeMoveAnimated(move, onComplete, isRemote = false) {
    this.hideIllegalMovePrompt();
    this.isBusy = true;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.clearLegalMoveIndicators();
    this.clearGrandmasterHint3D?.();

    const movingPiece = this.engine.board[move.fr][move.fc];
    const targetPiece = this.engine.board[move.tr][move.tc];
    const movingMesh = this.pieceMeshes.get(movingPiece.id);
    const targetMesh = targetPiece ? this.pieceMeshes.get(targetPiece.id) : null;

    const startPos = gridToWorld(move.fr, move.fc);
    const endPos = gridToWorld(move.tr, move.tc);
    const isCapture = Boolean(targetPiece);
    const capturedCharSnapshot = targetPiece ? (targetPiece.isHidden ? '暗子' : targetPiece.char) : '';
    const movePieceType = movingPiece.isHidden ? (movingPiece.posType || movingPiece.type) : movingPiece.type;

    if (this.gameMode !== 'pvp' && movingPiece.color === BLACK) {
      this.sfx.playPickUp(movingPiece.color, true);
    }

    const notation = this.formatChineseMoveNotation(move);
    const moverColor = this.engine.turn;
    const moveRes = this.engine.makeMove(move);
    const wasFlipped = Boolean(moveRes.flipped);

    this.recordReplayStep?.(move, notation, moverColor, moveRes.actionTag);

    if (!isRemote && this.conn?.open) {
      this.conn.send({
        type: 'move',
        move: { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc },
        revealedType: wasFlipped ? movingPiece.type : null
      });
    }

    this.setLastMoveMarkers(move.fr, move.fc, move.tr, move.tc);

    this.spawnMoveTrailRibbon?.(startPos, endPos, moverColor, isCapture, movePieceType);

    const animDuration = isCapture
      ? (movePieceType === 'c' ? 0.54 : (movePieceType === 'n' ? 0.50 : 0.44))
      : (wasFlipped ? 0.48 : (movePieceType === 'n' ? 0.44 : (movePieceType === 'r' ? 0.34 : 0.38)));

    const moveDist = Math.hypot(endPos.x - startPos.x, endPos.z - startPos.z) || 1;
    const attackDirX = (endPos.x - startPos.x) / moveDist;
    const attackDirZ = (endPos.z - startPos.z) / moveDist;

    let midFlipApplied = false;
    let captureShattered = false;
    this.activeAnimations.push({
      mesh: movingMesh,
      elapsed: 0,
      duration: animDuration,
      update: (t) => {
        if (!movingMesh) return;
        const tf = this.computePieceMotionTransform(movePieceType, startPos, endPos, isCapture, wasFlipped, t);
        movingMesh.position.set(tf.x, tf.y, tf.z);
        movingMesh.rotation.set(tf.rx, tf.ry, tf.rz);
        movingMesh.scale.set(tf.sx, tf.sy, tf.sz);

        // 吃子防重叠优化：在进攻棋子即将触达目标格瞬间 (t >= 0.72) 提前击飞并粉碎被吃棋子，杜绝两子模型交叉重叠！
        if (isCapture && targetMesh && !captureShattered) {
          if (t >= 0.45 && t < 0.72) {
            const tremor = Math.sin(t * 95) * 0.032;
            targetMesh.position.set(endPos.x + tremor, 0, endPos.z - tremor);
          } else if (t >= 0.72) {
            captureShattered = true;
            if (this.piecesGroup) this.piecesGroup.remove(targetMesh);
            this.scene.remove(targetMesh);
            this.pieceMeshes.delete(targetPiece.id);
            this.spawnShatterFragments(endPos.x, endPos.z, targetPiece.color, attackDirX, attackDirZ);
            this.sfx.playAttackShatter();
          }
        }

        if (wasFlipped && t >= 0.48 && !midFlipApplied) {
          midFlipApplied = true;
          movingMesh.userData.isHidden = false;
          movingMesh.userData.type = movingPiece.type;
          movingMesh.userData.char = movingPiece.char;
          if (movingMesh.userData.topDisc && typeof getPieceTopMaterial === 'function') {
            movingMesh.userData.topDisc.material = getPieceTopMaterial(movingPiece.color, movingPiece.char, false);
          }
        }
      },
      complete: () => {
        if (movingMesh) {
          movingMesh.position.set(endPos.x, 0, endPos.z);
          movingMesh.rotation.set(0, 0, 0);
          movingMesh.scale.set(1, 1, 1);
          movingMesh.userData.r = move.tr;
          movingMesh.userData.c = move.tc;
          movingMesh.userData.isHidden = Boolean(movingPiece.isHidden);
          movingMesh.userData.type = movingPiece.type;
          movingMesh.userData.char = movingPiece.char;
          if (wasFlipped && !midFlipApplied && movingMesh.userData.topDisc && typeof getPieceTopMaterial === 'function') {
            movingMesh.userData.topDisc.material = getPieceTopMaterial(movingPiece.color, movingPiece.char, false);
          }
        }
        if (isCapture) {
          if (!captureShattered && targetMesh) {
            if (this.piecesGroup) this.piecesGroup.remove(targetMesh);
            this.scene.remove(targetMesh);
            this.pieceMeshes.delete(targetPiece.id);
            this.spawnShatterFragments(endPos.x, endPos.z, targetPiece.color, attackDirX, attackDirZ);
            this.sfx.playAttackShatter();
          }
        } else {
          this.spawnMoveImpactWave?.(endPos.x, endPos.z, movePieceType === 'r' || movePieceType === 'n');
          this.sfx.playMove(movingPiece.color, movingPiece.type);
        }
        this.updateTacticalGlowState();
        this.onTurnFinished({
          wasCapture: isCapture,
          moverColor,
          moverChar: movingPiece.char,
          capturedChar: capturedCharSnapshot,
          notation
        });
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
    document.getElementById('cycle-countdown-badge').textContent = `余 ${cycleStatus.remainingSteps} 步裁决`;

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
    let calloutTitle = '双方不变 · 判和';
    if (cycleStatus.verdict === 'RED_LOSE') { winnerColor = BLACK; calloutTitle = '红方长打不变 · 判负'; }
    else if (cycleStatus.verdict === 'BLACK_LOSE') { winnerColor = RED; calloutTitle = '黑方长打不变 · 判负'; }

    const rulePattern = {
      title: calloutTitle,
      stampText: winnerColor === 'draw' ? '握手言和' : '循环判负',
      badge: `循环裁决 · ${cycleStatus.verdictShort}`,
      poem: '“天道有常须变着，执迷不悟判负还。”',
      analysis: cycleStatus.ruleExplanation,
      highlightCoords: [],
      vfxType: 'stalemate_trap'
    };
    this.recordReplayOutcome?.(winnerColor, calloutTitle);
    this.updateRestartButtonLabel();
    this.updateUI(this.engine.isInCheck(this.engine.turn));
    this.sfx.playVictorySeal();
    this.showCenterCallout(calloutTitle, winnerColor === 'draw' ? RED : winnerColor, '循环裁定');
    setTimeout(() => { if (this.gameOver) this.showGameOverModal(winnerColor, rulePattern); }, 1450);
  }

  onTurnFinished(moveMeta = null) {
    const currentTurn = this.engine.turn;
    const inCheck = this.engine.isInCheck(currentTurn);
    const hasMoves = this.engine.hasAnyLegalMove(currentTurn);

    this.updateUI(inCheck);

    if (!hasMoves) {
      const winner = currentTurn === RED ? BLACK : RED;
      let pattern = CheckmateClassifier.classify(this.engine, currentTurn);
      if (this.activeDrillVfxType && winner === RED && this.engine.history.length <= 2) {
        if (pattern.vfxType !== this.activeDrillVfxType && typeof CheckmateClassifier.getMetaByType === 'function') {
          const drillMeta = CheckmateClassifier.getMetaByType(this.activeDrillVfxType);
          if (drillMeta) {
            pattern = {
              ...pattern,
              title: drillMeta.title,
              stampText: drillMeta.stampText,
              subBanner: drillMeta.subBanner,
              badge: drillMeta.badge,
              poem: drillMeta.poem,
              analysis: drillMeta.desc,
              vfxType: drillMeta.vfxType
            };
          }
        }
        this.activeDrillVfxType = null;
      }

      if (this.replayMode) {
        this.replayTrialCheckmated = true;
        this.isBusy = false;
        this.hideCycleWarningBanner();
        this.updateReplayPanelUI?.();
        this.updateTacticalGlowState();
        this.updateUI(inCheck);
        this.showCheckmateHighlights(pattern.highlightCoords);
        this.triggerCheckmateVFX(pattern, winner);
        this.showIllegalMovePrompt({
          icon: 'undo',
          title: `试招绝杀 · ${pattern.title}`,
          message: '当前分支已被绝杀，点击底部「悔棋」可退回继续推演。'
        }, 6000);
        return;
      }

      this.gameOver = true;
      this.isBusy = false;
      this.hideCycleWarningBanner();
      this.recordReplayOutcome?.(winner, pattern.title);
      this.updateRestartButtonLabel();
      this.updateTacticalGlowState();
      this.updateUI(inCheck);
      this.showCheckmateHighlights(pattern.highlightCoords);
      this.triggerCheckmateVFX(pattern, winner);
      const vfxWaitMs = Math.round((this.vfxAtmosphereDuration || 6.80) * 1000) + 80;
      setTimeout(() => { if (this.gameOver) this.showGameOverModal(winner, pattern); }, vfxWaitMs);
      return;
    }

    const cycleStatus = this.engine.analyzeCycleStatus();
    if (cycleStatus) {
      if (cycleStatus.remainingSteps === 0) {
        if (this.replayMode) {
          this.replayTrialCheckmated = true;
          this.isBusy = false;
          this.hideCycleWarningBanner();
          this.updateReplayPanelUI?.();
          this.updateTacticalGlowState();
          this.updateUI(inCheck);
          this.showCenterCallout(`${cycleStatus.verdictShort} · 请悔棋继续`, RED, '复盘裁定');
          this.showIllegalMovePrompt({
            icon: 'undo',
            title: `试招裁决 · ${cycleStatus.verdictShort}`,
            message: `${cycleStatus.ruleExplanation} 请点击「悔棋」退回继续推演。`
          }, 5500);
          return;
        }
        this.triggerRuleAdjudication(cycleStatus);
        return;
      }
      this.updateCycleWarningUI(cycleStatus);
      if (cycleStatus.remainingSteps === cycleStatus.period || cycleStatus.remainingSteps <= 2) {
        this.showIllegalMovePrompt({ icon: 'gavel', title: `循环警告 · 余${cycleStatus.remainingSteps}步`, message: cycleStatus.ruleExplanation }, 2800);
      }
    } else {
      this.hideCycleWarningBanner();
    }

    const attackerColor = currentTurn === RED ? BLACK : RED;
    if (inCheck && moveMeta?.wasCapture) {
      this.sfx.playCheck();
      this.showActionBurstPopup('吃·将', `${moveMeta.moverChar}斩${moveMeta.capturedChar} · 雷霆叫将`, attackerColor, 'capture_check');
    } else if (inCheck) {
      this.sfx.playCheck();
      this.showActionBurstPopup('將軍', moveMeta?.notation ? `${moveMeta.notation} · 威逼九宫` : '兵临城下 · 速解将围', attackerColor, 'check');
    } else if (moveMeta?.wasCapture) {
      this.showActionBurstPopup('吃', `${moveMeta.moverChar}吃${moveMeta.capturedChar} · ${moveMeta.notation}`, attackerColor, 'capture');
    }

    const shouldAITakeTurn = !this.replayMode
      ? (this.gameMode !== 'pvp' && currentTurn === BLACK && !this.gameOver)
      : (this.replayBranchActive && this.gameMode !== 'pvp' && !this.replayTrialCheckmated && currentTurn !== (this.replayHumanColor || RED));

    if (shouldAITakeTurn) {
      this.isBusy = true;
      const aiBadge = document.getElementById('ai-thinking');
      const aiLabel = document.getElementById('ai-thinking-label');
      aiBadge?.classList.remove('hidden');
      aiBadge?.classList.add('inline-flex');
      if (aiLabel) aiLabel.textContent = this.gameMode === 'inferno' ? '宗师推演…' : 'AI 推演…';

      this.requestAIMove(currentTurn, this.gameMode, (aiMove) => {
        aiBadge?.classList.add('hidden');
        aiBadge?.classList.remove('inline-flex');
        const stillValid = !this.replayMode
          ? !this.gameOver
          : (this.replayMode && this.replayBranchActive && !this.replayTrialCheckmated);
        if (aiMove && stillValid) {
          this.executeMoveAnimated(aiMove);
        } else {
          this.isBusy = false;
          this.updateUI(this.engine.isInCheck(this.engine.turn));
        }
      });
    } else {
      this.isBusy = false;
      this.updateUI(inCheck);
    }
  }

  handleBoardClick(clientX, clientY) {
    if (window.innerWidth < 1024 && !this.capturedTrayCollapsed) {
      this.capturedTrayCollapsed = true;
      this.syncCapturedTrayVisibility();
    }

    if (this.isBusy || (!this.replayMode && this.gameOver && !this.endgameEditor)) return;
    if (this.replayMode) {
      this.stopReplayAutoPlay?.();
      if (this.replayTrialCheckmated) {
        this.showIllegalMovePrompt({
          icon: 'undo',
          title: '当前分支已绝杀',
          message: '请点击底部「悔棋」退回上一步，继续尝试其他着法。'
        }, 3000);
        return;
      }
    }
    if (!this.endgameEditor && !this.replayMode && this.gameMode !== 'pvp' && this.engine.turn === BLACK) return;
    if (!this.endgameEditor && this.onlineRole && this.engine.turn !== this.onlineRole) return;

    if ((this.checkmateVFXGroup && this.checkmateVFXGroup.children.length > 0) || (this.checkmateHighlightRings && this.checkmateHighlightRings.length > 0)) {
      this.clearCheckmateVFX();
      this.clearCheckmateHighlights();
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this._mouseVec.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = this._raycaster;
    raycaster.setFromCamera(this._mouseVec, this.camera);

    if (this.selectedSquare && this.moveIndicators.length > 0) {
      const hitTargets = [];
      for (let i = 0; i < this.moveIndicators.length; i++) {
        const children = this.moveIndicators[i].children;
        for (let j = 0; j < children.length; j++) {
          const ch = children[j];
          if (ch.userData && (ch.userData.isMoveTarget || ch.userData.isForbiddenTarget)) hitTargets.push(ch);
        }
      }
      const moveHits = raycaster.intersectObjects(hitTargets, false);
      if (moveHits.length > 0) {
        const hitData = moveHits[0].object.userData;
        if (hitData.isMoveTarget) {
          this.clearIllegalWarningRings();
          if (this.replayMode) {
            this.replayHumanColor = this.engine.turn;
            this.prepareReplayBranchAtCurrentStep?.(this.engine.turn);
          }
          this.executeMoveAnimated(hitData.move);
          return;
        } else if (hitData.isForbiddenTarget) {
          const diagnosis = this.engine.diagnoseIllegalMove(hitData.move.fr, hitData.move.fc, hitData.move.tr, hitData.move.tc);
          this.showIllegalMovePrompt(diagnosis);
          return;
        }
      }
    }

    const hitPlane = raycaster.ray.intersectPlane(this._boardPlane, this._intersectPt);
    if (hitPlane) {
      const c = Math.round(this._intersectPt.x / CELL_SIZE + 4);
      const r = Math.round(this._intersectPt.z / CELL_SIZE + 4.5);
      if (this.engine.inBounds(r, c)) {
        if (this.endgameEditor) { this.editBoardSquare(r, c); return; }
        const clickedPiece = this.engine.board[r][c];

        if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
          if (clickedPiece) this.sfx.playMove(clickedPiece.color, clickedPiece.type);
          this.selectedSquare = null;
          this.legalMovesForSelected = [];
          this.clearLegalMoveIndicators();
          this.updateTacticalGlowState();
          return;
        }

        if (clickedPiece && clickedPiece.color === this.engine.turn) {
          this.clearIllegalWarningRings();
          this.sfx.playPickUp(clickedPiece.color, false);
          this.selectedSquare = { r, c };
          const cache = this.engine._ensureTacticalCache?.(this.engine.turn, this.engine.board);
          this.legalMovesForSelected = cache
            ? (cache.legalMovesBySq.get(r * 9 + c) || [])
            : this.engine.getLegalMoves(r, c);
          this.showLegalMoveIndicators(r, c, this.legalMovesForSelected);
          return;
        }

        if (this.selectedSquare) {
          const matchingMove = this.legalMovesForSelected.find(m => m.tr === r && m.tc === c);
          if (matchingMove) {
            this.clearIllegalWarningRings();
            if (this.replayMode) {
              this.replayHumanColor = this.engine.turn;
              this.prepareReplayBranchAtCurrentStep?.(this.engine.turn);
            }
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
    this.updateTacticalGlowState();
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

    const camLerp = this.vfxAtmosphereTimer > 0 ? 0.25 : 0.1;
    this.camSpherical.radius = THREE.MathUtils.lerp(this.camSpherical.radius, this.desiredSpherical.radius, camLerp);
    this.camSpherical.phi = THREE.MathUtils.lerp(this.camSpherical.phi, this.desiredSpherical.phi, camLerp);
    this.camSpherical.theta = THREE.MathUtils.lerp(this.camSpherical.theta, this.desiredSpherical.theta, camLerp);

    const sinPhi = Math.sin(this.camSpherical.phi);
    const camX = this.camTarget.x + this.camSpherical.radius * sinPhi * Math.sin(this.camSpherical.theta);
    const camY = this.camTarget.y + this.camSpherical.radius * Math.cos(this.camSpherical.phi);
    const camZ = this.camTarget.z + this.camSpherical.radius * sinPhi * Math.cos(this.camSpherical.theta);

    if (this.cameraShake > 0.005) {
      const shakeOffset = (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.set(camX + shakeOffset, camY + shakeOffset * 0.7, camZ + shakeOffset);
      this.cameraShake *= 0.84;
    } else {
      this.camera.position.set(camX, camY, camZ);
      this.cameraShake = 0;
    }
    this.camera.lookAt(this.camTarget);

    for (const mesh of this.pieceMeshes.values()) {
      if (this.activeAnimations.some(a => a.mesh === mesh)) continue;
      if (this._activeCheckerMeshes && this._activeCheckerMeshes.some(x => x.mesh === mesh) && this.vfxAtmosphereTimer > 0) continue;
      const ud = mesh.userData;
      if (!ud) continue;
      const { r, c } = ud;
      const isSelected = Boolean(this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c);

      if (isSelected) {
        mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.36 + Math.sin(elapsed * 5.2) * 0.06, 0.22);
        mesh.rotation.x = Math.sin(elapsed * 4.0) * 0.07;
        mesh.rotation.z = Math.cos(elapsed * 4.0) * 0.07;
      } else {
        if (Math.abs(mesh.position.y) > 0.001) mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0, 0.24);
        if (Math.abs(mesh.rotation.x) > 0.001 || Math.abs(mesh.rotation.z) > 0.001) {
          mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, 0, 0.24);
          mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, 0.24);
        }
      }
    }

    if (this.selectedRing.visible) {
      const s = 1.0 + Math.sin(elapsed * 4.8) * 0.04;
      this.selectedRing.scale.set(s, s, 1);
      this.selectedRing.rotation.z = elapsed * 0.75;
    }
    if (this.lastFromRing?.visible) {
      this.lastFromRing.rotation.z = -elapsed * 0.35;
    }
    if (this.lastToRing?.visible) {
      const s = 0.98 + Math.sin(elapsed * 3.2) * 0.03;
      this.lastToRing.scale.set(s, s, 1);
      this.lastToRing.rotation.z = elapsed * 0.45;
    }

    for (const ind of this.moveIndicators) {
      const u = ind.userData;
      const ph = u.phase || 0;
      if (u.isCapture) {
        const s = 0.97 + Math.sin(elapsed * 4.8 + ph) * 0.05;
        ind.scale.set(s, 1, s);
        if (u.baseLock) u.baseLock.rotation.z = elapsed * 0.85 + ph;
      } else {
        const s = 0.96 + Math.sin(elapsed * 4.2 + ph) * 0.06;
        ind.scale.set(s, 1, s);
        if (u.lotusDisc) u.lotusDisc.rotation.z = elapsed * 0.65 + ph;
      }
    }

    if (this.impactWaves && this.impactWaves.length > 0) {
      for (let i = this.impactWaves.length - 1; i >= 0; i--) {
        const w = this.impactWaves[i];
        w.age += dt;
        const p = Math.min(1, w.age / w.maxAge);
        if (w.isTrail) {
          w.mesh.material.opacity = (1 - p) * 0.78;
        } else if (w.isSlash) {
          const sc = 0.75 + (1 - Math.pow(1 - p, 3)) * (w.maxScale - 0.75);
          w.mesh.scale.set(sc, sc, 1);
          w.mesh.rotation.z += dt * 4.2;
          w.mesh.material.opacity = (1 - p) * 0.90;
        } else {
          const sc = 0.70 + (1 - Math.pow(1 - p, 2)) * (w.maxScale - 0.70);
          w.mesh.scale.set(sc, sc, 1);
          w.mesh.material.opacity = (1 - p) * 0.82;
        }
        if (p >= 1) {
          this.scene.remove(w.mesh);
          w.mesh.geometry?.dispose?.();
          w.mesh.material?.dispose?.();
          this.impactWaves.splice(i, 1);
        }
      }
    }

    if (this.illegalWarningRings && this.illegalWarningRings.length > 0) {
      for (let i = this.illegalWarningRings.length - 1; i >= 0; i--) {
        const item = this.illegalWarningRings[i];
        item.age += dt;
        const p = Math.min(1, item.age / item.maxAge);
        const s = 0.94 + Math.sin(item.age * 10) * 0.06;
        item.mesh.scale.set(s, s, 1);
        item.mesh.rotation.z += dt * 1.2;
        item.mesh.material.opacity = (1 - p) * 0.88;
        if (p >= 1) {
          this.scene.remove(item.mesh);
          item.mesh.geometry?.dispose?.();
          item.mesh.material?.dispose?.();
          this.illegalWarningRings.splice(i, 1);
        }
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
      if (!this._vfxCustomColorGrading) {
        const progress = 1 - (this.vfxAtmosphereTimer / (this.vfxAtmosphereDuration || 3.80));
        let eclipseFactor = 0;
        if (progress < 0.14) eclipseFactor = progress / 0.14;
        else if (progress < 0.76) eclipseFactor = 1;
        else eclipseFactor = 1 - (progress - 0.76) / 0.24;
        const sc = this.getActiveSceneConfig();
        this._tempDayColor.setHex(sc.bgHex || 0xdbe9dc);
        this._tempDayColor.lerp(this._tempNightColor, Math.max(0, Math.min(1, eclipseFactor)) * 0.76);
        this.scene.background.copy(this._tempDayColor);
        if (this.scene.fog) this.scene.fog.color.copy(this._tempDayColor);
        if (this.sunLight) this.sunLight.intensity = THREE.MathUtils.lerp(sc.sunIntensity || 0.88, 0.24, eclipseFactor);
        if (this.hemiLight) this.hemiLight.intensity = THREE.MathUtils.lerp(sc.hemiIntensity || 0.65, 0.22, eclipseFactor);
      }
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
      this.checkmateVFXAnimations.length === 0
    ) {
      this.clearCheckmateVFX();
      this.clearCheckmateHighlights();
      this.vfxAtmosphereDuration = 0;
    }
    for (let i = this.shatterParticles.length - 1; i >= 0; i--) {
      const p = this.shatterParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry?.dispose?.();
        p.mesh.material?.dispose?.();
        this.shatterParticles.splice(i, 1);
        continue;
      }
      p.vy -= 14.5 * dt;
      this._tempVec3.set(p.vx, p.vy, p.vz);
      p.mesh.position.addScaledVector(this._tempVec3, dt);
      if (p.mesh.position.y < 0.04) { p.mesh.position.y = 0.04; p.vy = -p.vy * 0.42; }
      p.mesh.material.opacity = Math.max(0, 1 - p.life / p.maxLife);
    }

    if (this.currentSceneId === 'ancient_battlefield') {
      if (this.battlefieldFlames) {
        this.battlefieldFlames.forEach(f => {
          const sx = 0.92 + Math.sin(elapsed * 9.5 + f.phase) * 0.12;
          const sy = 0.90 + Math.cos(elapsed * 12.0 + f.phase) * 0.18;
          f.outer.scale.set(sx, sy, sx);
          f.inner.scale.set(sy, sx, sy);
          f.group.rotation.y = elapsed * 2.2 + f.phase;
        });
      }
      if (this.battlefieldLights) {
        this.battlefieldLights.forEach(bl => {
          bl.light.intensity = bl.baseIntensity + Math.sin(elapsed * 11.0 + bl.phase) * 0.22;
        });
      }
      if (this.warDrumMallet) {
        this.warDrumMallet.rotation.x = Math.abs(Math.sin(elapsed * 3.6)) * 0.55 - 0.15;
      }
      if (this.warBanners) {
        this.warBanners.forEach(wb => {
          wb.mesh.rotation.y = Math.sin(elapsed * 2.4 + wb.phase) * 0.18;
          wb.mesh.rotation.z = Math.cos(elapsed * 1.9 + wb.phase) * 0.045;
        });
      }
      if (this.battlefieldEmbers) {
        this.battlefieldEmbers.forEach(em => {
          em.sprite.position.y += em.speedY * dt;
          em.sprite.position.x += Math.sin(elapsed * 1.2 + em.phase) * em.speedX * dt;
          em.sprite.position.z += Math.cos(elapsed * 0.9 + em.phase) * 0.35 * dt;
          const flicker = 0.55 + 0.45 * Math.sin(elapsed * 6.5 + em.phase);
          em.sprite.material.opacity = flicker;
          if (em.sprite.position.y > 9.5) {
            em.sprite.position.y = -3.8;
            em.sprite.position.x = (Math.random() - 0.5) * 26;
            em.sprite.position.z = (Math.random() - 0.5) * 26;
          }
        });
      }
    } else if (this.currentSceneId === 'imperial_study') {
      if (this.studyLanterns) {
        this.studyLanterns.forEach(lt => {
          lt.group.position.y = lt.baseY + Math.sin(elapsed * 1.6 + lt.phase) * 0.14;
          lt.group.rotation.y = elapsed * 0.4 + lt.phase;
          lt.light.intensity = 0.52 + Math.sin(elapsed * 4.2 + lt.phase) * 0.10;
        });
      }
      if (this.studyAstrolabe) {
        this.studyAstrolabe.rotation.z = elapsed * 0.12;
      }
      if (this.studyWaterLanterns) {
        this.studyWaterLanterns.forEach(wl => {
          wl.angle += wl.speed * dt;
          wl.group.position.x = Math.cos(wl.angle) * wl.radius;
          wl.group.position.z = Math.sin(wl.angle) * wl.radius;
          wl.group.position.y = -4.28 + Math.sin(elapsed * 2.2 + wl.phase) * 0.03;
          wl.group.rotation.y = elapsed * 0.5 + wl.phase;
        });
      }
      if (this.studySmokeRings) {
        this.studySmokeRings.forEach(sr => {
          const cycle = (elapsed * 0.42 + sr.baseOffset) % 1.4;
          sr.mesh.position.y = 0.58 + cycle;
          sr.mesh.position.x = -6.35 + Math.sin(elapsed * 1.6 + sr.phase) * 0.08 * cycle;
          const sc = 0.75 + cycle * 1.15;
          sr.mesh.scale.set(sc, sc, 1);
          sr.mesh.material.opacity = Math.max(0, (1 - cycle / 1.4) * 0.34);
        });
      }
      if (this.studyClouds) {
        this.studyClouds.forEach(cl => {
          cl.group.position.x = cl.baseX + Math.sin(elapsed * 0.45 + cl.phase) * 0.45;
          cl.group.position.z = cl.baseZ + Math.cos(elapsed * 0.38 + cl.phase) * 0.35;
        });
      }
      if (this.studyStardust) {
        this.studyStardust.forEach(sd => {
          sd.sprite.position.y += sd.speedY * dt;
          sd.sprite.position.x += Math.sin(elapsed * 0.9 + sd.phase) * sd.speedX * dt;
          sd.sprite.material.opacity = 0.42 + 0.38 * Math.sin(elapsed * 4.5 + sd.phase);
          if (sd.sprite.position.y > 9.5) {
            sd.sprite.position.y = -3.2;
          }
        });
      }
    } else {
      this.trees.forEach(t => {
        t.group.rotation.z = Math.sin(elapsed * 1.2 + t.phase) * 0.035;
        t.group.rotation.x = Math.cos(elapsed * 0.9 + t.phase) * 0.025;
      });
      if (this.koiFishList) {
        this.koiFishList.forEach(koi => {
          koi.angle += koi.speed * dt;
          const kx = Math.cos(koi.angle) * koi.radius;
          const kz = Math.sin(koi.angle) * koi.radius;
          koi.group.position.set(kx, -4.25 + Math.sin(elapsed * 2.5 + koi.phase) * 0.03, kz);
          koi.group.rotation.y = -koi.angle + Math.PI;
          if (koi.tail) koi.tail.rotation.y = Math.sin(elapsed * 10.0 + koi.phase) * 0.35;
        });
      }
      if (this.incenseSmokeRings) {
        this.incenseSmokeRings.forEach(sr => {
          const cycle = (elapsed * 0.45 + sr.baseOffset) % 1.4;
          sr.mesh.position.y = 0.68 + cycle;
          sr.mesh.position.x = Math.sin(elapsed * 1.8 + sr.phase) * 0.08 * cycle;
          const sc = 0.8 + cycle * 1.1;
          sr.mesh.scale.set(sc, sc, 1);
          sr.mesh.material.opacity = Math.max(0, (1 - cycle / 1.4) * 0.38);
        });
      }
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
    }

    this.renderer.render(this.scene, this.camera);
  }

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

  renderGroupedCapturedChips(piecesList, chipClass) {
    if (!piecesList || piecesList.length === 0) return '';
    const order = { r: 1, n: 2, c: 3, b: 4, a: 5, p: 6, hidden: 7, k: 0 };
    const grouped = new Map();
    for (const p of piecesList) {
      if (p.isHidden) {
        const key = 'hidden_dark';
        if (!grouped.has(key)) {
          grouped.set(key, { char: '暗', type: 'hidden', isHidden: true, count: 0 });
        }
        grouped.get(key).count++;
      } else {
        const key = p.type || p.char;
        if (!grouped.has(key)) {
          grouped.set(key, { char: p.char, type: p.type, isHidden: false, count: 0 });
        }
        grouped.get(key).count++;
      }
    }
    const sorted = Array.from(grouped.values()).sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
    return sorted.map(item => {
      const badge = item.count > 1 ? `<em class="chip-count-badge">×${item.count}</em>` : '';
      if (item.isHidden) {
        return `<span class="captured-chip ${chipClass} chip-hidden-back serif-cn" title="暗子（背面朝上）"><span class="chip-back-emblem"></span>${badge}</span>`;
      }
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
      const arrow = this.capturedTrayCollapsed ? '▶' : '▼';
      toggleBtn.innerHTML = `<span class="serif-cn">战果</span> <span class="text-red-700">红${this.engine.capturedBlack.length}</span>·<span class="text-slate-900">黑${this.engine.capturedRed.length}</span> ${arrow}`;
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

    if (this.replayMode && this.replayTrialCheckmated) {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-red-600 ring-4 ring-red-600/30 animate-ping';
      turnText.className = 'serif-cn font-bold text-xs text-red-700';
      turnText.textContent = '试招被杀 · 点悔棋继续';
    } else if (this.gameOver && !this.replayMode) {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-600 ring-4 ring-amber-600/20';
      turnText.className = 'serif-cn font-bold text-xs text-amber-900';
      turnText.textContent = this.endgameReasonText || '终局盘面';
    } else if (this.engine.turn === RED) {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-red-600 ring-4 ring-red-600/20';
      turnText.className = 'serif-cn font-bold text-xs text-red-800';
      const isAIOppInReplay = this.replayMode && this.replayBranchActive && this.gameMode !== 'pvp' && this.replayHumanColor === BLACK;
      turnText.textContent = this.replayMode ? (isAIOppInReplay ? '复盘 · 红方AI' : '复盘 · 红方') : '红方行棋';
    } else {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-900 ring-4 ring-slate-900/20';
      turnText.className = 'serif-cn font-bold text-xs text-slate-900';
      const modeLabels = { pvp: '黑方行棋', easy: '简单AI', hard: '困难AI', inferno: '宗师AI' };
      const isAIOppInReplay = this.replayMode && this.replayBranchActive && this.gameMode !== 'pvp' && (this.replayHumanColor || RED) === RED;
      turnText.textContent = this.replayMode ? (isAIOppInReplay ? `复盘 · ${modeLabels[this.gameMode] || 'AI'}` : '复盘 · 黑方') : (modeLabels[this.gameMode] || 'AI');
    }

    if (inCheck && (!this.gameOver || this.replayMode)) {
      checkBadge.classList.remove('hidden');
      checkBadge.classList.add('flex');
    } else {
      checkBadge.classList.add('hidden');
      checkBadge.classList.remove('flex');
    }

    const variantBadgeEl = document.getElementById('variant-mode-badge');
    if (variantBadgeEl) {
      const isJieqi = this.engine.variantMode === 'jieqi';
      variantBadgeEl.textContent = isJieqi ? '揭棋' : '象棋';
      variantBadgeEl.className = isJieqi
        ? 'inline-block cursor-pointer serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600/15 text-amber-900 border border-amber-600/30'
        : 'inline-block cursor-pointer serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-800/10 text-red-900 border border-red-800/20';
    }

    const isOnline = Boolean(this.onlineRole && (this.isOnlineConnected || this.conn?.open));
    ['mode-pvp', 'mode-easy', 'mode-hard', 'mode-inferno'].forEach(id => {
      document.getElementById(id)?.toggleAttribute('disabled', Boolean(this.onlineRole));
    });

    btnDraw?.classList.toggle('hidden', !isOnline);
    btnResign?.classList.toggle('hidden', !isOnline);

    ['btn-endgame-editor', 'btn-vfx-panel', 'btn-standard-new-game'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = Boolean(this.onlineRole);
        el.classList.toggle('opacity-45', Boolean(this.onlineRole));
        el.classList.toggle('cursor-not-allowed', Boolean(this.onlineRole));
        el.title = this.onlineRole ? '联机中不可使用' : '';
      }
    });

    if (btnUndo) {
      if (this.replayMode) {
        btnUndo.disabled = this.isBusy || (this.replayStepIndex || 0) <= 0;
        btnUndo.classList.toggle('ring-2', Boolean(this.replayTrialCheckmated));
        btnUndo.classList.toggle('ring-amber-500', Boolean(this.replayTrialCheckmated));
        btnUndo.classList.toggle('bg-amber-100', Boolean(this.replayTrialCheckmated));
      } else {
        btnUndo.disabled = this.engine.history.length === 0 || this.isBusy || this.gameOver || Boolean(this.pendingUndoRequest);
        btnUndo.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-100');
      }
    }
    if (btnHint) {
      if (this.replayMode) {
        btnHint.disabled = this.isBusy || Boolean(this.replayTrialCheckmated) || Boolean(this.onlineRole);
      } else {
        btnHint.disabled = this.isBusy || this.gameOver || (this.gameMode !== 'pvp' && this.engine.turn !== RED) || Boolean(this.onlineRole);
      }
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

  showCenterCallout(text, color = RED, badgeLabel = '') {
    const container = document.getElementById('center-callout');
    const inner = document.getElementById('center-callout-inner');
    const textEl = document.getElementById('center-callout-text');
    const badgeEl = document.getElementById('center-callout-badge');
    if (!container || !inner) return;

    if (textEl) {
      textEl.textContent = text;
    } else {
      inner.textContent = text;
    }
    if (badgeEl) {
      const autoBadge = badgeLabel || (text.includes('支招') || text.includes('进') || text.includes('平') || text.includes('退') ? '锦囊妙手' : '雅集通告');
      badgeEl.textContent = autoBadge;
    }

    inner.dataset.theme = color === BLACK ? 'black' : 'red';
    container.classList.remove('hidden', 'callout-animate');
    void container.offsetWidth;
    container.classList.add('callout-animate');
    if (this.calloutHideTimer) clearTimeout(this.calloutHideTimer);
    this.calloutHideTimer = setTimeout(() => container.classList.add('hidden'), 1750);
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
      icon.className = 'w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 text-amber-50 flex items-center justify-center serif-cn text-2xl font-black shadow-lg ring-2 ring-amber-300/60 shrink-0';
      subtitle.textContent = `握手言和 · 共 ${rounds} 回合`;
    } else if (winnerColor === RED) {
      icon.textContent = '帥';
      icon.className = 'w-14 h-14 rounded-2xl bg-gradient-to-br from-red-700 to-amber-800 text-amber-50 flex items-center justify-center serif-cn text-2xl font-black shadow-lg ring-2 ring-amber-300/60 shrink-0';
      subtitle.className = 'serif-cn text-xs font-bold text-red-800 mt-0.5';
      subtitle.textContent = `红方（白玉）胜 · 第 ${rounds} 回合终局`;
    } else {
      icon.textContent = '將';
      icon.className = 'w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-950 to-black text-amber-300 flex items-center justify-center serif-cn text-2xl font-black shadow-lg ring-2 ring-amber-400/60 shrink-0';
      subtitle.className = 'serif-cn text-xs font-bold text-slate-900 mt-0.5';
      subtitle.textContent = `黑方（黑曜石）胜 · 第 ${rounds} 回合终局`;
    }

    title.textContent = pattern.title || '绝杀获胜';
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
    this.resetTelemetryUI();
    this.updateTacticalGlowState();
    if (this.replayMode) {
      this.updateReplayPanelUI?.();
    }
    const shouldTriggerAI = !this.replayMode
      ? (this.gameMode !== 'pvp' && this.engine.turn === BLACK && !this.gameOver)
      : (this.replayBranchActive && this.gameMode !== 'pvp' && !this.replayTrialCheckmated && this.engine.turn !== (this.replayHumanColor || RED));
    if (shouldTriggerAI) {
      this.onTurnFinished();
    } else {
      this.updateUI(this.engine.isInCheck(this.engine.turn));
    }
  }

  undoMove(isRemoteApproved = false) {
    if (this.replayMode) {
      this.undoMoveInReplay?.();
      return;
    }
    if (this.isBusy || this.engine.history.length === 0) return;
    if (this.onlineRole && this.conn?.open && !isRemoteApproved) {
      if (this.pendingUndoRequest) return;
      this.pendingUndoRequest = true;
      this.sfx.playSelect();
      try {
        this.conn.send({ type: 'undo_request' });
        this.showCenterCallout('已发送悔棋请求', this.onlineRole);
        this.undoRequestTimeout = setTimeout(() => {
          if (!this.pendingUndoRequest) return;
          this.pendingUndoRequest = false;
          this.showCenterCallout('悔棋请求未获回应', this.onlineRole);
          this.updateUI(this.engine.isInCheck(this.engine.turn));
        }, 15000);
      } catch (_) {
        this.pendingUndoRequest = false;
        this.updateOnlineStatusUI('悔棋发送失败，请检查连接', false);
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
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.clearCheckmateHighlights();
    this.clearCheckmateVFX();
    this.clearAllTransientVFX(false);

    if (!this.onlineRole && this.gameMode !== 'pvp' && this.engine.turn === RED && this.engine.history.length >= 2) {
      this.engine.undoLastMove();
      this.popReplayStep?.();
      this.engine.undoLastMove();
      this.popReplayStep?.();
    } else {
      this.engine.undoLastMove();
      this.popReplayStep?.();
    }
    if (this.engine.history.length === 0) {
      this.resetTelemetryUI();
      this.setLastMoveMarkers(null, null, null, null);
    } else {
      const prevH = this.engine.history[this.engine.history.length - 1];
      if (prevH?.move) {
        this.setLastMoveMarkers(prevH.move.fr, prevH.move.fc, prevH.move.tr, prevH.move.tc);
      }
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

  openVariantSelectModal() {
    if (this.onlineRole && this.conn?.open) {
      this.showCenterCallout('联机中不可切换棋制', this.onlineRole);
      return;
    }
    this.sfx.playSelect();
    this.toggleMoreMenu(false);
    document.getElementById('scene-select-modal')?.classList.add('hidden');
    this.renderVariantModalOptions();
    document.getElementById('variant-select-modal')?.classList.remove('hidden');
  }

  closeVariantSelectModal() {
    document.getElementById('variant-select-modal')?.classList.add('hidden');
  }

  renderVariantModalOptions() {
    const container = document.getElementById('variant-options-list');
    if (!container) return;
    const currentVariant = this.engine.variantMode || this.variantMode || 'xiangqi';
    container.innerHTML = this.variantRegistry.map(v => {
      const isCurrent = v.id === currentVariant && !this.customEndgameSnapshot;
      return `
        <button type="button" onclick="window.gameApp.selectChessVariant('${v.id}')"
          class="md-btn w-full text-left rounded-2xl p-3.5 border-2 transition-all flex items-start gap-3 ${
            isCurrent
              ? 'border-red-700 bg-gradient-to-r from-red-50/95 to-amber-50/95 shadow-md'
              : 'border-amber-200/80 bg-white/90 hover:bg-amber-50/60'
          }">
          <div class="w-10 h-10 rounded-xl ${
            v.id === 'jieqi' ? 'bg-gradient-to-br from-amber-600 to-red-700' : 'bg-gradient-to-br from-red-700 to-slate-950'
          } text-amber-50 flex items-center justify-center shrink-0 shadow-sm serif-cn font-black text-lg">
            ${v.id === 'jieqi' ? '揭' : '象'}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <span class="serif-cn font-black text-sm text-slate-900">${v.name}</span>
                <span class="serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  v.id === 'jieqi' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'
                }">${v.badge}</span>
              </div>
              <span class="serif-cn text-[11px] font-bold ${isCurrent ? 'text-red-700' : 'text-amber-700'}">
                ${isCurrent ? '● 当前 · 开启新局' : '开启 ▶'}
              </span>
            </div>
            <p class="serif-cn text-xs text-slate-600 leading-relaxed mt-1">${v.desc}</p>
          </div>
        </button>
      `;
    }).join('');
  }

  selectChessVariant(variantId) {
    if (this.onlineRole && this.conn?.open) {
      this.showCenterCallout('联机中不可切换棋制', this.onlineRole);
      return;
    }
    const target = this.variantRegistry.find(v => v.id === variantId) || this.variantRegistry[0];
    this.variantMode = target.id;
    this.engine.variantMode = target.id;
    this.closeVariantSelectModal();
    this.customEndgameSnapshot = null;
    this.endgameEditor = false;
    document.getElementById('custom-endgame-panel')?.classList.add('hidden');
    this.restartGame();
    this.showCenterCallout(`开启【${target.name}】新局`, RED, '棋制切换');
  }

  toggleSceneModal(forceState) {
    const modal = document.getElementById('scene-select-modal');
    if (!modal) return;
    const willShow = typeof forceState === 'boolean' ? forceState : modal.classList.contains('hidden');
    if (willShow) {
      this.sfx.playSelect();
      this.toggleMoreMenu(false);
      this.closeVariantSelectModal();
      document.getElementById('online-modal')?.classList.add('hidden');
      this.renderSceneModalOptions();
    }
    modal.classList.toggle('hidden', !willShow);
  }

  renderSceneModalOptions() {
    const container = document.getElementById('scene-options-list');
    if (!container) return;
    container.innerHTML = this.sceneRegistry.map(sc => {
      const isCurrent = sc.id === this.currentSceneId;
      const isBattlefield = sc.id === 'ancient_battlefield';
      const isStudy = sc.id === 'imperial_study';
      const activeBorder = isBattlefield
        ? 'border-red-700 bg-gradient-to-r from-amber-50/95 to-red-50/95 shadow-md'
        : (isStudy
            ? 'border-amber-600 bg-gradient-to-r from-amber-50/95 to-purple-50/95 shadow-md'
            : 'border-emerald-700 bg-gradient-to-r from-emerald-50/95 to-teal-50/95 shadow-md');
      const iconBg = isBattlefield
        ? 'bg-gradient-to-br from-red-700 to-amber-700 text-amber-50'
        : (isStudy
            ? 'bg-gradient-to-br from-amber-600 to-purple-900 text-amber-50'
            : 'bg-gradient-to-br from-emerald-700 to-teal-800 text-emerald-50');
      const badgeCls = isBattlefield
        ? 'bg-red-100 text-red-900'
        : (isStudy ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900');
      const statusCls = isBattlefield ? 'text-red-800' : (isStudy ? 'text-amber-800' : 'text-emerald-800');
      return `
        <button type="button" onclick="window.gameApp.switchScene('${sc.id}')"
          class="md-btn w-full text-left rounded-2xl p-3.5 border-2 transition-all flex items-start gap-3 ${
            isCurrent ? activeBorder : 'border-slate-200 bg-white/90 hover:bg-amber-50/50'
          }">
          <div class="w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 shadow-sm">
            <span class="material-symbols-rounded text-[20px]">${sc.icon || 'park'}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <span class="serif-cn font-black text-sm text-slate-900">${sc.name}</span>
                <span class="serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeCls}">${sc.badge}</span>
              </div>
              <span class="serif-cn text-[11px] font-bold ${statusCls}">${isCurrent ? '✓ 当前' : '切换 ▶'}</span>
            </div>
            <p class="serif-cn text-xs text-slate-600 leading-relaxed mt-1">${sc.desc}</p>
          </div>
        </button>
      `;
    }).join('');
  }

  switchScene(sceneId) {
    const sc = this.sceneRegistry.find(s => s.id === sceneId) || this.sceneRegistry[0];
    this.currentSceneId = sc.id;
    const isPark = sc.id === 'bamboo_park';
    const isBattlefield = sc.id === 'ancient_battlefield';
    const isStudy = sc.id === 'imperial_study';
    this.sfx.playSelect();

    if (this.parkGroup) this.parkGroup.visible = isPark;
    if (this.dappledCanopy) this.dappledCanopy.visible = isPark;
    if (this.breezeParticles) {
      this.breezeParticles.forEach(bp => { bp.mesh.visible = isPark; });
    }
    if (this.battlefieldGroup) this.battlefieldGroup.visible = isBattlefield;
    if (this.battlefieldEmbers) {
      this.battlefieldEmbers.forEach(em => { em.sprite.visible = isBattlefield; });
    }
    if (this.studyGroup) this.studyGroup.visible = isStudy;

    if (this.scene) {
      this.scene.background = new THREE.Color(sc.bgHex);
      if (this.scene.fog) {
        this.scene.fog.color.setHex(sc.bgHex);
        this.scene.fog.density = sc.fogDensity || 0.014;
      }
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.background = isBattlefield ? '#432d22' : (isStudy ? '#0d182e' : '#dbe9dc');
    }
    if (this.sunLight) {
      this.sunLight.color.setHex(sc.sunColor || 0xfff6e5);
      this.sunLight.intensity = sc.sunIntensity || 0.54;
    }
    if (this.hemiLight) {
      this.hemiLight.color.setHex(sc.hemiSky || 0xfef9e7);
      this.hemiLight.groundColor.setHex(sc.hemiGround || 0x5c7a58);
      this.hemiLight.intensity = sc.hemiIntensity || 0.30;
    }

    const badgeEl = document.getElementById('scene-badge');
    if (badgeEl) {
      badgeEl.textContent = sc.name;
      badgeEl.className = !isPark
        ? 'hidden md:inline-block cursor-pointer serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-800/15 text-amber-950 border border-amber-800/25'
        : 'hidden md:inline-block cursor-pointer serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-800/10 text-emerald-900 border border-emerald-800/15';
    }
    const switcherBtn = document.getElementById('btn-scene-switcher');
    if (switcherBtn) {
      switcherBtn.title = `切换场景（当前：${sc.name}）`;
    }

    this.toggleSceneModal(false);
    this.showCenterCallout(`已切换至【${sc.name}】`, RED, '雅集换景');
  }

  restartStandardGame(isRemote = false) {
    if (this.onlineRole && this.conn?.open && !isRemote) {
      this.showCenterCallout('联机中请点「重新对局」发起申请', this.onlineRole);
      return;
    }
    this.openVariantSelectModal();
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
    this.gameOver = false;
    this.endgameReasonText = null;
    this.endgameEditor = false;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.clearCheckmateHighlights();
    this.clearCheckmateVFX();
    this.clearAllTransientVFX(true);
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
    this.gameOver = false;
    this.endgameReasonText = null;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.clearCheckmateHighlights();
    this.clearCheckmateVFX();
    this.clearAllTransientVFX(true);
    this.engine.reset(this.variantMode || 'xiangqi');

    this.initReplaySession?.(this.engine.board, this.engine.turn, 'standard');

    this.resetTelemetryUI();
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
