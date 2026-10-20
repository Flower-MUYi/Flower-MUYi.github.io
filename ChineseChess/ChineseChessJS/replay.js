/*************************************************************************
 * TREASURE BOX REPLAY ("复盘") SYSTEM MODULE
 * Extends Xiangqi3DApp.prototype
 *
 * Implements:
 *   1. Step-by-step demonstration from initial standard game up to draw, resign, or checkmate
 *   2. Step-by-step demonstration from custom-arranged endgame or shared endgame up to checkmate
 *   3. Automatic clearing of replay records when a new game or endgame begins
 *   4. Sharing replay with others: uses the modified share modal, and displays the FINAL board (最终棋盘)
 *      with ultra-compact binary move encoding so QR codes never overflow.
 *************************************************************************/

function encodeMovesToBase64Url(moves) {
  const bytes = new Uint8Array(moves.length * 2);
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    bytes[i * 2] = m.fr * 9 + m.fc;
    bytes[i * 2 + 1] = m.tr * 9 + m.tc;
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeMovesFromBase64Url(b64Url) {
  let b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const bin = atob(b64);
  const moves = [];
  for (let i = 0; i + 1 < bin.length; i += 2) {
    const fromSq = bin.charCodeAt(i);
    const toSq = bin.charCodeAt(i + 1);
    moves.push({
      fr: Math.floor(fromSq / 9),
      fc: fromSq % 9,
      tr: Math.floor(toSq / 9),
      tc: toSq % 9
    });
  }
  return moves;
}

Object.assign(Xiangqi3DApp.prototype, {
  /**
   * 初始化/清空复盘会话（在每次新对局或新残局开始时调用）
   */
  initReplaySession(initialBoard = this.engine.board, initialTurn = this.engine.turn, sourceType = 'standard') {
    if (this.replayMode) {
      this.stopReplayAutoPlay();
      this.replayMode = false;
      document.getElementById('replay-panel')?.classList.add('hidden');
    }
    this.replayInitialFEN = this.exportBoardToFEN(initialBoard, initialTurn);
    this.replaySourceType = sourceType; // 'standard' | 'endgame'
    this.replayMoves = [];
    this.replayOutcome = null;
    this.replayStepIndex = 0;
    this.replaySnapshots = [
      {
        fen: this.replayInitialFEN,
        notation: '初始盘面',
        moverColor: null,
        move: null,
        capturedRed: [],
        capturedBlack: [],
        inCheck: this.engine.isInCheck(initialTurn, initialBoard)
      }
    ];
  },

  /**
   * 每走一步棋时，记录该步到复盘序列
   */
  recordReplayStep(move, notation, moverColor, actionTag) {
    if (this.replayMode) return;
    if (!this.replaySnapshots || this.replaySnapshots.length === 0) {
      this.initReplaySession(this.engine.board, this.engine.turn);
    }
    const fenAfter = this.exportBoardToFEN(this.engine.board, this.engine.turn);
    const stepRecord = {
      fr: move.fr,
      fc: move.fc,
      tr: move.tr,
      tc: move.tc,
      notation: notation || '着法',
      moverColor,
      actionType: actionTag?.type || 'xian',
      fenAfter,
      capturedRed: this.engine.capturedRed.map(p => ({ ...p })),
      capturedBlack: this.engine.capturedBlack.map(p => ({ ...p })),
      inCheck: this.engine.isInCheck(this.engine.turn, this.engine.board)
    };
    this.replayMoves.push(stepRecord);
    this.replaySnapshots.push({
      fen: fenAfter,
      notation: stepRecord.notation,
      moverColor,
      move: { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc },
      capturedRed: stepRecord.capturedRed,
      capturedBlack: stepRecord.capturedBlack,
      inCheck: stepRecord.inCheck
    });
  },

  /**
   * 悔棋时同步弹出复盘的最后一步
   */
  popReplayStep() {
    if (this.replayMoves && this.replayMoves.length > 0) {
      this.replayMoves.pop();
    }
    if (this.replaySnapshots && this.replaySnapshots.length > 1) {
      this.replaySnapshots.pop();
    }
    this.replayOutcome = null;
  },

  /**
   * 记录终局结果（绝杀、困毙、求和、认输、循环判负）
   */
  recordReplayOutcome(winnerColor, titleText) {
    this.replayOutcome = {
      winnerColor,
      title: titleText || '终局',
      finalFEN: this.exportBoardToFEN(this.engine.board, this.engine.turn)
    };
  },

  /**
   * 打开百宝箱中的“复盘”面板
   */
  openReplayPanel() {
    if (this.endgameEditor) {
      this.showCenterCallout('请先退出残局工坊再打开复盘', RED);
      return;
    }
    if (!this.replayMoves || this.replayMoves.length === 0) {
      this.showIllegalMovePrompt({
        icon: 'history_edu',
        title: '暂无可复盘着法',
        message: '当前对局或残局尚未走棋，请在对局走棋或终局后再打开复盘。'
      }, 2400);
      return;
    }

    this.sfx.playSelect();
    this.closeModalOnly();
    this.hideAllActionModals?.();
    this.clearLegalMoveIndicators();
    this.clearCheckmateVFX();
    this.clearCheckmateHighlights();
    this.selectedSquare = null;

    if (!this.replayMode) {
      this.savedLiveStateBeforeReplay = {
        fen: this.exportBoardToFEN(this.engine.board, this.engine.turn),
        capturedRed: this.engine.capturedRed.map(p => ({ ...p })),
        capturedBlack: this.engine.capturedBlack.map(p => ({ ...p })),
        gameOver: this.gameOver,
        endgameReasonText: this.endgameReasonText,
        lastFromPos: this.lastFromRing?.visible ? this.lastFromRing.position.clone() : null,
        lastToPos: this.lastToRing?.visible ? this.lastToRing.position.clone() : null
      };
    }

    this.replayMode = true;
    document.getElementById('replay-panel')?.classList.remove('hidden');

    this.applyReplaySnapshotAt(0, false);
  },

  /**
   * 退出复盘模式，恢复终局/当前盘面
   */
  exitReplayMode(restoreBoard = true) {
    this.stopReplayAutoPlay();
    this.replayMode = false;
    document.getElementById('replay-panel')?.classList.add('hidden');

    if (restoreBoard && this.savedLiveStateBeforeReplay) {
      const parsed = this.parseFENToBoard(this.savedLiveStateBeforeReplay.fen);
      if (parsed) {
        this.engine.board = parsed.board;
        this.engine.turn = parsed.turn;
      }
      this.engine.capturedRed = this.savedLiveStateBeforeReplay.capturedRed || [];
      this.engine.capturedBlack = this.savedLiveStateBeforeReplay.capturedBlack || [];
      this.gameOver = this.savedLiveStateBeforeReplay.gameOver;
      this.endgameReasonText = this.savedLiveStateBeforeReplay.endgameReasonText || null;
      this.syncPiecesFromEngine();
      if (this.savedLiveStateBeforeReplay.lastFromPos && this.lastFromRing) {
        this.lastFromRing.position.copy(this.savedLiveStateBeforeReplay.lastFromPos);
        this.lastFromRing.visible = true;
      }
      if (this.savedLiveStateBeforeReplay.lastToPos && this.lastToRing) {
        this.lastToRing.position.copy(this.savedLiveStateBeforeReplay.lastToPos);
        this.lastToRing.visible = true;
      }
      this.updateRestartButtonLabel();
      this.updateUI(this.engine.isInCheck(this.engine.turn));
    }
    this.savedLiveStateBeforeReplay = null;
  },

  /**
   * 渲染指定步数的棋盘状态（支持静态跳转或单步动画演示）
   */
  applyReplaySnapshotAt(stepIndex, animateMove = false, onAnimDone = null) {
    if (!this.replaySnapshots || this.replaySnapshots.length === 0) return;
    const totalSteps = this.replaySnapshots.length - 1;
    const targetIdx = Math.max(0, Math.min(totalSteps, stepIndex));

    const prevIdx = this.replayStepIndex;
    this.replayStepIndex = targetIdx;
    const snap = this.replaySnapshots[targetIdx];

    if (animateMove && targetIdx === prevIdx + 1 && snap.move) {
      const prevSnap = this.replaySnapshots[prevIdx];
      const prevParsed = this.parseFENToBoard(prevSnap.fen);
      if (prevParsed) {
        this.engine.board = prevParsed.board;
        this.engine.turn = prevParsed.turn;
        this.syncPiecesFromEngine();
      }
      const m = snap.move;
      const movingPiece = this.engine.board[m.fr]?.[m.fc];
      const targetPiece = this.engine.board[m.tr]?.[m.tc];
      const movingMesh = movingPiece ? this.pieceMeshes.get(movingPiece.id) : null;
      const targetMesh = targetPiece ? this.pieceMeshes.get(targetPiece.id) : null;

      if (movingMesh) {
        const startPos = gridToWorld(m.fr, m.fc);
        const endPos = gridToWorld(m.tr, m.tc);
        const isCapture = Boolean(targetPiece);

        this.lastFromRing.position.set(startPos.x, 0.015, startPos.z);
        this.lastFromRing.visible = true;
        this.lastToRing.position.set(endPos.x, 0.015, endPos.z);
        this.lastToRing.visible = true;

        this.activeAnimations = [];
        this.activeAnimations.push({
          mesh: movingMesh,
          elapsed: 0,
          duration: isCapture ? 0.42 : 0.3,
          update: (t) => {
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            movingMesh.position.x = THREE.MathUtils.lerp(startPos.x, endPos.x, ease);
            movingMesh.position.z = THREE.MathUtils.lerp(startPos.z, endPos.z, ease);
            movingMesh.position.y = Math.sin(ease * Math.PI) * 0.75;
          },
          complete: () => {
            const curParsed = this.parseFENToBoard(snap.fen);
            if (curParsed) {
              this.engine.board = curParsed.board;
              this.engine.turn = curParsed.turn;
            }
            this.engine.capturedRed = snap.capturedRed || [];
            this.engine.capturedBlack = snap.capturedBlack || [];
            if (isCapture && targetMesh) {
              this.spawnShatterFragments(endPos.x, endPos.z, targetPiece.color);
              this.sfx.playAttackShatter();
            } else if (movingPiece) {
              this.sfx.playMove(movingPiece.color, movingPiece.type);
            }
            this.syncPiecesFromEngine();
            this.updateReplayPanelUI();
            this.updateUI(snap.inCheck);

            if (targetIdx === totalSteps && this.replayOutcome) {
              this.showCenterCallout(`复盘终局 · ${this.replayOutcome.title}`, this.replayOutcome.winnerColor === BLACK ? BLACK : RED);
            } else if (snap.inCheck) {
              this.sfx.playCheck();
            }
            if (onAnimDone) onAnimDone();
          }
        });
        this.updateReplayPanelUI();
        return;
      }
    }

    this.activeAnimations = [];
    const parsed = this.parseFENToBoard(snap.fen);
    if (parsed) {
      this.engine.board = parsed.board;
      this.engine.turn = parsed.turn;
    }
    this.engine.capturedRed = snap.capturedRed || [];
    this.engine.capturedBlack = snap.capturedBlack || [];
    this.syncPiecesFromEngine();

    if (snap.move) {
      const startPos = gridToWorld(snap.move.fr, snap.move.fc);
      const endPos = gridToWorld(snap.move.tr, snap.move.tc);
      this.lastFromRing.position.set(startPos.x, 0.015, startPos.z);
      this.lastFromRing.visible = true;
      this.lastToRing.position.set(endPos.x, 0.015, endPos.z);
      this.lastToRing.visible = true;
    } else {
      if (this.lastFromRing) this.lastFromRing.visible = false;
      if (this.lastToRing) this.lastToRing.visible = false;
    }

    this.updateReplayPanelUI();
    this.updateUI(snap.inCheck);
    if (onAnimDone) onAnimDone();
  },

  updateReplayPanelUI() {
    const totalSteps = Math.max(0, (this.replaySnapshots?.length || 1) - 1);
    const cur = this.replayStepIndex || 0;
    const snap = this.replaySnapshots?.[cur];

    const stepBadge = document.getElementById('replay-step-badge');
    if (stepBadge) {
      const sourceLabel = this.replaySourceType === 'endgame' ? '残局起点' : '初始棋局';
      if (cur === 0) {
        stepBadge.textContent = `第 0 / ${totalSteps} 步 · ${sourceLabel}`;
      } else if (cur === totalSteps && this.replayOutcome) {
        stepBadge.textContent = `第 ${cur} / ${totalSteps} 步 · 【${snap?.notation || ''}】(${this.replayOutcome.title})`;
      } else {
        const sideText = snap?.moverColor === RED ? '红' : '黑';
        stepBadge.textContent = `第 ${cur} / ${totalSteps} 步 · ${sideText}：${snap?.notation || ''}`;
      }
    }

    const playBtnText = document.getElementById('replay-autoplay-label');
    const playBtnIcon = document.getElementById('replay-autoplay-icon');
    if (playBtnText) playBtnText.textContent = this.replayAutoTimer ? '暂停' : '自动演示';
    if (playBtnIcon) playBtnIcon.textContent = this.replayAutoTimer ? 'pause' : 'play_arrow';

    const listEl = document.getElementById('replay-moves-list');
    if (listEl && this.replaySnapshots) {
      listEl.innerHTML = this.replaySnapshots.map((s, idx) => {
        const isActive = idx === cur;
        if (idx === 0) {
          return `<button onclick="window.gameApp.jumpToReplayStep(0)" class="replay-step-pill ${isActive ? 'active' : ''} px-2 py-1 rounded-lg text-[11px] font-bold border border-amber-200 bg-white text-slate-700 shrink-0">0. 起点</button>`;
        }
        const dotColor = s.moverColor === RED ? 'text-red-700' : 'text-slate-800';
        return `<button onclick="window.gameApp.jumpToReplayStep(${idx})" class="replay-step-pill ${isActive ? 'active' : ''} px-2 py-1 rounded-lg text-[11px] font-bold border border-amber-200 bg-white ${dotColor} shrink-0">${idx}. ${s.notation}</button>`;
      }).join('');

      const activeBtn = listEl.children[cur];
      if (activeBtn && activeBtn.scrollIntoView) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  },

  jumpToReplayStep(idx) {
    this.stopReplayAutoPlay();
    this.sfx.playSelect();
    this.applyReplaySnapshotAt(idx, false);
  },

  replayFirstStep() {
    this.stopReplayAutoPlay();
    this.sfx.playSelect();
    this.applyReplaySnapshotAt(0, false);
  },

  replayPrevStep() {
    this.stopReplayAutoPlay();
    if (this.replayStepIndex <= 0) return;
    this.sfx.playSelect();
    this.applyReplaySnapshotAt(this.replayStepIndex - 1, false);
  },

  replayNextStep() {
    this.stopReplayAutoPlay();
    const total = (this.replaySnapshots?.length || 1) - 1;
    if (this.replayStepIndex >= total) return;
    this.applyReplaySnapshotAt(this.replayStepIndex + 1, true);
  },

  replayLastStep() {
    this.stopReplayAutoPlay();
    this.sfx.playSelect();
    const total = (this.replaySnapshots?.length || 1) - 1;
    this.applyReplaySnapshotAt(total, false);
  },

  toggleReplayAutoPlay() {
    if (this.replayAutoTimer) {
      this.stopReplayAutoPlay();
      this.sfx.playSelect();
      return;
    }
    const total = (this.replaySnapshots?.length || 1) - 1;
    if (total <= 0) return;
    this.sfx.playSelect();
    if (this.replayStepIndex >= total) {
      this.applyReplaySnapshotAt(0, false);
    }

    const stepLoop = () => {
      if (!this.replayMode) {
        this.stopReplayAutoPlay();
        return;
      }
      const maxStep = (this.replaySnapshots?.length || 1) - 1;
      if (this.replayStepIndex >= maxStep) {
        this.stopReplayAutoPlay();
        return;
      }
      this.applyReplaySnapshotAt(this.replayStepIndex + 1, true, () => {
        if (!this.replayAutoTimer) return;
        const nextMax = (this.replaySnapshots?.length || 1) - 1;
        if (this.replayStepIndex >= nextMax) {
          this.stopReplayAutoPlay();
        } else {
          this.replayAutoTimer = setTimeout(stepLoop, 720);
        }
      });
    };

    this.replayAutoTimer = setTimeout(stepLoop, 280);
    this.updateReplayPanelUI();
  },

  stopReplayAutoPlay() {
    if (this.replayAutoTimer) {
      clearTimeout(this.replayAutoTimer);
      this.replayAutoTimer = null;
    }
    if (this.replayMode) this.updateReplayPanelUI();
  },

  /**
   * 分享复盘：
   * 界面与修改后的残局分享一致（无右上角古谱挑战印章），且海报上的棋盘固定显示【最终棋盘】！
   */
  shareReplay() {
    if (!this.replaySnapshots || this.replaySnapshots.length <= 1) {
      this.showCenterCallout('尚无复盘记录可分享', RED);
      return;
    }
    this.stopReplayAutoPlay();
    this.sfx.playSelect();

    const finalSnap = this.replaySnapshots[this.replaySnapshots.length - 1];
    const finalParsed = this.parseFENToBoard(finalSnap.fen);
    const finalBoard = finalParsed ? finalParsed.board : this.engine.board;
    const finalTurn = finalParsed ? finalParsed.turn : this.engine.turn;

    // 使用二进制紧凑编码复盘步数，确保长对局二维码也绝不溢出
    const b64Moves = encodeMovesToBase64Url(this.replayMoves);
    const isStandard = this.replayInitialFEN === STANDARD_START_FEN;
    const wCode = this.replayOutcome?.winnerColor === BLACK ? 'b' : (this.replayOutcome?.winnerColor === 'draw' ? 'd' : 'r');
    const encodedReplay = isStandard
      ? `v2.${wCode}.${b64Moves}`
      : `v2e.${wCode}.${encodeURIComponent(this.replayInitialFEN)}.${b64Moves}`;

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('fen');
    url.searchParams.delete('mode');
    url.searchParams.set('replay', encodedReplay);
    this.currentShareUrl = url.toString();
    this.currentShareKind = 'replay';

    const outcomeTitle = this.replayOutcome?.title || `共 ${this.replayMoves.length} 步终局`;
    const modalTitle = document.getElementById('share-modal-title');
    const modalSub = document.getElementById('share-modal-subtitle');
    const modalBadge = document.getElementById('share-modal-badge');
    if (modalTitle) modalTitle.textContent = '棋局复盘 · 终局分享';
    if (modalSub) modalSub.textContent = '海报展示最终棋盘 · 扫码或点链接可回看完整复盘';
    if (modalBadge) modalBadge.textContent = '谱';

    const totalPlies = this.replayMoves.length;
    const badgeLabel = `● ${outcomeTitle} · 共 ${totalPlies} 步`;
    const badgeColor = this.replayOutcome?.winnerColor === BLACK ? '#1e293b' : '#991b1b';

    // 渲染最终棋盘 (finalBoard) 到分享海报上（无右上角印章）
    this.renderEndgamePoster(finalBoard, finalTurn, this.currentShareUrl, {
      posterTitle: '中国象棋 · 棋局复盘',
      badgeText: badgeLabel,
      badgeColor,
      footerHeadline: '扫码回看全局复盘 · 步步精妙',
      footerSub: '长按识别二维码，或使用游戏内「扫码识局」演示每一步棋'
    });

    document.getElementById('share-endgame-modal')?.classList.remove('hidden');
  },

  /**
   * 解析他人分享的复盘参数并构建完整复盘序列（兼容 v2 紧凑格式与旧版 JSON 格式）
   */
  loadSharedReplayFromParam(encodedReplay) {
    try {
      let initFen = STANDARD_START_FEN;
      let movesList = [];
      let winnerColor = RED;
      let outcomeTitle = '';

      if (encodedReplay.startsWith('v2.') || encodedReplay.startsWith('v2e.')) {
        const parts = encodedReplay.split('.');
        const isEndgame = parts[0] === 'v2e';
        const wCode = parts[1];
        winnerColor = wCode === 'b' ? BLACK : (wCode === 'd' ? 'draw' : RED);
        if (isEndgame) {
          initFen = decodeURIComponent(parts[2] || '') || STANDARD_START_FEN;
          movesList = decodeMovesFromBase64Url(parts[3] || '');
        } else {
          initFen = STANDARD_START_FEN;
          movesList = decodeMovesFromBase64Url(parts[2] || '');
        }
        outcomeTitle = winnerColor === 'draw' ? '双方和局' : (winnerColor === BLACK ? '黑方获胜' : '红方获胜');
      } else {
        const jsonStr = decodeURIComponent(atob(encodedReplay));
        const data = JSON.parse(jsonStr);
        if (!data || typeof data.m !== 'string') return false;
        initFen = (!data.i || data.i === 'start') ? STANDARD_START_FEN : data.i;
        winnerColor = data.w || RED;
        outcomeTitle = data.t || '';
        const movesStr = data.m;
        for (let i = 0; i + 3 < movesStr.length; i += 4) {
          movesList.push({
            fr: Number(movesStr[i]),
            fc: Number(movesStr[i + 1]),
            tr: Number(movesStr[i + 2]),
            tc: Number(movesStr[i + 3])
          });
        }
      }

      const isCustom = initFen !== STANDARD_START_FEN;
      if (!this.loadBoardFromFEN(initFen, { isCustomEndgame: isCustom })) return false;

      this.initReplaySession(this.engine.board, this.engine.turn, isCustom ? 'endgame' : 'standard');

      for (const move of movesList) {
        const piece = this.engine.board[move.fr]?.[move.fc];
        if (!piece) break;
        const notation = this.formatChineseMoveNotation(move);
        const moverColor = this.engine.turn;
        const res = this.engine.makeMove(move);
        this.recordReplayStep(move, notation, moverColor, res.actionTag);
      }

      if (outcomeTitle) {
        this.recordReplayOutcome(winnerColor, outcomeTitle);
      }

      this.syncPiecesFromEngine();
      this.openReplayPanel();
      return true;
    } catch (e) {
      return false;
    }
  }
});
