/*************************************************************************
 * ENDGAME WORKSHOP, IMPERIAL SCROLL POSTER GENERATOR, SOCIAL SHARING & QR SCANNER
 * Extends Xiangqi3DApp.prototype
 *
 * Implements:
 *   - Custom Endgame Editor (残局工坊)
 *   - FEN Serialization & Parsing
 *   - Newly Redrawn Imperial Rosewood & Golden-Phoebe Chessboard Share Poster
 *     (3D beveled wood frame, brass corner brackets, wood grain, file coordinates,
 *      3D cylinder pieces with vector calligraphy, no top-right stamp seal)
 *   - Synchronous QR Code Canvas rendering + Web Share API & Social Platform sharing
 *   - QR Code Scanner (recognizes Room invites, Endgame FENs, and Shared Replays)
 *************************************************************************/

function dataURLToBlobSync(dataURL) {
  try {
    const parts = dataURL.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (_) {
    return null;
  }
}

Object.assign(Xiangqi3DApp.prototype, {
  copyTextSafe(text, successMsg = '已复制到剪贴板') {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showCenterCallout(successMsg, RED);
      }).catch(() => {
        this.fallbackCopyText(text, successMsg);
      });
    } else {
      this.fallbackCopyText(text, successMsg);
    }
  },

  fallbackCopyText(text, successMsg) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.showCenterCallout(successMsg, RED);
    } catch (_) {
      this.showCenterCallout('复制失败，请手动复制地址栏链接', RED);
    }
  },

  toggleEditorTools() {
    const content = document.getElementById('editor-tools-content');
    const button = document.getElementById('editor-collapse-btn');
    if (!content || !button) return;
    const collapsed = content.classList.toggle('hidden');
    button.textContent = collapsed ? '展开' : '收起';
  },

  enterEndgameEditor() {
    if (this.onlineRole) {
      this.showCenterCallout('联机对局中不能打开残局工坊', this.onlineRole);
      return;
    }
    if (this.isBusy) return;
    if (this.replayMode) this.exitReplayMode(false);
    this.endgameEditor = true;
    this.gameOver = false;
    this.endgameReasonText = null;
    this.isBusy = false;
    this.aiCallback = null;
    this.selectedSquare = null;
    this.clearLegalMoveIndicators();
    this.clearCheckmateVFX();
    this.clearCheckmateHighlights();
    document.getElementById('custom-endgame-panel')?.classList.remove('hidden');
    this.chooseEditorPiece('r', 'k');
    this.resetTelemetryUI?.();
  },

  chooseEditorPiece(color, type) {
    this.editorPiece = { color, type };
    this.editorErase = false;
    const chars = PIECE_CHARS[color][type];
    const status = document.getElementById('editor-piece-status');
    if (status) status.textContent = `当前工具：${color === RED ? '红' : '黑'}${chars}`;
  },

  setEditorErase() {
    this.editorErase = true;
    const status = document.getElementById('editor-piece-status');
    if (status) status.textContent = '当前工具：橡皮擦';
  },

  clearEditorBoard() {
    if (!this.endgameEditor) return;
    this.engine.board = Array.from({ length: 10 }, () => Array(9).fill(null));
    this.engine.turn = RED;
    this.engine.clearCapturesAndHistory?.();
    this.syncPiecesFromEngine();
    this.updateUI(false);
  },

  editBoardSquare(r, c) {
    if (!this.endgameEditor) return false;
    const old = this.engine.board[r][c];
    if (this.editorErase || (old && !this.editorErase && old.color === this.editorPiece.color && old.type === this.editorPiece.type)) {
      this.engine.board[r][c] = null;
    } else {
      this.engine.board[r][c] = {
        id: Date.now() + r * 9 + c,
        color: this.editorPiece.color,
        type: this.editorPiece.type,
        char: PIECE_CHARS[this.editorPiece.color][this.editorPiece.type]
      };
    }
    this.engine.turn = RED;
    this.engine.clearCapturesAndHistory?.();
    this.selectedSquare = null;
    this.clearLegalMoveIndicators();
    this.syncPiecesFromEngine();
    this.updateUI(false);
    return true;
  },

  exitEndgameEditor(startGame) {
    if (!this.endgameEditor) return;
    if (startGame) {
      let redKing = false, blackKing = false;
      for (const row of this.engine.board) {
        for (const p of row) {
          if (p && p.type === 'k') {
            if (p.color === RED) redKing = true;
            else blackKing = true;
          }
        }
      }
      if (!redKing || !blackKing) {
        this.showIllegalMovePrompt({ icon: 'info', title: '残局布阵提示', message: '请在棋盘上各放置一枚红【帥】和黑【將】后再开始对局。' }, 2400);
        return;
      }
      this.customEndgameSnapshot = this.engine.board.map(row => row.map(piece => piece ? { ...piece } : null));
    }
    this.endgameEditor = false;
    document.getElementById('custom-endgame-panel')?.classList.add('hidden');
    this.engine.turn = this.editorFirstTurn || RED;
    this.engine.clearCapturesAndHistory?.();
    this.gameOver = false;
    this.endgameReasonText = null;
    this.selectedSquare = null;
    this.syncPiecesFromEngine();

    if (startGame) {
      // 新的残局开始后，清空复盘并记录当前布置的残局为初始盘面
      this.initReplaySession?.(this.engine.board, this.engine.turn, 'endgame');
      this.setGameMode(this.onlineRole ? 'pvp' : 'inferno');
      this.updateRestartButtonLabel();
      if (this.conn?.open) {
        this.conn.send({
          type: 'sync_board',
          fen: this.exportBoardToFEN(this.engine.board, this.engine.turn),
          isCustomEndgame: true
        });
      }
    }
    this.resetTelemetryUI?.();
    this.updateRestartButtonLabel();
    this.updateUI(this.engine.isInCheck(this.engine.turn));
  },

  toggleEditorTurn() {
    this.editorFirstTurn = this.editorFirstTurn === BLACK ? RED : BLACK;
    const btn = document.getElementById('editor-turn-btn');
    if (btn) btn.textContent = this.editorFirstTurn === RED ? '红先' : '黑先';
    this.sfx.playSelect();
  },

  exportBoardToFEN(board = this.engine.board, turn = this.engine.turn) {
    return board.map(row => {
      let out = '', empty = 0;
      for (const p of row) {
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        out += p.color === RED ? p.type.toUpperCase() : p.type.toLowerCase();
      }
      if (empty) out += empty;
      return out;
    }).join('/') + ' ' + (turn === BLACK ? 'b' : 'w');
  },

  parseFENToBoard(fenString) {
    try {
      const parts = String(fenString).trim().split(/\s+/);
      const rows = parts[0].split('/');
      if (rows.length !== 10) return null;
      const board = Array.from({ length: 10 }, () => Array(9).fill(null));
      let fallbackId = Date.now() % 1000000 + 500;
      let redKing = false, blackKing = false;
      for (let r = 0; r < 10; r++) {
        let c = 0;
        for (const ch of rows[r]) {
          if (/[1-9]/.test(ch)) { c += Number(ch); continue; }
          const type = ch.toLowerCase();
          if (!PIECE_CHARS.r[type] || c >= 9) return null;
          const color = ch === ch.toUpperCase() ? RED : BLACK;
          const pid = this.engine?.allocPieceId ? this.engine.allocPieceId() : (fallbackId++);
          board[r][c++] = {
            id: pid,
            color,
            type,
            realType: type,
            posType: type,
            char: PIECE_CHARS[color][type],
            realChar: PIECE_CHARS[color][type],
            isHidden: false
          };
          if (type === 'k') { if (color === RED) redKing = true; else blackKing = true; }
        }
        if (c !== 9) return null;
      }
      if (!redKing || !blackKing) return null;
      const turn = parts[1] === 'b' ? BLACK : RED;
      return { board, turn };
    } catch (_) {
      return null;
    }
  },

  loadBoardFromFEN(fenString, options = {}) {
    const parsed = this.parseFENToBoard(fenString);
    if (!parsed) return false;
    const { board, turn } = parsed;
    const { isOnlineSync = false, isCustomEndgame = true, preserveReplay = false } = options;

    if (this.replayMode && !preserveReplay) {
      this.exitReplayMode(false);
    }

    this.editorFirstTurn = turn;
    this.engine.board = board;
    this.engine.turn = turn;
    this.engine.history = [];
    this.engine.capturedRed = [];
    this.engine.capturedBlack = [];
    this.engine.initialPosKey = this.engine.getPositionKey(board, turn);

    const normalizedFen = this.exportBoardToFEN(board, turn);
    const isStandardStart = normalizedFen === STANDARD_START_FEN;
    if (isOnlineSync && !isCustomEndgame) {
      this.customEndgameSnapshot = null;
    } else if (!isOnlineSync && isStandardStart) {
      this.customEndgameSnapshot = null;
    } else if (isCustomEndgame) {
      this.customEndgameSnapshot = board.map(row => row.map(p => p ? { ...p } : null));
    }

    this.gameOver = false;
    this.endgameReasonText = null;
    this.selectedSquare = null;
    this.clearLegalMoveIndicators();
    this.clearCheckmateHighlights();
    this.clearCheckmateVFX();
    if (this.lastFromRing) this.lastFromRing.visible = false;
    if (this.lastToRing) this.lastToRing.visible = false;

    if (!preserveReplay) {
      this.initReplaySession?.(board, turn, this.customEndgameSnapshot ? 'endgame' : 'standard');
    }

    this.syncPiecesFromEngine();
    this.resetTelemetryUI?.();
    this.updateRestartButtonLabel();
    this.updateUI(this.engine.isInCheck(turn));
    return true;
  },

  /**
   * 分享当前残局（从百宝箱点击“分享残局”）
   */
  shareCurrentBoard() {
    const board = this.endgameEditor
      ? this.engine.board
      : (this.customEndgameSnapshot && this.engine.history.length === 0 ? this.customEndgameSnapshot : this.engine.board);
    const turn = this.endgameEditor ? this.editorFirstTurn : this.engine.turn;
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('replay');
    url.searchParams.set('fen', this.exportBoardToFEN(board, turn));
    url.searchParams.set('mode', this.gameMode);

    this.currentShareUrl = url.toString();
    this.currentShareKind = 'endgame';

    const modalTitle = document.getElementById('share-modal-title');
    const modalSub = document.getElementById('share-modal-subtitle');
    const modalBadge = document.getElementById('share-modal-badge');
    if (modalTitle) modalTitle.textContent = '残局战帖 · 分享挑战';
    if (modalSub) modalSub.textContent = '长按海报、点击分享图片或选择下方社交平台转发';
    if (modalBadge) modalBadge.textContent = '局';

    const lastMove = this.engine.history.length > 0
      ? this.engine.history[this.engine.history.length - 1].move
      : null;

    this.renderEndgamePoster(board, turn, this.currentShareUrl, {
      posterTitle: '中国象棋 · 残局战帖',
      badgeText: turn === BLACK ? '● 黑方先行 · 破阵挑战' : '● 红方先行 · 破阵挑战',
      badgeColor: turn === BLACK ? '#1e293b' : '#991b1b',
      footerHeadline: '扫码立破此局 · 与君一决高下',
      footerSub: '长按识别二维码，或使用游戏内「扫码识局」直接挑战',
      lastMove
    });
    document.getElementById('share-endgame-modal')?.classList.remove('hidden');
  },

  /**
   * 全新重绘的御书房锦绫金丝楠木棋盘分享海报 (1080 × 1540 超清画质)
   * - 彻底移除右上角印章
   * - 锦绫暗纹卷轴背景 + 四角古典回纹金饰
   * - 立体花梨木包铜角外框 + 金丝楠木纹理棋盘 + 顶底传统九路坐标 + 楚河汉界碑刻
   * - 3D 圆柱立体厚边象牙/黑曜棋子 + Path2D 刀刻描金书法字心
   */
  renderEndgamePoster(board, turn, shareUrl, customOpts = {}) {
    const img = document.getElementById('share-poster-img');
    const qr = document.getElementById('share-poster-qr');
    const W = 1080;
    const H = 1540;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rRect = (x, y, w, h, r) => {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
    };

    const posterTitle = customOpts.posterTitle || '中国象棋 · 残局战帖';
    const badgeText = customOpts.badgeText || (turn === BLACK ? '● 黑方先行 · 破阵挑战' : '● 红方先行 · 破阵挑战');
    const badgeColor = customOpts.badgeColor || (turn === BLACK ? '#1e293b' : '#991b1b');
    const footerHeadline = customOpts.footerHeadline || '扫码立破此局 · 与君一决高下';
    const footerSub = customOpts.footerSub || '长按识别二维码，或使用游戏内「扫码识局」直接挑战';
    const lastMove = customOpts.lastMove || null;

    // 1. 宣纸锦绫渐变底卷
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#fcf8ef');
    bgGrad.addColorStop(0.48, '#f3e8d2');
    bgGrad.addColorStop(1, '#e4d2b2');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 宣纸云丝暗纹
    ctx.save();
    ctx.strokeStyle = 'rgba(138, 98, 52, 0.045)';
    ctx.lineWidth = 1.5;
    for (let y = 20; y < H; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.33, y + 6, W * 0.66, y - 6, W, y);
      ctx.stroke();
    }
    ctx.restore();

    // 2. 双层紫檀描金装裱外框 + 四角古典回纹金饰
    ctx.strokeStyle = '#4a2810';
    ctx.lineWidth = 8;
    ctx.strokeRect(26, 26, W - 52, H - 52);

    ctx.strokeStyle = '#c59643';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(38, 38, W - 76, H - 76);

    const drawCornerFret = (cx, cy, sx, sy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sx, sy);
      ctx.strokeStyle = '#9a6824';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, 36); ctx.lineTo(0, 0); ctx.lineTo(36, 0);
      ctx.moveTo(8, 28); ctx.lineTo(8, 8); ctx.lineTo(28, 8);
      ctx.moveTo(16, 20); ctx.lineTo(16, 16); ctx.lineTo(20, 16);
      ctx.stroke();
      ctx.restore();
    };
    drawCornerFret(48, 48, 1, 1);
    drawCornerFret(W - 48, 48, -1, 1);
    drawCornerFret(48, H - 48, 1, -1);
    drawCornerFret(W - 48, H - 48, -1, -1);

    // 3. 顶部中轴御制牌匾标题区（无右上角印章，干净大气）
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 标题两侧祥云金线装饰
    ctx.strokeStyle = '#b48236';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(110, 104); ctx.lineTo(255, 104);
    ctx.moveTo(W - 255, 104); ctx.lineTo(W - 110, 104);
    ctx.stroke();
    ctx.fillStyle = '#b48236';
    [255, W - 255].forEach(px => {
      ctx.beginPath();
      ctx.arc(px, 104, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.font = '900 54px "XiangqiCalligraphy", "Noto Serif SC", "Songti SC", "STKaiti", "Kaiti SC", "KaiTi", "Songti SC", serif';
    ctx.fillStyle = 'rgba(255, 248, 230, 0.9)';
    ctx.fillText(posterTitle, W / 2 + 2, 106);
    ctx.fillStyle = '#361c0a';
    ctx.fillText(posterTitle, W / 2, 104);

    // 先手/终局状态锦囊铭牌
    ctx.font = 'bold 24px "XiangqiCalligraphy", "Noto Serif SC", "Songti SC", "STKaiti", "Kaiti SC", "KaiTi", serif';
    const textMetrics = ctx.measureText(badgeText);
    const badgeW = Math.max(280, Math.min(760, textMetrics.width + 72));
    const badgeX = (W - badgeW) / 2;
    const badgeY = 142;
    const badgeH = 46;

    ctx.shadowColor = 'rgba(40, 18, 6, 0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = badgeColor;
    rRect(badgeX, badgeY, badgeW, badgeH, 23);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.8;
    rRect(badgeX + 2, badgeY + 2, badgeW - 4, badgeH - 4, 21);
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.fillText(badgeText, W / 2, badgeY + badgeH / 2 + 1);
    ctx.restore();

    // 4. 立体花梨木镶铜边棋盘底座 + 金丝楠木棋盘面板
    const outerBoardX = 68;
    const outerBoardY = 212;
    const outerBoardW = W - 136; // 944
    const outerBoardH = 1036;

    // 4.1 紫檀/花梨木立体外框与投影
    ctx.save();
    ctx.shadowColor = 'rgba(28, 14, 4, 0.34)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 14;
    const frameGrad = ctx.createLinearGradient(outerBoardX, outerBoardY, outerBoardX + outerBoardW, outerBoardY + outerBoardH);
    frameGrad.addColorStop(0, '#4d2b12');
    frameGrad.addColorStop(0.5, '#381e0b');
    frameGrad.addColorStop(1, '#261205');
    ctx.fillStyle = frameGrad;
    rRect(outerBoardX, outerBoardY, outerBoardW, outerBoardH, 24);
    ctx.fill();
    ctx.restore();

    // 外框包角黄铜片装饰与嵌金丝内线
    ctx.save();
    ctx.strokeStyle = '#c89b48';
    ctx.lineWidth = 2.2;
    rRect(outerBoardX + 8, outerBoardY + 8, outerBoardW - 16, outerBoardH - 16, 18);
    ctx.stroke();
    ctx.restore();

    // 4.2 金丝楠木棋盘内面板
    const innerPad = 24;
    const innerX = outerBoardX + innerPad;
    const innerY = outerBoardY + innerPad;
    const innerW = outerBoardW - innerPad * 2;
    const innerH = outerBoardH - innerPad * 2;

    const woodGrad = ctx.createLinearGradient(innerX, innerY, innerX + innerW, innerY + innerH);
    woodGrad.addColorStop(0, '#f1dfb9');
    woodGrad.addColorStop(0.5, '#e5cc9d');
    woodGrad.addColorStop(1, '#d5b57e');
    ctx.fillStyle = woodGrad;
    rRect(innerX, innerY, innerW, innerH, 14);
    ctx.fill();

    // 棋盘木纹年轮细丝
    ctx.save();
    rRect(innerX, innerY, innerW, innerH, 14);
    ctx.clip();
    ctx.strokeStyle = 'rgba(110, 72, 30, 0.06)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 95; i++) {
      const wy = innerY + i * 10.5 + Math.sin(i * 0.7) * 3;
      ctx.beginPath();
      ctx.moveTo(innerX, wy);
      ctx.bezierCurveTo(innerX + innerW * 0.35, wy + 7, innerX + innerW * 0.65, wy - 7, innerX + innerW, wy);
      ctx.stroke();
    }
    ctx.restore();

    // 4.3 棋盘九路十线网格与九宫/楚河汉界/星位花标
    const cell = 92;
    const gridW = cell * 8; // 736
    const gridH = cell * 9; // 828
    const x0 = Math.round((W - gridW) / 2); // 172
    const y0 = outerBoardY + 104; // 316

    // 顶底九路传统坐标铭文
    const blackCols = ['１', '２', '３', '４', '５', '６', '７', '８', '９'];
    const redCols = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
    for (let c = 0; c < 9; c++) {
      const cx = x0 + c * cell;
      if (typeof drawCalligraphicGlyph === 'function') {
        drawCalligraphicGlyph(ctx, blackCols[c], cx, y0 - 46, 26, { fillStyle: '#4a2e14' });
        drawCalligraphicGlyph(ctx, redCols[c], cx, y0 + gridH + 46, 26, { fillStyle: '#881313' });
      }
    }

    // 外粗内细双框线
    ctx.strokeStyle = '#38220f';
    ctx.lineWidth = 6.5;
    ctx.strokeRect(x0 - 14, y0 - 14, gridW + 28, gridH + 28);
    ctx.strokeStyle = '#6e4720';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 - 7, y0 - 7, gridW + 14, gridH + 14);

    // 棋盘横线与竖线
    ctx.strokeStyle = '#38220f';
    ctx.lineWidth = 2.8;
    ctx.strokeRect(x0, y0, gridW, gridH);

    for (let r = 1; r < 9; r++) {
      const y = y0 + r * cell;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + gridW, y);
      ctx.stroke();
    }
    for (let c = 1; c < 8; c++) {
      const x = x0 + c * cell;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + 4 * cell);
      ctx.moveTo(x, y0 + 5 * cell);
      ctx.lineTo(x, y0 + 9 * cell);
      ctx.stroke();
    }

    // 九宫格斜线
    for (const [r1, c1, r2, c2] of [[0, 3, 2, 5], [0, 5, 2, 3], [7, 3, 9, 5], [7, 5, 9, 3]]) {
      ctx.beginPath();
      ctx.moveTo(x0 + c1 * cell, y0 + r1 * cell);
      ctx.lineTo(x0 + c2 * cell, y0 + r2 * cell);
      ctx.stroke();
    }

    // 炮位与兵卒十字花标
    const drawStar = (r, c) => {
      const x = x0 + c * cell, y = y0 + r * cell;
      const gap = 7, len = 18;
      ctx.lineWidth = 2.4;
      for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if ((c === 0 && qx < 0) || (c === 8 && qx > 0)) continue;
        ctx.beginPath();
        ctx.moveTo(x + qx * gap, y + qy * (gap + len));
        ctx.lineTo(x + qx * gap, y + qy * gap);
        ctx.lineTo(x + qx * (gap + len), y + qy * gap);
        ctx.stroke();
      }
    };
    [[2, 1], [2, 7], [7, 1], [7, 7]].forEach(([r, c]) => drawStar(r, c));
    for (let c = 0; c < 9; c += 2) { drawStar(3, c); drawStar(6, c); }

    // 楚河汉界（矢量刀刻书法 + 中央太极菱花纹章）
    const riverMidY = y0 + 4.5 * cell;
    const riverGlyphOpts = {
      fillStyle: '#422812',
      bevelColor: 'rgba(255, 248, 228, 0.6)',
      bevelOffsetX: 1.2,
      bevelOffsetY: 1.5
    };
    if (typeof drawCalligraphicGlyph === 'function') {
      drawCalligraphicGlyph(ctx, '楚', x0 + 1.55 * cell, riverMidY, 48, riverGlyphOpts);
      drawCalligraphicGlyph(ctx, '河', x0 + 2.45 * cell, riverMidY, 48, riverGlyphOpts);
      drawCalligraphicGlyph(ctx, '漢', x0 + 5.55 * cell, riverMidY, 48, riverGlyphOpts);
      drawCalligraphicGlyph(ctx, '界', x0 + 6.45 * cell, riverMidY, 48, riverGlyphOpts);
    }

    // 河界中央古典菱花纹饰
    ctx.save();
    ctx.translate(W / 2, riverMidY);
    ctx.strokeStyle = 'rgba(66, 40, 18, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(18, 0); ctx.lineTo(0, 18); ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 若存在最后一步着法，绘制起点与落点金碧光环
    if (lastMove && typeof lastMove.fr === 'number') {
      const fx = x0 + lastMove.fc * cell, fy = y0 + lastMove.fr * cell;
      const tx = x0 + lastMove.tc * cell, ty = y0 + lastMove.tr * cell;
      ctx.save();
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.65)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(fx, fy, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(tx, ty, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. 3D 圆柱立体雕花象牙/黑曜棋子绘制
    const pieceR = 40;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board?.[r]?.[c];
        if (!p) continue;
        const x = x0 + c * cell;
        const y = y0 + r * cell;
        const isRed = p.color === RED;

        // 5.1 棋子底部投影与 3D 圆柱侧壁厚度
        ctx.save();
        ctx.shadowColor = 'rgba(15, 10, 5, 0.42)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 7;
        ctx.beginPath();
        ctx.arc(x, y + 4.5, pieceR, 0, Math.PI * 2);
        ctx.fillStyle = isRed ? '#bda37c' : '#050811';
        ctx.fill();
        ctx.restore();

        // 5.2 棋子顶面弧形光泽
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, pieceR, 0, Math.PI * 2);
        const topGrad = ctx.createRadialGradient(x - 12, y - 12, 4, x, y, pieceR);
        if (isRed) {
          topGrad.addColorStop(0, '#fffef9');
          topGrad.addColorStop(0.65, '#f6ede0');
          topGrad.addColorStop(1, '#decba8');
        } else {
          topGrad.addColorStop(0, '#364358');
          topGrad.addColorStop(0.6, '#141c2c');
          topGrad.addColorStop(1, '#080c15');
        }
        ctx.fillStyle = topGrad;
        ctx.fill();

        // 棋子外缘金属包边
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = isRed ? '#c8a04b' : '#64748b';
        ctx.stroke();

        // 双圈内环与八角暗纹
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = isRed ? '#b91c1c' : '#d4af37';
        ctx.beginPath();
        ctx.arc(x, y, 34.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 1.2;
        ctx.strokeStyle = isRed ? '#d97706' : '#e2e8f0';
        ctx.beginPath();
        ctx.arc(x, y, 30.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 5.3 棋子字心（揭棋暗子绘制背面宝相花暗纹，明子调用内置矢量书法渲染器）
        const ch = p.char || PIECE_CHARS[p.color]?.[p.type] || '?';
        if (p.isHidden) {
          ctx.save();
          ctx.translate(x, y);
          ctx.strokeStyle = isRed ? '#b91c1c' : '#d4af37';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, 0, 21, 0, Math.PI * 2);
          ctx.stroke();
          for (let i = 0; i < 8; i++) {
            ctx.save();
            ctx.rotate((i * Math.PI) / 4);
            ctx.beginPath();
            ctx.moveTo(0, 7);
            ctx.quadraticCurveTo(4.5, 14, 0, 20);
            ctx.quadraticCurveTo(-4.5, 14, 0, 7);
            ctx.stroke();
            ctx.restore();
          }
          ctx.fillStyle = isRed ? '#b91c1c' : '#d4af37';
          ctx.beginPath();
          ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (typeof drawCalligraphicGlyph === 'function') {
          if (isRed) {
            drawCalligraphicGlyph(ctx, ch, x, y, 44, {
              carveShadowColor: 'rgba(68, 22, 8, 0.28)',
              carveOffsetX: -0.9,
              carveOffsetY: -1.1,
              bevelColor: 'rgba(255, 251, 235, 0.85)',
              bevelOffsetX: 0.9,
              bevelOffsetY: 1.1,
              strokeStyle: '#d4af37',
              lineWidth: 1.4,
              topGradientColors: ['#dc2626', '#991b1b', '#670d0d']
            });
          } else {
            drawCalligraphicGlyph(ctx, ch, x, y, 44, {
              carveShadowColor: 'rgba(0, 0, 0, 0.72)',
              carveOffsetX: -1.0,
              carveOffsetY: -1.2,
              bevelColor: 'rgba(212, 175, 55, 0.55)',
              bevelOffsetX: 0.9,
              bevelOffsetY: 1.1,
              strokeStyle: '#b88924',
              lineWidth: 1.3,
              topGradientColors: ['#ffffff', '#fef3c7', '#f59e0b']
            });
          }
        }
      }
    }

    // 6. 底部战帖铭文卡与扫码擂台区
    const cardX = 68;
    const cardY = 1272;
    const cardW = W - 136;
    const cardH = 212;

    ctx.save();
    ctx.shadowColor = 'rgba(40, 20, 6, 0.12)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    cardGrad.addColorStop(0, '#fffdf9');
    cardGrad.addColorStop(1, '#f7efe0');
    ctx.fillStyle = cardGrad;
    rRect(cardX, cardY, cardW, cardH, 20);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#c59b58';
    ctx.lineWidth = 2.2;
    rRect(cardX, cardY, cardW, cardH, 20);
    ctx.stroke();

    // 左侧金红竖向装饰条
    ctx.fillStyle = '#991b1b';
    rRect(cardX + 26, cardY + 34, 6, cardH - 68, 3);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#361c0a';
    ctx.font = '900 35px "XiangqiCalligraphy", "Noto Serif SC", "Songti SC", "STKaiti", "Kaiti SC", "KaiTi", serif';
    ctx.fillText(footerHeadline, cardX + 48, cardY + 66);

    ctx.fillStyle = '#6b4c2b';
    ctx.font = '600 22px "XiangqiCalligraphy", "Noto Serif SC", "Songti SC", "STKaiti", "Kaiti SC", "KaiTi", serif';
    ctx.fillText(footerSub, cardX + 48, cardY + 118);

    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 19px "XiangqiCalligraphy", "Noto Serif SC", "Songti SC", "STKaiti", "Kaiti SC", "KaiTi", serif';
    ctx.fillText(this.currentSceneId === 'ancient_battlefield' ? '◆ 3D 中国象棋 · 古风战场楚汉演武' : '◆ 3D 中国象棋 · 竹林石桌古谱演武', cardX + 48, cardY + 166);

    const finalizePoster = (source) => {
      const qrBoxX = cardX + cardW - 198;
      const qrBoxY = cardY + 18;
      const qrBoxSize = 176;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#d4b483';
      ctx.lineWidth = 2;
      rRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 14);
      ctx.fill();
      ctx.stroke();

      if (source) {
        try {
          ctx.drawImage(source, qrBoxX + 10, qrBoxY + 10, qrBoxSize - 20, qrBoxSize - 20);
        } catch (_) { }
      } else {
        // 离线兜底装饰性二维码框提示
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px "XiangqiCalligraphy", "Noto Serif SC", serif';
        ctx.fillText('复制链接', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize / 2 - 12);
        ctx.fillText('即可挑战', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize / 2 + 16);
      }
      ctx.restore();

      let dataUrl = '';
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (_) {
        return;
      }
      if (img) img.src = dataUrl;
      this.currentPosterDataUrl = dataUrl;
      const syncBlob = dataURLToBlobSync(dataUrl);
      this.currentPosterBlob = syncBlob;
      if (syncBlob && typeof File !== 'undefined') {
        const fileName = this.currentShareKind === 'replay' ? 'xiangqi3d-replay.png' : 'xiangqi3d-endgame.png';
        try {
          this.currentPosterFile = new File([syncBlob], fileName, { type: 'image/png', lastModified: Date.now() });
        } catch (_) {
          this.currentPosterFile = null;
        }
      }
    };

    let qrDrawnSync = false;
    if (qr && typeof QRCode !== 'undefined') {
      qr.innerHTML = '';
      try {
        new QRCode(qr, {
          text: shareUrl,
          width: 220,
          height: 220,
          colorDark: '#111827',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.L : undefined
        });
        const c = qr.querySelector('canvas');
        if (c && c.width > 0) {
          finalizePoster(c);
          qrDrawnSync = true;
        }
      } catch (_) { }
    }

    if (!qrDrawnSync) {
      finalizePoster(null);
      const fallbackImg = new Image();
      fallbackImg.crossOrigin = 'anonymous';
      fallbackImg.onload = () => finalizePoster(fallbackImg);
      fallbackImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=' + encodeURIComponent(shareUrl);
    }
  },

  /**
   * 分享海报原生/跨平台转发
   */
  async shareEndgamePosterNative() {
    this.sfx?.playSelect?.();
    const url = this.currentShareUrl || window.location.href;
    const isReplay = this.currentShareKind === 'replay';
    const shareTitle = isReplay ? '中国象棋 3D · 精彩棋局复盘' : '中国象棋 3D · 残局挑战';
    const shareText = isReplay
      ? '来看看这盘精彩的中国象棋对局复盘，扫码或点击链接即可逐步回看全局演武！'
      : '我摆了一道精妙象棋残局，扫码或点击链接即可直接应战！';

    let file = this.currentPosterFile;
    let blob = this.currentPosterBlob;
    if (!blob && this.currentPosterDataUrl) {
      blob = dataURLToBlobSync(this.currentPosterDataUrl);
      this.currentPosterBlob = blob;
    }
    if (!file && blob && typeof File !== 'undefined') {
      try {
        file = new File([blob], isReplay ? 'xiangqi3d-replay.png' : 'xiangqi3d-endgame.png', { type: 'image/png' });
        this.currentPosterFile = file;
      } catch (_) { }
    }

    if (typeof navigator.share === 'function') {
      if (file) {
        let canShareFile = true;
        if (typeof navigator.canShare === 'function') {
          try { canShareFile = navigator.canShare({ files: [file] }); } catch (_) { canShareFile = false; }
        }
        if (canShareFile) {
          try {
            await navigator.share({ files: [file], title: shareTitle, text: shareText });
            this.showCenterCallout('已调起系统分享', RED);
            return;
          } catch (err) {
            if (err?.name === 'AbortError') return;
            try {
              await navigator.share({ files: [file] });
              this.showCenterCallout('已调起图片分享', RED);
              return;
            } catch (err2) {
              if (err2?.name === 'AbortError') return;
            }
          }
        }
      }

      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        this.showCenterCallout('已调起链接分享', RED);
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }

    if (blob && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        this.showCenterCallout('海报图片已复制，可直接去微信/QQ/社交平台粘贴发送！', RED);
        return;
      } catch (_) { }
    }

    this.downloadEndgamePoster();
    this.copyTextSafe(url, '已为您保存海报并复制分享链接，可直接发往社交平台');
  },

  async shareToSocialPlatform(platform) {
    this.sfx?.playSelect?.();
    const url = this.currentShareUrl || window.location.href;
    const isReplay = this.currentShareKind === 'replay';
    const title = isReplay
      ? '【中国象棋 3D · 棋局复盘】步步精妙，点击链接或扫码回看整局演武！'
      : '【中国象棋 3D · 残局战帖】我摆了一道象棋残局，敢来一决高下吗？';

    const blob = this.currentPosterBlob || (this.currentPosterDataUrl ? dataURLToBlobSync(this.currentPosterDataUrl) : null);

    let imageCopied = false;
    if (blob && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        imageCopied = true;
      } catch (_) { }
    }

    if (platform === 'weibo') {
      const weiboUrl = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
      window.open(weiboUrl, '_blank', 'noopener,noreferrer,width=680,height=520');
      this.showCenterCallout(imageCopied ? '已打开微博分享（海报图片也已复制，可直接粘贴）' : '已打开微博分享窗口', RED);
      return;
    }

    if (platform === 'qq') {
      const qqUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(isReplay ? '中国象棋 3D · 棋局复盘' : '中国象棋 3D · 残局战帖')}&summary=${encodeURIComponent(title)}`;
      window.open(qqUrl, '_blank', 'noopener,noreferrer,width=720,height=540');
      this.showCenterCallout(imageCopied ? '已打开 QQ 分享（海报图片也已复制，可在聊天框直接粘贴）' : '已打开 QQ 分享窗口', RED);
      return;
    }

    if (platform === 'wechat') {
      if (this.currentPosterFile && navigator.share && (!navigator.canShare || navigator.canShare({ files: [this.currentPosterFile] }))) {
        try {
          await navigator.share({ files: [this.currentPosterFile], title: isReplay ? '棋局复盘' : '残局战帖', text: title });
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      if (imageCopied) {
        this.showCenterCallout('海报图片已复制！打开微信可直接粘贴发送，或长按上方海报转发', RED);
      } else {
        this.downloadEndgamePoster();
        this.showCenterCallout('已保存高清海报图片，打开微信/朋友圈即可直接发送', RED);
      }
      return;
    }

    if (platform === 'copy_image') {
      if (imageCopied) {
        this.showCenterCallout('高清海报图片已复制，可直接粘贴到任意社交平台！', RED);
      } else {
        this.downloadEndgamePoster();
        this.showCenterCallout('当前浏览器限制剪贴板图片，已为您直接下载海报', RED);
      }
    }
  },

  copyEndgameShareLink() {
    const url = this.currentShareUrl || window.location.href;
    this.copyTextSafe(url, this.currentShareKind === 'replay' ? '复盘链接已复制' : '残局链接已复制');
  },

  downloadEndgamePoster() {
    const img = document.getElementById('share-poster-img');
    const src = img?.src || this.currentPosterDataUrl;
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = this.currentShareKind === 'replay' ? '中国象棋3D-棋局复盘.png' : '中国象棋3D-残局挑战.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  async startQRScanner() {
    const modal = document.getElementById('qr-scanner-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const status = document.getElementById('qr-scan-status');
    const video = document.getElementById('qr-video');
    if (!navigator.mediaDevices?.getUserMedia) {
      if (status) status.textContent = '当前环境不支持摄像头，请点击「从相册选择」二维码图片。';
      return;
    }
    try {
      this.stopQRScanner(false);
      if (status) status.textContent = '正在启动高清摄像头与自动对焦…';
      let stream;
      const v = { facingMode: { ideal: this.qrFacingMode || 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } };
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...v, advanced: [{ focusMode: 'continuous' }] } });
      } catch (_) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: this.qrFacingMode || 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      }
      this.qrStream = stream;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      await video.play();
      const track = stream.getVideoTracks()[0];
      if (track?.getCapabilities) {
        const caps = track.getCapabilities(), adv = {};
        if (caps.focusMode?.includes('continuous')) adv.focusMode = 'continuous';
        if (caps.zoom) adv.zoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1.15));
        if (Object.keys(adv).length) track.applyConstraints({ advanced: [adv] }).catch(() => { });
        video.onclick = () => {
          if (caps.focusMode?.includes('single-shot')) {
            track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] }).then(() => setTimeout(() => {
              if (caps.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => { });
            }, 600)).catch(() => { });
          }
          if (status) status.textContent = '已尝试重新对焦，请避免二维码离镜头过近。';
        };
      }
      let detector = null;
      if ('BarcodeDetector' in window) {
        try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (_) { }
      }
      const canvas = document.getElementById('qr-canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      const scan = async () => {
        if (!this.qrStream || modal.classList.contains('hidden')) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          if (detector) {
            try {
              const codes = await detector.detect(video);
              if (codes?.[0]?.rawValue) {
                const value = codes[0].rawValue;
                this.stopQRScanner();
                this.handleScannedQRText(value);
                return;
              }
            } catch (_) { }
          }
          if (typeof jsQR !== 'undefined') {
            const w = video.videoWidth, h = video.videoHeight, crop = Math.floor(Math.min(w, h) * 0.9);
            const sx = Math.floor((w - crop) / 2), sy = Math.floor((h - crop) / 2), dim = Math.min(1024, crop);
            canvas.width = dim; canvas.height = dim;
            ctx.drawImage(video, sx, sy, crop, crop, 0, 0, dim, dim);
            const d = ctx.getImageData(0, 0, dim, dim);
            const code = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
            if (code?.data) {
              this.stopQRScanner();
              this.handleScannedQRText(code.data);
              return;
            }
          }
        }
        this.qrAnimationFrame = requestAnimationFrame(scan);
      };
      if (status) status.textContent = '请将二维码放入取景框 · 建议距离 15–25cm · 点击画面可尝试对焦';
      this.qrAnimationFrame = requestAnimationFrame(scan);
    } catch (e) {
      if (status) status.textContent = '摄像头启动失败，请检查权限或使用「从相册选择」。';
    }
  },

  stopQRScanner(closeModal = true) {
    if (this.qrAnimationFrame) cancelAnimationFrame(this.qrAnimationFrame);
    this.qrAnimationFrame = null;
    if (this.qrStream) {
      this.qrStream.getTracks().forEach(t => t.stop());
      this.qrStream = null;
    }
    const video = document.getElementById('qr-video');
    if (video) video.srcObject = null;
    if (closeModal) document.getElementById('qr-scanner-modal')?.classList.add('hidden');
  },

  async scanQRImageFile(input) {
    const file = input?.files?.[0];
    if (!file) return;
    try {
      if (typeof jsQR === 'undefined') throw new Error('扫码库未加载');
      const bitmap = await createImageBitmap(file);
      const c = document.getElementById('qr-canvas');
      c.width = bitmap.width;
      c.height = bitmap.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
      bitmap.close?.();
      if (!code) throw new Error('图片中未识别到二维码');
      this.stopQRScanner();
      this.handleScannedQRText(code.data);
    } catch (e) {
      const status = document.getElementById('qr-scan-status');
      if (status) status.textContent = e.message || '图片识别失败，请换一张清晰的二维码图片。';
    }
    input.value = '';
  },

  handleScannedQRText(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return;
    let url = null;
    try { url = new URL(text); } catch (_) { }
    if (url) {
      const room = url.searchParams.get('room');
      const replayData = url.searchParams.get('replay');
      const fen = url.searchParams.get('fen');
      const mode = url.searchParams.get('mode');
      if (room) {
        if (fen) this.loadBoardFromFEN(fen);
        this.joinOnlineRoom(room.trim().toUpperCase());
        this.showCenterCallout('扫码成功 · 正在加入房间', RED);
        return;
      }
      if (replayData) {
        if (this.onlineRole) {
          this.showCenterCallout('请先退出联机房间再查看复盘', RED);
          return;
        }
        if (this.loadSharedReplayFromParam?.(replayData)) {
          this.showCenterCallout('扫码成功 · 已进入复盘演示', RED);
          return;
        }
      }
      if (fen) {
        if (this.onlineRole) {
          this.showCenterCallout('请先退出联机房间再加载残局', RED);
          return;
        }
        if (this.loadBoardFromFEN(fen)) {
          if (mode) this.setGameMode(mode);
          this.showCenterCallout('扫码成功 · 残局已加载', RED);
        }
        return;
      }
    }
    if (/^[A-Z0-9]{4,10}$/i.test(text)) {
      this.joinOnlineRoom(text.toUpperCase());
      this.showCenterCallout('正在加入房间', RED);
      return;
    }
    if ((text.match(/\//g) || []).length === 9) {
      if (this.onlineRole) {
        this.showCenterCallout('请先退出联机房间再加载残局', RED);
        return;
      }
      if (this.loadBoardFromFEN(text)) this.showCenterCallout('残局已加载', RED);
      return;
    }
    this.showIllegalMovePrompt({ icon: 'qr_code', title: '无法识别的二维码', message: '请扫描本游戏的房间邀请码、残局战帖或复盘二维码。' }, 2500);
  },

  toggleQRScannerCamera() {
    this.qrFacingMode = this.qrFacingMode === 'environment' ? 'user' : 'environment';
    this.startQRScanner();
  }
});
