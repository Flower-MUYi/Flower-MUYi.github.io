/*************************************************************************
 * GRANDMASTER XIANGQI AI ENGINE WORKER
 * Supports 4 Distinct Tiers:
 *   1. easy             - 新手友好（浅层直觉评估 + 柔和着法选择，照顾新手体验）
 *   2. hard             - 高手进阶（开局库 + 迭代加深 PVS + 置换表 + 历史/杀手启发 + 静态搜索，对接高手）
 *   3. inferno          - 宗师（全开局库 + 连将/叫杀算杀器 + 渴望窗口 + SEE + 空步/LMR/延伸 + 宫城攻防精评，算尽变化）
 *   4. grandmaster_hint - 支招（残局连将/锁喉算杀器 + 全局宗师深算，兼顾破解残局与全局推演）
 * Built-in Rule Guard:
 *   Strictly filters and penalizes perpetual check (长将), perpetual chase (长捉), and repetitive cycles at both root and tree nodes.
 *************************************************************************/

importScripts('constants.js');

let seed = 0x13579BDF;
function rand32() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
}

const PIECE_KEYS = ['rk', 'ra', 'rb', 'rn', 'rr', 'rc', 'rp', 'bk', 'ba', 'bb', 'bn', 'br', 'bc', 'bp'];
const KEY_MAP = {};
PIECE_KEYS.forEach((k, i) => { KEY_MAP[k] = i; });

const ZOBRIST_LO = Array.from({ length: 14 }, () => Array.from({ length: 90 }, () => rand32()));
const ZOBRIST_HI = Array.from({ length: 14 }, () => Array.from({ length: 90 }, () => rand32()));
const ZOBRIST_TURN_LO = rand32();
const ZOBRIST_TURN_HI = rand32();

// 1M entries Transposition Table for deep Grandmaster & Hint search
const TT_SIZE = 1 << 20;
const TT_MASK = TT_SIZE - 1;
const ttHashHi = new Uint32Array(TT_SIZE);
const ttDepth = new Int8Array(TT_SIZE);
const ttFlag = new Uint8Array(TT_SIZE);
const ttScore = new Int32Array(TT_SIZE);
const ttMove = new Uint32Array(TT_SIZE);

const historyTable = new Int32Array(90 * 90);
const counterMoveTable = new Uint32Array(90 * 90);
const killerMoves = Array.from({ length: 64 }, () => [0, 0]);

// Search state & path tracking for repetition / perpetual check / chase avoidance
const pathHashLo = new Uint32Array(128);
const pathHashHi = new Uint32Array(128);
const pathGaveCheck = new Uint8Array(128);
const pathWasChase = new Uint8Array(128);
let gameHistoryHashes = [];
let rootAllowedMoves = null;

function encodeMove(m) {
  return (m.fr << 12) | (m.fc << 8) | (m.tr << 4) | m.tc;
}

function inPalace(r, c, color) {
  if (c < 3 || c > 5) return false;
  return color === RED ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
}

function getCaptureTier(type) {
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

function isUncrossedPawn(piece, r) {
  if (!piece || piece.type !== 'p') return false;
  return piece.color === RED ? r >= 5 : r <= 4;
}

function getPseudoMoves(r, c, board, capturesOnly = false) {
  const p = board[r][c];
  if (!p) return [];
  const moves = [];
  const color = p.color;
  const type = p.type;

  const addIfValid = (nr, nc) => {
    if (nr < 0 || nr >= 10 || nc < 0 || nc >= 9) return false;
    const target = board[nr][nc];
    if (!target) {
      if (!capturesOnly) moves.push({ fr: r, fc: c, tr: nr, tc: nc, capture: null });
      return true;
    } else if (target.color !== color) {
      moves.push({ fr: r, fc: c, tr: nr, tc: nc, capture: target });
      return false;
    }
    return false;
  };

  if (type === 'k') {
    if (c > 3) addIfValid(r, c - 1);
    if (c < 5) addIfValid(r, c + 1);
    if (color === RED) {
      if (r > 7) addIfValid(r - 1, c);
      if (r < 9) addIfValid(r + 1, c);
    } else {
      if (r > 0) addIfValid(r - 1, c);
      if (r < 2) addIfValid(r + 1, c);
    }
  } else if (type === 'a') {
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let i = 0; i < 4; i++) {
      const nr = r + dirs[i][0], nc = c + dirs[i][1];
      if (inPalace(nr, nc, color)) addIfValid(nr, nc);
    }
  } else if (type === 'b') {
    const dirs = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
    for (let i = 0; i < 4; i++) {
      const nr = r + dirs[i][0], nc = c + dirs[i][1];
      if (nr < 0 || nr >= 10 || nc < 0 || nc >= 9) continue;
      if (color === RED && nr < 5) continue;
      if (color === BLACK && nr > 4) continue;
      if (board[r + (dirs[i][0] >> 1)][c + (dirs[i][1] >> 1)] === null) {
        addIfValid(nr, nc);
      }
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
            if (!capturesOnly) moves.push({ fr: r, fc: c, tr: nr, tc: nc, capture: null });
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
    if (color === RED ? r <= 4 : r >= 5) {
      if (c > 0) addIfValid(r, c - 1);
      if (c < 8) addIfValid(r, c + 1);
    }
  }
  return moves;
}

function isInCheck(color, board) {
  let kr = -1, kc = -1;
  let ekr = -1, ekc = -1;
  const rStart = color === RED ? 7 : 0;
  const rEnd = color === RED ? 9 : 2;
  for (let r = rStart; r <= rEnd; r++) {
    for (let c = 3; c <= 5; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === 'k') { kr = r; kc = c; break; }
    }
  }
  if (kr === -1) return true;

  const erStart = color === RED ? 0 : 7;
  const erEnd = color === RED ? 2 : 9;
  for (let r = erStart; r <= erEnd; r++) {
    for (let c = 3; c <= 5; c++) {
      const p = board[r][c];
      if (p && p.color !== color && p.type === 'k') { ekr = r; ekc = c; break; }
    }
  }
  if (ekr !== -1 && kc === ekc) {
    let blocked = false;
    const minR = Math.min(kr, ekr) + 1;
    const maxR = Math.max(kr, ekr);
    for (let r = minR; r < maxR; r++) {
      if (board[r][kc] !== null) { blocked = true; break; }
    }
    if (!blocked) return true;
  }

  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let d = 0; d < 4; d++) {
    const dr = dirs[d][0], dc = dirs[d][1];
    let nr = kr + dr, nc = kc + dc;
    let mounts = 0;
    let dist = 1;
    while (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
      const p = board[nr][nc];
      if (p) {
        if (mounts === 0) {
          if (p.color !== color) {
            if (p.type === 'r') return true;
            if (p.type === 'p' && dist === 1) {
              const pawnForward = p.color === RED ? -1 : 1;
              if (nr + pawnForward === kr || nr === kr) return true;
            }
          }
          mounts = 1;
        } else if (mounts === 1) {
          if (p.color !== color && p.type === 'c') return true;
          break;
        }
      }
      nr += dr;
      nc += dc;
      dist++;
    }
  }

  const hChecks = [
    { hr: -2, hc: -1 }, { hr: -2, hc: 1 },
    { hr: 2, hc: -1 },  { hr: 2, hc: 1 },
    { hr: -1, hc: -2 }, { hr: 1, hc: -2 },
    { hr: -1, hc: 2 },  { hr: 1, hc: 2 }
  ];
  for (let i = 0; i < 8; i++) {
    const hr = kr + hChecks[i].hr, hc = kc + hChecks[i].hc;
    if (hr >= 0 && hr < 10 && hc >= 0 && hc < 9) {
      const p = board[hr][hc];
      if (p && p.color !== color && p.type === 'n') {
        const legR = hr + (kr - hr === 2 ? 1 : kr - hr === -2 ? -1 : 0);
        const legC = hc + (kc - hc === 2 ? 1 : kc - hc === -2 ? -1 : 0);
        if (board[legR][legC] === null) return true;
      }
    }
  }

  return false;
}

