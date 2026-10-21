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
    this.variantMode = 'xiangqi'; // 'xiangqi' (象棋) | 'jieqi' (揭棋)
    this.variantRegistry = [
      {
        id: 'xiangqi',
        name: '象棋',
        badge: '传统标准局',
        desc: '32子明置标准排阵，循传统中国象棋规则博弈（替代原标准新局）',
        icon: 'chess'
      },
      {
        id: 'jieqi',
        name: '揭棋',
        badge: '暗子新玩法',
        desc: '将帅明置九宫原点，其余各15子暗置随机摆放；暗子按初始位规则行棋并翻开，明相明仕允许过河',
        icon: 'style'
      }
    ];
    this.currentSceneId = 'bamboo_park';
    this.sceneRegistry = [
      {
        id: 'bamboo_park',
        name: '竹林石桌',
        badge: '古典雅集',
        desc: '翠竹掩映、青石棋案、落英微风的古典公园雅集意境',
        icon: 'park',
        bgHex: 0xdce8dc,
        fogDensity: 0.015,
        sunColor: 0xfff5e0,
        sunIntensity: 1.15,
        hemiSky: 0xfef9e7,
        hemiGround: 0x688264,
        hemiIntensity: 0.75
      },
      {
        id: 'ancient_battlefield',
        name: '古风战场',
        badge: '楚汉峥嵘',
        desc: '金戈铁马、玄铁点将台、猎猎帅旗与烽火流萤的楚汉古战场意境',
        icon: 'local_fire_department',
        bgHex: 0x261a16,
        fogDensity: 0.014,
        sunColor: 0xffcfa3,
        sunIntensity: 1.28,
        hemiSky: 0xffb38a,
        hemiGround: 0x3b2318,
        hemiIntensity: 0.72
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

    // 移动端默认收起吃子浮层以绝不遮挡棋盘；桌面端在左右两侧博古架展示，同样绝不遮挡棋盘
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
    this._tempDayColor = new THREE.Color(0xdce8dc);
    this._tempNightColor = new THREE.Color(0x13111c);

    this.initAIWorker();
    this.initThree();
    this.buildParkEnvironment();
    this.buildBattlefieldEnvironment();
    this.buildChessboard3D();
    this.buildInteractionMarkers();
    this.piecesGroup = new THREE.Group();
    this.scene.add(this.piecesGroup);
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
    worker.onerror = (err) => {
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
      console.warn('AI Worker 切换至主线程宗师引擎回退：', err);
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
    const isFileProtocol = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
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
    } catch (err) {
      const blobWorker = this.createBlobAIWorker();
      if (blobWorker) {
        this.aiWorker = blobWorker;
        this.bindAIWorkerEvents(blobWorker);
      } else {
        console.warn('Web Worker fallback active:', err);
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
      telEl.textContent = `${depth} · ${nodesStr}节点 · ${winnerName}必胜 M${matePly}`;
    } else {
      const adv = Math.abs(redScore) < 60 ? '均势' : (redScore > 0 ? `红优 +${Math.round(redScore / 100)}` : `黑优 +${Math.round(-redScore / 100)}`);
      telEl.textContent = depth === '开局库' ? `开局库 · ${adv}` : `深${depth} · ${nodesStr}节点 · ${adv}`;
    }
  }

  /**
   * 修复 2：切换模式（对弈难度模式 / 象棋揭棋模式）或新局重置时，同步重置标题栏预测文本与胜率条
   */
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
      telEl.textContent = `复盘推演 · ${modeLabel}就绪`;
    } else if (this.gameMode === 'pvp' || this.onlineRole) {
      telEl.textContent = `${modeLabel} · 均势`;
    } else if (isJieqi) {
      telEl.textContent = `${modeLabel}就绪 · 均势`;
    } else {
      telEl.textContent = `开局库就绪 · 均势`;
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
    if (this.isBusy || (this.gameOver && !this.replayMode) || this.onlineRole || this.replayTrialCheckmated) return;
    if (!this.replayMode && this.gameMode !== 'pvp' && side !== RED) return;
    if (this.replayMode) {
      this.stopReplayAutoPlay?.();
    }
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
      if (!move || (this.gameOver && !this.replayMode)) {
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

  /**
   * 需求 7：新增场景 —— 古风战场 (Ancient Chu-Han Battlefield 3D Environment)
   * 包含：赤壁焦土大地、八角玄铁青铜点将台、战鼓座墩、四隅青铜篝火鼎（动态烈焰+火光点光源）、
   *       楚汉帅旗战幡（迎风猎猎摆动）、古战场鹿角拒马、画戟兵器架与漫天烽火流萤火星
   */
  buildBattlefieldEnvironment() {
    this.battlefieldGroup = new THREE.Group();
    this.battlefieldGroup.visible = this.currentSceneId === 'ancient_battlefield';
    this.scene.add(this.battlefieldGroup);

    // 1. 苍茫赤壁黄沙古战场大地
    const groundGeo = new THREE.CylinderGeometry(58, 58, 1, 64);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3b271e });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -4.8;
    ground.receiveShadow = true;
    this.battlefieldGroup.add(ground);

    // 外围古战场砂石环带
    const outerRingGeo = new THREE.RingGeometry(11.5, 28.0, 48);
    const outerRingMat = new THREE.MeshLambertMaterial({
      color: 0x2a1b14,
      side: THREE.DoubleSide
    });
    const outerSandRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerSandRing.rotation.x = -Math.PI / 2;
    outerSandRing.position.y = -4.28;
    outerSandRing.receiveShadow = true;
    this.battlefieldGroup.add(outerSandRing);

    const obsidianStoneMat = new THREE.MeshStandardMaterial({
      color: 0x262322,
      roughness: 0.72,
      metalness: 0.25
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.45,
      metalness: 0.65
    });
    const gildedBronzeMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x78350f,
      emissiveIntensity: 0.25,
      roughness: 0.32,
      metalness: 0.88
    });
    const crimsonLacquerMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      roughness: 0.48,
      metalness: 0.22
    });

    // 2. 八角玄铁点将台基座 (Stepped Octagonal Command Dais)
    const daisBase = new THREE.Mesh(new THREE.CylinderGeometry(10.8, 11.6, 0.36, 8), obsidianStoneMat);
    daisBase.position.y = -4.22;
    daisBase.receiveShadow = true;
    this.battlefieldGroup.add(daisBase);

    const daisStep = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.8, 0.28, 8), darkIronMat);
    daisStep.position.y = -3.95;
    daisStep.receiveShadow = true;
    this.battlefieldGroup.add(daisStep);

    const daisBronzeRim = new THREE.Mesh(new THREE.TorusGeometry(9.45, 0.12, 10, 8), gildedBronzeMat);
    daisBronzeRim.rotation.x = Math.PI / 2;
    daisBronzeRim.rotation.z = Math.PI / 8;
    daisBronzeRim.position.y = -3.85;
    this.battlefieldGroup.add(daisBronzeRim);

    // 3. 中央玄铁鎏金帅案与巨型战鼓台座
    const tableSlab = new THREE.Mesh(new THREE.CylinderGeometry(8.05, 7.75, 0.78, 32), darkIronMat);
    tableSlab.position.y = -0.62;
    tableSlab.castShadow = true;
    tableSlab.receiveShadow = true;
    this.battlefieldGroup.add(tableSlab);

    const tableBronzeRim = new THREE.Mesh(new THREE.TorusGeometry(7.88, 0.18, 14, 64), gildedBronzeMat);
    tableBronzeRim.rotation.x = Math.PI / 2;
    tableBronzeRim.position.y = -0.44;
    this.battlefieldGroup.add(tableBronzeRim);

    // 帅案外缘 16 颗青铜虎头铆钉
    const rivetGeo = new THREE.SphereGeometry(0.14, 12, 12);
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      const rivet = new THREE.Mesh(rivetGeo, gildedBronzeMat);
      rivet.position.set(Math.cos(a) * 7.92, -0.62, Math.sin(a) * 7.92);
      this.battlefieldGroup.add(rivet);
    }

    const drumPedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 3.25, 3.5, 24), crimsonLacquerMat);
    drumPedestal.position.y = -2.55;
    drumPedestal.castShadow = true;
    drumPedestal.receiveShadow = true;
    this.battlefieldGroup.add(drumPedestal);

    const drumRingTop = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.11, 10, 36), gildedBronzeMat);
    drumRingTop.rotation.x = Math.PI / 2;
    drumRingTop.position.y = -1.2;
    const drumRingBot = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.11, 10, 36), gildedBronzeMat);
    drumRingBot.rotation.x = Math.PI / 2;
    drumRingBot.position.y = -3.6;
    this.battlefieldGroup.add(drumRingTop, drumRingBot);

    // 4. 四方牛皮朱漆战鼓坐墩
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
      this.battlefieldGroup.add(sg);
    });

    // 5. 四隅青铜烽火篝火鼎 (Flaming Bronze Braziers)
    this.battlefieldFlames = [];
    this.battlefieldLights = [];
    const brazierCoords = [
      { x: -7.6, z: -7.6 },
      { x: 7.6, z: -7.6 },
      { x: -7.6, z: 7.6 },
      { x: 7.6, z: 7.6 }
    ];
    brazierCoords.forEach((bp, idx) => {
      const bg = new THREE.Group();
      bg.position.set(bp.x, 0, bp.z);

      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.58, 0.9, 16), darkIronMat);
      bowl.position.y = -1.75;
      bowl.castShadow = true;
      bg.add(bowl);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.09, 10, 24), gildedBronzeMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = -1.32;
      bg.add(rim);

      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.52, 2.2, 12), obsidianStoneMat);
      pillar.position.y = -3.1;
      bg.add(pillar);

      // 赤红炭火床与动态多层火焰
      const coalBed = new THREE.Mesh(
        new THREE.CircleGeometry(0.92, 20),
        new THREE.MeshBasicMaterial({ color: 0xea580c })
      );
      coalBed.rotation.x = -Math.PI / 2;
      coalBed.position.y = -1.31;
      bg.add(coalBed);

      const flameGroup = new THREE.Group();
      flameGroup.position.y = -1.28;
      const outerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.72, 1.85, 10),
        new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      outerFlame.position.y = 0.85;
      const innerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 1.35, 10),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      innerFlame.position.y = 0.62;
      flameGroup.add(outerFlame, innerFlame);
      bg.add(flameGroup);

      const fireLight = new THREE.PointLight(0xff7b24, 1.25, 16, 1.6);
      fireLight.position.set(0, -0.2, 0);
      bg.add(fireLight);

      this.battlefieldGroup.add(bg);
      this.battlefieldFlames.push({ group: flameGroup, outer: outerFlame, inner: innerFlame, phase: idx * 1.7 });
      this.battlefieldLights.push({ light: fireLight, baseIntensity: 1.25, phase: idx * 2.1 });
    });

    // 6. 楚汉古战场猎猎帅旗与长戈战戟
    this.warBanners = [];
    const bannerConfigs = [
      { x: -13.2, z: -10.8, isRed: false, scale: 1.15 },
      { x: 13.2, z: -10.8, isRed: false, scale: 1.15 },
      { x: -13.2, z: 10.8, isRed: true, scale: 1.15 },
      { x: 13.2, z: 10.8, isRed: true, scale: 1.15 },
      { x: -16.5, z: -2.2, isRed: false, scale: 1.0 },
      { x: 16.5, z: 2.2, isRed: true, scale: 1.0 }
    ];
    bannerConfigs.forEach((cfg, idx) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(cfg.x, 0, cfg.z);
      bGroup.scale.setScalar(cfg.scale);

      // 旗杆与矛尖
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

      // 战旗布面
      const clothGeo = new THREE.PlaneGeometry(2.3, 4.4, 8, 8);
      const clothMat = new THREE.MeshStandardMaterial({
        color: cfg.isRed ? 0x991b1b : 0x1e293b,
        emissive: cfg.isRed ? 0x450a0a : 0x0f172a,
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

    // 7. 战场外围鹿角拒马与古烽火台剪影
    const barricadeCoords = [
      { x: -11.5, z: -15.5, ry: 0.35 },
      { x: 11.5, z: -15.5, ry: -0.35 },
      { x: -15.8, z: 5.5, ry: 1.1 },
      { x: 15.8, z: -5.5, ry: -1.1 }
    ];
    const woodBeamMat = new THREE.MeshLambertMaterial({ color: 0x452c1e });
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

    // 8. 漫天烽火流萤火星粒子 (Battlefield Floating Embers)
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

    const selTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('selected') : null;
    const selMat = new THREE.MeshBasicMaterial({
      map: selTex,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.selectedRing = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.36), selMat);
    this.selectedRing.rotation.x = -Math.PI / 2;
    this.selectedRing.position.y = 0.022;
    this.selectedRing.visible = false;
    this.scene.add(this.selectedRing);

    const fromTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('last_from') : null;
    const fromMat = new THREE.MeshBasicMaterial({
      map: fromTex,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.lastFromRing = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.06), fromMat);
    this.lastFromRing.rotation.x = -Math.PI / 2;
    this.lastFromRing.position.y = 0.015;
    this.lastFromRing.visible = false;

    const toTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('last_to') : null;
    const toMat = new THREE.MeshBasicMaterial({
      map: toTex,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.lastToRing = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 1.32), toMat);
    this.lastToRing.rotation.x = -Math.PI / 2;
    this.lastToRing.position.y = 0.016;
    this.lastToRing.visible = false;
    this.scene.add(this.lastFromRing, this.lastToRing);

    this.moveIndicators = [];
  }

  /**
   * 需求 1（美化所有光效）：预构建并缓存棋子共享几何体与高精莲华/丝绸气旋光晕材质
   */
  ensureSharedPieceAssets() {
    if (this.sharedPieceAssets) return this.sharedPieceAssets;
    const height = 0.34;
    const radius = 0.44;
    const dangerTex = getTacticalAuraTextures('danger');
    const safeTex = getTacticalAuraTextures('safe');

    const createTacticalMatSet = (auraTex) => ({
      haloMat: new THREE.MeshBasicMaterial({
        map: auraTex.radialMap,
        transparent: true,
        opacity: 0.90,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      outerRingMat: new THREE.MeshBasicMaterial({
        map: auraTex.coronaMap,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      cylShellMat: new THREE.MeshBasicMaterial({
        map: auraTex.cylinderMap,
        transparent: true,
        opacity: 0.74,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      topCoronaMat: new THREE.MeshBasicMaterial({
        map: auraTex.coronaMap,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    });

    this.sharedPieceAssets = {
      height,
      radius,
      cylGeo: new THREE.CylinderGeometry(radius * 0.94, radius, height, 36),
      rimGeo: new THREE.TorusGeometry(radius * 0.92, 0.028, 12, 36),
      topDiscGeo: new THREE.CircleGeometry(radius * 0.91, 36),
      auraRingGeo: new THREE.PlaneGeometry(1.24, 1.24),
      haloPlaneGeo: new THREE.PlaneGeometry(1.42, 1.42),
      outerRingGeo: new THREE.PlaneGeometry(1.28, 1.28),
      cylShellGeo: new THREE.CylinderGeometry(radius * 1.12, radius * 1.03, height * 1.32, 36, 1, true),
      topCoronaGeo: new THREE.PlaneGeometry(1.02, 1.02),
      redRimMat: new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 }),
      blackRimMat: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 }),
      turnRedTex: typeof getTurnAuraTexture === 'function' ? getTurnAuraTexture('red') : null,
      turnBlackTex: typeof getTurnAuraTexture === 'function' ? getTurnAuraTexture('black') : null,
      turnSelTex: typeof getTurnAuraTexture === 'function' ? getTurnAuraTexture('selected') : null,
      tacticalMats: {
        danger: createTacticalMatSet(dangerTex),
        safe: createTacticalMatSet(safeTex)
      }
    };
    return this.sharedPieceAssets;
  }

  /**
   * 需求 1（美化所有落点）：预构建并缓存 3D 翠玉灵珠 / 朱砂警珠 / 四方金戈锁敌阵的共享几何体与材质
   */
  ensureSharedIndicatorAssets() {
    if (this.sharedIndicatorAssets) return this.sharedIndicatorAssets;
    const dangerAura = getTacticalAuraTextures('danger');
    const safeAura = getTacticalAuraTextures('safe');
    const dotSafeTex = getMoveIndicatorTexture('dot_safe');
    const dotUnsafeTex = getMoveIndicatorTexture('dot_unsafe');
    const capSafeTex = getMoveIndicatorTexture('capture_safe');
    const capUnsafeTex = getMoveIndicatorTexture('capture_unsafe');

    this.sharedIndicatorAssets = {
      captureBaseGeo: new THREE.PlaneGeometry(1.38, 1.38),
      captureCrownGeo: new THREE.PlaneGeometry(1.06, 1.06),
      softGlowGeo: new THREE.PlaneGeometry(0.92, 0.92),
      lotusDotGeo: new THREE.PlaneGeometry(0.76, 0.76),
      gemOrbGeo: new THREE.SphereGeometry(0.105, 24, 16),
      hitGeo: new THREE.CylinderGeometry(0.62, 0.62, 0.55, 16),
      captureSafeMat: new THREE.MeshBasicMaterial({
        map: capSafeTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      captureUnsafeMat: new THREE.MeshBasicMaterial({
        map: capUnsafeTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      glowSafeMat: new THREE.MeshBasicMaterial({
        map: safeAura.radialMap,
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      glowUnsafeMat: new THREE.MeshBasicMaterial({
        map: dangerAura.radialMap,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      dotSafeMat: new THREE.MeshBasicMaterial({
        map: dotSafeTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96,
        depthWrite: false
      }),
      dotUnsafeMat: new THREE.MeshBasicMaterial({
        map: dotUnsafeTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96,
        depthWrite: false
      }),
      orbSafeMat: new THREE.MeshStandardMaterial({
        color: 0x6ee7b7,
        emissive: 0x10b981,
        emissiveIntensity: 0.75,
        roughness: 0.15,
        metalness: 0.25,
        transparent: true,
        opacity: 0.95
      }),
      orbUnsafeMat: new THREE.MeshStandardMaterial({
        color: 0xfca5a5,
        emissive: 0xef4444,
        emissiveIntensity: 0.82,
        roughness: 0.15,
        metalness: 0.25,
        transparent: true,
        opacity: 0.95
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
      ? new THREE.MeshPhysicalMaterial({ color: 0xfaf3e3, roughness: 0.22, metalness: 0.03, clearcoat: 0.65 })
      : new THREE.MeshPhysicalMaterial({ color: 0x131924, roughness: 0.08, metalness: 0.22, clearcoat: 1.0 });

    const cylMesh = new THREE.Mesh(assets.cylGeo, bodyMat);
    cylMesh.position.y = height / 2;
    cylMesh.castShadow = true;
    group.add(cylMesh);

    const rimMat = isRed ? assets.redRimMat : assets.blackRimMat;
    const rimMesh = new THREE.Mesh(assets.rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = height - 0.01;
    group.add(rimMesh);

    const topMat = typeof getPieceTopMaterial === 'function'
      ? getPieceTopMaterial(pieceData.color, pieceData.char, isHidden)
      : new THREE.MeshStandardMaterial({ ...getPieceMedallionTextures(pieceData.color, pieceData.char, isHidden), bumpScale: 0.028 });
    const topDisc = new THREE.Mesh(assets.topDiscGeo, topMat);
    topDisc.rotation.x = -Math.PI / 2;
    const flipForBlack = (this.onlineRole === BLACK) || (!this.onlineRole && this.gameMode === 'pvp' && pieceData.color === BLACK);
    topDisc.rotation.z = flipForBlack ? Math.PI : 0;
    topDisc.position.y = height + 0.002;
    group.add(topDisc);

    const auraMat = new THREE.MeshBasicMaterial({
      map: isRed ? assets.turnRedTex : assets.turnBlackTex,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const auraRing = new THREE.Mesh(assets.auraRingGeo, auraMat);
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.01;
    auraRing.visible = false;
    group.add(auraRing);

    // 新增 2 & 3：棋子立体光晕组件（己方危险冒红光 / 对面可被安全吃掉冒绿光），使用预编译共享材质
    const tacticalGlowGroup = new THREE.Group();
    tacticalGlowGroup.visible = false;
    const dangerSet = assets.tacticalMats.danger;

    const haloMesh = new THREE.Mesh(assets.haloPlaneGeo, dangerSet.haloMat);
    haloMesh.rotation.x = -Math.PI / 2;
    haloMesh.position.y = 0.014;
    tacticalGlowGroup.add(haloMesh);

    const outerRingMesh = new THREE.Mesh(assets.outerRingGeo, dangerSet.outerRingMat);
    outerRingMesh.rotation.x = -Math.PI / 2;
    outerRingMesh.position.y = 0.022;
    tacticalGlowGroup.add(outerRingMesh);

    const cylShellMesh = new THREE.Mesh(assets.cylShellGeo, dangerSet.cylShellMat);
    cylShellMesh.position.y = height * 0.62;
    tacticalGlowGroup.add(cylShellMesh);

    const topCoronaRing = new THREE.Mesh(assets.topCoronaGeo, dangerSet.topCoronaMat);
    topCoronaRing.rotation.x = -Math.PI / 2;
    topCoronaRing.position.y = height + 0.008;
    tacticalGlowGroup.add(topCoronaRing);

    group.add(tacticalGlowGroup);

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
      auraRing,
      auraMat,
      topDisc,
      bodyMat,
      rimMat,
      tacticalGlowGroup,
      haloMesh,
      outerRingMesh,
      cylShellMesh,
      topCoronaRing,
      haloMat: dangerSet.haloMat,
      outerRingMat: dangerSet.outerRingMat,
      cylShellMat: dangerSet.cylShellMat,
      topCoronaMat: dangerSet.topCoronaMat,
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

  /**
   * 实时计算并更新：
   *   - 新增 2：己方有危险的棋子冒红光 (danger)
   *   - 新增 3：己方能吃的对面棋子且吃过去不会被吃时，对面棋子冒绿光 (safe_capture)
   */
  updateTacticalGlowState() {
    if (!this.engine || !this.pieceMeshes) return;
    const hideAll = this.endgameEditor || (this.gameOver && !this.replayMode) || this.replayTrialCheckmated;
    if (hideAll) {
      this.threatenedFriendlyIds = new Set();
      this.safeCapturableEnemyIds = new Set();
      for (const mesh of this.pieceMeshes.values()) {
        if (!mesh.userData) continue;
        mesh.userData.tacticalState = null;
        if (mesh.userData.tacticalGlowGroup) mesh.userData.tacticalGlowGroup.visible = false;
        if (mesh.userData.bodyMat) {
          mesh.userData.bodyMat.emissive.setHex(0x000000);
          mesh.userData.bodyMat.emissiveIntensity = 0.0;
        }
      }
      return;
    }

    const friendlyColor = this.onlineRole
      ? this.onlineRole
      : (this.replayMode
          ? (this.replayBranchActive && this.gameMode !== 'pvp' ? (this.replayHumanColor || RED) : this.engine.turn)
          : (this.gameMode !== 'pvp' ? RED : this.engine.turn));

    this.threatenedFriendlyIds = this.engine.getThreatenedFriendlyPieceIds(friendlyColor, this.engine.board);
    this.safeCapturableEnemyIds = this.engine.getSafeCapturableEnemyPieceIds(friendlyColor, this.selectedSquare, this.engine.board);

    const assets = this.ensureSharedPieceAssets();
    const dangerSet = assets.tacticalMats.danger;
    const safeSet = assets.tacticalMats.safe;

    for (const mesh of this.pieceMeshes.values()) {
      const ud = mesh.userData;
      if (!ud || !ud.tacticalGlowGroup) continue;
      const pid = ud.pieceId;
      const isFriendly = ud.color === friendlyColor;

      let nextState = null;
      if (isFriendly && this.threatenedFriendlyIds.has(pid)) {
        nextState = 'danger';
      } else if (!isFriendly && this.safeCapturableEnemyIds.has(pid)) {
        nextState = 'safe_capture';
      }

      if (nextState === 'danger') {
        if (ud.tacticalState !== 'danger') {
          ud.tacticalState = 'danger';
          ud.haloMesh.material = dangerSet.haloMat;
          ud.outerRingMesh.material = dangerSet.outerRingMat;
          ud.cylShellMesh.material = dangerSet.cylShellMat;
          ud.topCoronaRing.material = dangerSet.topCoronaMat;
          ud.haloMat = dangerSet.haloMat;
          ud.outerRingMat = dangerSet.outerRingMat;
          ud.cylShellMat = dangerSet.cylShellMat;
          ud.topCoronaMat = dangerSet.topCoronaMat;
          ud.bodyMat.emissive.setHex(0x991b1b);
          ud.bodyMat.emissiveIntensity = 0.25;
        }
        ud.tacticalGlowGroup.visible = true;
      } else if (nextState === 'safe_capture') {
        if (ud.tacticalState !== 'safe_capture') {
          ud.tacticalState = 'safe_capture';
          ud.haloMesh.material = safeSet.haloMat;
          ud.outerRingMesh.material = safeSet.outerRingMat;
          ud.cylShellMesh.material = safeSet.cylShellMat;
          ud.topCoronaRing.material = safeSet.topCoronaMat;
          ud.haloMat = safeSet.haloMat;
          ud.outerRingMat = safeSet.outerRingMat;
          ud.cylShellMat = safeSet.cylShellMat;
          ud.topCoronaMat = safeSet.topCoronaMat;
          ud.bodyMat.emissive.setHex(0x065f46);
          ud.bodyMat.emissiveIntensity = 0.28;
        }
        ud.tacticalGlowGroup.visible = true;
      } else {
        if (ud.tacticalState !== null) {
          ud.tacticalState = null;
          ud.bodyMat.emissive.setHex(0x000000);
          ud.bodyMat.emissiveIntensity = 0.0;
        }
        ud.tacticalGlowGroup.visible = false;
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
      const warnTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('warning') : null;
      const selTex = typeof getBoardMarkerTexture === 'function' ? getBoardMarkerTexture('selected') : null;
      diagnosis.highlightSquares.forEach((sq, idx) => {
        if (!sq || typeof sq.r !== 'number' || typeof sq.c !== 'number') return;
        const pos = gridToWorld(sq.r, sq.c);
        const tex = idx === 0 ? warnTex : selTex;
        const ring = new THREE.Mesh(
          tex ? new THREE.PlaneGeometry(1.36, 1.36) : new THREE.RingGeometry(0.42, 0.56, 32),
          new THREE.MeshBasicMaterial({
            map: tex || null,
            color: tex ? 0xffffff : (idx === 0 ? 0xef4444 : 0xf59e0b),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
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

    const indAssets = this.ensureSharedIndicatorAssets();

    for (const m of moves) {
      const pos = gridToWorld(m.tr, m.tc);
      const isCapture = Boolean(m.capture);
      // 检测己方棋子下到该落点后是否会被敌方吃掉
      const isUnsafe = this.engine.wouldPieceBeCapturedAfterMove(m, this.engine.board);
      const holder = new THREE.Group();
      holder.position.set(pos.x, 0.024, pos.z);
      holder.userData = { isCapture, isUnsafe, phase: (m.tr * 0.65 + m.tc * 0.45) };

      if (isCapture) {
        const baseLock = new THREE.Mesh(
          indAssets.captureBaseGeo,
          isUnsafe ? indAssets.captureUnsafeMat : indAssets.captureSafeMat
        );
        baseLock.rotation.x = -Math.PI / 2;
        baseLock.position.y = 0.012;
        holder.add(baseLock);

        const crownLock = new THREE.Mesh(
          indAssets.captureCrownGeo,
          isUnsafe ? indAssets.captureUnsafeMat : indAssets.captureSafeMat
        );
        crownLock.rotation.x = -Math.PI / 2;
        crownLock.position.y = 0.345;
        holder.add(crownLock);

        holder.userData.baseLock = baseLock;
        holder.userData.crownLock = crownLock;
      } else {
        const softGlow = new THREE.Mesh(
          indAssets.softGlowGeo,
          isUnsafe ? indAssets.glowUnsafeMat : indAssets.glowSafeMat
        );
        softGlow.rotation.x = -Math.PI / 2;
        softGlow.position.y = -0.006;
        holder.add(softGlow);

        const lotusDisc = new THREE.Mesh(
          indAssets.lotusDotGeo,
          isUnsafe ? indAssets.dotUnsafeMat : indAssets.dotSafeMat
        );
        lotusDisc.rotation.x = -Math.PI / 2;
        lotusDisc.position.y = 0.002;
        holder.add(lotusDisc);

        const gemOrb = new THREE.Mesh(
          indAssets.gemOrbGeo,
          isUnsafe ? indAssets.orbUnsafeMat : indAssets.orbSafeMat
        );
        gemOrb.scale.set(1, 0.44, 1);
        gemOrb.position.y = 0.026;
        holder.add(gemOrb);

        holder.userData.lotusDisc = lotusDisc;
        holder.userData.gemOrb = gemOrb;
      }

      const hitMesh = new THREE.Mesh(indAssets.hitGeo, indAssets.hitMat);
      hitMesh.position.y = 0.2;
      hitMesh.userData = { isMoveTarget: true, move: m };
      holder.add(hitMesh);

      this.markersGroup.add(holder);
      this.moveIndicators.push(holder);
    }
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
    const wasFlipped = Boolean(moveRes.flipped);

    this.recordReplayStep?.(move, notation, moverColor, moveRes.actionTag);

    if (!isRemote && this.conn?.open) {
      this.conn.send({
        type: 'move',
        move: { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc },
        revealedType: wasFlipped ? movingPiece.type : null
      });
    }

    this.lastFromRing.position.set(startPos.x, 0.015, startPos.z);
    this.lastFromRing.visible = true;
    this.lastToRing.position.set(endPos.x, 0.015, endPos.z);
    this.lastToRing.visible = true;

    let midFlipApplied = false;
    this.activeAnimations.push({
      mesh: movingMesh,
      elapsed: 0,
      duration: isCapture ? 0.5 : (wasFlipped ? 0.44 : 0.34),
      update: (t) => {
        if (!movingMesh) return;
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        movingMesh.position.x = THREE.MathUtils.lerp(startPos.x, endPos.x, ease);
        movingMesh.position.z = THREE.MathUtils.lerp(startPos.z, endPos.z, ease);
        movingMesh.position.y = Math.sin(ease * Math.PI) * (wasFlipped ? 1.05 : 0.8);
        if (wasFlipped) {
          movingMesh.rotation.x = ease * Math.PI * 2;
          if (t >= 0.48 && !midFlipApplied) {
            midFlipApplied = true;
            movingMesh.userData.isHidden = false;
            movingMesh.userData.type = movingPiece.type;
            movingMesh.userData.char = movingPiece.char;
            if (movingMesh.userData.topDisc && typeof getPieceTopMaterial === 'function') {
              movingMesh.userData.topDisc.material = getPieceTopMaterial(movingPiece.color, movingPiece.char, false);
            }
          }
        }
      },
      complete: () => {
        if (movingMesh) {
          movingMesh.position.set(endPos.x, 0, endPos.z);
          movingMesh.rotation.set(0, 0, 0);
          movingMesh.userData.r = move.tr;
          movingMesh.userData.c = move.tc;
          movingMesh.userData.isHidden = Boolean(movingPiece.isHidden);
          movingMesh.userData.type = movingPiece.type;
          movingMesh.userData.char = movingPiece.char;
          if (wasFlipped && !midFlipApplied && movingMesh.userData.topDisc && typeof getPieceTopMaterial === 'function') {
            movingMesh.userData.topDisc.material = getPieceTopMaterial(movingPiece.color, movingPiece.char, false);
          }
        }
        if (isCapture && targetMesh) {
          if (this.piecesGroup) this.piecesGroup.remove(targetMesh);
          this.scene.remove(targetMesh);
          this.pieceMeshes.delete(targetPiece.id);
          this.spawnShatterFragments(endPos.x, endPos.z, targetPiece.color);
          this.sfx.playAttackShatter();
        } else {
          this.spawnMoveImpactWave?.(endPos.x, endPos.z, false);
          this.sfx.playMove(movingPiece.color, movingPiece.type);
        }
        this.updateTacticalGlowState();
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
    const hasMoves = this.engine.hasAnyLegalMove(currentTurn);

    this.updateUI(inCheck);

    if (!hasMoves) {
      const winner = currentTurn === RED ? BLACK : RED;
      const pattern = CheckmateClassifier.classify(this.engine, currentTurn);

      // 新增 1：复盘尝试另一种思路时若被绝杀，不会结束对局，播放绝杀动画并提示用户悔棋以继续复盘
      if (this.replayMode) {
        this.replayTrialCheckmated = true;
        this.isBusy = false;
        this.hideCycleWarningBanner();
        this.updateReplayPanelUI?.();
        this.updateTacticalGlowState();
        this.updateUI(inCheck);
        this.showCheckmateHighlights(pattern.highlightCoords);
        this.triggerCheckmateVFX(pattern, winner);
        this.showCenterCallout(`${pattern.title} · 请悔棋继续复盘`, winner);
        this.showIllegalMovePrompt({
          icon: 'undo',
          title: `复盘试招绝杀 · ${pattern.title}`,
          message: '当前尝试分支已被绝杀（不结束对局）。请点击下方「悔棋」按钮退回重选其他思路继续复盘！'
        }, 6500);
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
      this.showCenterCallout(pattern.title, winner);
      setTimeout(() => { if (this.gameOver) this.showGameOverModal(winner, pattern); }, 2100);
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
          this.showCenterCallout(`${cycleStatus.verdictShort} · 请悔棋继续复盘`, RED);
          this.showIllegalMovePrompt({
            icon: 'undo',
            title: `复盘试招裁决 · ${cycleStatus.verdictShort}`,
            message: `${cycleStatus.ruleExplanation} 请点击下方「悔棋」按钮退回继续复盘！`
          }, 6000);
          return;
        }
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

    const shouldAITakeTurn = !this.replayMode
      ? (this.gameMode !== 'pvp' && currentTurn === BLACK && !this.gameOver)
      : (this.replayBranchActive && this.gameMode !== 'pvp' && !this.replayTrialCheckmated && currentTurn !== (this.replayHumanColor || RED));

    if (shouldAITakeTurn) {
      this.isBusy = true;
      const aiBadge = document.getElementById('ai-thinking');
      const aiLabel = document.getElementById('ai-thinking-label');
      aiBadge?.classList.remove('hidden');
      aiBadge?.classList.add('inline-flex');
      if (aiLabel) aiLabel.textContent = this.gameMode === 'inferno' ? '宗师推演中...' : 'AI 思考中...';

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
    // 移动端点击棋盘时若吃子浮层展开，自动收起以保持视野清爽无遮挡
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
          title: '当前复盘分支已绝杀',
          message: '请点击底部「悔棋」按钮退回上一步，即可继续尝试其他走法思路！'
        }, 3200);
        return;
      }
    }
    if (!this.endgameEditor && !this.replayMode && this.gameMode !== 'pvp' && this.engine.turn === BLACK) return;
    if (!this.endgameEditor && this.onlineRole && this.engine.turn !== this.onlineRole) return;

    if (this.checkmateVFXGroup && this.checkmateVFXGroup.children.length > 0) {
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

    if (this.sharedPieceAssets?.tacticalMats) {
      const globalPulse = 0.5 + 0.5 * Math.sin(elapsed * 4.2);
      const { danger, safe } = this.sharedPieceAssets.tacticalMats;
      danger.haloMat.opacity = 0.52 + globalPulse * 0.38;
      danger.outerRingMat.opacity = 0.65 + globalPulse * 0.32;
      danger.cylShellMat.opacity = 0.42 + globalPulse * 0.36;
      danger.topCoronaMat.opacity = 0.40 + globalPulse * 0.38;

      safe.haloMat.opacity = 0.52 + globalPulse * 0.38;
      safe.outerRingMat.opacity = 0.65 + globalPulse * 0.32;
      safe.cylShellMat.opacity = 0.42 + globalPulse * 0.36;
      safe.topCoronaMat.opacity = 0.40 + globalPulse * 0.38;
    }

    for (const mesh of this.pieceMeshes.values()) {
      if (this.activeAnimations.some(a => a.mesh === mesh)) continue;
      const ud = mesh.userData;
      const { r, c, color, auraMat, auraRing } = ud;
      const isSelected = this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c;
      const isTurnSide = color === this.engine.turn && (!this.gameOver || this.replayMode) && !this.replayTrialCheckmated;

      let targetAuraOpacity = 0.0;
      if (isSelected) {
        mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0.32 + Math.sin(elapsed * 5.0) * 0.07, 0.18);
        targetAuraOpacity = 0.85 + Math.sin(elapsed * 5.0) * 0.15;
        if (this.sharedPieceAssets?.turnSelTex && auraMat.map !== this.sharedPieceAssets.turnSelTex) {
          auraMat.map = this.sharedPieceAssets.turnSelTex;
          auraMat.needsUpdate = true;
        }
      } else {
        if (Math.abs(mesh.position.y) > 0.001) mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0, 0.22);
        const normalTex = color === RED ? this.sharedPieceAssets?.turnRedTex : this.sharedPieceAssets?.turnBlackTex;
        if (normalTex && auraMat.map !== normalTex) {
          auraMat.map = normalTex;
          auraMat.needsUpdate = true;
        }
        if (isTurnSide && !ud.tacticalState) {
          targetAuraOpacity = 0.24 + Math.sin(elapsed * 2.8 + r * 0.5 + c * 0.3) * 0.12;
        }
      }
      auraMat.opacity = targetAuraOpacity;
      if (auraRing) {
        auraRing.visible = targetAuraOpacity > 0.005;
        if (auraRing.visible) {
          auraRing.rotation.z = elapsed * (isSelected ? 1.15 : 0.45);
        }
      }

      if (ud.tacticalState && ud.tacticalGlowGroup && ud.tacticalGlowGroup.visible) {
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.2 + (r * 0.7 + c * 0.5));
        const haloScale = 0.94 + pulse * 0.12;
        ud.haloMesh.scale.set(haloScale, haloScale, 1);
        ud.haloMesh.rotation.z = elapsed * (ud.tacticalState === 'danger' ? -0.65 : 0.65);
        ud.outerRingMesh.rotation.z = elapsed * (ud.tacticalState === 'danger' ? 1.25 : -1.25);
        ud.topCoronaRing.rotation.z = elapsed * (ud.tacticalState === 'danger' ? -1.6 : 1.6);
        ud.cylShellMesh.rotation.y = elapsed * (ud.tacticalState === 'danger' ? -1.35 : 1.35);
        if (ud.bodyMat) {
          ud.bodyMat.emissiveIntensity = 0.20 + pulse * 0.24;
        }
      }
    }

    if (this.selectedRing.visible) {
      const s = 1 + Math.sin(elapsed * 4.8) * 0.065;
      this.selectedRing.scale.set(s, s, 1);
      this.selectedRing.rotation.z = elapsed * 0.85;
    }
    if (this.lastFromRing?.visible) {
      this.lastFromRing.rotation.z = -elapsed * 0.45;
    }
    if (this.lastToRing?.visible) {
      const s = 0.97 + Math.sin(elapsed * 3.6) * 0.05;
      this.lastToRing.scale.set(s, s, 1);
      this.lastToRing.rotation.z = elapsed * 0.55;
    }

    for (const ind of this.moveIndicators) {
      const u = ind.userData;
      const ph = u.phase || 0;
      if (u.isCapture) {
        const s = 0.96 + Math.sin(elapsed * 5.5 + ph) * 0.085;
        ind.scale.set(s, 1, s);
        if (u.baseLock) u.baseLock.rotation.z = elapsed * 1.1 + ph;
        if (u.crownLock) u.crownLock.rotation.z = -elapsed * 1.65 - ph;
      } else {
        const s = 0.95 + Math.sin(elapsed * 4.6 + ph) * 0.08;
        ind.scale.set(s, 1, s);
        if (u.lotusDisc) u.lotusDisc.rotation.z = elapsed * 0.75 + ph;
        if (u.gemOrb) {
          u.gemOrb.position.y = 0.028 + Math.sin(elapsed * 4.6 + ph) * 0.012;
        }
      }
    }

    if (this.impactWaves && this.impactWaves.length > 0) {
      for (let i = this.impactWaves.length - 1; i >= 0; i--) {
        const w = this.impactWaves[i];
        w.age += dt;
        const p = Math.min(1, w.age / w.maxAge);
        const sc = 0.65 + (1 - Math.pow(1 - p, 2)) * (w.maxScale - 0.65);
        w.mesh.scale.set(sc, sc, 1);
        w.mesh.material.opacity = (1 - p) * 0.85;
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
        const s = 0.92 + Math.sin(item.age * 12) * 0.08;
        item.mesh.scale.set(s, s, 1);
        item.mesh.rotation.z += dt * 1.5;
        item.mesh.material.opacity = (1 - p) * 0.92;
        if (p >= 1) {
          this.scene.remove(item.mesh);
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
      const progress = 1 - (this.vfxAtmosphereTimer / (this.vfxAtmosphereDuration || 3.8));
      let eclipseFactor = 0;
      if (progress < 0.12) eclipseFactor = progress / 0.12;
      else if (progress < 0.72) eclipseFactor = 1;
      else eclipseFactor = 1 - (progress - 0.72) / 0.28;
      const sc = this.getActiveSceneConfig();
      this._tempDayColor.setHex(sc.bgHex || 0xdce8dc);
      this._tempDayColor.lerp(this._tempNightColor, Math.max(0, Math.min(1, eclipseFactor)) * 0.86);
      this.scene.background.copy(this._tempDayColor);
      if (this.scene.fog) this.scene.fog.color.copy(this._tempDayColor);
      if (this.sunLight) this.sunLight.intensity = THREE.MathUtils.lerp(sc.sunIntensity || 1.15, 0.22, eclipseFactor);
      if (this.hemiLight) this.hemiLight.intensity = THREE.MathUtils.lerp(sc.hemiIntensity || 0.75, 0.18, eclipseFactor);
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
          bl.light.intensity = bl.baseIntensity + Math.sin(elapsed * 11.0 + bl.phase) * 0.28;
        });
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
    } else {
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
    }

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
        return `<span class="captured-chip ${chipClass} chip-hidden-back serif-cn" title="被吃暗子（背面朝上放置，不可翻看）"><span class="chip-back-emblem"></span>${badge}</span>`;
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

    if (this.replayMode && this.replayTrialCheckmated) {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-red-600 ring-4 ring-red-600/30 animate-ping';
      turnText.className = 'serif-cn font-bold text-xs text-red-700';
      turnText.textContent = '试招被绝杀 · 请点悔棋继续';
    } else if (this.gameOver && !this.replayMode) {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-600 ring-4 ring-amber-600/20';
      turnText.className = 'serif-cn font-bold text-xs text-amber-900';
      turnText.textContent = this.endgameReasonText || '终局棋盘展示';
    } else if (this.engine.turn === RED) {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-red-600 ring-4 ring-red-600/20';
      turnText.className = 'serif-cn font-bold text-xs text-red-800';
      const isAIOppInReplay = this.replayMode && this.replayBranchActive && this.gameMode !== 'pvp' && this.replayHumanColor === BLACK;
      turnText.textContent = this.replayMode ? (isAIOppInReplay ? '复盘：红方AI' : '复盘：红方走棋') : '红方走棋';
    } else {
      turnDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-900 ring-4 ring-slate-900/20';
      turnText.className = 'serif-cn font-bold text-xs text-slate-900';
      const modeLabels = { pvp: '黑方走棋', easy: '简单AI', hard: '困难AI', inferno: '宗师AI' };
      const isAIOppInReplay = this.replayMode && this.replayBranchActive && this.gameMode !== 'pvp' && (this.replayHumanColor || RED) === RED;
      turnText.textContent = this.replayMode ? (isAIOppInReplay ? `复盘：${modeLabels[this.gameMode] || 'AI'}` : '复盘：黑方走棋') : (modeLabels[this.gameMode] || 'AI');
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
        ? 'inline-block serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600/15 text-amber-900 border border-amber-600/25'
        : 'inline-block serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-800/10 text-red-900 border border-red-800/15';
    }

    const isOnline = Boolean(this.onlineRole && (this.isOnlineConnected || this.conn?.open));
    ['mode-pvp', 'mode-easy', 'mode-hard', 'mode-inferno'].forEach(id => {
      document.getElementById(id)?.toggleAttribute('disabled', Boolean(this.onlineRole));
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
    if (this.engine.history.length === 0) {
      this.resetTelemetryUI();
      if (this.lastFromRing) this.lastFromRing.visible = false;
      if (this.lastToRing) this.lastToRing.visible = false;
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

  /**
   * 修改 1：“标准新局”按钮改为“模式选择”按钮，点击后弹出棋局模式选择面板
   */
  openVariantSelectModal() {
    if (this.onlineRole && this.conn?.open) {
      this.showCenterCallout('联机对局中不可切换棋局模式，请先退出房间', this.onlineRole);
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
            v.id === 'jieqi' ? 'bg-gradient-to-br from-amber-600 to-red-700' : 'bg-gradient-to-br from-red-700 to-slate-800'
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
                ${isCurrent ? '● 当前模式 · 点击新局' : '点击开启 ▶'}
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
      this.showCenterCallout('联机对局中不可切换棋局模式', this.onlineRole);
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
    this.showCenterCallout(`已开启【${target.name}】新局`, RED);
  }

  /**
   * 新增 7：点击标题栏“帥”图标后可以切换场景，切换场景不刷新网页且不破坏当前棋局
   */
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
      const activeBorder = isBattlefield
        ? 'border-red-700 bg-gradient-to-r from-amber-50/95 to-red-50/95 shadow-md'
        : 'border-emerald-700 bg-gradient-to-r from-emerald-50/95 to-teal-50/95 shadow-md';
      const iconBg = isBattlefield
        ? 'bg-gradient-to-br from-red-700 to-amber-700 text-amber-50'
        : 'bg-gradient-to-br from-emerald-700 to-teal-800 text-emerald-50';
      const badgeCls = isBattlefield
        ? 'bg-red-100 text-red-900'
        : 'bg-emerald-100 text-emerald-900';
      const statusCls = isBattlefield ? 'text-red-800' : 'text-emerald-800';
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
                <span class="serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeCls}">${sc.badge || (isCurrent ? '当前使用' : '可用场景')}</span>
              </div>
              <span class="serif-cn text-[11px] font-bold ${statusCls}">${isCurrent ? '✓ 当前场景' : '点击切换 ▶'}</span>
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
    const isBattlefield = sc.id === 'ancient_battlefield';
    this.sfx.playSelect();

    // 在不刷新网页、不重置棋盘与对局状态的前提下，无缝切换 3D 场景模型、粒子与光影
    if (this.parkGroup) this.parkGroup.visible = !isBattlefield;
    if (this.dappledCanopy) this.dappledCanopy.visible = !isBattlefield;
    if (this.breezeParticles) {
      this.breezeParticles.forEach(bp => { bp.mesh.visible = !isBattlefield; });
    }
    if (this.battlefieldGroup) this.battlefieldGroup.visible = isBattlefield;
    if (this.battlefieldEmbers) {
      this.battlefieldEmbers.forEach(em => { em.sprite.visible = isBattlefield; });
    }

    if (this.scene) {
      this.scene.background = new THREE.Color(sc.bgHex);
      if (this.scene.fog) {
        this.scene.fog.color.setHex(sc.bgHex);
        this.scene.fog.density = sc.fogDensity || 0.015;
      }
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.background = isBattlefield ? '#261a16' : '#dce7dc';
    }
    if (this.sunLight) {
      this.sunLight.color.setHex(sc.sunColor || 0xfff5e0);
      this.sunLight.intensity = sc.sunIntensity || 1.15;
    }
    if (this.hemiLight) {
      this.hemiLight.color.setHex(sc.hemiSky || 0xfef9e7);
      this.hemiLight.groundColor.setHex(sc.hemiGround || 0x688264);
      this.hemiLight.intensity = sc.hemiIntensity || 0.75;
    }

    const badgeEl = document.getElementById('scene-badge');
    if (badgeEl) {
      badgeEl.textContent = sc.name;
      badgeEl.className = isBattlefield
        ? 'hidden md:inline-block cursor-pointer serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-800/15 text-amber-950 border border-amber-800/25'
        : 'hidden md:inline-block cursor-pointer serif-cn text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-800/10 text-emerald-900 border border-emerald-800/15';
    }
    const switcherBtn = document.getElementById('btn-scene-switcher');
    if (switcherBtn) {
      switcherBtn.title = `点击切换 3D 场景（当前：${sc.name}）`;
    }

    this.toggleSceneModal(false);
    this.showCenterCallout(`场景已切换：${sc.name}`, RED);
  }

  restartStandardGame(isRemote = false) {
    if (this.onlineRole && this.conn?.open && !isRemote) {
      this.showCenterCallout('联机对局中请使用「重新对局」按钮向对方发起请求', this.onlineRole);
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
