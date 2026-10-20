/*************************************************************************
 * ENDGAME WORKSHOP, POSTER GENERATOR, SOCIAL SHARING & QR SCANNER MODULE
 * Extends Xiangqi3DApp.prototype
 *
 * Implements:
 *   - Custom Endgame Editor (残局工坊)
 *   - FEN Serialization & Parsing
 *   - Poster Generation (with top-right "古谱挑战" seal removed; supports both Endgame & Replay final board)
 *   - Synchronous QR Code Canvas rendering + Fixed Web Share API & Social Platform sharing
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
  },

  chooseEditorPiece(color, type) {
    this.editorPiece = { color, type };
    this.editorErase = false;
    const chars = PIECE_CHARS[color][type];
    const status = document.getElementById('editor-piece-status');
    if (status) status.textContent = `当前：${color === RED ? '红' : '黑'}${chars}`;
  },

  setEditorErase() {
    this.editorErase = true;
    const status = document.getElementById('editor-piece-status');
    if (status) status.textContent = '当前：橡皮擦';
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
        this.showIllegalMovePrompt({ icon: 'info', title: '残局提示', message: '请在棋盘上各放置一个红帥和黑將。' }, 2000);
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
      let id = 100, redKing = false, blackKing = false;
      for (let r = 0; r < 10; r++) {
        let c = 0;
        for (const ch of rows[r]) {
          if (/[1-9]/.test(ch)) { c += Number(ch); continue; }
          const type = ch.toLowerCase();
          if (!PIECE_CHARS.r[type] || c >= 9) return null;
          const color = ch === ch.toUpperCase() ? RED : BLACK;
          board[r][c++] = { id: id++, color, type, char: PIECE_CHARS[color][type] };
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

    // 区分联机标准局同步 vs 残局加载，防止联机接受方被错误标记为“重置残局”
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

    this.renderEndgamePoster(board, turn, this.currentShareUrl, {
      posterTitle: '中国象棋 · 残局战帖',
      badgeText: turn === BLACK ? '● 黑方先行' : '● 红方先行',
      badgeColor: turn === BLACK ? '#1e293b' : '#991b1b',
      footerHeadline: '扫码立破此局 · 与君一决高下',
      footerSub: '长按识别二维码，或使用游戏内「扫码识局」直接挑战'
    });
    document.getElementById('share-endgame-modal')?.classList.remove('hidden');
  },

  /**
   * 渲染分享海报（已彻底去除右上角“古谱挑战”印章，支持残局分享与复盘最终棋盘分享）
   * 并在绘制完成后同步将 QR 码画入海报并生成 File/Blob，确保点击“分享图片”时不会丢失用户手势激活态
   */
  renderEndgamePoster(board, turn, shareUrl, customOpts = {}) {
    const img = document.getElementById('share-poster-img');
    const qr = document.getElementById('share-poster-qr');
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const posterTitle = customOpts.posterTitle || '中国象棋 · 残局战帖';
    const badgeText = customOpts.badgeText || (turn === BLACK ? '● 黑方先行' : '● 红方先行');
    const badgeColor = customOpts.badgeColor || (turn === BLACK ? '#1e293b' : '#991b1b');
    const footerHeadline = customOpts.footerHeadline || '扫码立破此局 · 与君一决高下';
    const footerSub = customOpts.footerSub || '长按识别二维码，或使用游戏内「扫码识局」直接挑战';

    const bg = ctx.createLinearGradient(0, 0, 1000, 1420);
    bg.addColorStop(0, '#fbf7ee');
    bg.addColorStop(0.5, '#f3ead6');
    bg.addColorStop(1, '#e7dac0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1000, 1420);

    ctx.strokeStyle = '#784b23';
    ctx.lineWidth = 8;
    ctx.strokeRect(28, 28, 944, 1364);
    ctx.strokeStyle = '#b48a52';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(40, 40, 920, 1340);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#3d2310';
    ctx.font = '900 52px "Noto Serif SC","Songti SC",serif';
    ctx.fillText(posterTitle, 500, 112);

    const badgeWidth = Math.max(240, badgeText.length * 28 + 44);
    const badgeX = 500 - badgeWidth / 2;
    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(badgeX, 136, badgeWidth, 44, 22);
    else ctx.rect(badgeX, 136, badgeWidth, 44);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 23px "Noto Serif SC",serif';
    ctx.fillText(badgeText, 500, 165);

    // 已彻底移除右上角 (850, 110) 的“古谱挑战”印章

    ctx.save();
    ctx.shadowColor = 'rgba(40,20,5,.24)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    const wood = ctx.createLinearGradient(76, 210, 924, 1130);
    wood.addColorStop(0, '#ecdab9');
    wood.addColorStop(0.5, '#e2ca9f');
    wood.addColorStop(1, '#d4b886');
    ctx.fillStyle = wood;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(76, 210, 848, 920, 20);
    else ctx.rect(76, 210, 848, 920);
    ctx.fill();
    ctx.restore();

    const x0 = 140, y0 = 275, cell = 90;
    ctx.strokeStyle = '#3d2914';
    ctx.lineWidth = 6;
    ctx.strokeRect(x0 - 12, y0 - 12, 744, 834);
    ctx.lineWidth = 2.5;
    for (let r = 0; r < 10; r++) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + r * cell);
      ctx.lineTo(x0 + 720, y0 + r * cell);
      ctx.stroke();
    }
    for (let c = 1; c < 8; c++) {
      ctx.beginPath();
      ctx.moveTo(x0 + c * cell, y0);
      ctx.lineTo(x0 + c * cell, y0 + 360);
      ctx.moveTo(x0 + c * cell, y0 + 450);
      ctx.moveTo(x0 + c * cell, y0 + 810);
      ctx.stroke();
    }
    for (const [r1, c1, r2, c2] of [[0, 3, 2, 5], [0, 5, 2, 3], [7, 3, 9, 5], [7, 5, 9, 3]]) {
      ctx.beginPath();
      ctx.moveTo(x0 + c1 * cell, y0 + r1 * cell);
      ctx.lineTo(x0 + c2 * cell, y0 + r2 * cell);
      ctx.stroke();
    }
    const flower = (r, c) => {
      const x = x0 + c * cell, y = y0 + r * cell;
      for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if ((c === 0 && qx < 0) || (c === 8 && qx > 0)) continue;
        ctx.beginPath();
        ctx.moveTo(x + qx * 7, y + qy * 21);
        ctx.lineTo(x + qx * 7, y + qy * 7);
        ctx.lineTo(x + qx * 21, y + qy * 7);
        ctx.stroke();
      }
    };
    [[2, 1], [2, 7], [7, 1], [7, 7]].forEach(([r, c]) => flower(r, c));
    for (let c = 0; c < 9; c += 2) { flower(3, c); flower(6, c); }

    ctx.fillStyle = '#472f18';
    ctx.font = 'bold 44px "Noto Serif SC","Songti SC",serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚  河', x0 + 180, y0 + 405);
    ctx.fillText('漢  界', x0 + 540, y0 + 405);

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board?.[r]?.[c];
        if (!p) continue;
        const x = x0 + c * cell, y = y0 + r * cell, red = p.color === RED;
        ctx.save();
        ctx.shadowColor = 'rgba(15,23,42,.38)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
        ctx.beginPath();
        ctx.arc(x, y, 39, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(x - 10, y - 10, 4, x, y, 39);
        if (red) {
          g.addColorStop(0, '#fffdf7');
          g.addColorStop(0.72, '#f5ecd9');
          g.addColorStop(1, '#decba8');
        } else {
          g.addColorStop(0, '#334155');
          g.addColorStop(0.65, '#111827');
          g.addColorStop(1, '#090d16');
        }
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();

        ctx.lineWidth = 3;
        ctx.strokeStyle = red ? '#b91c1c' : '#d4af37';
        ctx.beginPath();
        ctx.arc(x, y, 35, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 1.2;
        ctx.strokeStyle = red ? '#d97706' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.stroke();

        const ch = p.char || PIECE_CHARS[p.color]?.[p.type] || '?';
        ctx.font = '900 42px "KaiTi","STKaiti","Noto Serif SC",serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = red ? '#d4af37' : '#b48a28';
        ctx.strokeText(ch, x, y + 2);
        ctx.fillStyle = red ? '#991b1b' : '#f8fafc';
        ctx.fillText(ch, x, y + 2);
      }
    }

    ctx.fillStyle = '#fffdf8';
    ctx.strokeStyle = '#d6c3a5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(76, 1160, 848, 200, 18);
    else ctx.rect(76, 1160, 848, 200);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#3d2310';
    ctx.font = '900 32px "Noto Serif SC",serif';
    ctx.fillText(footerHeadline, 112, 1225);
    ctx.fillStyle = '#785a3c';
    ctx.font = '500 22px "Inter",sans-serif';
    ctx.fillText(footerSub, 112, 1275);
    ctx.fillStyle = '#9a7b56';
    ctx.font = 'bold 18px "Inter",sans-serif';
    ctx.fillText('3D 中国象棋 · 极简公园版', 112, 1320);

    const finalizePoster = (source) => {
      if (source) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#e2d5be';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(732, 1176, 168, 168, 12);
        else ctx.rect(732, 1176, 168, 168);
        ctx.fill();
        ctx.stroke();
        try { ctx.drawImage(source, 742, 1186, 148, 148); } catch (_) { }
      }
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
        // 使用通用 ASCII 文件名以兼容各移动端系统级分享与微信/QQ/微博客户端
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
          width: 200,
          height: 200,
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
      fallbackImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=' + encodeURIComponent(shareUrl);
    }
  },

  /**
   * 修复后的图片分享功能：
   * 1. 直接使用预生成的同步 File 对象调用 navigator.share，避免异步等待导致丢失浏览器用户手势激活态 (NotAllowedError)
   * 2. 兼容仅支持 {files} 或支持 {files, title, text} 或仅支持 {title, text, url} 的多端浏览器与社交 App WebView
   * 3. 在不支持原生系统分享面板的桌面端/受限端，自动将海报图片写入剪贴板并弹出社交平台分享指引
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

    // 优先调用系统级图片分享面板（iOS / Android / 鸿蒙 / Windows / macOS 社交平台转发）
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
            // 部分手机浏览器当 files 与 title/text 同传时会报错，回退仅传 files
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

      // 回退：调用原生链接分享面板
      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        this.showCenterCallout('已调起链接分享', RED);
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }

    // 桌面浏览器或不支持 Web Share 的环境：复制海报图片到剪贴板 + 自动保存海报
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

  /**
   * 社交平台定向分享（微信/朋友圈、微博、QQ、复制海报图片）
   */
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