function generateLegalMoves(color, board, capturesOnly = false) {
  const legal = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        const pseudo = getPseudoMoves(r, c, board, capturesOnly);
        for (let i = 0; i < pseudo.length; i++) {
          const m = pseudo[i];
          const saved = board[m.tr][m.tc];
          board[m.tr][m.tc] = p;
          board[m.fr][m.fc] = null;
          if (!isInCheck(color, board)) {
            legal.push(m);
          }
          board[m.fr][m.fc] = p;
          board[m.tr][m.tc] = saved;
        }
      }
    }
  }
  return legal;
}

/**
 * Checks whether the piece that just moved to (tr, tc) is now chasing (捉)
 * a higher-value or unprotected enemy piece according to Chinese Chess rules.
 */
function doesPieceChaseEnemy(board, tr, tc, moverColor) {
  const attacker = board[tr][tc];
  if (!attacker || attacker.type === 'k') return false;
  const attackerTier = getCaptureTier(attacker.type);
  const attacks = getPseudoMoves(tr, tc, board, true);
  for (let i = 0; i < attacks.length; i++) {
    const m = attacks[i];
    const target = m.capture;
    if (!target || target.type === 'k') continue;
    if (isUncrossedPawn(target, m.tr)) continue;
    const targetTier = getCaptureTier(target.type);
    if (targetTier > attackerTier) return true;
    const defenderColor = target.color;
    board[m.tr][m.tc] = attacker;
    board[tr][tc] = null;
    let protectedByEnemy = false;
    for (let r = 0; r < 10 && !protectedByEnemy; r++) {
      for (let c = 0; c < 9 && !protectedByEnemy; c++) {
        const dp = board[r][c];
        if (dp && dp.color === defenderColor) {
          const dMoves = getPseudoMoves(r, c, board, true);
          for (let j = 0; j < dMoves.length; j++) {
            if (dMoves[j].tr === m.tr && dMoves[j].tc === m.tc) {
              protectedByEnemy = true;
              break;
            }
          }
        }
      }
    }
    board[tr][tc] = attacker;
    board[m.tr][m.tc] = target;
    if (!protectedByEnemy) return true;
  }
  return false;
}

/**
 * Static Exchange Evaluation (SEE) on target square (tr, tc)
 */
function seeCaptureGain(board, m) {
  if (!m.capture) return 0;
  const mover = board[m.fr][m.fc];
  if (!mover) return 0;
  const victimVal = PIECE_VALUES[m.capture.type] || 0;
  const attackerVal = PIECE_VALUES[mover.type] || 0;
  if (victimVal >= attackerVal) return victimVal - (attackerVal >> 3);

  const enemyColor = m.capture.color;
  board[m.tr][m.tc] = mover;
  board[m.fr][m.fc] = null;
  let defended = false;
  for (let r = 0; r < 10 && !defended; r++) {
    for (let c = 0; c < 9 && !defended; c++) {
      const p = board[r][c];
      if (p && p.color === enemyColor) {
        const ms = getPseudoMoves(r, c, board, true);
        for (let i = 0; i < ms.length; i++) {
          if (ms[i].tr === m.tr && ms[i].tc === m.tc) {
            defended = true;
            break;
          }
        }
      }
    }
  }
  board[m.fr][m.fc] = mover;
  board[m.tr][m.tc] = m.capture;
  return defended ? (victimVal - attackerVal) : victimVal;
}

/**
 * Novice Evaluation for 'easy' difficulty (Simple material + mild advancement)
 */
function evaluateNovice(board, perspectiveColor) {
  let redScore = 0;
  let blackScore = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;
      let val = PIECE_VALUES[p.type];
      const pstRow = p.color === RED ? r : (9 - r);
      if (PST[p.type]) val += PST[p.type][pstRow][c] * 0.9;
      if (p.color === RED) redScore += val;
      else blackScore += val;
    }
  }
  const diff = redScore - blackScore;
  return perspectiveColor === RED ? diff : -diff;
}

/**
 * Grandmaster & Master Evaluation Function
 * Evaluates material, PST, piece mobility, horse leg freedom, central/empty cannon,
 * chariot open files & 7th/bottom rank control, advisor/elephant synergy, and palace attack pressure.
 */
