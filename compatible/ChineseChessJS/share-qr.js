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
  return btoa(bin).replace(/\+/g, '-').split('/').join('_').replace(/=+$/, '');
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

  cloneBoardMatrix(board = this.engine.board) {
    return board.map(row => row.map(cell => cell ? { ...cell } : null));
  },

  cloneHistoryEntry(h) {
    if (!h) return null;
    return {
      ...h,
      move: h.move ? { ...h.move } : null,
      piece: h.piece ? { ...h.piece } : null,
      pieceAfter: h.pieceAfter ? { ...h.pieceAfter } : null,
      captured: h.captured ? { ...h.captured } : null,
      actionTag: h.actionTag ? { ...h.actionTag, chasedTargetIds: [...(h.actionTag.chasedTargetIds || [])] } : null
    };
  },

  cloneHistoryStack(history = this.engine.history) {
    return (history || []).map(h => this.cloneHistoryEntry(h));
  },

  cloneReplayStepSnapshot(snap) {
    if (!snap) return null;
    return {
      ...snap,
      board: snap.board ? this.cloneBoardMatrix(snap.board) : null,
      history: snap.history ? snap.history.slice() : [],
      move: snap.move ? { ...snap.move } : null,
      capturedRed: (snap.capturedRed || []).map(p => ({ ...p })),
      capturedBlack: (snap.capturedBlack || []).map(p => ({ ...p }))
    };
  },

  setReplayPanelCollapsed(collapsed) {
    this.replayPanelCollapsed = Boolean(collapsed);
    const bodyEl = document.getElementById('replay-panel-body');
    const btnEl = document.getElementById('replay-collapse-btn');
    const headerEl = document.getElementById('replay-panel-header');
    if (bodyEl) {
      bodyEl.classList.toggle('hidden', this.replayPanelCollapsed);
    }
    if (headerEl) {
      headerEl.classList.toggle('border-b', !this.replayPanelCollapsed);
    }
    if (btnEl) {
      btnEl.textContent = this.replayPanelCollapsed ? '展开' : '收起';
    }
  },

  toggleReplayPanelCollapse() {
    this.sfx?.playSelect?.();
    this.setReplayPanelCollapsed(!this.replayPanelCollapsed);
  },

  initReplaySession(initialBoard = this.engine.board, initialTurn = this.engine.turn, sourceType = 'standard') {
    if (this.replayMode) {
      this.stopReplayAutoPlay();
      this.replayMode = false;
      this.replayBranchActive = false;
      this.replayTrialCheckmated = false;
      this.replayHumanColor = RED;
      document.getElementById('replay-panel')?.classList.add('hidden');
    }
    this.replayInitialFEN = this.exportBoardToFEN(initialBoard, initialTurn);
    this.replaySourceType = sourceType;
    this.replayVariantMode = this.engine.variantMode || 'xiangqi';
    this.replayMoves = [];
    this.replayOutcome = null;
    this.replayStepIndex = 0;
    this.replayBranchActive = false;
    this.replayTrialCheckmated = false;
    this.replayHumanColor = RED;
    this.originalReplayData = null;
    this._lastRenderedReplayListHash = '';

    this.replaySnapshots = [
      {
        fen: this.replayInitialFEN,
        board: this.cloneBoardMatrix(initialBoard),
        turn: initialTurn,
        history: [],
        variantMode: this.replayVariantMode,
        notation: '初始盘面',
        moverColor: null,
        move: null,
        capturedRed: [],
        capturedBlack: [],
        inCheck: this.engine.isInCheck(initialTurn, initialBoard)
      }
    ];
  },

  prepareReplayBranchAtCurrentStep(humanMoverColor = null) {
    if (!this.replayMode) return;
    this.stopReplayAutoPlay();
    this.replayTrialCheckmated = false;

    const curIdx = Math.max(0, Math.min((this.replaySnapshots?.length || 1) - 1, this.replayStepIndex || 0));
    const currentSnapIsOriginal = !this.replaySnapshots?.[curIdx]?.isBranchStep;

    if (humanMoverColor) {
      this.replayHumanColor = humanMoverColor;
    } else if (!this.replayBranchActive || currentSnapIsOriginal || !this.replayHumanColor) {
      this.replayHumanColor = this.engine.turn || RED;
    }

    if (!this.originalReplayData && this.replaySnapshots) {
      this.originalReplayData = {
        snapshots: this.replaySnapshots.map(s => this.cloneReplayStepSnapshot(s)),
        moves: (this.replayMoves || []).map(m => ({
          ...m,
          capturedRed: (m.capturedRed || []).map(p => ({ ...p })),
          capturedBlack: (m.capturedBlack || []).map(p => ({ ...p }))
        })),
        outcome: this.replayOutcome ? { ...this.replayOutcome } : null,
        branchOriginIndex: curIdx
      };
    } else if (this.originalReplayData && (!this.replayBranchActive || currentSnapIsOriginal)) {
      this.originalReplayData.branchOriginIndex = curIdx;
    }

    this.replaySnapshots = this.replaySnapshots.slice(0, curIdx + 1);
    this.replayMoves = (this.replayMoves || []).slice(0, curIdx);
    this.replayStepIndex = curIdx;
    this.replayBranchActive = true;
    this.replayOutcome = null;
    this._lastRenderedReplayListHash = '';
  },

  restoreOriginalReplayLine() {
    if (!this.replayMode || !this.originalReplayData) return;
    this.stopReplayAutoPlay();
    this.sfx.playSelect();
    this.isBusy = false;
    this.aiCallback = null;
    document.getElementById('ai-thinking')?.classList.add('hidden');
    document.getElementById('ai-thinking')?.classList.remove('inline-flex');
    this.clearCheckmateVFX();
    this.clearCheckmateHighlights();
    this.clearGrandmasterHint3D?.();
    this.hideIllegalMovePrompt();
    this.replayTrialCheckmated = false;
    this.replayBranchActive = false;
    this._lastRenderedReplayListHash = '';

    const branchStep = typeof this.originalReplayData.branchOriginIndex === 'number'
      ? this.originalReplayData.branchOriginIndex
      : 0;

    this.replaySnapshots = this.originalReplayData.snapshots.map(s => this.cloneReplayStepSnapshot(s));
    this.replayMoves = this.originalReplayData.moves.map(m => ({
      ...m,
      capturedRed: (m.capturedRed || []).map(p => ({ ...p })),
      capturedBlack: (m.capturedBlack || []).map(p => ({ ...p }))
    }));
    this.replayOutcome = this.originalReplayData.outcome ? { ...this.originalReplayData.outcome } : null;

    const targetStep = Math.max(0, Math.min(branchStep, this.replaySnapshots.length - 1));
    this.applyReplaySnapshotAt(targetStep, false);
    this.showCenterCallout(`已还原原谱 · 第 ${targetStep} 步`, RED);
  },

  recordReplayStep(move, notation, moverColor, actionTag) {
    if (!this.replaySnapshots || this.replaySnapshots.length === 0) {
      this.initReplaySession(this.engine.board, this.engine.turn);
    }
    const fenAfter = this.exportBoardToFEN(this.engine.board, this.engine.turn);
    const inChk = this.engine.isInCheck(this.engine.turn, this.engine.board);
    const boardClone = this.cloneBoardMatrix(this.engine.board);
    const capRedClone = this.engine.capturedRed.map(p => ({ ...p }));
    const capBlackClone = this.engine.capturedBlack.map(p => ({ ...p }));
    const historyShallow = this.engine.history.slice();

    const stepRecord = {
      fr: move.fr,
      fc: move.fc,
      tr: move.tr,
      tc: move.tc,
      notation: notation || '着法',
      moverColor,
      actionType: actionTag?.type || 'xian',
      fenAfter,
      turn: this.engine.turn,
      variantMode: this.engine.variantMode,
      capturedRed: capRedClone,
      capturedBlack: capBlackClone,
      inCheck: inChk
    };
    this.replayMoves.push(stepRecord);
    this.replaySnapshots.push({
      fen: fenAfter,
      board: boardClone,
      turn: stepRecord.turn,
      history: historyShallow,
      variantMode: stepRecord.variantMode,
      notation: stepRecord.notation,
      moverColor,
      move: { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc },
      capturedRed: capRedClone,
      capturedBlack: capBlackClone,
      inCheck: stepRecord.inCheck,
      isBranchStep: Boolean(this.replayMode && this.replayBranchActive)
    });
    if (this.replayMode) {
      this.replayStepIndex = this.replaySnapshots.length - 1;
      this.updateReplayPanelUI();
    }
  },

  popReplayStep() {
    if (this.replayMoves && this.replayMoves.length > 0) {
      this.replayMoves.pop();
    }
    if (this.replaySnapshots && this.replaySnapshots.length > 1) {
      this.replaySnapshots.pop();
    }
    if (!this.replayMode) {
      this.replayOutcome = null;
    }
    if (this.replaySnapshots) {
      this.replayStepIndex = Math.min(this.replayStepIndex || 0, this.replaySnapshots.length - 1);
    }
    this._lastRenderedReplayListHash = '';
  },

  undoMoveInReplay() {
    if (!this.replayMode || this.isBusy) return;
    this.stopReplayAutoPlay();
    this.hideIllegalMovePrompt();
    this.hideCycleWarningBanner();
    this.clearCheckmateHighlights();
    this.clearCheckmateVFX();
    this.clearGrandmasterHint3D?.();
    this.clearLegalMoveIndicators();
    this.selectedSquare = null;

    if (!this.replaySnapshots || this.replayStepIndex <= 0) {
      this.showIllegalMovePrompt({
        icon: 'history_edu',
        title: '已处于复盘起点',
        message: '已处初始盘面，无法继续悔棋。'
      }, 2000);
      return;
    }

    this.sfx.playSelect();
    const wasTrialCheckmated = Boolean(this.replayTrialCheckmated);
    this.replayTrialCheckmated = false;

    const humanSide = this.replayHumanColor || RED;
    let stepsBack = 1;
    if (this.replayBranchActive && this.gameMode !== 'pvp' && this.engine.turn === humanSide && this.replayStepIndex >= 2) {
      const prevSnap = this.replaySnapshots[this.replayStepIndex];
      const prevPrevSnap = this.replaySnapshots[this.replayStepIndex - 1];
      if (prevSnap?.isBranchStep && prevPrevSnap?.isBranchStep) {
        stepsBack = 2;
      }
    }

    if (this.replayBranchActive) {
      const currentSnap = this.replaySnapshots[this.replayStepIndex];
      if (currentSnap?.isBranchStep) {
        for (let i = 0; i < stepsBack; i++) {
          const topSnap = this.replaySnapshots[this.replaySnapshots.length - 1];
          if (this.replaySnapshots.length > 1 && topSnap?.isBranchStep) {
            this.replaySnapshots.pop();
            this.replayMoves.pop();
          }
        }
        this._lastRenderedReplayListHash = '';
        this.applyReplaySnapshotAt(this.replaySnapshots.length - 1, false);
        if (wasTrialCheckmated) {
          this.showCenterCallout('已悔棋 · 请继续复盘推演', this.engine.turn);
        }
        return;
      }
    }

    const targetIdx = Math.max(0, this.replayStepIndex - 1);
    this.applyReplaySnapshotAt(targetIdx, false);
    if (wasTrialCheckmated) {
      this.showCenterCallout('已悔棋 · 请继续复盘推演', this.engine.turn);
    }
  },

  recordReplayOutcome(winnerColor, titleText) {
    this.replayOutcome = {
      winnerColor,
      title: titleText || '终局',
      finalFEN: this.exportBoardToFEN(this.engine.board, this.engine.turn)
    };
  },

  openReplayPanel() {
    if (this.endgameEditor) {
      this.showCenterCallout('请先退出残局工坊再打开复盘', RED);
      return;
    }
    if (!this.replayMoves || this.replayMoves.length === 0) {
      this.showIllegalMovePrompt({
        icon: 'history_edu',
        title: '暂无可复盘着法',
        message: '当前尚未落子，请走棋后再开启复盘。'
      }, 2400);
      return;
    }

    this.sfx.playSelect();
    this.closeModalOnly();
    this.hideAllActionModals?.();
    this.clearLegalMoveIndicators();
    this.clearCheckmateVFX();
    this.clearCheckmateHighlights();
    this.clearGrandmasterHint3D?.();
    this.selectedSquare = null;

    if (!this.replayMode) {
      this.savedLiveStateBeforeReplay = {
        fen: this.exportBoardToFEN(this.engine.board, this.engine.turn),
        board: this.cloneBoardMatrix(this.engine.board),
        turn: this.engine.turn,
        history: this.cloneHistoryStack(this.engine.history),
        variantMode: this.engine.variantMode,
        capturedRed: this.engine.capturedRed.map(p => ({ ...p })),
        capturedBlack: this.engine.capturedBlack.map(p => ({ ...p })),
        gameOver: this.gameOver,
        endgameReasonText: this.endgameReasonText,
        lastFromPos: this.lastFromRing?.visible ? this.lastFromRing.position.clone() : null,
        lastToPos: this.lastToRing?.visible ? this.lastToRing.position.clone() : null
      };
      this.originalReplayData = {
        snapshots: this.replaySnapshots.map(s => this.cloneReplayStepSnapshot(s)),
        moves: this.replayMoves.map(m => ({
          ...m,
          capturedRed: (m.capturedRed || []).map(p => ({ ...p })),
          capturedBlack: (m.capturedBlack || []).map(p => ({ ...p }))
        })),
        outcome: this.replayOutcome ? { ...this.replayOutcome } : null,
        branchOriginIndex: 0
      };
    }

    this.replayMode = true;
    this.replayBranchActive = false;
    this.replayTrialCheckmated = false;
    this.replayHumanColor = RED;
    this._lastRenderedReplayListHash = '';
    this.setReplayPanelCollapsed(false);
    document.getElementById('replay-panel')?.classList.remove('hidden');

    this.applyReplaySnapshotAt(0, false);
  },

  exitReplayMode(restoreBoard = true) {
    this.stopReplayAutoPlay();
    this.isBusy = false;
    this.aiCallback = null;
    document.getElementById('ai-thinking')?.classList.add('hidden');
    document.getElementById('ai-thinking')?.classList.remove('inline-flex');
    this.replayMode = false;
    this.replayBranchActive = false;
    this.replayTrialCheckmated = false;
    this._lastRenderedReplayListHash = '';
    this.clearCheckmateVFX();
    this.clearCheckmateHighlights();
    this.clearGrandmasterHint3D?.();
    this.hideIllegalMovePrompt();
    document.getElementById('replay-panel')?.classList.add('hidden');

    if (this.originalReplayData) {
      this.replaySnapshots = this.originalReplayData.snapshots.map(s => this.cloneReplayStepSnapshot(s));
      this.replayMoves = this.originalReplayData.moves.map(m => ({
        ...m,
        capturedRed: (m.capturedRed || []).map(p => ({ ...p })),
        capturedBlack: (m.capturedBlack || []).map(p => ({ ...p }))
      }));
      this.replayOutcome = this.originalReplayData.outcome ? { ...this.originalReplayData.outcome } : null;
      this.originalReplayData = null;
    }

    if (restoreBoard && this.savedLiveStateBeforeReplay) {
      if (this.savedLiveStateBeforeReplay.board) {
        this.engine.board = this.cloneBoardMatrix(this.savedLiveStateBeforeReplay.board);
        this.engine.turn = this.savedLiveStateBeforeReplay.turn;
        this.engine.history = this.cloneHistoryStack(this.savedLiveStateBeforeReplay.history || []);
        if (this.savedLiveStateBeforeReplay.variantMode) {
          this.engine.variantMode = this.savedLiveStateBeforeReplay.variantMode;
        }
      } else {
        const parsed = this.parseFENToBoard(this.savedLiveStateBeforeReplay.fen);
        if (parsed) {
          this.engine.board = parsed.board;
          this.engine.turn = parsed.turn;
        }
      }
      this.engine.capturedRed = (this.savedLiveStateBeforeReplay.capturedRed || []).map(p => ({ ...p }));
      this.engine.capturedBlack = (this.savedLiveStateBeforeReplay.capturedBlack || []).map(p => ({ ...p }));
      this.engine.invalidateTacticalCache?.();
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

  restoreSnapshotToEngine(snap) {
    if (!snap) return;
    if (snap.board) {
      this.engine.board = this.cloneBoardMatrix(snap.board);
      this.engine.turn = snap.turn || RED;
      this.engine.history = this.cloneHistoryStack(snap.history || []);
      if (snap.variantMode) {
        this.engine.variantMode = snap.variantMode;
      }
    } else if (snap.fen) {
      const parsed = this.parseFENToBoard(snap.fen);
      if (parsed) {
        this.engine.board = parsed.board;
        this.engine.turn = parsed.turn;
      }
    }
    this.engine.capturedRed = (snap.capturedRed || []).map(p => ({ ...p }));
    this.engine.capturedBlack = (snap.capturedBlack || []).map(p => ({ ...p }));
    this.engine.invalidateTacticalCache?.();
  },

  applyReplaySnapshotAt(stepIndex, animateMove = false, onAnimDone = null) {
    if (!this.replaySnapshots || this.replaySnapshots.length === 0) return;
    const totalSteps = this.replaySnapshots.length - 1;
    const targetIdx = Math.max(0, Math.min(totalSteps, stepIndex));

    const prevIdx = this.replayStepIndex;
    this.replayStepIndex = targetIdx;
    this.replayTrialCheckmated = false;
    this.selectedSquare = null;
    this.clearLegalMoveIndicators();
    this.clearCheckmateVFX();
    this.clearCheckmateHighlights();
    this.clearGrandmasterHint3D?.();

    const snap = this.replaySnapshots[targetIdx];
    if (targetIdx === 0) {
      this.resetTelemetryUI?.();
    }

    if (animateMove && targetIdx === prevIdx + 1 && snap.move) {
      const prevSnap = this.replaySnapshots[prevIdx];
      this.restoreSnapshotToEngine(prevSnap);
      this.syncPiecesFromEngine();

      const m = snap.move;
      const movingPiece = this.engine.board[m.fr]?.[m.fc];
      const targetPiece = this.engine.board[m.tr]?.[m.tc];
      const movingMesh = movingPiece ? this.pieceMeshes.get(movingPiece.id) : null;
      const targetMesh = targetPiece ? this.pieceMeshes.get(targetPiece.id) : null;

      if (movingMesh) {
        const startPos = gridToWorld(m.fr, m.fc);
        const endPos = gridToWorld(m.tr, m.tc);
        const isCapture = Boolean(targetPiece);
        const movePieceType = movingPiece.isHidden ? (movingPiece.posType || movingPiece.type) : movingPiece.type;

        this.setLastMoveMarkers?.({ r: m.fr, c: m.fc }, { r: m.tr, c: m.tc });
        this.spawnMoveTrailRibbon?.(startPos, endPos, movePieceType, movingPiece.color, isCapture);

        const moveDx = endPos.x - startPos.x;
        const moveDz = endPos.z - startPos.z;
        const moveDist = Math.hypot(moveDx, moveDz) || 1;
        const attackDirX = moveDx / moveDist;
        const attackDirZ = moveDz / moveDist;
        let captureShattered = false;

        this.activeAnimations = [];
        this.activeAnimations.push({
          mesh: movingMesh,
          elapsed: 0,
          duration: isCapture ? 0.46 : 0.36,
          update: (t) => {
            if (typeof this.computePieceMotionTransform === 'function') {
              const tf = this.computePieceMotionTransform(movePieceType, startPos, endPos, isCapture, false, t);
              movingMesh.position.set(tf.x, tf.y, tf.z);
              movingMesh.rotation.set(tf.rx, tf.ry, tf.rz);
              movingMesh.scale.set(tf.sx, tf.sy, tf.sz);
            } else {
              const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
              movingMesh.position.x = THREE.MathUtils.lerp(startPos.x, endPos.x, ease);
              movingMesh.position.z = THREE.MathUtils.lerp(startPos.z, endPos.z, ease);
              movingMesh.position.y = Math.sin(ease * Math.PI) * 0.75;
            }
            if (isCapture && targetMesh && !captureShattered) {
              if (t >= 0.45 && t < 0.72) {
                const pre = (t - 0.45) / 0.27;
                targetMesh.position.x = endPos.x + Math.sin(pre * 28) * 0.04 * pre;
                targetMesh.position.z = endPos.z + Math.cos(pre * 28) * 0.04 * pre;
                targetMesh.scale.set(1 + pre * 0.06, 1 - pre * 0.14, 1 + pre * 0.06);
              } else if (t >= 0.72) {
                captureShattered = true;
                this.piecesGroup.remove(targetMesh);
                this.pieceMeshes.delete(targetPiece.id);
                this.spawnShatterFragments(endPos.x, endPos.z, targetPiece.color, attackDirX, attackDirZ);
                this.sfx.playAttackShatter();
              }
            }
          },
          complete: () => {
            movingMesh.rotation.set(0, 0, 0);
            movingMesh.scale.set(1, 1, 1);
            this.restoreSnapshotToEngine(snap);
            if (isCapture && targetMesh && !captureShattered) {
              captureShattered = true;
              this.spawnShatterFragments(endPos.x, endPos.z, targetPiece.color, attackDirX, attackDirZ);
              this.sfx.playAttackShatter();
            } else if (!isCapture && movingPiece) {
              this.spawnMoveImpactWave?.(endPos.x, endPos.z, false, movingPiece.color);
              this.sfx.playMove(movingPiece.color, movingPiece.type);
            }
            this.syncPiecesFromEngine();
            this.updateReplayPanelUI();
            this.updateUI(snap.inCheck);

            if (targetIdx === totalSteps && this.replayOutcome && !this.replayBranchActive) {
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
    this.restoreSnapshotToEngine(snap);
    this.syncPiecesFromEngine();

    if (snap.move) {
      this.setLastMoveMarkers?.({ r: snap.move.fr, c: snap.move.fc }, { r: snap.move.tr, c: snap.move.tc });
    } else {
      this.setLastMoveMarkers?.(null, null);
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
      const aiOppLabel = this.gameMode === 'pvp' ? '双人推演' : 'AI应手';
      const branchTag = this.replayBranchActive ? ` · 分支(${aiOppLabel})` : ` · 可试招`;
      if (cur === 0) {
        stepBadge.textContent = `第 0 / ${totalSteps} 步 · ${sourceLabel}${branchTag}`;
      } else if (cur === totalSteps && this.replayOutcome && !this.replayBranchActive) {
        stepBadge.textContent = `第 ${cur} / ${totalSteps} 步 · 【${snap?.notation || ''}】(${this.replayOutcome.title})`;
      } else {
        const sideText = snap?.moverColor === RED ? '红' : '黑';
        stepBadge.textContent = `第 ${cur} / ${totalSteps} 步 · ${sideText}：${snap?.notation || ''}${branchTag}`;
      }
    }

    const restoreBtn = document.getElementById('btn-restore-replay-line');
    if (restoreBtn) {
      restoreBtn.classList.toggle('hidden', !this.replayBranchActive);
    }

    const playBtnText = document.getElementById('replay-autoplay-label');
    const playBtnIcon = document.getElementById('replay-autoplay-icon');
    if (playBtnText) playBtnText.textContent = this.replayAutoTimer ? '暂停' : '自动演示';
    if (playBtnIcon) playBtnIcon.textContent = this.replayAutoTimer ? 'pause' : 'play_arrow';

    const listEl = document.getElementById('replay-moves-list');
    if (listEl && this.replaySnapshots) {
      const lastSnap = this.replaySnapshots[this.replaySnapshots.length - 1];
      const listHash = `${this.replaySnapshots.length}:${this.replayBranchActive ? 1 : 0}:${lastSnap?.notation || ''}`;
      if (this._lastRenderedReplayListHash === listHash && listEl.children.length === this.replaySnapshots.length) {
        for (let i = 0; i < listEl.children.length; i++) {
          listEl.children[i].classList.toggle('active', i === cur);
        }
      } else {
        this._lastRenderedReplayListHash = listHash;
        listEl.innerHTML = this.replaySnapshots.map((s, idx) => {
          const isActive = idx === cur;
          if (idx === 0) {
            return `<button onclick="window.gameApp.jumpToReplayStep(0)" class="replay-step-pill serif-cn ${isActive ? 'active' : ''} px-2 py-1 rounded-lg text-[11px] font-bold border border-amber-200 bg-white text-slate-700 shrink-0">0. 起点</button>`;
          }
          const dotColor = s.moverColor === RED ? 'text-red-700' : 'text-slate-800';
          const branchMark = s.isBranchStep ? '★' : '';
          return `<button onclick="window.gameApp.jumpToReplayStep(${idx})" class="replay-step-pill serif-cn ${isActive ? 'active' : ''} px-2 py-1 rounded-lg text-[11px] font-bold border border-amber-200 bg-white ${dotColor} shrink-0">${idx}. ${branchMark}${s.notation}</button>`;
        }).join('');
      }

      const activeBtn = listEl.children[cur];
      if (activeBtn && activeBtn.scrollIntoView) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  },

  jumpToReplayStep(idx) {
    if (this.isBusy) return;
    this.stopReplayAutoPlay();
    this.sfx.playSelect();
    this.applyReplaySnapshotAt(idx, false);
  },

  replayFirstStep() {
    if (this.isBusy) return;
    this.stopReplayAutoPlay();
    this.sfx.playSelect();
    this.applyReplaySnapshotAt(0, false);
  },

  replayPrevStep() {
    if (this.isBusy) return;
    this.stopReplayAutoPlay();
    if (this.replayStepIndex <= 0) return;
    this.sfx.playSelect();
    this.applyReplaySnapshotAt(this.replayStepIndex - 1, false);
  },

  replayNextStep() {
    if (this.isBusy) return;
    this.stopReplayAutoPlay();
    const total = (this.replaySnapshots?.length || 1) - 1;
    if (this.replayStepIndex >= total) return;
    this.applyReplaySnapshotAt(this.replayStepIndex + 1, true);
  },

  replayLastStep() {
    if (this.isBusy) return;
    this.stopReplayAutoPlay();
    this.sfx.playSelect();
    const total = (this.replaySnapshots?.length || 1) - 1;
    this.applyReplaySnapshotAt(total, false);
  },

  toggleReplayAutoPlay() {
    if (this.isBusy) return;
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

  shareReplay() {
    if (!this.replaySnapshots || this.replaySnapshots.length <= 1) {
      this.showCenterCallout('尚无复盘记录可分享', RED);
      return;
    }
    this.stopReplayAutoPlay();
    this.sfx.playSelect();

    const finalSnap = this.replaySnapshots[this.replaySnapshots.length - 1];
    const finalBoard = finalSnap.board ? this.cloneBoardMatrix(finalSnap.board) : (this.parseFENToBoard(finalSnap.fen)?.board || this.engine.board);
    const finalTurn = finalSnap.turn || (this.parseFENToBoard(finalSnap.fen)?.turn || this.engine.turn);

    const b64Moves = encodeMovesToBase64Url(this.replayMoves);
    const isStandard = this.replayInitialFEN === STANDARD_START_FEN && this.engine.variantMode !== 'jieqi';
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

    this.renderEndgamePoster(finalBoard, finalTurn, this.currentShareUrl, {
      posterTitle: '中国象棋 · 棋局复盘',
      badgeText: badgeLabel,
      badgeColor,
      footerHeadline: '扫码回看全局复盘 · 步步精妙',
      footerSub: '长按识别二维码，或使用游戏内「扫码识局」演示每一步棋',
      lastMove: finalSnap.move || null
    });

    document.getElementById('share-endgame-modal')?.classList.remove('hidden');
  },

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
