/*************************************************************************
 * 25+ CLASSIC XIANGQI CHECKMATE PATTERN RECOGNITION ENGINE
 * (古谱十七大名局杀法因果推演智能判定系统)
 *************************************************************************/
class CheckmateClassifier {
  static getCatalog() {
    return [
      {
        vfxType: 'double_chariot',
        name: '双车错',
        title: '双车错 · 绝杀',
        stampText: '双车错',
        subBanner: '双车交替 · 错位绝杀',
        badge: '绝杀名局 · 双车错',
        poem: '“双车并驾入重围，交错纵横疾如飞；一锁咽喉一夺命，霸王到此亦低眉。”',
        desc: '双车于底线或肋道交替掩护、错位挫杀，火力覆盖敌将全部生路。'
      },
      {
        vfxType: 'smothered_palace',
        name: '闷宫',
        title: '闷宫 · 绝杀',
        stampText: '闷宫',
        subBanner: '双士塞路 · 困死九宫',
        badge: '绝杀名局 · 闷宫',
        poem: '“双士护驾反成牢，九宫闭塞无处逃；金锁重门惊雷落，困死王侯不血刀。”',
        desc: '敌方士象阻塞王驾退路，致胜子力乘势攻入将门，令敌将闷死宫中。'
      },
      {
        vfxType: 'royal_gaze',
        name: '对面笑',
        title: '对面笑 · 绝杀',
        stampText: '对面笑',
        subBanner: '金甲神将 · 白脸封喉',
        badge: '绝杀名局 · 对面笑',
        poem: '“两王相见本无情，借帅之力锁中庭；金甲破空施妙手，对面笑里定输赢。”',
        desc: '妙借将帅不照面规则，以己方将帅隔空锁死肋道或掩护强子，协同主力一击绝杀。'
      },
      {
        vfxType: 'double_cannon',
        name: '重炮',
        title: '重炮 · 绝杀',
        stampText: '重炮',
        subBanner: '城头双炮 · 轰碎九宫',
        badge: '绝杀名局 · 重炮',
        poem: '“双炮连环一线牵，前炮作架后炮轰；九宫城墙如纸薄，弹指灰飞烟灭中。”',
        desc: '双炮同线叠阵，前炮镇守作架、后炮齐射催命，火力直贯九宫中枢。'
      },
      {
        vfxType: 'horse_cannon',
        name: '马后炮',
        title: '马后炮 · 绝杀',
        stampText: '马后炮',
        subBanner: '铁骑锁喉 · 火炮轰门',
        badge: '绝杀名局 · 马后炮',
        poem: '“骏马当先控将门，火炮随后定乾坤；前锁咽喉后催命，千古名局第一功。”',
        desc: '战马封锁敌将退路或兼作炮架，后方火炮隔山轰击，马炮合一绝杀九宫。'
      },
      {
        vfxType: 'iron_bolt',
        name: '铁门栓',
        title: '铁门栓 · 绝杀',
        stampText: '铁门栓',
        subBanner: '玄铁重门 · 锁链封宫',
        badge: '绝杀名局 · 铁门栓',
        poem: '“中炮巍然镇神州，轻车破门入龙楼；铁栓横锁生死路，将士束手万古愁。”',
        desc: '中炮死锁九宫中轴，车或兵卒切入底线或肋道一击致命，如玄铁重门上栓。'
      },
      {
        vfxType: 'side_tiger',
        name: '侧面虎',
        title: '侧面虎 · 绝杀',
        stampText: '侧面虎',
        subBanner: '猛虎下山 · 侧翼扑杀',
        badge: '绝杀名局 · 侧面虎',
        poem: '“猛虎咆哮跃侧翼，车马纵横逼玉阶；任尔九宫多险固，狂飙一扑万军摧。”',
        desc: '战马跃居九宫侧翼高钓或虎位控场，协同强车横扫将门，势如猛虎侧扑。'
      },
      {
        vfxType: 'octagon_horse',
        name: '八角马',
        title: '八角马 · 绝杀',
        stampText: '八角马',
        subBanner: '明月银枪 · 八角锁阵',
        badge: '绝杀名局 · 八角马',
        poem: '“骏马凌空挂八角，斜刺银枪破月华；八面威风封去路，将在城头计已穷。”',
        desc: '战马据守九宫士角与敌将呈对角定马之势，锁死纵横两路，车马联攻绝杀。'
      },
      {
        vfxType: 'fishing_horse',
        name: '钓鱼马',
        title: '钓鱼马 · 绝杀',
        stampText: '钓鱼马',
        subBanner: '碧海漩涡 · 垂钓擒王',
        badge: '绝杀名局 · 钓鱼马',
        poem: '“稳坐寒江垂钓钩，金鞍玉勒锁王侯；车马联营施巧计，一朝收网万事休。”',
        desc: '战马高悬敌宫三七路钓位锁死将门，强车远距离直入底线完成致命绝杀。'
      },
      {
        vfxType: 'standing_horse_chariot',
        name: '列马车',
        title: '列马车 · 绝杀',
        stampText: '列马车',
        subBanner: '断崖赤日 · 列马斩将',
        badge: '绝杀名局 · 列马车',
        poem: '“赤日悬空照断崖，天驹独立傲风沙；长车直破中宫帐，一骑绝尘斩乱麻。”',
        desc: '战马驻守宫前护佑，强车贴身切入九宫肋道或花心，车马并列绝杀敌将。'
      },
      {
        vfxType: 'double_check',
        name: '双将',
        title: '双将 · 绝杀',
        stampText: '双将',
        subBanner: '金剑破石 · 双路齐发',
        badge: '绝杀名局 · 双将',
        poem: '“一子跃出惊天地，双刃齐发锁九宫；任凭神仙多妙算，难挡雷霆两路攻。”',
        desc: '双子同时从两路发起将军，敌方无法靠吃子或垫子兼顾化解，立判绝杀。'
      },
      {
        vfxType: 'chariot_cannon_clamp',
        name: '夹车炮',
        title: '夹车炮 · 绝杀',
        stampText: '夹车炮',
        subBanner: '大漠战车 · 车炮夹击',
        badge: '绝杀名局 · 夹车炮',
        poem: '“大漠风沙卷战旗，车炮交攻下底线；进退失据无回路，铁炮轰鸣凯歌还。”',
        desc: '强车与火炮在敌阵底线与二三路交相掩映、层层逼宫，形成夹车炮绝杀。'
      },
      {
        vfxType: 'trough_horse',
        name: '卧槽马',
        title: '卧槽马 · 绝杀',
        stampText: '卧槽马',
        subBanner: '金门破空 · 神驹跃槽',
        badge: '绝杀名局 · 卧槽马',
        poem: '“千里良驹跃卧槽，将军抽车气势豪；车炮相随封退路，金驹破阵斩天骄。”',
        desc: '战马跃入敌方底线前一格的卧槽要津致命将军，配合车炮或帅力封锁将门完成绝杀。'
      },
      {
        vfxType: 'smothered_kill',
        name: '闷杀',
        title: '闷杀 · 绝杀',
        stampText: '闷杀',
        subBanner: '玄铁锁魂 · 隔山轰杀',
        badge: '绝杀名局 · 闷杀',
        poem: '“四围铁锁缚龙楼，尺地寸天莫展筹；隔山一炮惊雷动，闷杀强敌万事休。”',
        desc: '敌将四周宫格尽被己方棋子塞满，攻方远距离隔山打将或跃马一击闷杀。'
      },
      {
        vfxType: 'heaven_earth_cannon',
        name: '天地炮',
        title: '天地炮 · 绝杀',
        stampText: '天地炮',
        subBanner: '天火降世 · 乾坤十字',
        badge: '绝杀名局 · 天地炮',
        poem: '“一炮凌空镇天门，一炮沉底裂地痕；天地交泰天火降，九宫顷刻化微尘。”',
        desc: '中炮镇锁中路天门，沉底炮横扫底线地户，纵横十字封死九宫。'
      },
      {
        vfxType: 'stalemate_trap',
        name: '困毙',
        title: '困毙 · 绝杀',
        stampText: '困毙',
        subBanner: '八卦石阵 · 四面合围',
        badge: '终局裁定 · 欠行困毙',
        poem: '“八卦奇门石阵开，孤军深陷绝仙台；虽无飞矢临城下，四壁合拢莫出来。”',
        desc: '受困方全局子力均被封锁，无任何合法着法可行，依规判欠行困毙。'
      },
      {
        vfxType: 'frost_lotus_strike',
        name: '海底捞月',
        title: '海底捞月 · 绝杀',
        stampText: '海底捞月',
        subBanner: '沧海映月 · 碧浪涌莲',
        badge: '绝杀名局 · 海底捞月',
        poem: '“金轮沉海映寒波，碧浪翻莲锁奈何；莫道微兵难近驾，海底捞月奏凯歌。”',
        desc: '攻方妙用沉底子力于九宫海底横向逼宫催命，破除敌方护驾防线一击绝杀。'
      }
    ];
  }