function evaluateGrandmaster(board, perspectiveColor, isDeepGrandmaster = true) {
  let redScore = 0;
  let blackScore = 0;

  let redAdvisors = 0, redElephants = 0, redChariots = 0, redCannons = 0, redHorses = 0;
  let blackAdvisors = 0, blackElephants = 0, blackChariots = 0, blackCannons = 0, blackHorses = 0;
  let rkr = 9, rkc = 4, bkr = 0, bkc = 4;
  let totalPieces = 0;

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;
      totalPieces++;
      if (p.type === 'k') {
        if (p.color === RED) { rkr = r; rkc = c; }
        else { bkr = r; bkc = c; }
      }
    }
  }

  let redAttackUnits = 0;
  let blackAttackUnits = 0;

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;
      const isRed = p.color === RED;
      const type = p.type;
      let val = PIECE_VALUES[type];

      const pstRow = isRed ? r : (9 - r);
      if (PST[type]) {
        val += PST[type][pstRow][c] * 2.6;
      }

      if (isRed) {
        if (type === 'a') redAdvisors++;
        else if (type === 'b') redElephants++;
        else if (type === 'r') redChariots++;
        else if (type === 'c') redCannons++;
        else if (type === 'n') redHorses++;
      } else {
        if (type === 'a') blackAdvisors++;
        else if (type === 'b') blackElephants++;
        else if (type === 'r') blackChariots++;
        else if (type === 'c') blackCannons++;
        else if (type === 'n') blackHorses++;
      }

      // Horse mobility & palace threat
      if (type === 'n') {
        let openLegs = 0;
        if (r > 1 && !board[r - 1][c]) openLegs++;
        if (r < 8 && !board[r + 1][c]) openLegs++;
        if (c > 1 && !board[r][c - 1]) openLegs++;
        if (c < 7 && !board[r][c + 1]) openLegs++;
        val += (openLegs - 2) * 22;

        if (isDeepGrandmaster) {
          const ekR = isRed ? bkr : rkr;
          const ekC = isRed ? bkc : rkc;
          const dist = Math.abs(r - ekR) + Math.abs(c - ekC);
          if (dist <= 4) {
            val += (5 - dist) * 26;
            if (isRed) redAttackUnits += 2; else blackAttackUnits += 2;
          }
        }
      }

      // Cannon tactical positioning (中炮/空头炮/沉底炮)
      if (type === 'c') {
        const ekR = isRed ? bkr : rkr;
        const ekC = isRed ? bkc : rkc;
        if (c === ekC) {
          let between = 0;
          const minR = Math.min(r, ekR) + 1;
          const maxR = Math.max(r, ekR);
          for (let rr = minR; rr < maxR; rr++) {
            if (board[rr][c]) between++;
          }
          if (between === 0) {
            val += 165; // 空头炮
            if (isRed) redAttackUnits += 3; else blackAttackUnits += 3;
          } else if (between === 1) {
            val += 95;
            if (isRed) redAttackUnits += 2; else blackAttackUnits += 2;
          } else if (between === 2) {
            val += 65;
            if (isRed) redAttackUnits += 1; else blackAttackUnits += 1;
          }
        }
        if ((isRed && r <= 1) || (!isRed && r >= 8)) {
          val += 45; // 沉底炮
          if (isRed) redAttackUnits += 1; else blackAttackUnits += 1;
        }
      }

      // Chariot dominance (巡河/沉底/占肋道/通头车)
      if (type === 'r') {
        if (isRed && r <= 2) {
          val += 55;
          if (c === 3 || c === 5) val += 52;
          redAttackUnits += 3;
        } else if (!isRed && r >= 7) {
          val += 55;
          if (c === 3 || c === 5) val += 52;
          blackAttackUnits += 3;
        }

        if (isDeepGrandmaster) {
          let mobility = 0;
          for (let nr = r - 1; nr >= 0; nr--) { mobility++; if (board[nr][c]) break; }
          for (let nr = r + 1; nr < 10; nr++) { mobility++; if (board[nr][c]) break; }
          for (let nc = c - 1; nc >= 0; nc--) { mobility++; if (board[r][nc]) break; }
          for (let nc = c + 1; nc < 9; nc++)  { mobility++; if (board[r][nc]) break; }
          val += mobility * 6;
        }
      }

      // Crossed pawn pressure near enemy palace
      if (type === 'p') {
        const crossed = isRed ? r <= 4 : r >= 5;
        if (crossed) {
          const ekR = isRed ? bkr : rkr;
          const ekC = isRed ? bkc : rkc;
          const dist = Math.abs(r - ekR) + Math.abs(c - ekC);
          if (dist <= 3) {
            val += (4 - dist) * 32;
            if (isRed) redAttackUnits += 1; else blackAttackUnits += 1;
          }
        }
      }

      if (isRed) redScore += val;
      else blackScore += val;
    }
  }

  // Defensive synergy & palace vulnerability
  if (redAdvisors === 2) redScore += 45;
  if (blackAdvisors === 2) blackScore += 45;
  if (redElephants === 2) redScore += 35;
  if (blackElephants === 2) blackScore += 35;

  if (redAdvisors < 2 && blackChariots > 0) {
    redScore -= (2 - redAdvisors) * blackChariots * 75;
  }
  if (blackAdvisors < 2 && redChariots > 0) {
    blackScore -= (2 - blackAdvisors) * redChariots * 75;
  }
  if (redElephants < 2 && blackCannons > 0) {
    redScore -= (2 - redElephants) * blackCannons * 45;
  }
  if (blackElephants < 2 && redCannons > 0) {
    blackScore -= (2 - blackElephants) * redCannons * 45;
  }

  // Multi-piece siege pressure bonus
  if (isDeepGrandmaster) {
    if (redAttackUnits >= 4) redScore += (redAttackUnits - 3) * 42;
    if (blackAttackUnits >= 4) blackScore += (blackAttackUnits - 3) * 42;

    // White-faced King (白脸将/帅助攻) open file bonus in middlegame/endgame
    if (rkc === bkc) {
      let blockers = 0;
      for (let rr = bkr + 1; rr < rkr; rr++) {
        if (board[rr][rkc]) blockers++;
      }
      if (blockers === 1) {
        if (redChariots + redCannons > blackChariots + blackCannons) redScore += 35;
        else if (blackChariots + blackCannons > redChariots + redCannons) blackScore += 35;
      }
    }
  }

  // Endgame scaling
  if (totalPieces <= 16) {
    const phase = totalPieces <= 8 ? 1.2 : (16 - totalPieces) / 8;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (!p) continue;
        const advance = p.color === RED ? 9 - r : r;
        if (p.type === 'p') {
          const crossed = p.color === RED ? r <= 4 : r >= 5;
          const isBottom = (p.color === RED && r === 0) || (p.color === BLACK && r === 9);
          const bonus = (crossed ? 45 : 0) + (isBottom ? 12 : advance * 6);
          if (p.color === RED) redScore += bonus * phase;
          else blackScore += bonus * phase;
        } else if (p.type === 'k') {
          const centrality = 4 - Math.abs(4 - c);
          const mobilityBonus = (centrality * 8 + (p.color === RED ? 9 - r : r) * 3) * phase;
          if (p.color === RED) redScore += mobilityBonus;
          else blackScore += mobilityBonus;
        }
      }
    }
  }

  const diff = redScore - blackScore;
  return perspectiveColor === RED ? diff : -diff;
}

