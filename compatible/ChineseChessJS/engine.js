class XiangqiEngine {
  constructor() {
    this.variantMode = 'xiangqi';
    this.nextPieceId = 1;
    this._tacticalCache = { key: '', threatened: null, safeCaptures: null, legalMovesBySq: null };
    this.reset('xiangqi');
  }

  allocPieceId() {
    return this.nextPieceId++;
  }

  invalidateTacticalCache() {
    this._tacticalCache.key = '';
    this._tacticalCache.threatened = null;
    this._tacticalCache.safeCaptures = null;
    this._tacticalCache.legalMovesBySq = null;
  }

  reset(variantMode = this.variantMode) {
    if (variantMode === 'xiangqi' || variantMode === 'jieqi') {
      this.variantMode = variantMode;
    }
    this.board = Array.from({ length: 10 }, () => Array(9).fill(null));
    this.turn = RED;
    this.history = [];
    this.capturedRed = [];
    this.capturedBlack = [];
    this.setupInitialBoard();
    this.initialPosKey = this.getPositionKey(this.board, RED);
    this.invalidateTacticalCache();
  }

  clearCapturesAndHistory() {
    this.history = [];
    this.capturedRed = [];
    this.capturedBlack = [];
    this.initialPosKey = this.getPositionKey(this.board, this.turn);
    this.invalidateTacticalCache();
  }

  getJieqiPositionalType(r, c) {
    if (r === 0 || r === 9) {
      const backRank = ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'];
      return backRank[c] || null;
    }
    if ((r === 2 || r === 7) && (c === 1 || c === 7)) return 'c';
    if ((r === 3 || r === 6) && (c % 2 === 0)) return 'p';
    return null;
  }

  getPositionKey(board = this.board, turn = this.turn) {
    let s = `${this.variantMode}:${turn}:`;
    for (let r = 0; r < 10; r++) {
      const row = board[r];
      for (let c = 0; c < 9; c++) {
        const p = row[c];
        if (!p) {
          s += '..';
        } else if (p.isHidden) {
          s += `${p.color}?${p.posType || p.type}`;
        } else {
          s += `${p.color}${p.type}`;
        }
      }
    }
    return s;
  }

  setupInitialBoard() {
    if (this.variantMode === 'jieqi') {
      this.setupJieqiBoard();
      return;
    }

    const place = (r, c, color, type) => {
      this.board[r][c] = {
        id: this.allocPieceId(),
        color,
        type,
        realType: type,
        posType: type,
        char: PIECE_CHARS[color][type],
        realChar: PIECE_CHARS[color][type],
        isHidden: false,
        originR: r,
        originC: c
      };
    };

    const backRank = ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'];
    for (let c = 0; c < 9; c++) {
      place(0, c, BLACK, backRank[c]);
      place(9, c, RED, backRank[c]);
    }
    place(2, 1, BLACK, 'c');
    place(2, 7, BLACK, 'c');
    place(7, 1, RED, 'c');
    place(7, 7, RED, 'c');

    for (let c = 0; c < 9; c += 2) {
      place(3, c, BLACK, 'p');
      place(6, c, RED, 'p');
    }
  }

  setupJieqiBoard() {
    const shuffle = (arr) => {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    };

    const basePool = ['r', 'r', 'n', 'n', 'b', 'b', 'a', 'a', 'c', 'c', 'p', 'p', 'p', 'p', 'p'];
    const blackPool = shuffle(basePool);
    const redPool = shuffle(basePool);

    this.board[0][4] = {
      id: this.allocPieceId(),
      color: BLACK,
      type: 'k',
      realType: 'k',
      posType: 'k',
      char: PIECE_CHARS[BLACK].k,
      realChar: PIECE_CHARS[BLACK].k,
      isHidden: false,
      originR: 0,
      originC: 4
    };
    this.board[9][4] = {
      id: this.allocPieceId(),
      color: RED,
      type: 'k',
      realType: 'k',
      posType: 'k',
      char: PIECE_CHARS[RED].k,
      realChar: PIECE_CHARS[RED].k,
      isHidden: false,
      originR: 9,
      originC: 4
    };

    const placeHidden = (r, c, color, realType) => {
      const posType = this.getJieqiPositionalType(r, c) || 'p';
      this.board[r][c] = {
        id: this.allocPieceId(),
        color,
        type: posType,
        posType,
        realType,
        char: PIECE_CHARS[color][posType],
        realChar: PIECE_CHARS[color][realType],
        isHidden: true,
        originR: r,
        originC: c
      };
    };

    const blackCoords = [
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 5], [0, 6], [0, 7], [0, 8],
      [2, 1], [2, 7],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8]
    ];
    const redCoords = [
      [9, 0], [9, 1], [9, 2], [9, 3], [9, 5], [9, 6], [9, 7], [9, 8],
      [7, 1], [7, 7],
      [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]
    ];

    blackCoords.forEach(([r, c], idx) => placeHidden(r, c, BLACK, blackPool[idx]));
    redCoords.forEach(([r, c], idx) => placeHidden(r, c, RED, redPool[idx]));
  }

  inBounds(r, c) {
    return r >= 0 && r < 10 && c >= 0 && c < 9;
  }

  inPalace(r, c, color) {
    if (c < 3 || c > 5) return false;
    return color === RED ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
  }

  cloneBoard(board = this.board) {
    return board.map(row => row.map(cell => cell ? { ...cell } : null));
  }

  getCaptureTier(type) {
    switch (type) {
      case 'r': return 4;
      case 'c':
      case 'n': return 3;
      case 'a':
      case 'b': return 2;
      case 'p': return 1;
      default: return 0;
    }
  }

  isUncrossedPawn(piece, r) {
    if (!piece) return false;
    const activeType = piece.isHidden ? (piece.posType || piece.type) : piece.type;
    if (activeType !== 'p') return false;
    return piece.color === RED ? r >= 5 : r <= 4;
  }

  getPseudoMoves(r, c, board = this.board) {
    const p = board[r][c];
    if (!p) return [];
    const moves = [];
    const { color } = p;
    const isJieqi = this.variantMode === 'jieqi';
    const isHidden = Boolean(p.isHidden);

    const type = isHidden ? (p.posType || this.getJieqiPositionalType(r, c) || p.type) : p.type;

    const addIfValid = (nr, nc) => {
      if (nr < 0 || nr >= 10 || nc < 0 || nc >= 9) return false;
      const target = board[nr][nc];
      if (!target) {
        moves.push({ fr: r, fc: c, tr: nr, tc: nc, capture: null });
        return true;
      } else if (target.color !== color) {
        moves.push({ fr: r, fc: c, tr: nr, tc: nc, capture: target });
        return false;
      }
      return false;
    };

    if (type === 'k') {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (let i = 0; i < 4; i++) {
        const nr = r + dirs[i][0], nc = c + dirs[i][1];
        if (this.inPalace(nr, nc, color)) addIfValid(nr, nc);
      }
    } else if (type === 'a') {
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (let i = 0; i < 4; i++) {
        const nr = r + dirs[i][0], nc = c + dirs[i][1];

        if (isJieqi && !isHidden) {
          addIfValid(nr, nc);
        } else if (this.inPalace(nr, nc, color)) {
          addIfValid(nr, nc);
        }
      }
    } else if (type === 'b') {
      const dirs = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
      for (let i = 0; i < 4; i++) {
        const dr = dirs[i][0], dc = dirs[i][1];
        const nr = r + dr, nc = c + dc;
        const er = r + (dr >> 1), ec = c + (dc >> 1);
        if (nr < 0 || nr >= 10 || nc < 0 || nc >= 9) continue;

        if (!isJieqi || isHidden) {
          if (color === RED && nr < 5) continue;
          if (color === BLACK && nr > 4) continue;
        }
        if (board[er][ec] === null) addIfValid(nr, nc);
      }
    } else if (type === 'n') {
      if (r > 1 && board[r - 1][c] === null) {
        if (c > 0) addIfValid(r - 2, c - 1);
        if (c < 8) addIfValid(r - 2, c + 1);
      }
      if (r < 8 && board[r + 1][c] === null) {
        if (c > 0) addIfValid(r + 2, c - 1);
        if (c < 8) addIfValid(r + 2, c + 1);
      }
      if (c > 1 && board[r][c - 1] === null) {
        if (r > 0) addIfValid(r - 1, c - 2);
        if (r < 9) addIfValid(r + 1, c - 2);
      }
      if (c < 7 && board[r][c + 1] === null) {
        if (r > 0) addIfValid(r - 1, c + 2);
        if (r < 9) addIfValid(r + 1, c + 2);
      }
    } else if (type === 'r') {
      for (let nr = r - 1; nr >= 0; nr--) { if (!addIfValid(nr, c)) break; }
      for (let nr = r + 1; nr < 10; nr++) { if (!addIfValid(nr, c)) break; }
      for (let nc = c - 1; nc >= 0; nc--) { if (!addIfValid(r, nc)) break; }
      for (let nc = c + 1; nc < 9; nc++)  { if (!addIfValid(r, nc)) break; }
    } else if (type === 'c') {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (let d = 0; d < 4; d++) {
        const dr = dirs[d][0], dc = dirs[d][1];
        let nr = r + dr, nc = c + dc;
        let jumped = false;
        while (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
          const target = board[nr][nc];
          if (!jumped) {
            if (!target) {
              moves.push({ fr: r, fc: c, tr: nr, tc: nc, capture: null });
            } else {
              jumped = true;
            }
          } else {
            if (target) {
              if (target.color !== color) {
                moves.push({ fr: r, fc: c, tr: nr, tc: nc, capture: target });
              }
              break;
            }
          }
          nr += dr;
          nc += dc;
        }
      }
    } else if (type === 'p') {
      const forward = color === RED ? -1 : 1;
      addIfValid(r + forward, c);

      const crossedRiver = !isHidden && (color === RED ? r <= 4 : r >= 5);
      if (crossedRiver) {
        addIfValid(r, c - 1);
        addIfValid(r, c + 1);
      }
    }

    return moves;
  }

  areGeneralsFacing(board = this.board) {
    let rkr = -1, rkc = -1, bkr = -1, bkc = -1;
    for (let r = 0; r < 10; r++) {
      const row = board[r];
      for (let c = 3; c <= 5; c++) {
        const p = row[c];
        if (p && !p.isHidden && p.type === 'k') {
          if (p.color === RED) { rkr = r; rkc = c; }
          else { bkr = r; bkc = c; }
        }
      }
    }
    if (rkr === -1 || bkr === -1 || rkc !== bkc) return false;
    const minR = rkr < bkr ? rkr + 1 : bkr + 1;
    const maxR = rkr < bkr ? bkr : rkr;
    for (let r = minR; r < maxR; r++) {
      if (board[r][rkc] !== null) return false;
    }
    return true;
  }

  canSquareBeCapturedBy(tr, tc, attackerColor, board = this.board, requireLegal = false) {
    const isJieqi = this.variantMode === 'jieqi';
    const checkCandidate = (er, ec) => {
      if (!requireLegal) return true;
      const ep = board[er][ec];
      const savedTarget = board[tr][tc];
      board[tr][tc] = ep;
      board[er][ec] = null;
      const selfChk = this.isInCheck(attackerColor, board);
      board[er][ec] = ep;
      board[tr][tc] = savedTarget;
      return !selfChk;
    };

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let d = 0; d < 4; d++) {
      const dr = dirs[d][0], dc = dirs[d][1];
      let er = tr + dr, ec = tc + dc;
      let mounts = 0;
      let dist = 1;
      while (er >= 0 && er < 10 && ec >= 0 && ec < 9) {
        const ep = board[er][ec];
        if (ep) {
          if (mounts === 0) {
            if (ep.color === attackerColor) {
              const epIsHidden = Boolean(ep.isHidden);
              const epType = epIsHidden ? (ep.posType || this.getJieqiPositionalType(er, ec) || ep.type) : ep.type;
              let hits = false;
              if (epType === 'r') {
                hits = true;
              } else if (epType === 'k' && dist === 1 && this.inPalace(tr, tc, attackerColor)) {
                hits = true;
              } else if (epType === 'p' && dist === 1) {
                const forward = attackerColor === RED ? -1 : 1;
                if (er + forward === tr && ec === tc) hits = true;
                else if (!epIsHidden && (attackerColor === RED ? er <= 4 : er >= 5) && er === tr) hits = true;
              }
              if (hits && checkCandidate(er, ec)) return true;
            }
            mounts = 1;
          } else {
            if (ep.color === attackerColor) {
              const epIsHidden = Boolean(ep.isHidden);
              const epType = epIsHidden ? (ep.posType || this.getJieqiPositionalType(er, ec) || ep.type) : ep.type;
              if (epType === 'c' && checkCandidate(er, ec)) return true;
            }
            break;
          }
        }
        er += dr;
        ec += dc;
        dist++;
      }
    }

    const hOffsets = [
      [-2, -1, 1, 0], [-2, 1, 1, 0],
      [2, -1, -1, 0], [2, 1, -1, 0],
      [-1, -2, 0, 1], [1, -2, 0, 1],
      [-1, 2, 0, -1], [1, 2, 0, -1]
    ];
    for (let i = 0; i < 8; i++) {
      const er = tr + hOffsets[i][0], ec = tc + hOffsets[i][1];
      if (er >= 0 && er < 10 && ec >= 0 && ec < 9) {
        const ep = board[er][ec];
        if (ep && ep.color === attackerColor) {
          const epIsHidden = Boolean(ep.isHidden);
          const epType = epIsHidden ? (ep.posType || this.getJieqiPositionalType(er, ec) || ep.type) : ep.type;
          if (epType === 'n' && board[er + hOffsets[i][2]][ec + hOffsets[i][3]] === null) {
            if (checkCandidate(er, ec)) return true;
          }
        }
      }
    }

    const diags = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let i = 0; i < 4; i++) {
      const dr = diags[i][0], dc = diags[i][1];
      const er1 = tr + dr, ec1 = tc + dc;
      if (er1 >= 0 && er1 < 10 && ec1 >= 0 && ec1 < 9) {
        const ep1 = board[er1][ec1];
        if (ep1 && ep1.color === attackerColor) {
          const epIsHidden = Boolean(ep1.isHidden);
          const epType = epIsHidden ? (ep1.posType || this.getJieqiPositionalType(er1, ec1) || ep1.type) : ep1.type;
          if (epType === 'a') {
            if ((isJieqi && !epIsHidden) || this.inPalace(tr, tc, attackerColor)) {
              if (checkCandidate(er1, ec1)) return true;
            }
          }
        }
        const er2 = tr + dr * 2, ec2 = tc + dc * 2;
        if (er2 >= 0 && er2 < 10 && ec2 >= 0 && ec2 < 9 && board[er1][ec1] === null) {
          const ep2 = board[er2][ec2];
          if (ep2 && ep2.color === attackerColor) {
            const epIsHidden = Boolean(ep2.isHidden);
            const epType = epIsHidden ? (ep2.posType || this.getJieqiPositionalType(er2, ec2) || ep2.type) : ep2.type;
            if (epType === 'b') {
              if ((isJieqi && !epIsHidden) || (attackerColor === RED ? tr >= 5 : tr <= 4)) {
                if (checkCandidate(er2, ec2)) return true;
              }
            }
          }
        }
      }
    }

    return false;
  }

  isInCheck(color, board = this.board) {
    let kr = -1, kc = -1;
    let ekr = -1, ekc = -1;
    for (let r = 0; r < 10; r++) {
      const row = board[r];
      for (let c = 3; c <= 5; c++) {
        const p = row[c];
        if (p && !p.isHidden && p.type === 'k') {
          if (p.color === color) { kr = r; kc = c; }
          else { ekr = r; ekc = c; }
        }
      }
    }
    if (kr === -1) return true;

    if (ekr !== -1 && kc === ekc) {
      let blocked = false;
      const minR = kr < ekr ? kr + 1 : ekr + 1;
      const maxR = kr < ekr ? ekr : kr;
      for (let r = minR; r < maxR; r++) {
        if (board[r][kc] !== null) { blocked = true; break; }
      }
      if (!blocked) return true;
    }

    const enemy = color === RED ? BLACK : RED;
    return this.canSquareBeCapturedBy(kr, kc, enemy, board, false);
  }

  simulateMoveInPlace(m, board = this.board) {
    const p = board[m.fr][m.fc];
    const savedTarget = board[m.tr][m.tc];
    const savedHidden = p ? p.isHidden : false;
    const savedType = p ? p.type : null;
    const savedChar = p ? p.char : null;

    board[m.tr][m.tc] = p;
    board[m.fr][m.fc] = null;
    return () => {
      if (p) {
        p.isHidden = savedHidden;
        p.type = savedType;
        p.char = savedChar;
      }
      board[m.fr][m.fc] = p;
      board[m.tr][m.tc] = savedTarget;
    };
  }

  hasAnyLegalMove(color, board = this.board) {
    for (let r = 0; r < 10; r++) {
      const row = board[r];
      for (let c = 0; c < 9; c++) {
        const p = row[c];
        if (p && p.color === color) {
          const pseudo = this.getPseudoMoves(r, c, board);
          for (let i = 0; i < pseudo.length; i++) {
            const m = pseudo[i];
            const savedTarget = board[m.tr][m.tc];
            board[m.tr][m.tc] = p;
            board[m.fr][m.fc] = null;
            const inChk = this.isInCheck(color, board);
            board[m.fr][m.fc] = p;
            board[m.tr][m.tc] = savedTarget;
            if (!inChk) return true;
          }
        }
      }
    }
    return false;
  }

  hasMateInOne(attackerColor, defenderColor, board) {
    for (let r = 0; r < 10; r++) {
      const row = board[r];
      for (let c = 0; c < 9; c++) {
        const p = row[c];
        if (!p || p.color !== attackerColor) continue;
        const pseudo = this.getPseudoMoves(r, c, board);
        for (let i = 0; i < pseudo.length; i++) {
          const m = pseudo[i];
          if (m.capture && m.capture.type === 'k') continue;
          const savedTarget = board[m.tr][m.tc];
          board[m.tr][m.tc] = p;
          board[m.fr][m.fc] = null;

          let isMate = false;
          if (this.isInCheck(defenderColor, board) && !this.isInCheck(attackerColor, board)) {
            if (!this.hasAnyLegalMove(defenderColor, board)) {
              isMate = true;
            }
          }

          board[m.fr][m.fc] = p;
          board[m.tr][m.tc] = savedTarget;
          if (isMate) return true;
        }
      }
    }
    return false;
  }

  wouldPieceBeCapturedAfterMove(move, board = this.board) {
    if (move && typeof move._isUnsafe === 'boolean' && board === this.board) {
      return move._isUnsafe;
    }
    const mover = board[move.fr]?.[move.fc];
    if (!mover) return false;
    const myColor = mover.color;
    const enemyColor = myColor === RED ? BLACK : RED;

    const savedTarget = board[move.tr][move.tc];
    board[move.tr][move.tc] = mover;
    board[move.fr][move.fc] = null;

    const canBeCaptured = this.canSquareBeCapturedBy(move.tr, move.tc, enemyColor, board, true);

    board[move.fr][move.fc] = mover;
    board[move.tr][move.tc] = savedTarget;
    if (move && board === this.board) {
      move._isUnsafe = canBeCaptured;
    }
    return canBeCaptured;
  }

  _ensureTacticalCache(friendlyColor = this.turn, board = this.board) {
    if (board !== this.board) return null;
    const posKey = this.getPositionKey(board, friendlyColor);
    if (this._tacticalCache.key === posKey && this._tacticalCache.threatened && this._tacticalCache.legalMovesBySq) {
      return this._tacticalCache;
    }

    const enemyColor = friendlyColor === RED ? BLACK : RED;
    const threatened = new Set();
    const legalMovesBySq = new Map();

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (!p || p.color !== friendlyColor) continue;
        if (this.canSquareBeCapturedBy(r, c, enemyColor, board, true)) {
          threatened.add(p.id);
        }
        const legal = this.getLegalMoves(r, c, board);
        for (let i = 0; i < legal.length; i++) {
          const m = legal[i];
          if (m.capture && m.capture.color !== friendlyColor) {
            m._isUnsafe = this.wouldPieceBeCapturedAfterMove(m, board);
          }
        }
        legalMovesBySq.set(r * 9 + c, legal);
      }
    }

    this._tacticalCache.key = posKey;
    this._tacticalCache.threatened = threatened;
    this._tacticalCache.legalMovesBySq = legalMovesBySq;
    return this._tacticalCache;
  }

  getThreatenedFriendlyPieceIds(friendlyColor = this.turn, board = this.board) {
    const cache = this._ensureTacticalCache(friendlyColor, board);
    if (cache) {
      return new Set(cache.threatened);
    }

    const threatenedIds = new Set();
    const enemyColor = friendlyColor === RED ? BLACK : RED;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === friendlyColor) {
          if (this.canSquareBeCapturedBy(r, c, enemyColor, board, true)) {
            threatenedIds.add(p.id);
          }
        }
      }
    }
    return threatenedIds;
  }

  getSafeCapturableEnemyPieceIds(friendlyColor = this.turn, selectedSq = null, board = this.board) {
    const safeTargetIds = new Set();
    const unsafeForSelectedIds = new Set();
    const cache = this._ensureTacticalCache(friendlyColor, board);

    if (selectedSq && this.inBounds(selectedSq.r, selectedSq.c)) {
      const selPiece = board[selectedSq.r][selectedSq.c];
      if (selPiece && selPiece.color === friendlyColor) {
        const selMoves = cache
          ? (cache.legalMovesBySq.get(selectedSq.r * 9 + selectedSq.c) || [])
          : this.getLegalMoves(selectedSq.r, selectedSq.c, board);
        for (let i = 0; i < selMoves.length; i++) {
          const m = selMoves[i];
          if (m.capture && m.capture.color !== friendlyColor) {
            const unsafe = typeof m._isUnsafe === 'boolean' ? m._isUnsafe : this.wouldPieceBeCapturedAfterMove(m, board);
            if (!unsafe) {
              safeTargetIds.add(m.capture.id);
            } else {
              unsafeForSelectedIds.add(m.capture.id);
            }
          }
        }
      }
    }

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (selectedSq && selectedSq.r === r && selectedSq.c === c) continue;
        const p = board[r][c];
        if (!p || p.color !== friendlyColor) continue;
        const legal = cache
          ? (cache.legalMovesBySq.get(r * 9 + c) || [])
          : this.getLegalMoves(r, c, board);
        for (let i = 0; i < legal.length; i++) {
          const m = legal[i];
          if (m.capture && m.capture.color !== friendlyColor) {
            if (unsafeForSelectedIds.has(m.capture.id)) continue;
            const unsafe = typeof m._isUnsafe === 'boolean' ? m._isUnsafe : this.wouldPieceBeCapturedAfterMove(m, board);
            if (!unsafe) {
              safeTargetIds.add(m.capture.id);
            }
          }
        }
      }
    }
    return safeTargetIds;
  }

  isTargetProtectedAfterCapture(ar, ac, tr, tc, board) {
    const attacker = board[ar][ac];
    const target = board[tr][tc];
    if (!attacker || !target) return false;
    return this.wouldPieceBeCapturedAfterMove({ fr: ar, fc: ac, tr, tc }, board);
  }

  getValidChasesOnBoard(moverColor, board) {
    const chases = [];
    for (let r = 0; r < 10; r++) {
      const row = board[r];
      for (let c = 0; c < 9; c++) {
        const attacker = row[c];
        if (!attacker || attacker.color !== moverColor) continue;
        const pseudo = this.getPseudoMoves(r, c, board);
        for (let i = 0; i < pseudo.length; i++) {
          const m = pseudo[i];
          const target = m.capture;
          if (!target || target.type === 'k') continue;
          if (this.isUncrossedPawn(target, m.tr)) continue;

          const savedTarget = board[m.tr][m.tc];
          board[m.tr][m.tc] = attacker;
          board[m.fr][m.fc] = null;
          const selfInCheck = this.isInCheck(moverColor, board);
          board[m.fr][m.fc] = attacker;
          board[m.tr][m.tc] = savedTarget;
          if (selfInCheck) continue;

          const attackerTier = this.getCaptureTier(attacker.type);
          const targetTier = this.getCaptureTier(target.type);
          const isLowerCapturesHigher = attacker.type !== 'k' && targetTier > attackerTier;
          const isUnprotected = isLowerCapturesHigher ? false : !this.isTargetProtectedAfterCapture(r, c, m.tr, m.tc, board);

          if (isLowerCapturesHigher || isUnprotected) {
            const aChar = attacker.isHidden ? '暗子' : attacker.char;
            const tChar = target.isHidden ? '暗子' : target.char;
            chases.push({
              attackerId: attacker.id,
              attackerType: attacker.type,
              attackerChar: aChar,
              ar: r,
              ac: c,
              targetId: target.id,
              targetType: target.type,
              targetChar: tChar,
              tr: m.tr,
              tc: m.tc
            });
          }
        }
      }
    }
    return chases;
  }

  classifyMoveAction(move, movedPiece, boardBefore, boardAfter, precomputedChasesBefore = null) {
    const moverColor = movedPiece.color;
    const defenderColor = moverColor === RED ? BLACK : RED;
    const mChar = movedPiece.isHidden ? '暗子' : movedPiece.char;

    if (this.isInCheck(defenderColor, boardAfter)) {
      return {
        type: 'jiang',
        label: '将',
        desc: `${mChar}将军`,
        chasedTargetIds: []
      };
    }

    const hasMateAfter = this.hasMateInOne(moverColor, defenderColor, boardAfter);
    if (hasMateAfter) {
      const isMajorOrPawn = movedPiece.type === 'r' || movedPiece.type === 'c' || movedPiece.type === 'n' || movedPiece.type === 'p';
      if (isMajorOrPawn || !this.hasMateInOne(moverColor, defenderColor, boardBefore)) {
        return {
          type: 'sha',
          label: '杀',
          desc: `${mChar}叫杀`,
          chasedTargetIds: []
        };
      }
    }

    const chasesBefore = precomputedChasesBefore || this.getValidChasesOnBoard(moverColor, boardBefore);
    const chasesAfter = this.getValidChasesOnBoard(moverColor, boardAfter);

    const newlyCreatedChases = chasesAfter.filter(ca => {
      if (ca.attackerId === movedPiece.id) return true;
      return !chasesBefore.some(cb => cb.attackerId === ca.attackerId && cb.targetId === ca.targetId);
    });

    if (newlyCreatedChases.length > 0) {
      const targetIds = newlyCreatedChases.map(c => c.targetId);
      const standardChase = newlyCreatedChases.find(c => c.attackerType !== 'k' && c.attackerType !== 'p');
      if (standardChase) {
        return {
          type: 'zhuo',
          label: `捉${standardChase.targetChar}`,
          desc: `${standardChase.attackerChar}捉${standardChase.targetChar}`,
          chasedTargetIds: targetIds
        };
      }

      const pawnChase = newlyCreatedChases.find(c => c.attackerType === 'p');
      if (pawnChase) {
        return {
          type: 'pawn_zhuo',
          label: `兵捉${pawnChase.targetChar}`,
          desc: `${pawnChase.attackerChar}捉${pawnChase.targetChar}`,
          chasedTargetIds: targetIds
        };
      }

      const kingChase = newlyCreatedChases.find(c => c.attackerType === 'k');
      if (kingChase) {
        return {
          type: 'king_zhuo',
          label: `${kingChase.attackerChar}捉${kingChase.targetChar}`,
          desc: `${kingChase.attackerChar}捉${kingChase.targetChar}`,
          chasedTargetIds: targetIds
        };
      }
    }

    return {
      type: 'xian',
      label: '闲',
      desc: `${mChar}闲着`,
      chasedTargetIds: []
    };
  }

  analyzeCycleStatus() {
    const M = this.history.length;
    if (M < 4) return null;

    let lastIrreversiblePly = 0;
    for (let i = 0; i < M; i++) {
      const h = this.history[i];
      const isPawnForward = h.piece.type === 'p' && h.move.fr !== h.move.tr;
      if (h.captured || isPawnForward || h.flipped) {
        lastIrreversiblePly = i + 1;
      }
    }

    const getPosKeyAtPly = (ply) => {
      if (ply === 0) return this.initialPosKey;
      return this.history[ply - 1].posKeyAfter;
    };

    let period = -1;
    for (let p = 4; p <= M - lastIrreversiblePly; p += 2) {
      if (getPosKeyAtPly(M) === getPosKeyAtPly(M - p)) {
        period = p;
        break;
      }
    }
    if (period === -1) return null;

    let firstMatchPly = M;
    while (
      firstMatchPly - 1 >= lastIrreversiblePly + period &&
      getPosKeyAtPly(firstMatchPly - 1) === getPosKeyAtPly(firstMatchPly - 1 - period)
    ) {
      firstMatchPly--;
    }

    const extraRepeatedPlies = M - firstMatchPly;
    const remainingSteps = Math.max(0, period - extraRepeatedPlies);

    const cycleEntries = this.history.slice(M - period, M);
    const redEntries = cycleEntries.filter(e => e.turnBefore === RED);
    const blackEntries = cycleEntries.filter(e => e.turnBefore === BLACK);

    const isAttackTypeIfMutual = (t) => t === 'jiang' || t === 'sha' || t === 'zhuo' || t === 'pawn_zhuo';
    const redAllAttackIfMutual = redEntries.length > 0 && redEntries.every(e => isAttackTypeIfMutual(e.actionTag.type));
    const blackAllAttackIfMutual = blackEntries.length > 0 && blackEntries.every(e => isAttackTypeIfMutual(e.actionTag.type));
    const isMutualChangDa = redAllAttackIfMutual && blackAllAttackIfMutual;

    const evaluateSideCycle = (entries, sideName) => {
      const effectiveTypes = entries.map(e => {
        const raw = e.actionTag.type;
        if (raw === 'king_zhuo') return 'xian';
        if (raw === 'pawn_zhuo') return isMutualChangDa ? 'zhuo' : 'xian';
        return raw;
      });

      const rawTypes = entries.map(e => e.actionTag.type);
      const stepLabels = entries.map(e => e.actionTag.label).join('→');

      const hasIdle = effectiveTypes.includes('xian');
      if (hasIdle) {
        let shortName = '闲着';
        if (rawTypes.every(t => t === 'king_zhuo')) {
          shortName = '将帅长捉';
        } else if (rawTypes.every(t => t === 'pawn_zhuo')) {
          shortName = '兵卒常捉';
        } else if (effectiveTypes.includes('jiang')) {
          shortName = '一将一闲';
        } else if (effectiveTypes.includes('sha')) {
          shortName = '一杀一闲';
        } else if (effectiveTypes.includes('zhuo')) {
          shortName = '一捉一闲';
        }
        return {
          permitted: true,
          isPerpetualCheck: false,
          shortName,
          fullLabel: `${sideName} · ${shortName}`,
          stepLabels
        };
      }

      const allJiang = effectiveTypes.every(t => t === 'jiang');
      const allSha = effectiveTypes.every(t => t === 'sha');
      const allZhuo = effectiveTypes.every(t => t === 'zhuo');

      let shortName = '长打';
      if (allJiang) shortName = '长将';
      else if (allSha) shortName = '长杀';
      else if (allZhuo) shortName = rawTypes.includes('pawn_zhuo') ? '兵卒长捉' : '长捉';
      else if (effectiveTypes.includes('jiang') && effectiveTypes.includes('sha')) shortName = '一将一杀';
      else if (effectiveTypes.includes('jiang') && effectiveTypes.includes('zhuo')) shortName = '一将一捉';
      else if (effectiveTypes.includes('sha') && effectiveTypes.includes('zhuo')) shortName = '一杀一捉';

      return {
        permitted: false,
        isPerpetualCheck: allJiang,
        shortName,
        fullLabel: `${sideName} · ${shortName}(禁)`,
        stepLabels
      };
    };

    const redInfo = evaluateSideCycle(redEntries, '红方');
    const blackInfo = evaluateSideCycle(blackEntries, '黑方');

    let verdict = 'DRAW';
    let violator = null;
    let verdictShort = '双方不变判和';
    let ruleExplanation = '';

    if (redInfo.isPerpetualCheck && !blackInfo.isPerpetualCheck) {
      verdict = 'RED_LOSE';
      violator = RED;
      verdictShort = '红方长将判负';
      ruleExplanation = `红方单方长将，不变判负。`;
    } else if (blackInfo.isPerpetualCheck && !redInfo.isPerpetualCheck) {
      verdict = 'BLACK_LOSE';
      violator = BLACK;
      verdictShort = '黑方长将判负';
      ruleExplanation = `黑方单方长将，不变判负。`;
    } else if ((redInfo.permitted && blackInfo.permitted) || (!redInfo.permitted && !blackInfo.permitted)) {
      verdict = 'DRAW';
      violator = null;
      verdictShort = '双方不变判和';
      ruleExplanation = `双方允许着法或互打，不变判和。`;
    } else if (!redInfo.permitted && blackInfo.permitted) {
      verdict = 'RED_LOSE';
      violator = RED;
      verdictShort = `红方${redInfo.shortName}判负`;
      ruleExplanation = `红方【${redInfo.shortName}】属禁着，不变判负。`;
    } else {
      verdict = 'BLACK_LOSE';
      violator = BLACK;
      verdictShort = `黑方${blackInfo.shortName}判负`;
      ruleExplanation = `黑方【${blackInfo.shortName}】属禁着，不变判负。`;
    }

    const nextCycleEntry = this.history[M - period];
    const nextCycleMove = nextCycleEntry ? nextCycleEntry.move : null;

    return {
      period,
      remainingSteps,
      redInfo,
      blackInfo,
      verdict,
      violator,
      verdictShort,
      ruleExplanation,
      nextCycleMove
    };
  }

  findCheckingPieces(color, board = this.board) {
    let kr = -1, kc = -1;
    for (let r = 0; r < 10; r++) {
      for (let c = 3; c <= 5; c++) {
        const p = board[r][c];
        if (p && p.color === color && !p.isHidden && p.type === 'k') {
          kr = r;
          kc = c;
          break;
        }
      }
    }
    if (kr === -1) return { kingSq: null, attackers: [] };

    const enemy = color === RED ? BLACK : RED;
    const attackers = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === enemy) {
          const moves = this.getPseudoMoves(r, c, board);
          if (moves.some(m => m.tr === kr && m.tc === kc)) {
            attackers.push({ r, c, piece: p });
          }
        }
      }
    }
    return { kingSq: { r: kr, c: kc }, attackers };
  }

  getLegalMoves(r, c, board = this.board) {
    const p = board[r]?.[c];
    if (!p) return [];
    const pseudo = this.getPseudoMoves(r, c, board);
    const legal = [];

    for (let i = 0; i < pseudo.length; i++) {
      const m = pseudo[i];
      const savedTarget = board[m.tr][m.tc];
      board[m.tr][m.tc] = p;
      board[m.fr][m.fc] = null;
      const inCheck = this.isInCheck(p.color, board);
      board[m.fr][m.fc] = p;
      board[m.tr][m.tc] = savedTarget;

      if (!inCheck) {
        legal.push(m);
      }
    }
    return legal;
  }

  getForbiddenRepetitionMoves(color) {
    const forbidden = [];
    const addMoveUnique = (m) => {
      if (!m) return;
      if (!forbidden.some(f => f.fr === m.fr && f.fc === m.fc && f.tr === m.tr && f.tc === m.tc)) {
        forbidden.push({ fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc });
      }
    };

    const nextTurn = color === RED ? BLACK : RED;
    const allLegal = this.getAllLegalMoves(color);
    if (allLegal.length <= 1) return forbidden;

    const M = this.history.length;
    let lastIrreversiblePly = 0;
    for (let i = 0; i < M; i++) {
      const h = this.history[i];
      const isPawnForward = h.piece.type === 'p' && h.move.fr !== h.move.tr;
      if (h.captured || isPawnForward || h.flipped) lastIrreversiblePly = i + 1;
    }

    const recentPosKeys = new Set();
    if (lastIrreversiblePly === 0) recentPosKeys.add(this.initialPosKey);
    for (let i = Math.max(0, lastIrreversiblePly - 1); i < M; i++) {
      recentPosKeys.add(this.history[i].posKeyAfter);
    }

    const recentHistory = this.history.slice(lastIrreversiblePly);
    const ownRecent = recentHistory.filter(h => h.turnBefore === color);
    const oppRecent = recentHistory.filter(h => h.turnBefore === nextTurn);

    const lastOwn1 = ownRecent[ownRecent.length - 1] || null;
    const lastOwn2 = ownRecent[ownRecent.length - 2] || null;
    const lastOpp1 = oppRecent[oppRecent.length - 1] || null;
    const lastOpp2 = oppRecent[oppRecent.length - 2] || null;

    const isAttackTag = (t) => t === 'jiang' || t === 'sha' || t === 'zhuo' || t === 'pawn_zhuo';
    const ownConsecutiveAttack = Boolean(
      lastOwn1 && lastOwn2 &&
      isAttackTag(lastOwn1.actionTag?.type) &&
      isAttackTag(lastOwn2.actionTag?.type)
    );
    const ownConsecutiveChecks = Boolean(
      lastOwn1 && lastOwn2 &&
      lastOwn1.actionTag?.type === 'jiang' &&
      lastOwn2.actionTag?.type === 'jiang'
    );
    const oppConsecutiveAttack = Boolean(
      lastOpp1 && lastOpp2 &&
      isAttackTag(lastOpp1.actionTag?.type) &&
      isAttackTag(lastOpp2.actionTag?.type)
    );

    const repeatedlyChasedTargets = new Set();
    if (lastOwn1 && lastOwn2) {
      const t1 = lastOwn1.actionTag?.chasedTargetIds || [];
      const t2 = lastOwn2.actionTag?.chasedTargetIds || [];
      for (const id of t1) {
        if (t2.includes(id)) repeatedlyChasedTargets.add(id);
      }
    }

    const cycle = this.analyzeCycleStatus();
    const cycleActiveForSide = Boolean(
      cycle && (
        cycle.violator === color ||
        !(color === RED ? cycle.redInfo.permitted : cycle.blackInfo.permitted) ||
        (color === RED ? cycle.redInfo.isPerpetualCheck : cycle.blackInfo.isPerpetualCheck)
      )
    );
    if (cycle && cycle.nextCycleMove) {
      addMoveUnique(cycle.nextCycleMove);
    }

    let boardBeforeLazy = null;
    let chasesBeforeLazy = null;

    for (let i = 0; i < allLegal.length; i++) {
      const m = allLegal[i];
      const piece = this.board[m.fr][m.fc];
      if (!piece || piece.isHidden) continue;

      const savedTarget = this.board[m.tr][m.tc];
      this.board[m.tr][m.tc] = piece;
      this.board[m.fr][m.fc] = null;

      const givesCheck = this.isInCheck(nextTurn, this.board);
      const isImmediateMate = givesCheck && !this.hasAnyLegalMove(nextTurn, this.board);
      if (isImmediateMate) {
        this.board[m.fr][m.fc] = piece;
        this.board[m.tr][m.tc] = savedTarget;
        continue;
      }

      const nextKey = !savedTarget ? this.getPositionKey(this.board, nextTurn) : '';
      const repeatsPosition = !savedTarget && recentPosKeys.has(nextKey);
      const isBounceBack = Boolean(
        !savedTarget &&
        lastOwn1 &&
        lastOwn1.move.fr === m.tr &&
        lastOwn1.move.fc === m.tc &&
        lastOwn1.move.tr === m.fr &&
        lastOwn1.move.tc === m.fc
      );

      this.board[m.fr][m.fc] = piece;
      this.board[m.tr][m.tc] = savedTarget;

      if (cycle && repeatsPosition) {
        addMoveUnique(m);
        continue;
      }
      if ((oppConsecutiveAttack || (lastOpp1 && isAttackTag(lastOpp1.actionTag?.type))) && (repeatsPosition || isBounceBack)) {
        addMoveUnique(m);
        continue;
      }
      if (isBounceBack && lastOwn1 && isAttackTag(lastOwn1.actionTag?.type)) {
        addMoveUnique(m);
        continue;
      }
      if (ownConsecutiveChecks && !savedTarget && givesCheck && (repeatsPosition || isBounceBack || piece.id === lastOwn1.piece.id)) {
        addMoveUnique(m);
        continue;
      }

      const needsFullTag = !savedTarget && (
        cycleActiveForSide ||
        repeatsPosition ||
        isBounceBack ||
        repeatedlyChasedTargets.size > 0
      );
      if (!needsFullTag) continue;

      let tag = null;
      if (givesCheck) {
        tag = { type: 'jiang', chasedTargetIds: [] };
      } else {
        if (!boardBeforeLazy) {
          boardBeforeLazy = this.cloneBoard(this.board);
          chasesBeforeLazy = this.getValidChasesOnBoard(color, boardBeforeLazy);
        }
        this.board[m.tr][m.tc] = piece;
        this.board[m.fr][m.fc] = null;
        tag = this.classifyMoveAction(m, piece, boardBeforeLazy, this.board, chasesBeforeLazy);
        this.board[m.fr][m.fc] = piece;
        this.board[m.tr][m.tc] = savedTarget;
      }

      if (cycleActiveForSide && !savedTarget && isAttackTag(tag.type)) {
        addMoveUnique(m);
        continue;
      }
      if (repeatsPosition && isAttackTag(tag.type)) {
        addMoveUnique(m);
        continue;
      }
      if (isBounceBack && lastOwn1 && isAttackTag(tag.type)) {
        addMoveUnique(m);
        continue;
      }
      if (!savedTarget && (tag.type === 'zhuo' || tag.type === 'pawn_zhuo') && Array.isArray(tag.chasedTargetIds)) {
        if (tag.chasedTargetIds.some(id => repeatedlyChasedTargets.has(id))) {
          addMoveUnique(m);
          continue;
        }
        if (ownConsecutiveAttack && piece.id === lastOwn1?.piece?.id && (repeatsPosition || isBounceBack)) {
          addMoveUnique(m);
          continue;
        }
      }
    }

    if (forbidden.length >= allLegal.length) {
      forbidden.length = 0;
      if (cycle && cycle.nextCycleMove && allLegal.length > 1) {
        addMoveUnique(cycle.nextCycleMove);
      }
    }

    return forbidden;
  }

  getAllLegalMoves(color, board = this.board) {
    const all = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === color) {
          const ms = this.getLegalMoves(r, c, board);
          for (let i = 0; i < ms.length; i++) all.push(ms[i]);
        }
      }
    }
    return all;
  }

  diagnoseIllegalMove(fr, fc, tr, tc) {
    const p = this.board[fr]?.[fc];
    if (!p) return null;
    const color = p.color;
    const isJieqi = this.variantMode === 'jieqi';
    const isHidden = Boolean(p.isHidden);
    const activeType = isHidden ? (p.posType || this.getJieqiPositionalType(fr, fc) || p.type) : p.type;
    const pieceLabel = isHidden ? `暗子(${PIECE_CHARS[color][activeType]}位)` : p.char;
    const kingChar = color === RED ? '帥' : '將';
    const pseudo = this.getPseudoMoves(fr, fc, this.board);
    const matchedPseudo = pseudo.find(m => m.tr === tr && m.tc === tc);

    if (matchedPseudo) {
      const wasInCheckBefore = this.isInCheck(color, this.board);
      const restore = this.simulateMoveInPlace(matchedPseudo, this.board);

      const facing = this.areGeneralsFacing(this.board);
      const stillInCheck = this.isInCheck(color, this.board);
      const checkInfo = stillInCheck ? this.findCheckingPieces(color, this.board) : null;

      restore();

      if (facing) {
        let rk = null, bk = null;
        for (let r = 0; r < 10; r++) {
          for (let c = 3; c <= 5; c++) {
            const kp = this.board[r][c];
            if (kp && !kp.isHidden && kp.type === 'k') {
              if (kp.color === RED) rk = { r, c };
              else bk = { r, c };
            }
          }
        }
        return {
          icon: 'visibility_off',
          title: '禁着 · 将帅照面',
          message: `移【${pieceLabel}】致将帅同线照面，请另选落点。`,
          highlightSquares: [rk, bk, { r: tr, c: tc }].filter(Boolean)
        };
      }

      if (stillInCheck) {
        const attackerNames = checkInfo && checkInfo.attackers.length > 0
          ? checkInfo.attackers.map(a => `【${a.piece.isHidden ? '暗子' : a.piece.char}】`).join('、')
          : '敌方棋子';
        const highlights = [
          { r: tr, c: tc },
          checkInfo?.kingSq,
          ...(checkInfo?.attackers.map(a => ({ r: a.r, c: a.c })) || [])
        ].filter(Boolean);

        if (wasInCheckBefore) {
          return {
            icon: 'warning',
            title: '禁着 · 正被将军',
            message: `己方【${kingChar}】受${attackerNames}将军，请先应将。`,
            highlightSquares: highlights
          };
        }
        if (activeType === 'k') {
          return {
            icon: 'gpp_bad',
            title: '禁着 · 不可送将',
            message: `【${pieceLabel}】不可踏入敌方${attackerNames}火力网。`,
            highlightSquares: highlights
          };
        }
        return {
          icon: 'shield_locked',
          title: '禁着 · 暴露将门',
          message: `移【${pieceLabel}】致己方【${kingChar}】受${attackerNames}攻击。`,
          highlightSquares: highlights
        };
      }
    }

    const dr = tr - fr;
    const dc = tc - fc;
    const absR = Math.abs(dr);
    const absC = Math.abs(dc);
    const target = this.board[tr]?.[tc];

    if (activeType === 'n') {
      if ((absR === 2 && absC === 1) || (absR === 1 && absC === 2)) {
        const legR = fr + (absR === 2 ? Math.sign(dr) : 0);
        const legC = fc + (absC === 2 ? Math.sign(dc) : 0);
        const blocker = this.board[legR]?.[legC];
        if (blocker) {
          return {
            icon: 'block',
            title: '受阻 · 蹩马腿',
            message: `【${pieceLabel}】马腿受阻，无法跃日。`,
            highlightSquares: [{ r: legR, c: legC }, { r: tr, c: tc }]
          };
        }
      }
      return {
        icon: 'route',
        title: `步法不符 · ${pieceLabel}走日`,
        message: `【${pieceLabel}】须按“日”字对角跃进。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    if (activeType === 'b') {
      if ((!isJieqi || isHidden) && ((color === RED && tr < 5) || (color === BLACK && tr > 4))) {
        return {
          icon: 'water',
          title: '步法不符 · 不可过河',
          message: `【${pieceLabel}】限己方河界内飞田。`,
          highlightSquares: [{ r: tr, c: tc }]
        };
      }
      if (absR === 2 && absC === 2) {
        const eyeR = fr + dr / 2;
        const eyeC = fc + dc / 2;
        const blocker = this.board[eyeR]?.[eyeC];
        if (blocker) {
          return {
            icon: 'block',
            title: '受阻 · 塞象眼',
            message: `【${pieceLabel}】田心受阻，无法飞象。`,
            highlightSquares: [{ r: eyeR, c: eyeC }, { r: tr, c: tc }]
          };
        }
      }
      return {
        icon: 'route',
        title: `步法不符 · ${pieceLabel}飞田`,
        message: `【${pieceLabel}】须沿“田”字对角斜行。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    if (activeType === 'k' || activeType === 'a') {
      if ((activeType === 'k' || !isJieqi || isHidden) && !this.inPalace(tr, tc, color)) {
        return {
          icon: 'grid_off',
          title: '步法不符 · 限居九宫',
          message: `【${pieceLabel}】限在己方九宫内行棋。`,
          highlightSquares: [{ r: tr, c: tc }]
        };
      }
      return {
        icon: 'route',
        title: `步法不符 · ${pieceLabel}`,
        message: activeType === 'k' ? `【${pieceLabel}】每步限横竖走一格。` : `【${pieceLabel}】每步限九宫斜走一格。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    if (activeType === 'c') {
      if (fr === tr || fc === tc) {
        let between = 0;
        const stepR = Math.sign(dr);
        const stepC = Math.sign(dc);
        let curR = fr + stepR, curC = fc + stepC;
        while (curR !== tr || curC !== tc) {
          if (this.board[curR][curC]) between++;
          curR += stepR;
          curC += stepC;
        }
        if (target && target.color !== color) {
          if (between === 0) {
            return {
              icon: 'flare',
              title: '步法不符 · 炮打隔山',
              message: `【${pieceLabel}】吃子须隔一子作炮架。`,
              highlightSquares: [{ r: tr, c: tc }]
            };
          }
          if (between > 1) {
            return {
              icon: 'flare',
              title: '受阻 · 炮架过多',
              message: `【${pieceLabel}】隔山打子限隔一子（当前隔${between}子）。`,
              highlightSquares: [{ r: tr, c: tc }]
            };
          }
        } else if (!target && between > 0) {
          return {
            icon: 'block',
            title: '受阻 · 路径有子',
            message: `【${pieceLabel}】移动时不可越子。`,
            highlightSquares: [{ r: tr, c: tc }]
          };
        }
      }
      return {
        icon: 'route',
        title: `步法不符 · ${pieceLabel}直行`,
        message: `【${pieceLabel}】限沿横竖直线行棋。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    if (activeType === 'r') {
      if (fr === tr || fc === tc) {
        return {
          icon: 'block',
          title: '受阻 · 車路被挡',
          message: `【${pieceLabel}】路径受阻，不可越子。`,
          highlightSquares: [{ r: tr, c: tc }]
        };
      }
      return {
        icon: 'route',
        title: `步法不符 · ${pieceLabel}直行`,
        message: `【${pieceLabel}】限沿横竖直线行棋。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    if (activeType === 'p') {
      const isBackward = (color === RED && tr > fr) || (color === BLACK && tr < fr);
      if (isBackward) {
        return {
          icon: 'undo',
          title: '步法不符 · 不可后退',
          message: `【${pieceLabel}】只可进或平，不可退。`,
          highlightSquares: [{ r: tr, c: tc }]
        };
      }
      const notCrossedRiver = isHidden || (color === RED && fr >= 5) || (color === BLACK && fr <= 4);
      if (notCrossedRiver && fr === tr && absC === 1) {
        return {
          icon: 'water',
          title: '步法不符 · 未过河禁横',
          message: `【${pieceLabel}】未过河限向前一步。`,
          highlightSquares: [{ r: tr, c: tc }]
        };
      }
      return {
        icon: 'route',
        title: `步法不符 · ${pieceLabel}走一格`,
        message: `【${pieceLabel}】每步限走一格。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    return {
      icon: 'error',
      title: '禁着 · 落点无效',
      message: `请选择棋盘高亮落点。`,
      highlightSquares: [{ r: tr, c: tc }]
    };
  }

  makeMove(move) {
    const piece = this.board[move.fr][move.fc];
    const captured = this.board[move.tr][move.tc];
    const turnBefore = this.turn;
    const boardBefore = this.cloneBoard(this.board);
    const pieceBefore = { ...piece };
    const capturedBefore = captured ? { ...captured } : null;

    this.board[move.tr][move.tc] = piece;
    this.board[move.fr][move.fc] = null;

    let flipped = false;
    if (piece && piece.isHidden) {
      flipped = true;
      piece.isHidden = false;
      piece.type = piece.realType || piece.type;
      piece.char = piece.realChar || PIECE_CHARS[piece.color][piece.type];
    }

    if (capturedBefore) {
      if (capturedBefore.color === RED) this.capturedRed.push({ ...capturedBefore });
      else this.capturedBlack.push({ ...capturedBefore });
    }

    const actionTag = this.classifyMoveAction(move, piece, boardBefore, this.board);

    this.turn = this.turn === RED ? BLACK : RED;
    const posKeyAfter = this.getPositionKey(this.board, this.turn);
    const gaveCheck = actionTag.type === 'jiang';

    this.history.push({
      move: { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc },
      piece: pieceBefore,
      pieceAfter: { ...piece },
      flipped,
      captured: capturedBefore,
      turnBefore,
      posKeyAfter,
      gaveCheck,
      actionTag
    });

    this.invalidateTacticalCache();
    return { piece, pieceBefore, captured: capturedBefore, flipped, actionTag };
  }

  undoLastMove() {
    if (this.history.length === 0) return null;
    const last = this.history.pop();
    const { move, piece, captured, turnBefore } = last;

    const currentObj = this.board[move.tr]?.[move.tc];
    if (currentObj && currentObj.id === piece.id) {
      Object.assign(currentObj, piece);
      this.board[move.fr][move.fc] = currentObj;
    } else {
      this.board[move.fr][move.fc] = { ...piece };
    }
    this.board[move.tr][move.tc] = captured ? { ...captured } : null;

    if (captured) {
      if (captured.color === RED) this.capturedRed.pop();
      else this.capturedBlack.pop();
    }

    this.turn = turnBefore;
    this.invalidateTacticalCache();
    return last;
  }
}