  static getMetaByType(vfxType) {
    if (vfxType === 'sea_bottom_moon') vfxType = 'frost_lotus_strike';
    const list = CheckmateClassifier.getCatalog();
    return list.find(item => item.vfxType === vfxType) || list[list.length - 1];
  }

  static classify(engine, loserColor) {
    const winnerColor = loserColor === RED ? BLACK : RED;
    const board = engine.board;
    const inCheck = engine.isInCheck(loserColor, board);
    const lastRecord = engine.history[engine.history.length - 1];
    const lastMove = lastRecord ? lastRecord.move : null;
    const lastMover = lastRecord ? (lastRecord.pieceAfter || lastRecord.piece) : null;

    let kr = -1, kc = -1;
    let wkr = -1, wkc = -1;
    for (let r = 0; r < 10; r++) {
      for (let c = 3; c <= 5; c++) {
        const p = board[r][c];
        if (p && !p.isHidden && p.type === 'k') {
          if (p.color === loserColor) { kr = r; kc = c; }
          else { wkr = r; wkc = c; }
        }
      }
    }

    const kingCoord = kr !== -1 ? { r: kr, c: kc } : { r: loserColor === BLACK ? 0 : 9, c: 4 };
    const royalCoord = wkr !== -1 ? { r: wkr, c: wkc } : { r: winnerColor === RED ? 9 : 0, c: 4 };

    const dedupeCoords = (arr) => {
      const out = [];
      for (const item of (arr || [])) {
        if (!item || typeof item.r !== 'number' || typeof item.c !== 'number') continue;
        if (!out.some(x => x.r === item.r && x.c === item.c)) out.push({ r: item.r, c: item.c });
      }
      return out.length ? out : [kingCoord];
    };

    const buildResult = (vfxType, highlightCoords, extra = {}) => {
      const meta = CheckmateClassifier.getMetaByType(vfxType);
      return {
        title: extra.title || meta.title,
        stampText: extra.stampText || meta.stampText,
        subBanner: extra.subBanner || meta.subBanner,
        badge: extra.badge || meta.badge,
        poem: extra.poem || meta.poem,
        analysis: extra.analysis || meta.desc,
        vfxType: meta.vfxType,
        highlightCoords: dedupeCoords(highlightCoords),
        kingCoord,
        royalCoord,
        checkers: extra.checkers || [],
        mountCoord: extra.mountCoord || null
      };
    };

    // 1. 欠行 · 困毙 (Stalemate: Not in check, but no legal moves)
    if (!inCheck) {
      return buildResult('stalemate_trap', [kingCoord], {
        analysis: `${loserColor === RED ? '红方' : '黑方'}虽未被直接将军，但全局子力均被封锁或牵制，无任何合法着法可走，依规判【困毙】负。`
      });
    }

    const checkers = [];
    const attackerPieces = [];
    const loserPieces = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (!p) continue;
        const effType = p.isHidden ? (p.posType || p.type) : p.type;
        if (p.color === winnerColor) {
          attackerPieces.push({ r, c, piece: p, type: effType });
          const moves = engine.getPseudoMoves(r, c, board);
          if (moves.some(m => m.tr === kr && m.tc === kc)) {
            checkers.push({ r, c, piece: p, type: effType });
          }
        } else {
          loserPieces.push({ r, c, piece: p, type: effType });
        }
      }
    }

    const checkerSummaries = checkers.map(ch => ({
      r: ch.r,
      c: ch.c,
      type: ch.type,
      char: ch.piece.char,
      color: ch.piece.color
    }));

    const highlightCoords = checkers.map(ch => ({ r: ch.r, c: ch.c }));
    if (kr !== -1) highlightCoords.push({ r: kr, c: kc });

    const movedChecker = lastMove
      ? checkers.find(ch => ch.r === lastMove.tr && ch.c === lastMove.tc)
      : null;
    const primaryChecker = movedChecker || checkers[0] || {
      r: lastMove?.tr ?? kingCoord.r,
      c: lastMove?.tc ?? kingCoord.c,
      type: lastMover ? (lastMover.isHidden ? (lastMover.posType || lastMover.type) : lastMover.type) : 'r',
      piece: lastMover || { type: 'r', char: winnerColor === RED ? '俥' : '車', color: winnerColor }
    };

    const countBetweenOnLine = (r1, c1, r2, c2, customBoard = board) => {
      if (r1 !== r2 && c1 !== c2) return -1;
      let count = 0;
      const dr = Math.sign(r2 - r1);
      const dc = Math.sign(c2 - c1);
      let curR = r1 + dr, curC = c1 + dc;
      while (curR !== r2 || curC !== c2) {
        if (customBoard[curR][curC]) count++;
        curR += dr;
        curC += dc;
      }
      return count;
    };

    const getPiecesBetweenOnLine = (r1, c1, r2, c2, customBoard = board) => {
      if (r1 !== r2 && c1 !== c2) return [];
      const list = [];
      const dr = Math.sign(r2 - r1);
      const dc = Math.sign(c2 - c1);
      let curR = r1 + dr, curC = c1 + dc;
      while (curR !== r2 || curC !== c2) {
        if (customBoard[curR][curC]) {
          const p = customBoard[curR][curC];
          list.push({
            r: curR,
            c: curC,
            piece: p,
            type: p.isHidden ? (p.posType || p.type) : p.type
          });
        }
        curR += dr;
        curC += dc;
      }
      return list;
    };

    const analyzeKingStep = (nr, nc) => {
      const simBoard = engine.cloneBoard(board);
      const kingObj = simBoard[kr][kc];
      simBoard[kr][kc] = null;
      simBoard[nr][nc] = kingObj;

      let flyingGeneralBlocks = false;
      if (wkr !== -1 && wkc === nc) {
        if (countBetweenOnLine(nr, nc, wkr, wkc, simBoard) === 0) {
          flyingGeneralBlocks = true;
        }
      }

      const nonGeneralControllers = [];
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          const p = simBoard[r][c];
          if (!p || p.color !== winnerColor) continue;
          const effType = p.isHidden ? (p.posType || p.type) : p.type;
          if (effType === 'k') continue;
          const pMoves = engine.getPseudoMoves(r, c, simBoard);
          if (pMoves.some(m => m.tr === nr && m.tc === nc)) {
            nonGeneralControllers.push({ r, c, piece: p, type: effType });
          }
        }
      }
      return {
        flyingGeneralBlocks,
        nonGeneralControllers,
        onlyBlockedByFlyingGeneral: flyingGeneralBlocks && nonGeneralControllers.length === 0
      };
    };

    const doesPieceProtectOrAttackSquare = (ar, ac, tr, tc, customBoard = board) => {
      if (ar === tr && ac === tc) return false;
      const simBoard = engine.cloneBoard(customBoard);
      simBoard[tr][tc] = { color: loserColor, type: 'p', isHidden: false };
      const moves = engine.getPseudoMoves(ar, ac, simBoard);
      return moves.some(m => m.tr === tr && m.tc === tc);
    };

    const orthDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let ownBlockedCount = 0;
    let ownAdvisorBishopBlockedCount = 0;
    let ownMajorBlockedCount = 0;
    let emptyKingAdjCount = 0;
    let enemyAdjCount = 0;
    let palacePossibleCount = 0;
    let royalAssistUsed = false;
    let essentialRoyalAssist = false;
    const escapeSquareDetails = [];

    for (const [dr, dc] of orthDirs) {
      const nr = kr + dr, nc = kc + dc;
      if (!engine.inPalace(nr, nc, loserColor)) continue;
      palacePossibleCount++;
      const occupant = board[nr][nc];
      if (occupant && occupant.color === loserColor) {
        ownBlockedCount++;
        const occType = occupant.isHidden ? (occupant.posType || occupant.type) : occupant.type;
        if (occType === 'a' || occType === 'b') ownAdvisorBishopBlockedCount++;
        else ownMajorBlockedCount++;
        escapeSquareDetails.push({ r: nr, c: nc, status: 'own_blocked', occupant, occType });
      } else {
        if (occupant && occupant.color === winnerColor) {
          enemyAdjCount++;
        } else {
          emptyKingAdjCount++;
        }
        const stepInfo = analyzeKingStep(nr, nc);
        if (stepInfo.flyingGeneralBlocks) royalAssistUsed = true;
        if (stepInfo.onlyBlockedByFlyingGeneral) essentialRoyalAssist = true;
        escapeSquareDetails.push({
          r: nr,
          c: nc,
          status: occupant ? 'enemy_occupied' : 'empty',
          occupant,
          ...stepInfo
        });
      }
    }

    // Check if Flying General pins a defender on file kc that could otherwise capture primaryChecker
    if (wkr !== -1 && wkc === kc) {
      const betweenKings = getPiecesBetweenOnLine(kr, kc, wkr, wkc);
      if (betweenKings.length === 1 && betweenKings[0].piece.color === loserColor) {
        const pinned = betweenKings[0];
        const pMoves = engine.getPseudoMoves(pinned.r, pinned.c, board);
        if (pMoves.some(m => m.tr === primaryChecker.r && m.tc === primaryChecker.c)) {
          royalAssistUsed = true;
          essentialRoyalAssist = true;
        }
      }
    }

    let ownPiecesInPalace = 0;
    for (let r = (loserColor === BLACK ? 0 : 7); r <= (loserColor === BLACK ? 2 : 9); r++) {
      for (let c = 3; c <= 5; c++) {
        const p = board[r][c];
        if (p && p.color === loserColor && !(r === kr && c === kc)) {
          ownPiecesInPalace++;
        }
      }
    }

    const enemyBaseRow = loserColor === BLACK ? 0 : 9;
    const enemySecondRow = loserColor === BLACK ? 1 : 8;
    const enemyThirdRow = loserColor === BLACK ? 2 : 7;
    const enemyFourthRow = loserColor === BLACK ? 3 : 6;

    const isTroughPos = (r, c) => r === enemySecondRow && (c === 2 || c === 6);
    const isDiagonalOctagonLock = (hr, hc) =>
      engine.inPalace(hr, hc, loserColor) &&
      Math.abs(hr - kr) === 2 &&
      Math.abs(hc - kc) === 2 &&
      doesPieceProtectOrAttackSquare(hr, hc, kr, (hc + kc) >> 1) &&
      doesPieceProtectOrAttackSquare(hr, hc, (hr + kr) >> 1, kc);
    const isPalaceCornerHorse = (hr, hc) =>
      engine.inPalace(hr, hc, loserColor) && (hc === 3 || hc === 5) && (hr === enemyBaseRow || hr === enemyThirdRow);
    const isOctagonPos = (hr, hc) => isDiagonalOctagonLock(hr, hc) || isPalaceCornerHorse(hr, hc) || engine.inPalace(hr, hc, loserColor);

    const isFishingPos = (r, c) =>
      (r === enemyThirdRow && (c === 2 || c === 6)) ||
      (r === enemySecondRow && (c === 1 || c === 7));

    const isSideTigerPos = (r, c) =>
      Math.abs(r - enemyBaseRow) <= 3 && (c >= 1 && c <= 7) && c !== 4;

    const doesPieceControlKingEscape = (pieceCoord) => {
      for (const sq of escapeSquareDetails) {
        if (sq.nonGeneralControllers && sq.nonGeneralControllers.some(ctrl => ctrl.r === pieceCoord.r && ctrl.c === pieceCoord.c)) {
          return true;
        }
      }
      if (doesPieceProtectOrAttackSquare(pieceCoord.r, pieceCoord.c, primaryChecker.r, primaryChecker.c)) {
        return true;
      }
      return false;
    };

    // =========================================================================
    // 2. 双将 (Double Check: 2+ pieces checking the King simultaneously)
    // =========================================================================
    if (checkers.length >= 2) {
      const hasHorse = checkers.some(c => c.type === 'n');
      const hasCannon = checkers.some(c => c.type === 'c');
      const extra = (hasHorse && hasCannon)
        ? {
            badge: '古谱十八杀法 · 拔簧马双将',
            subBanner: '拔簧跃马 · 双将齐发',
            analysis: '致胜方跃马闪击，战马与火炮同时从两路照将（拔簧马双将），敌将无法兼顾，一击毙命！'
          }
        : {};
      return buildResult('double_check', highlightCoords, {
        checkers: checkerSummaries,
        ...extra
      });
    }

    // =========================================================================
    // 3. 天地炮 (Heaven & Earth Cannons: Central Cannon + Bottom/Second-Rank Cannon)
    // =========================================================================
    const centralCannons = attackerPieces.filter(a => a.type === 'c' && a.c === 4);
    const activeCentralCannon = centralCannons.find(cc => {
      if (kc === 4) {
        const b = countBetweenOnLine(cc.r, cc.c, kr, kc);
        return b >= 0 && b <= 2;
      }
      const b = countBetweenOnLine(cc.r, 4, kr, 4);
      return b >= 0 && b <= 2;
    });

    const bottomRowCannons = attackerPieces.filter(a => {
      if (a.type !== 'c' || (a.r !== enemyBaseRow && a.r !== enemySecondRow)) return false;
      if (activeCentralCannon && a.r === activeCentralCannon.r && a.c === activeCentralCannon.c) return false;
      if (kr === a.r) {
        const b = countBetweenOnLine(a.r, a.c, kr, kc);
        return b >= 1 && b <= 2;
      }
      const b = countBetweenOnLine(a.r, a.c, a.r, kc);
      return b >= 0 && b <= 2;
    });

    if (
      activeCentralCannon &&
      bottomRowCannons.length > 0 &&
      (primaryChecker.type === 'c' || bottomRowCannons.some(bc => bc.r === primaryChecker.r && bc.c === primaryChecker.c))
    ) {
      highlightCoords.push({ r: activeCentralCannon.r, c: activeCentralCannon.c });
      bottomRowCannons.forEach(bc => highlightCoords.push({ r: bc.r, c: bc.c }));
      return buildResult('heaven_earth_cannon', highlightCoords, {
        checkers: checkerSummaries
      });
    }

    // =========================================================================
    // 4. 铁门栓 (Iron Bolt: Central Cannon locks c=4 + Rook/Pawn strikes bottom/rib)
    // =========================================================================
    if (activeCentralCannon && kc === 4) {
      if (
        (primaryChecker.type === 'r' || primaryChecker.type === 'p') &&
        (primaryChecker.r === enemyBaseRow || primaryChecker.c === 3 || primaryChecker.c === 5 || primaryChecker.c === 4)
      ) {
        highlightCoords.push({ r: activeCentralCannon.r, c: activeCentralCannon.c });
        return buildResult('iron_bolt', highlightCoords, {
          checkers: checkerSummaries
        });
      }
      if (primaryChecker.type === 'c' && primaryChecker.c === 4) {
        const gateCrasher = attackerPieces.find(
          a => a.type === 'r' && doesPieceControlKingEscape(a) &&
            (a.r === enemyBaseRow || (engine.inPalace(a.r, a.c, loserColor) && (a.c === 3 || a.c === 5 || a.c === 4)))
        );
        if (gateCrasher) {
          highlightCoords.push({ r: gateCrasher.r, c: gateCrasher.c });
          return buildResult('iron_bolt', highlightCoords, {
            checkers: checkerSummaries
          });
        }
      }
    }

    // =========================================================================
    // 5. 夹车炮 (Chariot-Cannon Clamp) vs 重炮 (Double Cannon) vs 马后炮 (Horse-Cannon)
    // =========================================================================
    if (primaryChecker.type === 'c') {
      const mounts = getPiecesBetweenOnLine(primaryChecker.r, primaryChecker.c, kr, kc);
      const mount = mounts[0] || null;
      if (mount) highlightCoords.push({ r: mount.r, c: mount.c });
      const mountType = mount ? mount.type : null;

      const clampingRook = attackerPieces.find(a =>
        a.type === 'r' &&
        Math.abs(a.r - enemyBaseRow) <= 2 &&
        doesPieceControlKingEscape(a)
      );

      if (mount && mount.piece.color === winnerColor && mountType === 'c') {
        if (clampingRook) {
          highlightCoords.push({ r: clampingRook.r, c: clampingRook.c });
          return buildResult('chariot_cannon_clamp', highlightCoords, {
            checkers: checkerSummaries,
            mountCoord: { r: mount.r, c: mount.c }
          });
        }
        return buildResult('double_cannon', highlightCoords, {
          checkers: checkerSummaries,
          mountCoord: { r: mount.r, c: mount.c }
        });
      }

      if (mount && mount.piece.color === winnerColor && mountType === 'n') {
        return buildResult('horse_cannon', highlightCoords, {
          checkers: checkerSummaries,
          mountCoord: { r: mount.r, c: mount.c }
        });
      }

      const perpHorse = attackerPieces.find(a => {
        if (a.type !== 'n') return false;
        return escapeSquareDetails.some(sq => {
          const isPerp = (primaryChecker.r === kr) ? (sq.r !== kr) : (sq.c !== kc);
          return isPerp && sq.nonGeneralControllers?.some(ctrl => ctrl.r === a.r && ctrl.c === a.c);
        });
      });
      if (perpHorse) {
        highlightCoords.push({ r: perpHorse.r, c: perpHorse.c });
        return buildResult('horse_cannon', highlightCoords, {
          checkers: checkerSummaries,
          mountCoord: { r: perpHorse.r, c: perpHorse.c }
        });
      }
    }

    if (primaryChecker.type === 'n') {
      const alignedCannon = attackerPieces.find(a => {
        if (a.type !== 'c') return false;
        if (a.r === kr || a.c === kc) {
          const between = countBetweenOnLine(a.r, a.c, kr, kc);
          return between >= 0 && between <= 2;
        }
        return doesPieceControlKingEscape(a);
      });
      if (alignedCannon) {
        highlightCoords.push({ r: alignedCannon.r, c: alignedCannon.c });
        return buildResult('horse_cannon', highlightCoords, {
          checkers: checkerSummaries,
          mountCoord: { r: alignedCannon.r, c: alignedCannon.c }
        });
      }
    }

    // =========================================================================
    // 6. 双车错 (Double Chariot Alternating Mate)
    // =========================================================================
    const allWinnerChariots = attackerPieces.filter(a => a.type === 'r');
    if (primaryChecker.type === 'r' && allWinnerChariots.length >= 2) {
      const otherChariot = allWinnerChariots.find(r => {
        if (r.r === primaryChecker.r && r.c === primaryChecker.c) return false;
        return Math.abs(r.r - kr) <= 2 || Math.abs(r.c - kc) <= 1 || doesPieceControlKingEscape(r);
      });
      if (otherChariot) {
        highlightCoords.push({ r: otherChariot.r, c: otherChariot.c });
        return buildResult('double_chariot', highlightCoords, {
          checkers: checkerSummaries
        });
      }
    }

    // =========================================================================
    // 7. 夹车炮 (Chariot + Cannon Clamp in bottom 3 ranks)
    // =========================================================================
    if (primaryChecker.type === 'c' || primaryChecker.type === 'r') {
      const clampC = attackerPieces.find(a => a.type === 'c' && Math.abs(a.r - enemyBaseRow) <= 2 && (a === primaryChecker || doesPieceControlKingEscape(a)));
      const clampR = attackerPieces.find(a => a.type === 'r' && Math.abs(a.r - enemyBaseRow) <= 2 && (a === primaryChecker || doesPieceControlKingEscape(a)));
      if (clampC && clampR) {
        highlightCoords.push({ r: clampC.r, c: clampC.c }, { r: clampR.r, c: clampR.c });
        return buildResult('chariot_cannon_clamp', highlightCoords, {
          checkers: checkerSummaries
        });
      }
    }

    // =========================================================================
    // 8. 马系绝杀与车马协同绝杀 (卧槽马 / 八角马 / 钓鱼马 / 列马车 / 侧面虎 / 双马饮泉)
    // =========================================================================
    if (primaryChecker.type === 'n') {
      if (isTroughPos(primaryChecker.r, primaryChecker.c)) {
        return buildResult('trough_horse', highlightCoords, {
          checkers: checkerSummaries
        });
      }
      const secondHorse = attackerPieces.find(
        a => a.type === 'n' && (a.r !== primaryChecker.r || a.c !== primaryChecker.c) && doesPieceControlKingEscape(a)
      );
      if (secondHorse) {
        highlightCoords.push({ r: secondHorse.r, c: secondHorse.c });
        return buildResult('side_tiger', highlightCoords, {
          title: '双马饮泉 · 绝杀',
          stampText: '双马饮泉',
          subBanner: '双骏踏波 · 饮泉锁宫',
          badge: '古谱十八杀法 · 双马饮泉',
          poem: '“双骏奔腾饮玉泉，左盘右蹙锁金殿；纵横蹄影封生路，一跃擒王定凯旋。”',
          analysis: '致胜方双马在九宫左右盘旋呼应，一马封门、一马致命将军，成就古谱名杀【双马饮泉】！',
          checkers: checkerSummaries
        });
      }
      if (isOctagonPos(primaryChecker.r, primaryChecker.c)) {
        return buildResult('octagon_horse', highlightCoords, {
          checkers: checkerSummaries
        });
      }
      if (isFishingPos(primaryChecker.r, primaryChecker.c)) {
        return buildResult('fishing_horse', highlightCoords, {
          checkers: checkerSummaries
        });
      }
      if (ownBlockedCount >= 2 && palacePossibleCount > 0) {
        return buildResult('smothered_palace', highlightCoords, {
          checkers: checkerSummaries
        });
      }
      return buildResult('side_tiger', highlightCoords, {
        checkers: checkerSummaries
      });
    }

    if (primaryChecker.type === 'r') {
      const supportingHorses = attackerPieces.filter(
        a => a.type === 'n' && Math.abs(a.r - kr) <= 4 && Math.abs(a.c - kc) <= 3 && doesPieceControlKingEscape(a)
      );
      if (supportingHorses.length > 0) {
        const h = supportingHorses[0];
        highlightCoords.push({ r: h.r, c: h.c });
        const rookAdjacentToKing = (Math.abs(primaryChecker.r - kr) + Math.abs(primaryChecker.c - kc)) === 1;
        const horseProtectsRook = doesPieceProtectOrAttackSquare(h.r, h.c, primaryChecker.r, primaryChecker.c);

        if (isDiagonalOctagonLock(h.r, h.c) || isPalaceCornerHorse(h.r, h.c)) {
          return buildResult('octagon_horse', highlightCoords, {
            checkers: checkerSummaries
          });
        }
        if (isTroughPos(h.r, h.c)) {
          return buildResult('trough_horse', highlightCoords, {
            checkers: checkerSummaries
          });
        }
        if (rookAdjacentToKing && horseProtectsRook) {
          return buildResult('standing_horse_chariot', highlightCoords, {
            checkers: checkerSummaries
          });
        }
        if (isFishingPos(h.r, h.c)) {
          return buildResult('fishing_horse', highlightCoords, {
            checkers: checkerSummaries
          });
        }
        if (isSideTigerPos(h.r, h.c)) {
          return buildResult('side_tiger', highlightCoords, {
            checkers: checkerSummaries
          });
        }
        return buildResult('standing_horse_chariot', highlightCoords, {
          checkers: checkerSummaries
        });
      }
    }

    // =========================================================================
    // 9. 花心破宫特判：大刀剜心 (Chariot in Palace Center) & 小鬼坐龙廷 (Pawn in Palace Center)
    // =========================================================================
    if (primaryChecker.type === 'r' && primaryChecker.r === enemySecondRow && primaryChecker.c === 4 && !essentialRoyalAssist) {
      return buildResult('standing_horse_chariot', highlightCoords, {
        title: '大刀剜心 · 绝杀',
        stampText: '大刀剜心',
        subBanner: '中心开花 · 大刀剜心',
        badge: '古谱十八杀法 · 大刀剜心',
        poem: '“铁骑长驱入九宫，大刀直取九五尊；中心开花惊四座，霸气纵横贯长虹。”',
        analysis: '致胜方强車在后方子力掩护下直接闯入敌方九宫正中心（花心位），四面威慑令敌将寸步难行！',
        checkers: checkerSummaries
      });
    }

    if (primaryChecker.type === 'p' && primaryChecker.r !== enemyBaseRow && engine.inPalace(primaryChecker.r, primaryChecker.c, loserColor) && !essentialRoyalAssist) {
      return buildResult('frost_lotus_strike', highlightCoords, {
        title: '小鬼坐龙廷 · 绝杀',
        stampText: '老卒搜山',
        subBanner: '过河老卒 · 擒王定鼎',
        badge: '古谱十八杀法 · 老卒搜山',
        poem: '“过河小卒当车使，步步紧逼入深宫；莫欺微末无大志，一朝擒王立奇功。”',
        analysis: '过河老兵深入敌方九宫腹地，在主力子力协同封锁下亲自捉拿敌帅，完成传奇绝杀！',
        checkers: checkerSummaries
      });
    }

    // =========================================================================
    // 10. 闷杀 (Smothered Kill) vs 闷宫 (Smothered Palace)
    // =========================================================================
    if (palacePossibleCount > 0 && ownBlockedCount >= 2) {
      if (
        emptyKingAdjCount === 0 &&
        ownBlockedCount === palacePossibleCount &&
        (ownMajorBlockedCount >= 1 || ownPiecesInPalace >= 3 || kc !== 4)
      ) {
        return buildResult('smothered_kill', highlightCoords, {
          checkers: checkerSummaries
        });
      }
      return buildResult('smothered_palace', highlightCoords, {
        checkers: checkerSummaries
      });
    }

    // =========================================================================
    // 11. 海底捞月 (Scooping the Moon from the Sea Bottom - Video Case 17, 01:54)
    // =========================================================================
    const frontOfKingR = kr + (loserColor === BLACK ? 1 : -1);
    const frontOccupant = engine.inBounds(frontOfKingR, kc) ? board[frontOfKingR][kc] : null;
    if (
      kr === enemyBaseRow &&
      primaryChecker.r === enemyBaseRow &&
      (primaryChecker.type === 'p' || primaryChecker.type === 'r' || primaryChecker.type === 'c') &&
      frontOccupant &&
      frontOccupant.color === loserColor
    ) {
      highlightCoords.push({ r: frontOfKingR, c: kc });
      return buildResult('frost_lotus_strike', highlightCoords, {
        checkers: checkerSummaries
      });
    }

    // =========================================================================
    // 12. 空头炮 (Central Sky Cannon Mate on c=4)
    // =========================================================================
    if (primaryChecker.type === 'c' && primaryChecker.c === 4 && kc === 4 && !essentialRoyalAssist) {
      return buildResult('heaven_earth_cannon', highlightCoords, {
        title: '空头炮 · 绝杀',
        stampText: '空头炮',
        subBanner: '当头空炮 · 直轰中宫',
        badge: '古谱十八杀法 · 空头炮',
        poem: '“当头一炮最堪夸，直指中宫破帝家；莫道隔山方显威，空头落子乱如麻。”',
        analysis: '中路【空头炮】直指九宫核心，隔山发炮瞬间引爆雷霆一击，令敌将无路可逃！',
        checkers: checkerSummaries
      });
    }

    // =========================================================================
    // 13. 双鬼拍门 (Two Pawns or Pawn+Rook Clamping Palace Ribs)
    // =========================================================================
    const ribAttackers = attackerPieces.filter(
      a => (a.type === 'p' || a.type === 'r') &&
        Math.abs(a.r - enemyBaseRow) <= 1 &&
        (a.c === 3 || a.c === 5)
    );
    if (ribAttackers.length >= 2 && ribAttackers.some(a => a.type === 'p') && new Set(ribAttackers.map(a => a.c)).size >= 2) {
      ribAttackers.forEach(ra => highlightCoords.push({ r: ra.r, c: ra.c }));
      return buildResult('iron_bolt', highlightCoords, {
        title: '双鬼拍门 · 绝杀',
        stampText: '双鬼拍门',
        subBanner: '双卒叩门 · 左右夹击',
        badge: '古谱十八杀法 · 双鬼拍门',
        poem: '“双卒过河赛猛虎，左右叩门入王府；九宫两肋皆失守，纵有良将亦无补。”',
        analysis: '致胜方两路尖兵（或车兵）一左一右紧逼九宫两肋门户，如“双鬼拍门”锁死敌将生路！',
        checkers: checkerSummaries
      });
    }

    // =========================================================================
    // 14. 对面笑 / 白脸将 (Royal Gaze / Flying General Assist - Video Case 3, 00:13)
    // =========================================================================
    if (essentialRoyalAssist && wkr !== -1) {
      highlightCoords.push({ r: wkr, c: wkc });
      return buildResult('royal_gaze', highlightCoords, {
        checkers: checkerSummaries
      });
    }

    if (primaryChecker.r === enemyBaseRow) {
      return buildResult('frost_lotus_strike', highlightCoords, {
        checkers: checkerSummaries
      });
    }

    if (primaryChecker.type === 'p') {
      return buildResult('frost_lotus_strike', highlightCoords, {
        title: '小鬼坐龙廷 · 绝杀',
        stampText: '老卒搜山',
        subBanner: '过河老卒 · 擒王定鼎',
        badge: '古谱十八杀法 · 老卒搜山',
        poem: '“过河小卒当车使，步步紧逼入深宫；莫欺微末无大志，一朝擒王立奇功。”',
        analysis: '过河老兵深入敌方九宫腹地，在主力子力协同封锁下亲自捉拿敌帅，完成传奇绝杀！',
        checkers: checkerSummaries
      });
    }

    return buildResult('frost_lotus_strike', highlightCoords, {
      checkers: checkerSummaries
    });
  }
}