function computeBoardHash(board, turn) {
  let lo = turn === BLACK ? ZOBRIST_TURN_LO : 0;
  let hi = turn === BLACK ? ZOBRIST_TURN_HI : 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p) {
        const kIdx = KEY_MAP[p.color + p.type];
        const sq = r * 9 + c;
        lo ^= ZOBRIST_LO[kIdx][sq];
        hi ^= ZOBRIST_HI[kIdx][sq];
      }
    }
  }
  return { lo: lo >>> 0, hi: hi >>> 0 };
}

let nodesSearched = 0;
let stopSearch = false;
let startTime = 0;
let maxTimeMs = 1500;
let currentDifficulty = 'inferno';
let rootBestMove = null;

function orderMoves(moves, board, ttBestEncoded, ply, prevMoveEncoded = 0) {
  const k1 = killerMoves[ply] ? killerMoves[ply][0] : 0;
  const k2 = killerMoves[ply] ? killerMoves[ply][1] : 0;
  const counter = prevMoveEncoded ? counterMoveTable[prevMoveEncoded & 0x1fff] : 0;
  const prioritizeChecks = currentDifficulty === 'grandmaster_hint' || currentDifficulty === 'inferno';

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const enc = encodeMove(m);
    let score = 0;

    if (enc === ttBestEncoded) {
      score = 3000000;
    } else if (m.capture) {
      const see = seeCaptureGain(board, m);
      if (see >= 0) {
        score = 1500000 + see * 20 + PIECE_VALUES[m.capture.type];
      } else {
        score = 200000 + see * 10;
      }
    } else {
      const mover = board[m.fr][m.fc];
      const fromSq = m.fr * 9 + m.fc, toSq = m.tr * 9 + m.tc;
      if (prioritizeChecks && mover && ply < 10) {
        const savedTarget = board[m.tr][m.tc];
        board[m.tr][m.tc] = mover;
        board[m.fr][m.fc] = null;
        const givesCheck = isInCheck(mover.color === RED ? BLACK : RED, board);
        board[m.fr][m.fc] = mover;
        board[m.tr][m.tc] = savedTarget;
        m.givesCheck = givesCheck;
        if (givesCheck) score = 1350000;
      }
      if (score === 0) {
        if (enc === k1) score = 950000;
        else if (enc === k2) score = 900000;
        else if (enc === counter && counter !== 0) score = 850000;
        else score = historyTable[fromSq * 90 + toSq];
      }
    }
    m.sortScore = score;
  }
  moves.sort((a, b) => b.sortScore - a.sortScore);
}

/**
 * Checks if a position hash (lo, hi) has already appeared in search path or game history.
 */
function checkPositionRepetition(lo, hi, ply) {
  for (let p = ply - 2; p >= 0; p -= 2) {
    if (pathHashLo[p] === lo && pathHashHi[p] === hi) {
      return { repeated: true, fromSearchPly: p };
    }
  }
  for (let i = 0; i < gameHistoryHashes.length; i++) {
    const h = gameHistoryHashes[i];
    if (h.lo === lo && h.hi === hi) {
      return { repeated: true, fromSearchPly: -1 };
    }
  }
  return null;
}

/**
 * Dedicated Forced Mate / Continuous Check Solver (连将杀 / 算杀器)
 * Essential for cracking classical endgame puzzles (支招/宗师) where sacrifices lead to forced mate.
 * Strictly respects rootAllowedMoves at ply === 0 so it never plays a forbidden perpetual check.
 */
