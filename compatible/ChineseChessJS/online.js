Object.assign(Xiangqi3DApp.prototype, {

  isOnlineInRoom() {
    return Boolean(this.onlineRole && (this.isOnlineConnected || this.conn?.open));
  },

  hideAllActionModals() {
    ['undo-request-modal', 'draw-confirm-modal', 'resign-confirm-modal', 'draw-request-modal', 'rematch-request-modal'].forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });
  },

  requestDraw() {
    if (!this.isOnlineInRoom() || this.gameOver || this.isBusy || this.replayMode) return;
    this.sfx.playSelect();
    this.hideAllActionModals();
    const descEl = document.getElementById('draw-confirm-desc');
    if (descEl) {
      descEl.textContent = '向对方发起求和？对方同意后本局作和。';
    }
    document.getElementById('draw-confirm-modal')?.classList.remove('hidden');
  },

  confirmSendDrawRequest(confirmed) {
    document.getElementById('draw-confirm-modal')?.classList.add('hidden');
    if (!confirmed) {
      this.sfx.playSelect();
      return;
    }
    this.sfx.playSelect();
    if (this.isOnlineInRoom() && this.conn?.open) {
      if (this.pendingDrawRequest) {
        this.showCenterCallout('求和已发送，等待回应', this.onlineRole);
        return;
      }
      this.pendingDrawRequest = true;
      this.conn.send({ type: 'draw_request' });
      this.showCenterCallout('求和已发送，等待回应', this.onlineRole);
      clearTimeout(this.drawRequestTimeout);
      this.drawRequestTimeout = setTimeout(() => {
        this.pendingDrawRequest = false;
      }, 15000);
    }
  },

  respondDrawRequest(accepted) {
    document.getElementById('draw-request-modal')?.classList.add('hidden');
    if (!this.conn?.open) return;
    this.conn.send({ type: accepted ? 'draw_accept' : 'draw_reject' });
    if (accepted) {
      this.finishGameByDraw('双方同意求和 · 握手言和');
    } else {
      this.sfx.playSelect();
      this.showCenterCallout('已拒绝求和', this.onlineRole || RED);
    }
  },

  resignOnline() {
    if (!this.isOnlineInRoom() || this.gameOver || this.isBusy || this.replayMode) return;
    this.sfx.playSelect();
    this.hideAllActionModals();
    document.getElementById('resign-confirm-modal')?.classList.remove('hidden');
  },

  confirmResignAction(confirmed) {
    document.getElementById('resign-confirm-modal')?.classList.add('hidden');
    if (!confirmed) {
      this.sfx.playSelect();
      return;
    }
    this.sfx.playSelect();
    const resigningSide = this.onlineRole || RED;
    if (this.isOnlineInRoom() && this.conn?.open) {
      this.conn.send({ type: 'resign', side: resigningSide === RED ? 'red' : 'black' });
    }
    this.finishGameByResign(resigningSide, true);
  },

  finishGameByDraw(reasonText = '双方握手言和') {
    this.pendingDrawRequest = false;
    clearTimeout(this.drawRequestTimeout);
    this.gameOver = true;
    this.endgameReasonText = '终局 · 双方和棋';
    this.isBusy = false;
    this.selectedSquare = null;
    this.clearLegalMoveIndicators();
    this.hideCycleWarningBanner();
    this.hideIllegalMovePrompt();
    this.hideAllActionModals();
    this.closeModalOnly();

    const kings = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 3; c <= 5; c++) {
        const p = this.engine.board[r][c];
        if (p && p.type === 'k') kings.push({ r, c });
      }
    }
    this.showCheckmateHighlights(kings);
    this.sfx.playVictorySeal();

    this.recordReplayOutcome?.('draw', '握手言和 · 和局');
    this.updateRestartButtonLabel();
    this.updateUI(false);
    this.showCenterCallout(`${reasonText}`, this.onlineRole || RED);
  },

  finishGameByResign(resigningSide, isSelfResign = false) {
    this.gameOver = true;
    this.isBusy = false;
    this.selectedSquare = null;
    this.clearLegalMoveIndicators();
    this.hideCycleWarningBanner();
    this.hideIllegalMovePrompt();
    this.hideAllActionModals();
    this.closeModalOnly();

    const winnerColor = resigningSide === RED ? BLACK : RED;
    const loserName = resigningSide === RED ? '红方' : '黑方';
    const winnerName = winnerColor === RED ? '红方' : '黑方';
    this.endgameReasonText = `终局 · ${loserName}认输（${winnerName}胜）`;

    const kings = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 3; c <= 5; c++) {
        const p = this.engine.board[r][c];
        if (p && p.type === 'k') kings.push({ r, c });
      }
    }
    this.showCheckmateHighlights(kings);
    this.sfx.playVictorySeal();

    const titleText = `${loserName}认输 · ${winnerName}胜`;
    this.recordReplayOutcome?.(winnerColor, titleText);
    this.updateRestartButtonLabel();
    this.updateUI(false);
    this.showCenterCallout(
      isSelfResign ? `已投子认输 · 终局展示` : `${loserName}投子认输 · ${winnerName}获胜`,
      winnerColor
    );
  },

  requestRematchOnline(isPlayAgain = false) {
    const playAgainMode = Boolean(isPlayAgain || this.gameOver);
    const actionLabel = playAgainMode ? '再来一局' : '重新对局';

    if (!this.isOnlineInRoom() || !this.conn?.open) {
      this.showCenterCallout(`待好友连入后可发起${actionLabel}`, this.onlineRole || RED);
      return;
    }
    if (this.pendingRematchRequest) {
      this.showCenterCallout(`已发起${actionLabel}，等待回应`, this.onlineRole);
      return;
    }
    this.pendingRematchRequest = true;
    this.lastRematchWasPlayAgain = playAgainMode;
    this.closeModalOnly();
    this.sfx.playSelect();
    try {
      this.conn.send({ type: 'rematch_request', isPlayAgain: playAgainMode });
      this.showCenterCallout(`已发起「${actionLabel}」，等待回应`, this.onlineRole);
      clearTimeout(this.rematchRequestTimeout);
      this.rematchRequestTimeout = setTimeout(() => {
        if (!this.pendingRematchRequest) return;
        this.pendingRematchRequest = false;
        this.showCenterCallout(`${actionLabel}申请暂无回应`, this.onlineRole);
      }, 15000);
    } catch (err) {
      this.pendingRematchRequest = false;
      this.updateOnlineStatusUI(`发送${actionLabel}申请失败，请检查连接`, false);
    }
  },

  respondRematchRequest(accepted) {
    document.getElementById('rematch-request-modal')?.classList.add('hidden');
    if (!this.conn?.open) return;
    const isPlayAgain = Boolean(this.incomingRematchIsPlayAgain || this.gameOver);
    const actionLabel = isPlayAgain ? '再来一局' : '重新对局';
    this.conn.send({ type: accepted ? 'rematch_accept' : 'rematch_reject', isPlayAgain });
    if (accepted) {
      this.resetOnlineGameBoard();
      this.showCenterCallout(`已同意${actionLabel} · 棋盘重置`, this.onlineRole || RED);
    } else {
      this.sfx.playSelect();
      this.showCenterCallout(`已拒绝${actionLabel}`, this.onlineRole || RED);
    }
  },

  resetOnlineGameBoard() {
    this.pendingRematchRequest = false;
    this.pendingDrawRequest = false;
    this.pendingUndoRequest = false;
    this.endgameReasonText = null;
    clearTimeout(this.rematchRequestTimeout);
    clearTimeout(this.drawRequestTimeout);
    clearTimeout(this.undoRequestTimeout);
    this.hideAllActionModals();
    this.closeModalOnly();

    if (this.customEndgameSnapshot) {
      this.replayEndgame(true);
    } else {
      this.restartGame();
    }
    this.setGameMode('pvp');
    this.updatePiecesOrientation();
    this.updateRestartButtonLabel();
    this.updateUI(this.engine.isInCheck(this.engine.turn));
  },

  toggleOnlineModal(force) {
    const modal = document.getElementById('online-modal');
    if (!modal) return;
    const willShow = typeof force === 'boolean' ? force : modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !willShow);
    if (willShow) {
      document.getElementById('more-tools-menu')?.classList.add('hidden');
      document.getElementById('custom-endgame-panel')?.classList.add('hidden');
      document.getElementById('vfx-drawer')?.classList.add('hidden');
      document.getElementById('replay-panel')?.classList.add('hidden');
    }
  },

  renderInviteQRCode(inviteLink) {
    const section = document.getElementById('invite-qr-section');
    const target = document.getElementById('invite-qr');
    if (!section || !target) return;
    target.innerHTML = '';
    section.classList.remove('hidden');
    this.inviteLink = inviteLink;
    let rendered = false;
    if (typeof QRCode !== 'undefined') {
      try {
        new QRCode(target, { text: inviteLink, width: 160, height: 160, colorDark: '#111827', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : undefined });
        rendered = !!target.querySelector('canvas, img');
      } catch (_) { rendered = false; }
    }
    if (!rendered) {
      target.innerHTML = '';
      const img = document.createElement('img');
      img.alt = '房间邀请二维码';
      img.width = 160; img.height = 160;
      img.style.cssText = 'width:160px;height:160px;object-fit:contain;background:#fff;margin:0 auto;display:block';
      img.referrerPolicy = 'no-referrer';
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=' + encodeURIComponent(inviteLink);
      img.onerror = () => {
        target.innerHTML = '<div style="max-width:260px;margin:auto;padding:10px;color:#334155;font-size:12px;line-height:1.5">二维码服务暂时不可用。请使用下方“复制邀请链接”，或复制房间号手动加入。</div>';
      };
      target.appendChild(img);
    }
  },

  copyInviteLink() {
    if (!this.inviteLink) return;
    this.copyTextSafe(this.inviteLink, '邀请链接已复制');
  },

  copyRoomCodeOnly() {
    if (!this.roomCode) return;
    this.copyTextSafe(this.roomCode, `房间号 ${this.roomCode} 已复制`);
  },

  updateOnlineStatusUI(message, connected = false) {
    this.isOnlineConnected = Boolean(connected);
    const statusText = document.getElementById('online-status-text');
    if (statusText) statusText.textContent = message;
    const dot = document.getElementById('online-status-dot');
    if (dot) dot.className = `w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`;
    const label = document.getElementById('online-btn-label');
    if (label) label.textContent = connected ? '联机中' : '联机';
    document.getElementById('btn-disconnect-p2p')?.classList.toggle('hidden', !this.peer && !this.conn);

    const inRoom = this.isOnlineInRoom();
    document.getElementById('btn-offer-draw')?.classList.toggle('hidden', !inRoom);
    document.getElementById('btn-resign')?.classList.toggle('hidden', !inRoom);

    this.updateRestartButtonLabel();
  },

  createOnlineRoom() {
    if (typeof Peer === 'undefined') {
      this.updateOnlineStatusUI('联机组件加载失败，请刷新页面后重试', false);
      return;
    }
    this.disconnectOnline(true);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.roomCode = code;
    this.isRoomHost = true;
    this.isOnlineConnected = false;
    const selectedSide = document.querySelector('input[name="room-side"]:checked')?.value || 'red';
    this.onlineRole = selectedSide === 'black' ? BLACK : RED;
    const codeEl = document.getElementById('my-room-code');
    if (codeEl) codeEl.textContent = code;
    this.updateOnlineStatusUI('正在创建房间…', false);
    this.updateRestartButtonLabel();
    try {
      this.peer = new Peer(`xq3d-room-${code}`, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.relay.metered.ca:80' },
            { urls: 'turn:global.relay.metered.ca:80', username: '27751b623aee80f0bb21e94f', credential: 'Wt12ytaTNfCYW92L' },
            { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '27751b623aee80f0bb21e94f', credential: 'Wt12ytaTNfCYW92L' },
            { urls: 'turn:global.relay.metered.ca:443', username: '27751b623aee80f0bb21e94f', credential: 'Wt12ytaTNfCYW92L' },
            { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '27751b623aee80f0bb21e94f', credential: 'Wt12ytaTNfCYW92L' }
          ]
        }
      });
      this.peer.on('open', () => {
        const inviteUrl = new URL(window.location.href);
        inviteUrl.searchParams.delete('replay');
        inviteUrl.searchParams.set('room', code);
        this.inviteLink = inviteUrl.toString();
        this.renderInviteQRCode(this.inviteLink);
        this.updateOnlineStatusUI(`房间 ${code} 已创建，等待好友加入`, false);
      });
      this.peer.on('connection', conn => {
        this.conn = conn;
        this.setupPeerConnection();
      });
      this.peer.on('error', err => {
        const messages = {
          'unavailable-id': '房间号冲突，请重新创建房间',
          'peer-unavailable': '找不到该房间，请确认房间号仍有效',
          'network': '联机服务器连接失败，请检查网络或稍后重试',
          'server-error': '联机服务器暂时不可用，请稍后重试',
          'socket-error': '联机信令连接失败，可能被网络或浏览器拦截',
          'socket-closed': '联机信令连接已关闭，请重新创建房间'
        };
        this.updateOnlineStatusUI(messages[err?.type] || `创建房间失败：${err?.type || '未知错误'}`, false);
      });
    } catch (err) {
      this.updateOnlineStatusUI('创建房间失败，请刷新页面后重试', false);
    }
  },

  joinOnlineRoomFromInput() {
    const code = (document.getElementById('join-room-input')?.value || '').trim().toUpperCase();
    if (code) this.joinOnlineRoom(code);
  },

  joinOnlineRoom(code) {
    if (typeof Peer === 'undefined') return;
    this.disconnectOnline(true);
    this.roomCode = code;
    this.isRoomHost = false;
    this.isOnlineConnected = false;
    this.onlineRole = BLACK;
    const roomEl = document.getElementById('my-room-code');
    if (roomEl) roomEl.textContent = code;
    this.toggleOnlineModal(false);
    this.setGameMode('pvp');
    this.desiredSpherical.theta = Math.PI;
    this.updatePiecesOrientation();
    this.updateRestartButtonLabel();

    try {
      this.peer = new Peer(undefined, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.relay.metered.ca:80' },
            { urls: 'turn:global.relay.metered.ca:80', username: '27751b623aee80f0bb21e94f', credential: 'Wt12ytaTNfCYW92L' },
            { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '27751b623aee80f0bb21e94f', credential: 'Wt12ytaTNfCYW92L' },
            { urls: 'turn:global.relay.metered.ca:443', username: '27751b623aee80f0bb21e94f', credential: 'Wt12ytaTNfCYW92L' },
            { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '27751b623aee80f0bb21e94f', credential: 'Wt12ytaTNfCYW92L' }
          ]
        }
      });
      this.peer.on('open', () => {
        this.updateOnlineStatusUI(`正在连接房间 ${code}…`, false);
        this.conn = this.peer.connect(`xq3d-room-${code}`, { reliable: true, serialization: 'json' });
        this.setupPeerConnection();
      });
      this.peer.on('error', err => {
        const messages = {
          'peer-unavailable': '房间不存在或创建者已离线，请让好友重新创建房间',
          'network': '联机服务器连接失败，请检查网络后重试',
          'server-error': '联机服务器暂时不可用，请稍后重试',
          'socket-error': '联机信令连接失败，可能被网络或浏览器拦截',
          'socket-closed': '联机信令连接已关闭，请重新加入'
        };
        this.updateOnlineStatusUI(messages[err?.type] || `加入房间失败：${err?.type || '未知错误'}`, false);
      });
    } catch (err) {
      this.updateOnlineStatusUI('加入房间失败，请检查房间号并重试', false);
    }
  },

  setupPeerConnection() {
    if (!this.conn) return;
    this.conn.on('open', () => {
      this.isOnlineConnected = true;
      this.setGameMode('pvp');
      this.updateOnlineStatusUI(`已连入房间 ${this.roomCode}（${this.onlineRole === RED ? '红方' : '黑方'}）`, true);
      this.toggleOnlineModal(false);

      if (this.isRoomHost) {
        this.conn.send({
          type: 'host_init',
          hostRole: this.onlineRole === RED ? 'red' : 'black',
          fen: this.exportBoardToFEN(),
          isCustomEndgame: Boolean(this.customEndgameSnapshot)
        });
      } else {
        this.conn.send({ type: 'guest_ready' });
      }
      this.updateRestartButtonLabel();
      this.updateUI(this.engine.isInCheck(this.engine.turn));
    });
    this.conn.on('error', err => {
      this.updateOnlineStatusUI(`连接异常：${err?.type || '请重新连接'}`, false);
    });
    this.conn.on('close', () => {
      this.isOnlineConnected = false;
      this.updateOnlineStatusUI('好友连接已断开', false);
      this.updateUI(this.engine.isInCheck(this.engine.turn));
    });
    this.conn.on('data', data => {
      if (!data?.type) return;
      this.isOnlineConnected = true;

      if (data.type === 'guest_ready' && this.isRoomHost) {
        this.updateOnlineStatusUI(`已连入房间 ${this.roomCode}（${this.onlineRole === RED ? '红方' : '黑方'}）`, true);
        if (this.conn?.open) {
          this.conn.send({
            type: 'host_init',
            hostRole: this.onlineRole === RED ? 'red' : 'black',
            fen: this.exportBoardToFEN(),
            isCustomEndgame: Boolean(this.customEndgameSnapshot)
          });
        }
        this.updateRestartButtonLabel();
        this.updateUI(this.engine.isInCheck(this.engine.turn));
      } else if (data.type === 'host_init' && !this.isRoomHost) {
        this.onlineRole = data.hostRole === 'red' ? BLACK : RED;
        this.desiredSpherical.theta = this.onlineRole === BLACK ? Math.PI : 0;
        if (data.fen) {
          this.loadBoardFromFEN(data.fen, {
            isOnlineSync: true,
            isCustomEndgame: Boolean(data.isCustomEndgame)
          });
        }
        this.setGameMode('pvp');
        this.updatePiecesOrientation();
        this.updateOnlineStatusUI(`已连入房间 ${this.roomCode}（${this.onlineRole === RED ? '红方' : '黑方'}）`, true);
        this.updateRestartButtonLabel();
        this.updateUI(this.engine.isInCheck(this.engine.turn));
      } else if (data.type === 'role_info') {
        if (!this.isRoomHost && data.role) {
          this.onlineRole = data.role === 'red' ? BLACK : RED;
        }
        this.desiredSpherical.theta = this.onlineRole === BLACK ? Math.PI : 0;
        this.updatePiecesOrientation();
        this.updateOnlineStatusUI(`已连入房间 ${this.roomCode}（${this.onlineRole === RED ? '红方' : '黑方'}）`, true);
        this.updateRestartButtonLabel();
        this.updateUI(this.engine.isInCheck(this.engine.turn));
      } else if (data.type === 'draw_request') {
        this.hideAllActionModals();
        this.sfx.playSelect();
        document.getElementById('draw-request-modal')?.classList.remove('hidden');
      } else if (data.type === 'draw_accept') {
        this.finishGameByDraw('对方同意求和 · 握手言和');
      } else if (data.type === 'draw_reject') {
        this.pendingDrawRequest = false;
        clearTimeout(this.drawRequestTimeout);
        this.showCenterCallout('对方婉拒求和', this.onlineRole || RED);
      } else if (data.type === 'resign') {
        const resignedSide = data.side === 'red' ? RED : BLACK;
        this.finishGameByResign(resignedSide, false);
      } else if (data.type === 'rematch_request' || data.type === 'online_play_again') {
        this.incomingRematchIsPlayAgain = Boolean(data.isPlayAgain || data.type === 'online_play_again' || this.gameOver);
        const titleEl = document.getElementById('rematch-modal-title');
        const descEl = document.getElementById('rematch-modal-desc');
        const acceptBtn = document.getElementById('rematch-accept-btn');
        if (this.incomingRematchIsPlayAgain) {
          if (titleEl) titleEl.textContent = '对方请求再来一局';
          if (descEl) descEl.textContent = '对方邀请再来一局并重置棋盘，是否同意？';
          if (acceptBtn) acceptBtn.textContent = '同意再来一局';
        } else {
          if (titleEl) titleEl.textContent = '对方请求重新对局';
          if (descEl) descEl.textContent = '对方申请重置棋盘重新对局，是否同意？';
          if (acceptBtn) acceptBtn.textContent = '同意重开';
        }
        this.hideAllActionModals();
        this.sfx.playSelect();
        document.getElementById('rematch-request-modal')?.classList.remove('hidden');
      } else if (data.type === 'rematch_accept') {
        const label = (data.isPlayAgain || this.lastRematchWasPlayAgain) ? '再来一局' : '重新对局';
        this.resetOnlineGameBoard();
        this.showCenterCallout(`对方同意${label} · 棋盘重置`, this.onlineRole || RED);
      } else if (data.type === 'rematch_reject') {
        const label = (data.isPlayAgain || this.lastRematchWasPlayAgain) ? '再来一局' : '重新对局';
        this.pendingRematchRequest = false;
        clearTimeout(this.rematchRequestTimeout);
        this.showCenterCallout(`对方拒绝了${label}`, this.onlineRole || RED);
      } else if (data.type === 'request_sync' && this.isRoomHost && this.conn?.open) {
        this.conn.send({
          type: 'sync_board',
          fen: this.exportBoardToFEN(),
          isCustomEndgame: Boolean(this.customEndgameSnapshot)
        });
      } else if (data.type === 'sync_board' && data.fen) {
        this.loadBoardFromFEN(data.fen, {
          isOnlineSync: true,
          isCustomEndgame: Boolean(data.isCustomEndgame)
        });
        this.setGameMode('pvp');
        this.updatePiecesOrientation();
        this.updateRestartButtonLabel();
        this.updateUI(this.engine.isInCheck(this.engine.turn));
      } else if (data.type === 'undo_request') {
        if (this.engine.history.length > 0 && !this.isBusy) {
          this.hideAllActionModals();
          this.sfx.playSelect();
          document.getElementById('undo-request-modal')?.classList.remove('hidden');
        } else if (this.conn?.open) {
          this.conn.send({ type: 'undo_reject', reason: '当前无法悔棋' });
        }
      } else if (data.type === 'undo_accept') {
        this.pendingUndoRequest = false;
        clearTimeout(this.undoRequestTimeout);
        this.undoMove(true);
        this.showCenterCallout('对方已同意悔棋', this.onlineRole || RED);
      } else if (data.type === 'undo_reject') {
        this.pendingUndoRequest = false;
        clearTimeout(this.undoRequestTimeout);
        this.showCenterCallout('对方拒绝悔棋', this.onlineRole || RED);
        this.updateUI(this.engine.isInCheck(this.engine.turn));
      } else if (data.type === 'move' && data.move) {
        if (data.revealedType) {
          const mp = this.engine.board[data.move.fr]?.[data.move.fc];
          if (mp && mp.isHidden) {
            mp.realType = data.revealedType;
            mp.realChar = PIECE_CHARS[mp.color]?.[data.revealedType] || mp.char;
          }
        }
        this.executeMoveAnimated(data.move, null, true);
      }
    });
  },

  disconnectOnline(silent = false) {
    try { this.conn?.close(); } catch (_) { }
    try { this.peer?.destroy(); } catch (_) { }
    this.conn = null;
    this.peer = null;
    this.onlineRole = null;
    this.isRoomHost = false;
    this.isOnlineConnected = false;
    this.roomCode = null;
    this.pendingRematchRequest = false;
    this.pendingDrawRequest = false;
    this.pendingUndoRequest = false;
    this.hideAllActionModals();
    document.getElementById('btn-offer-draw')?.classList.add('hidden');
    document.getElementById('btn-resign')?.classList.add('hidden');
    if (!silent) {
      this.desiredSpherical.theta = 0;
      this.updateOnlineStatusUI('已断开联机', false);
      this.updateRestartButtonLabel();
      this.updateUI(this.engine.isInCheck(this.engine.turn));
    }
  }
});
