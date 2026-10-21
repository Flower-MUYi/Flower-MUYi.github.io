/*************************************************************************
 * CHINESE CHESS MAIN ENGINE (Core Rules, Cycle Adjudication, Proactive Variation Guard)
 *************************************************************************/
class XiangqiEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: 10 }, () => Array(9).fill(null));
    this.turn = RED;
    this.history = [];
    this.capturedRed = [];
    this.capturedBlack = [];
    this.setupInitialBoard();
    this.initialPosKey = this.getPositionKey(this.board, RED);
  }

  clearCapturesAndHistory() {
    this.history = [];
    this.capturedRed = [];
    this.capturedBlack = [];
    this.initialPosKey = this.getPositionKey(this.board, this.turn);
  }

  getPositionKey(board = this.board, turn = this.turn) {
    let s = turn + ':';
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        s += p ? (p.color + p.type) : '..';
      }
    }
    return s;
  }

  setupInitialBoard() {
    let nextId = 1;
    const place = (r, c, color, type) => {
      this.board[r][c] = {
        id: nextId++,
        color,
        type,
        char: PIECE_CHARS[color][type]
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
    if (!piece || piece.type !== 'p') return false;
    return piece.color === RED ? r >= 5 : r <= 4;
  }

  getPseudoMoves(r, c, board = this.board) {
    const p = board[r][c];
    if (!p) return [];
    const moves = [];
    const { color, type } = p;

    const addIfValid = (nr, nc) => {
      if (!this.inBounds(nr, nc)) return false;
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
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (this.inPalace(nr, nc, color)) addIfValid(nr, nc);
      }
    } else if (type === 'a') {
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (this.inPalace(nr, nc, color)) addIfValid(nr, nc);
      }
    } else if (type === 'b') {
      const dirs = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        const er = r + dr / 2, ec = c + dc / 2;
        if (!this.inBounds(nr, nc)) continue;
        if (color === RED && nr < 5) continue;
        if (color === BLACK && nr > 4) continue;
        if (board[er][ec] === null) addIfValid(nr, nc);
      }
    } else if (type === 'n') {
      const jumps = [
        { lr: -1, lc: 0, dr: -2, dc: -1 },
        { lr: -1, lc: 0, dr: -2, dc: 1 },
        { lr: 1, lc: 0, dr: 2, dc: -1 },
        { lr: 1, lc: 0, dr: 2, dc: 1 },
        { lr: 0, lc: -1, dr: -1, dc: -2 },
        { lr: 0, lc: -1, dr: 1, dc: -2 },
        { lr: 0, lc: 1, dr: -1, dc: 2 },
        { lr: 0, lc: 1, dr: 1, dc: 2 }
      ];
      for (const j of jumps) {
        const legR = r + j.lr, legC = c + j.lc;
        if (this.inBounds(legR, legC) && board[legR][legC] === null) {
          addIfValid(r + j.dr, c + j.dc);
        }
      }
    } else if (type === 'r') {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (this.inBounds(nr, nc)) {
          if (!addIfValid(nr, nc)) break;
          nr += dr;
          nc += dc;
        }
      }
    } else if (type === 'c') {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        let jumped = false;
        while (this.inBounds(nr, nc)) {
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
      const crossedRiver = color === RED ? r <= 4 : r >= 5;
      if (crossedRiver) {
        addIfValid(r, c - 1);
        addIfValid(r, c + 1);
      }
    }

    return moves;
  }

  areGeneralsFacing(board = this.board) {
    let rk = null, bk = null;
    for (let r = 0; r < 10; r++) {
      for (let c = 3; c <= 5; c++) {
        const p = board[r][c];
        if (p && p.type === 'k') {
          if (p.color === RED) rk = { r, c };
          else bk = { r, c };
        }
      }
    }
    if (!rk || !bk || rk.c !== bk.c) return false;
    for (let r = bk.r + 1; r < rk.r; r++) {
      if (board[r][rk.c] !== null) return false;
    }
    return true;
  }

  isInCheck(color, board = this.board) {
    if (this.areGeneralsFacing(board)) return true;

    let kr = -1, kc = -1;
    for (let r = 0; r < 10; r++) {
      for (let c = 3; c <= 5; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === 'k') {
          kr = r;
          kc = c;
          break;
        }
      }
    }
    if (kr === -1) return true;

    const enemy = color === RED ? BLACK : RED;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === enemy) {
          const moves = this.getPseudoMoves(r, c, board);
          for (const m of moves) {
            if (m.tr === kr && m.tc === kc) return true;
          }
        }
      }
    }
    return false;
  }

  hasAnyLegalMove(color, board = this.board) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === color) {
          const pseudo = this.getPseudoMoves(r, c, board);
          for (const m of pseudo) {
            const saved = board[m.tr][m.tc];
            board[m.tr][m.tc] = p;
            board[m.fr][m.fc] = null;
            const inChk = this.isInCheck(color, board);
            board[m.fr][m.fc] = p;
            board[m.tr][m.tc] = saved;
            if (!inChk) return true;
          }
        }
      }
    }
    return false;
  }

  hasMateInOne(attackerColor, defenderColor, board) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (!p || p.color !== attackerColor) continue;
        const pseudo = this.getPseudoMoves(r, c, board);
        for (const m of pseudo) {
          if (m.capture && m.capture.type === 'k') continue;
          const saved = board[m.tr][m.tc];
          board[m.tr][m.tc] = p;
          board[m.fr][m.fc] = null;

          let isMate = false;
          if (!this.isInCheck(attackerColor, board) && this.isInCheck(defenderColor, board)) {
            if (!this.hasAnyLegalMove(defenderColor, board)) {
              isMate = true;
            }
          }

          board[m.fr][m.fc] = p;
          board[m.tr][m.tc] = saved;
          if (isMate) return true;
        }
      }
    }
    return false;
  }

  isTargetProtectedAfterCapture(ar, ac, tr, tc, board) {
    const attacker = board[ar][ac];
    const target = board[tr][tc];
    if (!attacker || !target) return false;
    const defenderColor = target.color;

    board[tr][tc] = attacker;
    board[ar][ac] = null;

    let canRecapture = false;
    for (let r = 0; r < 10 && !canRecapture; r++) {
      for (let c = 0; c < 9 && !canRecapture; c++) {
        const dp = board[r][c];
        if (dp && dp.color === defenderColor) {
          const pseudo = this.getPseudoMoves(r, c, board);
          for (const m of pseudo) {
            if (m.tr === tr && m.tc === tc) {
              const saved2 = board[tr][tc];
              board[tr][tc] = dp;
              board[r][c] = null;
              const illegal = this.isInCheck(defenderColor, board);
              board[r][c] = dp;
              board[tr][tc] = saved2;
              if (!illegal) {
                canRecapture = true;
                break;
              }
            }
          }
        }
      }
    }

    board[ar][ac] = attacker;
    board[tr][tc] = target;
    return canRecapture;
  }

  getValidChasesOnBoard(moverColor, board) {
    const chases = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const attacker = board[r][c];
        if (!attacker || attacker.color !== moverColor) continue;
        const pseudo = this.getPseudoMoves(r, c, board);
        for (const m of pseudo) {
          const target = m.capture;
          if (!target || target.type === 'k') continue;
          if (this.isUncrossedPawn(target, m.tr)) continue;

          board[m.tr][m.tc] = attacker;
          board[r][c] = null;
          const selfInCheck = this.isInCheck(moverColor, board);
          board[r][c] = attacker;
          board[m.tr][m.tc] = target;
          if (selfInCheck) continue;

          const attackerTier = this.getCaptureTier(attacker.type);
          const targetTier = this.getCaptureTier(target.type);
          const isLowerCapturesHigher = attacker.type !== 'k' && targetTier > attackerTier;
          const isUnprotected = !this.isTargetProtectedAfterCapture(r, c, m.tr, m.tc, board);

          if (isLowerCapturesHigher || isUnprotected) {
            chases.push({
              attackerId: attacker.id,
              attackerType: attacker.type,
              attackerChar: attacker.char,
              ar: r,
              ac: c,
              targetId: target.id,
              targetType: target.type,
              targetChar: target.char,
              tr: m.tr,
              tc: m.tc
            });
          }
        }
      }
    }
    return chases;
  }

  classifyMoveAction(move, movedPiece, boardBefore, boardAfter) {
    const moverColor = movedPiece.color;
    const defenderColor = moverColor === RED ? BLACK : RED;

    if (this.isInCheck(defenderColor, boardAfter)) {
      return {
        type: 'jiang',
        label: '将',
        desc: `${movedPiece.char}将军`,
        chasedTargetIds: []
      };
    }

    const hadMateBefore = this.hasMateInOne(moverColor, defenderColor, boardBefore);
    const hasMateAfter = this.hasMateInOne(moverColor, defenderColor, boardAfter);
    if (hasMateAfter && (!hadMateBefore || movedPiece.type === 'r' || movedPiece.type === 'c' || movedPiece.type === 'n' || movedPiece.type === 'p')) {
      return {
        type: 'sha',
        label: '杀',
        desc: `${movedPiece.char}叫杀`,
        chasedTargetIds: []
      };
    }

    const chasesBefore = this.getValidChasesOnBoard(moverColor, boardBefore);
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
          desc: `${pawnChase.attackerChar}捉${pawnChase.targetChar}（单方算闲/长打算打）`,
          chasedTargetIds: targetIds
        };
      }

      const kingChase = newlyCreatedChases.find(c => c.attackerType === 'k');
      if (kingChase) {
        return {
          type: 'king_zhuo',
          label: `${kingChase.attackerChar}捉${kingChase.targetChar}`,
          desc: `${kingChase.attackerChar}捉${kingChase.targetChar}（允许着法）`,
          chasedTargetIds: targetIds
        };
      }
    }

    return {
      type: 'xian',
      label: '闲',
      desc: `${movedPiece.char}闲着`,
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
      if (h.captured || isPawnForward) {
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
          shortName = '兵卒长捉(算闲)';
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
          fullLabel: `${sideName}：${shortName}（允许）`,
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
        fullLabel: `${sideName}：${shortName}（禁止）`,
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
      verdictShort = '红方负（单方长将）';
      ruleExplanation = `单方长将者不变判负，红方必须变着！`;
    } else if (blackInfo.isPerpetualCheck && !redInfo.isPerpetualCheck) {
      verdict = 'BLACK_LOSE';
      violator = BLACK;
      verdictShort = '黑方负（单方长将）';
      ruleExplanation = `单方长将者不变判负，黑方必须变着！`;
    } else if ((redInfo.permitted && blackInfo.permitted) || (!redInfo.permitted && !blackInfo.permitted)) {
      verdict = 'DRAW';
      violator = null;
      verdictShort = '双方不变判和';
      ruleExplanation = `双方同属允许着法或双方长打，不变作和。`;
    } else if (!redInfo.permitted && blackInfo.permitted) {
      verdict = 'RED_LOSE';
      violator = RED;
      verdictShort = `红方负（${redInfo.shortName}不变）`;
      ruleExplanation = `红方为禁止着法【${redInfo.shortName}】，应变着，否则判负！`;
    } else {
      verdict = 'BLACK_LOSE';
      violator = BLACK;
      verdictShort = `黑方负（${blackInfo.shortName}不变）`;
      ruleExplanation = `黑方为禁止着法【${blackInfo.shortName}】，应变着，否则判负！`;
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
        if (p && p.color === color && p.type === 'k') {
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

  getLegalMoves(r, c) {
    const p = this.board[r][c];
    if (!p) return [];
    const pseudo = this.getPseudoMoves(r, c, this.board);
    const legal = [];

    for (const m of pseudo) {
      const savedTarget = this.board[m.tr][m.tc];
      this.board[m.tr][m.tc] = p;
      this.board[m.fr][m.fc] = null;

      const inCheck = this.isInCheck(p.color, this.board);

      this.board[m.fr][m.fc] = p;
      this.board[m.tr][m.tc] = savedTarget;

      if (!inCheck) {
        legal.push(m);
      }
    }
    return legal;
  }

  /**
   * 获取当前方的禁止循环着法与长将/长捉/收到长将长捉时的主动变招规避着法
   * 覆盖：简单 (easy)、困难 (hard)、宗师 (inferno)、支招 (grandmaster_hint) 全部难度！
   * 1. 当已触发循环裁决警告 (analyzeCycleStatus) 时：全面封禁继续循环、继续同子将军或同目标追捉的着法；
   * 2. 当连续 2 步己方执行“将/捉/杀”时：严禁无吃子重复盘面或连续第 3 次追捉同一敌子 / 原路折返将军；
   * 3. 当收到敌方长将/长捉威胁且己方存在非重复的解围/反击变招时：主动排除原路往返的被动重复步，促使 AI 主动变招。
   */
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
      if (h.captured || isPawnForward) lastIrreversiblePly = i + 1;
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

    // 收集己方最近两步连续追捉的敌方棋子 ID
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

    for (const m of allLegal) {
      const piece = this.board[m.fr][m.fc];
      if (!piece) continue;

      const savedTarget = this.board[m.tr][m.tc];
      const boardBefore = this.cloneBoard(this.board);
      this.board[m.tr][m.tc] = piece;
      this.board[m.fr][m.fc] = null;

      // 若该步直接一步绝杀（敌方无合法应着），绝不禁止！
      const isImmediateMate = this.isInCheck(nextTurn, this.board) && !this.hasAnyLegalMove(nextTurn, this.board);
      if (isImmediateMate) {
        this.board[m.fr][m.fc] = piece;
        this.board[m.tr][m.tc] = savedTarget;
        continue;
      }

      const nextKey = this.getPositionKey(this.board, nextTurn);
      const repeatsPosition = !savedTarget && recentPosKeys.has(nextKey);
      const boardAfter = this.cloneBoard(this.board);
      const tag = this.classifyMoveAction(m, piece, boardBefore, boardAfter);

      this.board[m.fr][m.fc] = piece;
      this.board[m.tr][m.tc] = savedTarget;

      const isBounceBack = Boolean(
        !savedTarget &&
        lastOwn1 &&
        lastOwn1.move.fr === m.tr &&
        lastOwn1.move.fc === m.tc &&
        lastOwn1.move.tr === m.fr &&
        lastOwn1.move.tc === m.fc
      );

      // 1. 若已触发循环裁决警告：禁止任何导致重复盘面的着法，且若己方处于长将/长捉违例侧，禁止继续空将或追捉
      if (cycle && repeatsPosition) {
        addMoveUnique(m);
        continue;
      }
      if (cycleActiveForSide && !savedTarget && isAttackTag(tag.type)) {
        addMoveUnique(m);
        continue;
      }

      // 2. 任何非吃子步若直接导致盘面重复且属于“将 / 杀 / 捉”，立即禁止（防止形成长将、长捉）
      if (repeatsPosition && isAttackTag(tag.type)) {
        addMoveUnique(m);
        continue;
      }

      // 3. 己方刚走出“将 / 杀 / 捉”后原路折返继续“将 / 杀 / 捉”，立即禁止
      if (isBounceBack && lastOwn1 && (isAttackTag(lastOwn1.actionTag?.type) || isAttackTag(tag.type))) {
        addMoveUnique(m);
        continue;
      }

      // 4. 己方已连续 2 步将军 (连将)，若第 3 步仍用同一棋子不吃子将军且重复盘面或往返将军，强制变招
      if (ownConsecutiveChecks && !savedTarget && tag.type === 'jiang' && (repeatsPosition || isBounceBack || piece.id === lastOwn1.piece.id)) {
        addMoveUnique(m);
        continue;
      }

      // 5. 己方已连续 2 步追捉同一敌子，第 3 步仍不吃子继续追捉该敌子，强制变招
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

      // 6. 收到敌方连续长将/长捉威胁时：若己方该步只是原路折返或重复旧盘面，将其列入规避列表以优先选择打破循环的变招
      if ((oppConsecutiveAttack || (lastOpp1 && isAttackTag(lastOpp1.actionTag?.type))) && (repeatsPosition || isBounceBack)) {
        addMoveUnique(m);
        continue;
      }
    }

    // 安全保底：若所有合法着法均被标记（例如被将死前仅有唯一解将步），则只保留真正违例的 nextCycleMove
    if (forbidden.length >= allLegal.length) {
      forbidden.length = 0;
      if (cycle && cycle.nextCycleMove && allLegal.length > 1) {
        addMoveUnique(cycle.nextCycleMove);
      }
    }

    return forbidden;
  }

  getAllLegalMoves(color) {
    const all = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = this.board[r][c];
        if (p && p.color === color) {
          const ms = this.getLegalMoves(r, c);
          for (const m of ms) all.push(m);
        }
      }
    }
    return all;
  }

  diagnoseIllegalMove(fr, fc, tr, tc) {
    const p = this.board[fr]?.[fc];
    if (!p) return null;
    const color = p.color;
    const kingChar = color === RED ? '帥' : '將';
    const pseudo = this.getPseudoMoves(fr, fc, this.board);
    const matchedPseudo = pseudo.find(m => m.tr === tr && m.tc === tc);

    if (matchedPseudo) {
      const wasInCheckBefore = this.isInCheck(color, this.board);
      const savedTarget = this.board[tr][tc];
      this.board[tr][tc] = p;
      this.board[fr][fc] = null;

      const facing = this.areGeneralsFacing(this.board);
      const stillInCheck = this.isInCheck(color, this.board);
      const checkInfo = stillInCheck ? this.findCheckingPieces(color, this.board) : null;

      this.board[fr][fc] = p;
      this.board[tr][tc] = savedTarget;

      if (facing) {
        let rk = null, bk = null;
        for (let r = 0; r < 10; r++) {
          for (let c = 3; c <= 5; c++) {
            const kp = this.board[r][c];
            if (kp && kp.type === 'k') {
              if (kp.color === RED) rk = { r, c };
              else bk = { r, c };
            }
          }
        }
        return {
          icon: 'visibility_off',
          title: '禁着提示 · 将帅不可照面',
          message: `移动【${p.char}】后会导致红黑【帥/將】在同一直线上直接照面（飞将）！`,
          highlightSquares: [rk, bk, { r: tr, c: tc }].filter(Boolean)
        };
      }

      if (stillInCheck) {
        const attackerNames = checkInfo && checkInfo.attackers.length > 0
          ? checkInfo.attackers.map(a => `【${a.piece.char}】`).join('、')
          : '敌方棋子';
        const highlights = [
          { r: tr, c: tc },
          checkInfo?.kingSq,
          ...(checkInfo?.attackers.map(a => ({ r: a.r, c: a.c })) || [])
        ].filter(Boolean);

        if (wasInCheckBefore) {
          return {
            icon: 'warning',
            title: '禁着提示 · 当前正被将军',
            message: `己方【${kingChar}】正受敌方${attackerNames}将军，请先应将解围！`,
            highlightSquares: highlights
          };
        }
        if (p.type === 'k') {
          return {
            icon: 'gpp_bad',
            title: '禁着提示 · 不可送将',
            message: `不可将【${p.char}】移至敌方${attackerNames}的攻击火力下！`,
            highlightSquares: highlights
          };
        }
        return {
          icon: 'shield_locked',
          title: '禁着提示 · 移动后己方被将军',
          message: `【${p.char}】正护住将门，移走会导致己方【${kingChar}】被${attackerNames}将军！`,
          highlightSquares: highlights
        };
      }
    }

    const dr = tr - fr;
    const dc = tc - fc;
    const absR = Math.abs(dr);
    const absC = Math.abs(dc);
    const target = this.board[tr]?.[tc];

    if (p.type === 'n') {
      if ((absR === 2 && absC === 1) || (absR === 1 && absC === 2)) {
        const legR = fr + (absR === 2 ? Math.sign(dr) : 0);
        const legC = fc + (absC === 2 ? Math.sign(dc) : 0);
        const blocker = this.board[legR]?.[legC];
        if (blocker) {
          return {
            icon: 'block',
            title: '走法受阻 · 蹩马腿',
            message: `【${p.char}】前进方向的马腿被【${blocker.char}】阻挡，无法跃出！`,
            highlightSquares: [{ r: legR, c: legC }, { r: tr, c: tc }]
          };
        }
      }
      return {
        icon: 'route',
        title: `走法违规 · 【${p.char}】走日字`,
        message: `【${p.char}】只能按“日”字对角线跃进。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    if (p.type === 'b') {
      if ((color === RED && tr < 5) || (color === BLACK && tr > 4)) {
        return {
          icon: 'water',
          title: '走法违规 · 相/象不可过河',
          message: `【${p.char}】只能在己方河界内飞“田”字，不可过河！`,
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
            title: '走法受阻 · 塞象眼',
            message: `【${p.char}】田字中心被【${blocker.char}】阻挡（塞象眼）！`,
            highlightSquares: [{ r: eyeR, c: eyeC }, { r: tr, c: tc }]
          };
        }
      }
      return {
        icon: 'route',
        title: `走法违规 · 【${p.char}】飞田字`,
        message: `【${p.char}】只能斜走两格（“田”字对角）。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    if (p.type === 'k' || p.type === 'a') {
      if (!this.inPalace(tr, tc, color)) {
        return {
          icon: 'grid_off',
          title: '走法违规 · 不可出九宫',
          message: `【${p.char}】只能在己方九宫格内活动！`,
          highlightSquares: [{ r: tr, c: tc }]
        };
      }
      return {
        icon: 'route',
        title: `走法违规 · 【${p.char}】步法不符`,
        message: p.type === 'k' ? `【${p.char}】每次只能沿横竖线走一格。` : `【${p.char}】每次只能沿九宫斜线走一格。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    if (p.type === 'c') {
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
              title: '走法违规 · 炮打隔山',
              message: `【${p.char}】吃子时中间必须隔一枚棋子（炮架）！`,
              highlightSquares: [{ r: tr, c: tc }]
            };
          }
          if (between > 1) {
            return {
              icon: 'flare',
              title: '走法违规 · 炮架超过一子',
              message: `【${p.char}】隔山打子只能隔一枚棋子，当前隔了 ${between} 枚！`,
              highlightSquares: [{ r: tr, c: tc }]
            };
          }
        } else if (!target && between > 0) {
          return {
            icon: 'block',
            title: '走法受阻 · 不吃子不可越子',
            message: `【${p.char}】不吃子移动时路径上不能越过其他棋子！`,
            highlightSquares: [{ r: tr, c: tc }]
          };
        }
      }
      return {
        icon: 'route',
        title: `走法违规 · 【${p.char}】只能直走`,
        message: `【${p.char}】只能沿横线或竖线直线移动。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    if (p.type === 'r') {
      if (fr === tr || fc === tc) {
        return {
          icon: 'block',
          title: '走法受阻 · 車路被挡',
          message: `【${p.char}】路径上有棋子阻挡，不能越子移动！`,
          highlightSquares: [{ r: tr, c: tc }]
        };
      }
      return {
        icon: 'route',
        title: `走法违规 · 【${p.char}】只能直走`,
        message: `【${p.char}】只能沿横线或竖线直线移动。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    if (p.type === 'p') {
      const isBackward = (color === RED && tr > fr) || (color === BLACK && tr < fr);
      if (isBackward) {
        return {
          icon: 'undo',
          title: '走法违规 · 兵/卒不可后退',
          message: `【${p.char}】只能向前或过河后平走，不可后退！`,
          highlightSquares: [{ r: tr, c: tc }]
        };
      }
      const notCrossedRiver = (color === RED && fr >= 5) || (color === BLACK && fr <= 4);
      if (notCrossedRiver && fr === tr && absC === 1) {
        return {
          icon: 'water',
          title: '走法违规 · 未过河不可横走',
          message: `【${p.char}】未越过楚河汉界前只能向前直走！`,
          highlightSquares: [{ r: tr, c: tc }]
        };
      }
      return {
        icon: 'route',
        title: `走法违规 · 【${p.char}】每次走一格`,
        message: `【${p.char}】每次只能移动一格。`,
        highlightSquares: [{ r: tr, c: tc }]
      };
    }

    return {
      icon: 'error',
      title: '走法违规 · 不可移动至此',
      message: `请点击棋盘上高亮的合法落点。`,
      highlightSquares: [{ r: tr, c: tc }]
    };
  }

  makeMove(move) {
    const piece = this.board[move.fr][move.fc];
    const captured = this.board[move.tr][move.tc];
    const turnBefore = this.turn;
    const boardBefore = this.cloneBoard(this.board);

    this.board[move.tr][move.tc] = piece;
    this.board[move.fr][move.fc] = null;

    if (captured) {
      if (captured.color === RED) this.capturedRed.push(captured);
      else this.capturedBlack.push(captured);
    }

    const boardAfter = this.cloneBoard(this.board);
    const actionTag = this.classifyMoveAction(move, piece, boardBefore, boardAfter);

    this.turn = this.turn === RED ? BLACK : RED;
    const posKeyAfter = this.getPositionKey(this.board, this.turn);
    const gaveCheck = actionTag.type === 'jiang';

    this.history.push({
      move: { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc },
      piece: { ...piece },
      captured: captured ? { ...captured } : null,
      turnBefore,
      posKeyAfter,
      gaveCheck,
      actionTag
    });

    return { piece, captured, actionTag };
  }

  undoLastMove() {
    if (this.history.length === 0) return null;
    const last = this.history.pop();
    const { move, piece, captured, turnBefore } = last;

    this.board[move.fr][move.fc] = piece;
    this.board[move.tr][move.tc] = captured;

    if (captured) {
      if (captured.color === RED) this.capturedRed.pop();
      else this.capturedBlack.pop();
    }

    this.turn = turnBefore;
    return last;
  }
}