function solveForcedMate(board, attackerColor, maxCheckPlies, ply = 0) {
  if ((nodesSearched & 255) === 0 && Date.now() - startTime > maxTimeMs) {
    stopSearch = true;
    return null;
  }
  if (stopSearch || ply >= maxCheckPlies) return null;
  nodesSearched++;

  const defenderColor = attackerColor === RED ? BLACK : RED;
  const isAttackerTurn = (ply % 2) === 0;

  if (isAttackerTurn) {
    const allMoves = (ply === 0 && rootAllowedMoves && rootAllowedMoves.length > 0)
      ? rootAllowedMoves.slice()
      : generateLegalMoves(attackerColor, board, false);
    if (allMoves.length === 0) return null;

    const forcingMoves = [];
    for (let i = 0; i < allMoves.length; i++) {
      const m = allMoves[i];
      const mover = board[m.fr][m.fc];
      const saved = board[m.tr][m.tc];
      board[m.tr][m.tc] = mover;
      board[m.fr][m.fc] = null;
      const givesChk = isInCheck(defenderColor, board);
      if (givesChk) {
        const defReplies = generateLegalMoves(defenderColor, board, false);
        board[m.fr][m.fc] = mover;
        board[m.tr][m.tc] = saved;
        if (defReplies.length === 0) {
          return { move: m, mateInPly: ply + 1 };
        }
        forcingMoves.push({ move: m, repliesCount: defReplies.length });
      } else {
        board[m.fr][m.fc] = mover;
        board[m.tr][m.tc] = saved;
      }
    }

    forcingMoves.sort((a, b) => a.repliesCount - b.repliesCount);

    for (let i = 0; i < forcingMoves.length; i++) {
      if (forcingMoves[i].repliesCount > 8 && ply >= 4) continue;
      const m = forcingMoves[i].move;
      const mover = board[m.fr][m.fc];
      const saved = board[m.tr][m.tc];
      board[m.tr][m.tc] = mover;
      board[m.fr][m.fc] = null;

      const res = solveForcedMate(board, attackerColor, maxCheckPlies, ply + 1);

      board[m.fr][m.fc] = mover;
      board[m.tr][m.tc] = saved;

      if (res) {
        return { move: m, mateInPly: res.mateInPly };
      }
      if (stopSearch) return null;
    }
    return null;
  } else {
    const evasions = generateLegalMoves(defenderColor, board, false);
    if (evasions.length === 0) {
      return { mateInPly: ply };
    }
    if (evasions.length > 10 && ply >= 3) return null;

    let worstMatePly = 0;
    for (let i = 0; i < evasions.length; i++) {
      const m = evasions[i];
      const mover = board[m.fr][m.fc];
      const saved = board[m.tr][m.tc];
      board[m.tr][m.tc] = mover;
      board[m.fr][m.fc] = null;

      const res = solveForcedMate(board, attackerColor, maxCheckPlies, ply + 1);

      board[m.fr][m.fc] = mover;
      board[m.tr][m.tc] = saved;

      if (!res) return null;
      if (res.mateInPly > worstMatePly) worstMatePly = res.mateInPly;
      if (stopSearch) return null;
    }
    return { mateInPly: worstMatePly };
  }
}

function quiescence(board, alpha, beta, color, qDepth) {
  nodesSearched++;
  if ((nodesSearched & 255) === 0 && Date.now() - startTime > maxTimeMs) stopSearch = true;
  if (stopSearch) return 0;

  const isGM = currentDifficulty === 'inferno' || currentDifficulty === 'grandmaster_hint';
  if (qDepth <= (isGM ? -10 : -6)) return evaluateGrandmaster(board, color, isGM);

  const inChk = isInCheck(color, board);

  if (!inChk) {
    const standPat = evaluateGrandmaster(board, color, isGM);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    if (qDepth <= (isGM ? -6 : -4)) return standPat;
  }

  const generateAll = inChk || (isGM && qDepth === 0);
  const rawMoves = generateLegalMoves(color, board, !generateAll);
  if (rawMoves.length === 0) {
    return inChk ? (-29000 + (10 - qDepth) * 10) : evaluateGrandmaster(board, color, isGM);
  }

  const nextColor = color === RED ? BLACK : RED;
  let moves = rawMoves;
  if (!inChk && isGM && qDepth === 0) {
    moves = [];
    for (let i = 0; i < rawMoves.length; i++) {
      const m = rawMoves[i];
      if (m.capture) {
        if (seeCaptureGain(board, m) >= -60) moves.push(m);
      } else {
        const mover = board[m.fr][m.fc];
        board[m.tr][m.tc] = mover;
        board[m.fr][m.fc] = null;
        const chk = isInCheck(nextColor, board);
        board[m.fr][m.fc] = mover;
        board[m.tr][m.tc] = null;
        if (chk) moves.push(m);
      }
    }
  }

  orderMoves(moves, board, 0, 32, 0);

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (!inChk && m.capture && seeCaptureGain(board, m) < -120) continue;

    const mover = board[m.fr][m.fc];
    const saved = board[m.tr][m.tc];
    board[m.tr][m.tc] = mover;
    board[m.fr][m.fc] = null;

    const score = -quiescence(board, -beta, -alpha, nextColor, qDepth - 1);

    board[m.fr][m.fc] = mover;
    board[m.tr][m.tc] = saved;

    if (stopSearch) return 0;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function pvs(board, depth, alpha, beta, color, hashLo, hashHi, ply, canNull, prevMoveEnc = 0) {
  if ((nodesSearched & 255) === 0 && Date.now() - startTime > maxTimeMs) {
    stopSearch = true;
  }
  if (stopSearch) return 0;

  const isGM = currentDifficulty === 'inferno' || currentDifficulty === 'grandmaster_hint';
  const isHint = currentDifficulty === 'grandmaster_hint';
  if (ply >= 60) return evaluateGrandmaster(board, color, isGM);

  pathHashLo[ply] = hashLo;
  pathHashHi[ply] = hashHi;

  // Repetition & Perpetual Check / Chase Detection inside Search Tree
  if (ply > 0) {
    const rep = checkPositionRepetition(hashLo, hashHi, ply);
    if (rep) {
      const moverJustChecked = pathGaveCheck[ply - 1] === 1;
      const moverJustChased = pathWasChase[ply - 1] === 1;
      if (moverJustChecked || moverJustChased) {
        return 18500 - ply * 20;
      }
      const selfCheckedEarlier = ply >= 2 && pathGaveCheck[ply - 2] === 1;
      const selfChasedEarlier = ply >= 2 && pathWasChase[ply - 2] === 1;
      if (selfCheckedEarlier || selfChasedEarlier) {
        return -18500 + ply * 20;
      }
      return -75;
    }
  }

  const inChk = isInCheck(color, board);
  if (inChk && ply < (isHint ? 18 : (isGM ? 14 : 8))) {
    depth++;
  }

  if (depth <= 0) {
    return quiescence(board, alpha, beta, color, 0);
  }

  nodesSearched++;
  const origAlpha = alpha;
  const ttIdx = hashLo & TT_MASK;
  let ttBestMove = 0;

  if (ttFlag[ttIdx] !== 0 && ttHashHi[ttIdx] === hashHi) {
    ttBestMove = ttMove[ttIdx];
    if (ttDepth[ttIdx] >= depth && ply > 0) {
      const tScore = ttScore[ttIdx];
      const flag = ttFlag[ttIdx];
      if (flag === 1) return tScore;
      if (flag === 2 && tScore >= beta) return tScore;
      if (flag === 3 && tScore <= alpha) return tScore;
    }
  }

  const nextColor = color === RED ? BLACK : RED;
  const staticEval = !inChk ? evaluateGrandmaster(board, color, isGM) : -30000;

  if (isGM && !inChk && ply > 0 && depth <= 2 && Math.abs(beta) < 20000) {
    const margin = depth * 180;
    if (staticEval - margin >= beta) return staticEval - margin;
  }

  if (canNull && !inChk && depth >= 3 && ply > 0 && staticEval >= beta - 120) {
    const R = depth > 6 ? 3 : 2;
    pathGaveCheck[ply] = 0;
    pathWasChase[ply] = 0;
    const nullScore = -pvs(
      board,
      depth - 1 - R,
      -beta,
      -beta + 1,
      nextColor,
      (hashLo ^ ZOBRIST_TURN_LO) >>> 0,
      (hashHi ^ ZOBRIST_TURN_HI) >>> 0,
      ply + 1,
      false,
      0
    );
    if (stopSearch) return 0;
    if (nullScore >= beta && Math.abs(nullScore) < 20000) return beta;
  }

  const moves = (ply === 0 && rootAllowedMoves && rootAllowedMoves.length > 0)
    ? rootAllowedMoves.slice()
    : generateLegalMoves(color, board, false);
  if (moves.length === 0) {
    return -29000 + ply * 20;
  }

  orderMoves(moves, board, ttBestMove, ply, prevMoveEnc);

  let bestScore = -Infinity;
  let bestMoveEnc = encodeMove(moves[0]);

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const mover = board[m.fr][m.fc];
    const saved = board[m.tr][m.tc];
    const curEnc = encodeMove(m);

    const kMover = KEY_MAP[mover.color + mover.type];
    const fromSq = m.fr * 9 + m.fc;
    const toSq = m.tr * 9 + m.tc;

    let nLo = hashLo ^ ZOBRIST_TURN_LO ^ ZOBRIST_LO[kMover][fromSq] ^ ZOBRIST_LO[kMover][toSq];
    let nHi = hashHi ^ ZOBRIST_TURN_HI ^ ZOBRIST_HI[kMover][fromSq] ^ ZOBRIST_HI[kMover][toSq];

    if (saved) {
      const kCap = KEY_MAP[saved.color + saved.type];
      nLo ^= ZOBRIST_LO[kCap][toSq];
      nHi ^= ZOBRIST_HI[kCap][toSq];
    }
    nLo >>>= 0;
    nHi >>>= 0;

    board[m.tr][m.tc] = mover;
    board[m.fr][m.fc] = null;

    const givesChk = m.givesCheck !== undefined ? m.givesCheck : isInCheck(nextColor, board);
    const isChase = !givesChk && !saved && ply < 12 ? doesPieceChaseEnemy(board, m.tr, m.tc, color) : false;

    pathGaveCheck[ply] = givesChk ? 1 : 0;
    pathWasChase[ply] = isChase ? 1 : 0;

    if (
      isGM && !inChk && !givesChk && !saved &&
      depth === 1 && i >= 6 && ply > 0 &&
      Math.abs(alpha) < 20000 && staticEval + 220 <= alpha
    ) {
      board[m.fr][m.fc] = mover;
      board[m.tr][m.tc] = saved;
      continue;
    }

    let score;
    if (i === 0) {
      score = -pvs(board, depth - 1, -beta, -alpha, nextColor, nLo, nHi, ply + 1, true, curEnc);
    } else {
      let reduction = 0;
      if (i >= 3 && depth >= 3 && !inChk && !givesChk && !saved) {
        reduction = i >= 9 ? 2 : 1;
        if ((isHint || isGM) && mover.type === 'p' && (color === RED ? m.tr <= 3 : m.tr >= 6)) {
          reduction = 0;
        }
      }
      score = -pvs(board, depth - 1 - reduction, -alpha - 1, -alpha, nextColor, nLo, nHi, ply + 1, true, curEnc);
      if (score > alpha && reduction > 0 && !stopSearch) {
        score = -pvs(board, depth - 1, -alpha - 1, -alpha, nextColor, nLo, nHi, ply + 1, true, curEnc);
      }
      if (score > alpha && score < beta && !stopSearch) {
        score = -pvs(board, depth - 1, -beta, -alpha, nextColor, nLo, nHi, ply + 1, true, curEnc);
      }
    }

    // Root-level extra guard: if a root move repeats a previous board state while checking or chasing (and isn't mate), penalize heavily
    if (ply === 0 && !saved && (givesChk || isChase) && score < 24000) {
      const repAtRoot = checkPositionRepetition(nLo, nHi, 0);
      if (repAtRoot) {
        score -= 18000;
      }
    }

    board[m.fr][m.fc] = mover;
    board[m.tr][m.tc] = saved;

    if (stopSearch) return 0;

    if (score > bestScore) {
      bestScore = score;
      bestMoveEnc = curEnc;
      if (ply === 0) rootBestMove = m;
      if (score > alpha) {
        alpha = score;
        if (alpha >= beta) {
          if (!saved && ply < 60) {
            if (killerMoves[ply][0] !== bestMoveEnc) {
              killerMoves[ply][1] = killerMoves[ply][0];
              killerMoves[ply][0] = bestMoveEnc;
            }
            historyTable[fromSq * 90 + toSq] += depth * depth;
            if (prevMoveEnc) {
              counterMoveTable[prevMoveEnc & 0x1fff] = bestMoveEnc;
            }
          }
          break;
        }
      }
    }
  }

  ttHashHi[ttIdx] = hashHi;
  ttDepth[ttIdx] = depth;
  ttScore[ttIdx] = bestScore;
  ttMove[ttIdx] = bestMoveEnc;
  ttFlag[ttIdx] = bestScore <= origAlpha ? 3 : (bestScore >= beta ? 2 : 1);

  return bestScore;
}

/**
 * Expanded Grandmaster Opening Book (Red & Black orthodox systems)
 */
function probeOpeningBook(historyMoves, aiColor, board) {
  if (historyMoves.length > 10) return null;
  let totalPieces = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) if (board[r][c]) totalPieces++;
  if (totalPieces < 28) return null;

  const sig = historyMoves.map(m => `${m.fr}${m.fc}${m.tr}${m.tc}`).join(',');
  const book = {
    '': [
      { fr: 7, fc: 7, tr: 7, tc: 4 },
      { fr: 7, fc: 1, tr: 7, tc: 4 },
      { fr: 6, fc: 6, tr: 5, tc: 6 },
      { fr: 9, fc: 7, tr: 7, tc: 6 }
    ],
    '7774': [{ fr: 0, fc: 7, tr: 2, tc: 6 }, { fr: 0, fc: 1, tr: 2, tc: 2 }],
    '7174': [{ fr: 0, fc: 1, tr: 2, tc: 2 }, { fr: 0, fc: 7, tr: 2, tc: 6 }],
    '7774,0726': [{ fr: 9, fc: 7, tr: 7, tc: 6 }],
    '7774,0122': [{ fr: 9, fc: 7, tr: 7, tc: 6 }],
    '7174,0122': [{ fr: 9, fc: 1, tr: 7, tc: 2 }],
    '7174,0726': [{ fr: 9, fc: 1, tr: 7, tc: 2 }],
    '7774,0726,9776': [{ fr: 0, fc: 8, tr: 0, tc: 7 }, { fr: 0, fc: 1, tr: 2, tc: 2 }],
    '7174,0122,9172': [{ fr: 0, fc: 0, tr: 0, tc: 1 }, { fr: 0, fc: 7, tr: 2, tc: 6 }],
    '7774,0726,9776,0807': [{ fr: 9, fc: 8, tr: 9, tc: 7 }],
    '7774,0726,9776,0122': [{ fr: 9, fc: 8, tr: 9, tc: 7 }],
    '7174,0122,9172,0001': [{ fr: 9, fc: 0, tr: 9, tc: 1 }],
    '7774,0726,9776,0807,9897': [{ fr: 0, fc: 1, tr: 2, tc: 2 }, { fr: 3, fc: 6, tr: 4, tc: 6 }],
    '7774,0726,9776,0122,9897': [{ fr: 0, fc: 8, tr: 0, tc: 7 }, { fr: 3, fc: 6, tr: 4, tc: 6 }],
    '7774,0726,9776,0807,9897,0122': [{ fr: 6, fc: 2, tr: 5, tc: 2 }, { fr: 9, fc: 1, tr: 7, tc: 2 }],
    '7774,0726,9776,0807,9897,0122,6252': [{ fr: 3, fc: 2, tr: 4, tc: 2 }, { fr: 3, fc: 6, tr: 4, tc: 6 }],
    '6656': [{ fr: 2, fc: 7, tr: 2, tc: 6 }, { fr: 3, fc: 6, tr: 4, tc: 6 }],
    '6252': [{ fr: 2, fc: 1, tr: 2, tc: 2 }, { fr: 3, fc: 2, tr: 4, tc: 2 }],
    '6656,2726': [{ fr: 9, fc: 7, tr: 7, tc: 6 }, { fr: 7, fc: 7, tr: 7, tc: 4 }],
    '9674': [{ fr: 2, fc: 7, tr: 2, tc: 4 }, { fr: 0, fc: 1, tr: 2, tc: 2 }],
    '9274': [{ fr: 2, fc: 1, tr: 2, tc: 4 }, { fr: 0, fc: 7, tr: 2, tc: 6 }],
    '9776': [{ fr: 3, fc: 6, tr: 4, tc: 6 }, { fr: 0, fc: 7, tr: 2, tc: 6 }],
    '9172': [{ fr: 3, fc: 2, tr: 4, tc: 2 }, { fr: 0, fc: 1, tr: 2, tc: 2 }]
  };

  const candidates = book[sig];
  if (!candidates) return null;
  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  const legal = generateLegalMoves(aiColor, board, false);
  return legal.find(m => m.fr === choice.fr && m.fc === choice.fc && m.tr === choice.tr && m.tc === choice.tc) || null;
}

/**
 * Easy Mode Move Selector (Beginner-friendly, natural, avoids ruthless checkmate traps)
 */
function selectEasyModeMove(board, turn, legalMoves) {
  const nextColor = turn === RED ? BLACK : RED;
  const scored = [];

  for (let i = 0; i < legalMoves.length; i++) {
    const m = legalMoves[i];
    const mover = board[m.fr][m.fc];
    const saved = board[m.tr][m.tc];
    board[m.tr][m.tc] = mover;
    board[m.fr][m.fc] = null;

    let s = evaluateNovice(board, turn);
    const givesCheck = isInCheck(nextColor, board);
    const isChase = !givesCheck && !saved && doesPieceChaseEnemy(board, m.tr, m.tc, turn);

    const { lo, hi } = computeBoardHash(board, nextColor);
    const rep = checkPositionRepetition(lo, hi, 0);
    if (rep && (givesCheck || isChase)) {
      s -= 12000;
    }

    const oppCaptures = generateLegalMoves(nextColor, board, true);
    let worstLoss = 0;
    for (let j = 0; j < oppCaptures.length; j++) {
      const cap = oppCaptures[j].capture;
      if (cap && PIECE_VALUES[cap.type] > worstLoss) {
        worstLoss = PIECE_VALUES[cap.type];
      }
    }
    s -= worstLoss * 0.55;

    board[m.fr][m.fc] = mover;
    board[m.tr][m.tc] = saved;

    s += (Math.random() - 0.5) * 95;
    scored.push({ move: m, score: s });
  }

  scored.sort((a, b) => b.score - a.score);
  const poolSize = Math.min(3, scored.length);
  const idx = Math.random() < 0.55 ? 0 : Math.floor(Math.random() * poolSize);
  return {
    move: scored[idx].move,
    score: Math.round(scored[idx].score),
    depth: 2,
    nodes: legalMoves.length * 12
  };
}

self.onmessage = function (e) {
  const { board, turn, difficulty, historyMoves, useBook, forbiddenMoves, historyBoards } = e.data;
  currentDifficulty = difficulty || 'inferno';
  nodesSearched = 0;
  stopSearch = false;
  startTime = Date.now();
  rootBestMove = null;

  gameHistoryHashes = [];
  if (Array.isArray(historyBoards)) {
    for (let i = 0; i < historyBoards.length; i++) {
      const hb = historyBoards[i];
      if (hb && hb.board && hb.turn) {
        gameHistoryHashes.push(computeBoardHash(hb.board, hb.turn));
      }
    }
  }

  let legalMoves = generateLegalMoves(turn, board, false);
  if (legalMoves.length === 0) {
    self.postMessage({ type: 'result', move: null, depth: 0, nodes: 0, score: -29000 });
    return;
  }

  // Strictly filter out forbidden repetition / perpetual check / perpetual chase moves at root
  if (Array.isArray(forbiddenMoves) && forbiddenMoves.length > 0) {
    const filtered = legalMoves.filter(
      m => !forbiddenMoves.some(f => f.fr === m.fr && f.fc === m.fc && f.tr === m.tr && f.tc === m.tc)
    );
    if (filtered.length > 0) {
      legalMoves = filtered;
    }
  }
  rootAllowedMoves = legalMoves;

  // 1. EASY MODE: Novice-friendly fast response
  if (currentDifficulty === 'easy') {
    const easyRes = selectEasyModeMove(board, turn, legalMoves);
    self.postMessage({
      type: 'result',
      move: easyRes.move,
      depth: easyRes.depth,
      nodes: easyRes.nodes,
      score: easyRes.score
    });
    return;
  }

  // 2. OPENING BOOK PROBE (for Hard, Inferno Grandmaster, and Full-Game Hint)
  if (useBook && (currentDifficulty === 'inferno' || currentDifficulty === 'hard' || currentDifficulty === 'grandmaster_hint')) {
    const bookMove = probeOpeningBook(historyMoves || [], turn, board);
    if (bookMove && legalMoves.some(m => m.fr === bookMove.fr && m.fc === bookMove.fc && m.tr === bookMove.tr && m.tc === bookMove.tc)) {
      self.postMessage({
        type: 'result',
        move: bookMove,
        depth: '开局库',
        nodes: 1,
        score: evaluateGrandmaster(board, turn, true),
        fromBook: true
      });
      return;
    }
  }

  let pieceCount = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) if (board[r][c]) pieceCount++;
  const isEndgame = pieceCount <= 16;
  const isDeepEndgame = pieceCount <= 10;
  const isHint = currentDifficulty === 'grandmaster_hint';
  const isInferno = currentDifficulty === 'inferno';

  if (currentDifficulty === 'hard') {
    maxTimeMs = isDeepEndgame ? 1500 : (isEndgame ? 1250 : 1000);
  } else if (isHint) {
    maxTimeMs = isDeepEndgame ? 4800 : (isEndgame ? 4000 : 3200);
  } else {
    maxTimeMs = isDeepEndgame ? 3800 : (isEndgame ? 3000 : 2400);
  }

  // 3. FORCED MATE SOLVER (连将算杀器) for Grandmaster & Hint modes
  if (isHint || isInferno) {
    const mateSolverBudget = Math.min(900, maxTimeMs * 0.28);
    const savedMaxTime = maxTimeMs;
    maxTimeMs = mateSolverBudget;
    const maxCheckPlies = isHint ? (isEndgame ? 15 : 11) : (isEndgame ? 11 : 9);
    let mateResult = null;
    for (let mp = 1; mp <= maxCheckPlies; mp += 2) {
      const candidate = solveForcedMate(board, turn, mp, 0);
      if (candidate && candidate.move) {
        mateResult = candidate;
        break;
      }
      if (stopSearch) break;
    }
    maxTimeMs = savedMaxTime;
    stopSearch = false;

    if (mateResult && mateResult.move) {
      const matchedLegal = legalMoves.find(
        m => m.fr === mateResult.move.fr && m.fc === mateResult.move.fc && m.tr === mateResult.move.tr && m.tc === mateResult.move.tc
      );
      if (matchedLegal) {
        const mateScore = 29000 - mateResult.mateInPly * 20;
        self.postMessage({
          type: 'result',
          move: matchedLegal,
          depth: `算杀M${Math.ceil(mateResult.mateInPly / 2)}`,
          nodes: nodesSearched,
          score: mateScore
        });
        return;
      }
    }
  }

  const maxTargetDepth = currentDifficulty === 'hard'
    ? (isDeepEndgame ? 9 : (isEndgame ? 8 : 7))
    : (isHint
      ? (isDeepEndgame ? 20 : (isEndgame ? 17 : 14))
      : (isDeepEndgame ? 18 : (isEndgame ? 15 : 13)));

  const { lo, hi } = computeBoardHash(board, turn);

  for (let i = 0; i < historyTable.length; i++) historyTable[i] >>= 2;

  let bestMove = legalMoves[0];
  let bestScore = 0;
  let completedDepth = 1;

  // 4. ITERATIVE DEEPENING PVS WITH ASPIRATION WINDOWS
  for (let d = 1; d <= maxTargetDepth; d++) {
    let alpha = -30000;
    let beta = 30000;
    const useAspiration = (isInferno || isHint) && d >= 4 && Math.abs(bestScore) < 20000;
    if (useAspiration) {
      alpha = bestScore - 55;
      beta = bestScore + 55;
    }

    let score = pvs(board, d, alpha, beta, turn, lo, hi, 0, false, 0);
    if (!stopSearch && useAspiration && (score <= alpha || score >= beta)) {
      score = pvs(board, d, -30000, 30000, turn, lo, hi, 0, false, 0);
    }

    if (stopSearch && d > 1) break;

    completedDepth = d;
    bestScore = score;

    if (rootBestMove) {
      const foundRoot = legalMoves.find(m => m.fr === rootBestMove.fr && m.fc === rootBestMove.fc && m.tr === rootBestMove.tr && m.tc === rootBestMove.tc);
      if (foundRoot) bestMove = foundRoot;
    }

    self.postMessage({
      type: 'progress',
      depth: completedDepth,
      nodes: nodesSearched,
      score: bestScore
    });

    if (bestScore > 25000 && d >= 4) break;
  }

  self.postMessage({
    type: 'result',
    move: bestMove,
    depth: completedDepth,
    nodes: nodesSearched,
    score: bestScore
  });
};
