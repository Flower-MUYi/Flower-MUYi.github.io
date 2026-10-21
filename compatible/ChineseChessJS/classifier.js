/*************************************************************************
 * 18 CLASSIC CHECKMATE PATTERN RECOGNITION ENGINE (绝杀类型智能判断系统)
 *************************************************************************/
class CheckmateClassifier {
  static classify(engine, loserColor) {
    const winnerColor = loserColor === RED ? BLACK : RED;
    const board = engine.board;
    const inCheck = engine.isInCheck(loserColor, board);
    const lastRecord = engine.history[engine.history.length - 1];
    const lastMove = lastRecord ? lastRecord.move : null;
    const lastMover = lastRecord ? lastRecord.piece : null;

    let kr = -1, kc = -1;
    for (let r = 0; r < 10; r++) {
      for (let c = 3; c <= 5; c++) {
        const p = board[r][c];
        if (p && p.color === loserColor && p.type === 'k') {
          kr = r;
          kc = c;
          break;
        }
      }
    }

    let wkr = -1, wkc = -1;
    for (let r = 0; r < 10; r++) {
      for (let c = 3; c <= 5; c++) {
        const p = board[r][c];
        if (p && p.color === winnerColor && p.type === 'k') {
          wkr = r;
          wkc = c;
          break;
        }
      }
    }

    const kingCoord = kr !== -1 ? { r: kr, c: kc } : { r: loserColor === BLACK ? 0 : 9, c: 4 };
    const royalCoord = wkr !== -1 ? { r: wkr, c: wkc } : null;

    if (!inCheck) {
      return {
        title: '欠行 · 困毙',
        badge: '古谱终局判定 · 欠行困毙',
        poem: '“四面楚歌起，孤军困九宫；虽无刀兵逼，寸步已难行。”',
        analysis: `${loserColor === RED ? '红方' : '黑方'}虽未被直接将军，但全局所有棋子均被封锁或牵制，无任何合法步可走，按中国象棋规则判为【欠行困毙】负。`,
        highlightCoords: [kingCoord],
        vfxType: 'stalemate_vortex',
        kingCoord,
        royalCoord,
        checkers: []
      };
    }

    const checkers = [];
    const attackerPieces = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === winnerColor) {
          attackerPieces.push({ r, c, piece: p });
          const moves = engine.getPseudoMoves(r, c, board);
          if (moves.some(m => m.tr === kr && m.tc === kc)) {
            checkers.push({ r, c, piece: p });
          }
        }
      }
    }

    const decorate = (res) => ({
      ...res,
      kingCoord,
      royalCoord,
      checkers: checkers.map(ch => ({ r: ch.r, c: ch.c, type: ch.piece.type, char: ch.piece.char }))
    });

    const orthDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let ownBlockedCount = 0;
    let palacePossibleCount = 0;
    let royalAssistUsed = false;

    for (const [dr, dc] of orthDirs) {
      const nr = kr + dr, nc = kc + dc;
      if (!engine.inPalace(nr, nc, loserColor)) continue;
      palacePossibleCount++;
      const occupant = board[nr][nc];
      if (occupant && occupant.color === loserColor) {
        ownBlockedCount++;
      } else if (wkc === nc) {
        let clearLine = true;
        const minR = Math.min(nr, wkr) + 1;
        const maxR = Math.max(nr, wkr);
        for (let rr = minR; rr < maxR; rr++) {
          if (rr !== kr && board[rr][nc] !== null) {
            clearLine = false;
            break;
          }
        }
        if (clearLine) royalAssistUsed = true;
      }
    }

    const getCannonMount = (cr, cc) => {
      if (cr === kr) {
        const step = cc < kc ? 1 : -1;
        for (let c = cc + step; c !== kc; c += step) {
          if (board[cr][c]) return { r: cr, c, piece: board[cr][c] };
        }
      } else if (cc === kc) {
        const step = cr < kr ? 1 : -1;
        for (let r = cr + step; r !== kr; r += step) {
          if (board[r][cc]) return { r, c: cc, piece: board[r][cc] };
        }
      }
      return null;
    };

    const centralCannons = attackerPieces.filter(a => a.piece.type === 'c' && a.c === 4);
    const hasCentralCannonControl = centralCannons.some(cc => {
      let count = 0;
      const minR = Math.min(cc.r, kr) + 1;
      const maxR = Math.max(cc.r, kr);
      for (let rr = minR; rr < maxR; rr++) {
        if (board[rr][4]) count++;
      }
      return count <= 2;
    });

    const highlightCoords = checkers.map(ch => ({ r: ch.r, c: ch.c }));
    if (kr !== -1) highlightCoords.push({ r: kr, c: kc });

    const primaryChecker = checkers[0] || { r: lastMove?.tr ?? 0, c: lastMove?.tc ?? 0, piece: lastMover || { type: 'r', char: '車' } };
    const enemyBaseRow = loserColor === BLACK ? 0 : 9;
    const enemySecondRow = loserColor === BLACK ? 1 : 8;
    const enemyThirdRow = loserColor === BLACK ? 2 : 7;

    if (checkers.length >= 2) {
      const names = checkers.map(c => c.piece.char).join('与');
      const hasHorse = checkers.some(c => c.piece.type === 'n');
      const hasCannon = checkers.some(c => c.piece.type === 'c');
      const title = (hasHorse && hasCannon) ? '拔簧马 · 双将绝杀' : '雷霆双将 · 绝杀';
      return decorate({
        title,
        badge: `古谱绝杀判定 · ${hasHorse && hasCannon ? '拔簧马双将' : '闪击双将'}`,
        poem: '“一子跃出惊天地，双刃齐发锁九宫；任凭神仙多妙算，难挡雷霆两路攻。”',
        analysis: `致胜方一着妙手形成【${names}】同时将军（双将照面）！双将之下无法通过吃子或垫子解围，而九宫退路已绝，一击毙命。`,
        highlightCoords,
        vfxType: 'double_lightning'
      });
    }

    if (primaryChecker.piece.type === 'c') {
      const mount = getCannonMount(primaryChecker.r, primaryChecker.c);
      if (mount) highlightCoords.push({ r: mount.r, c: mount.c });
      if (mount && mount.piece.color === winnerColor && mount.piece.type === 'c') {
        return decorate({
          title: '重炮 · 绝杀',
          badge: '古谱十八杀法 · 重炮',
          poem: '“双炮连环一线牵，前炮作架后炮轰；九宫城墙如纸薄，弹指灰飞烟灭中。”',
          analysis: `致胜方双炮同线叠阵，前炮为架、后炮发威，两门火炮互为犄角直轰九宫，令敌方防不胜防！`,
          highlightCoords,
          vfxType: 'double_cannon',
          mountCoord: { r: mount.r, c: mount.c }
        });
      }

      if (mount && mount.piece.color === winnerColor && mount.piece.type === 'n') {
        return decorate({
          title: '马后炮 · 绝杀',
          badge: '古谱十八杀法 · 马后炮',
          poem: '“骏马当先控将门，火炮随后定乾坤；前锁咽喉后催命，千古名局第一功。”',
          analysis: `经典【马后炮】杀法！致胜方灵馬不仅封死了敌将的左右逃生通道，更充当了后方火炮的坚实炮架，马炮合一绝杀九宫。`,
          highlightCoords,
          vfxType: 'horse_cannon',
          mountCoord: { r: mount.r, c: mount.c }
        });
      }
    }

    if (primaryChecker.piece.type === 'n') {
      const supportingCannon = attackerPieces.find(a => a.piece.type === 'c' && (a.r === kr || a.c === kc));
      if (supportingCannon) {
        highlightCoords.push({ r: supportingCannon.r, c: supportingCannon.c });
        return decorate({
          title: '马后炮 · 绝杀',
          badge: '古谱十八杀法 · 马后炮',
          poem: '“火炮遥镇九宫门，跃马扬鞭取上将；马炮纵横相呼应，敌手徒呼奈何天。”',
          analysis: `致胜方火炮封锁将门要道，战馬跃入九宫侧翼致命将军，形成经典的【马后炮】协同绝杀！`,
          highlightCoords,
          vfxType: 'horse_cannon',
          mountCoord: { r: supportingCannon.r, c: supportingCannon.c }
        });
      }
    }

    if (primaryChecker.piece.type === 'r' && primaryChecker.c === 4 && primaryChecker.r === enemySecondRow) {
      return decorate({
        title: '大刀剜心 · 绝杀',
        badge: '古谱十八杀法 · 大刀剜心',
        poem: '“铁骑长驱入九宫，大刀直取九五尊；中心开花惊四座，霸气纵横贯长虹。”',
        analysis: `致胜方强車在后方子力（中炮或帅力）掩护下，直接闯入敌方九宫正中心点（花心位），四面威慑，令敌将无处可逃！`,
        highlightCoords,
        vfxType: 'heart_blade'
      });
    }

    if (
      (primaryChecker.piece.type === 'r' || primaryChecker.piece.type === 'p') &&
      hasCentralCannonControl &&
      kc === 4 &&
      (primaryChecker.r === enemyBaseRow || primaryChecker.c === 3 || primaryChecker.c === 5)
    ) {
      const cc = centralCannons[0];
      if (cc) highlightCoords.push({ r: cc.r, c: cc.c });
      return decorate({
        title: '铁门栓 · 绝杀',
        badge: '古谱十八杀法 · 铁门栓',
        poem: '“中炮巍然镇神州，轻车破门入龙楼；铁栓横锁生死路，将士束手万古愁。”',
        analysis: `中路火炮死死镇住九宫中轴线（令敌方士将无法横向挪动），致胜${primaryChecker.piece.char}顺势切入底线/肋道一击致命，宛如铁门上栓！`,
        highlightCoords,
        vfxType: 'iron_bolt'
      });
    }

    if (
      primaryChecker.piece.type === 'c' &&
      attackerPieces.filter(a => a.piece.type === 'c').length >= 2 &&
      hasCentralCannonControl
    ) {
      return decorate({
        title: '天地炮 · 绝杀',
        badge: '古谱十八杀法 · 天地炮',
        poem: '“一炮凌空镇天门，一炮沉底裂地痕；天地交泰雷火动，九宫顷刻化微尘。”',
        analysis: `一门中炮从正面镇锁中路，另一门火炮沉底从侧翼轰击，纵横十字交叉封锁九宫，形成威震棋坛的【天地炮】绝杀！`,
        highlightCoords,
        vfxType: 'heaven_earth'
      });
    }

    if (palacePossibleCount > 0 && ownBlockedCount === palacePossibleCount) {
      return decorate({
        title: '闷宫 · 绝杀',
        badge: '古谱十八杀法 · 闷宫杀',
        poem: '“双士护驾反成牢，九宫闭塞无处逃；隔山一击惊雷落，闷杀王侯不血刀。”',
        analysis: `敌方将帅四周的九宫出路全被自己的士象或子力堵死，致胜方以【${primaryChecker.piece.char}】发起致命一击，令其作茧自缚、闷死宫中！`,
        highlightCoords,
        vfxType: 'smothered_cage'
      });
    }

    const allWinnerChariots = attackerPieces.filter(a => a.piece.type === 'r');
    if (primaryChecker.piece.type === 'r' && allWinnerChariots.length >= 2) {
      const otherChariot = allWinnerChariots.find(r => r.r !== primaryChecker.r || r.c !== primaryChecker.c);
      if (
        otherChariot &&
        (Math.abs(otherChariot.r - primaryChecker.r) <= 1 || Math.abs(otherChariot.c - primaryChecker.c) <= 1)
      ) {
        highlightCoords.push({ r: otherChariot.r, c: otherChariot.c });
        return decorate({
          title: '双车错 · 绝杀',
          badge: '古谱十八杀法 · 双车错',
          poem: '“双车并驾入重围，交错纵横疾如飞；一锁咽喉一夺命，霸王到此亦低眉。”',
          analysis: `双車在相邻的底线或肋道上交替掩护、错位挫杀，火力完全覆盖敌将的每一条逃生线，摧枯拉朽！`,
          highlightCoords,
          vfxType: 'double_chariot'
        });
      }
    }

    if (royalAssistUsed && wkr !== -1) {
      highlightCoords.push({ r: wkr, c: wkc });
      return decorate({
        title: '白脸将 · 对面笑',
        badge: '古谱十八杀法 · 对面笑',
        poem: '“两王相见本无情，借帅之力锁中庭；谈笑之间施妙手，对面笑里定输赢。”',
        analysis: `妙借【将帅不得直接照面】的规则，由本方将/帥隔空封死敌将的肋道或中路退路，配合【${primaryChecker.piece.char}】完成绝杀，俗称“白脸将”或“对面笑”！`,
        highlightCoords,
        vfxType: 'royal_gaze'
      });
    }

    if (primaryChecker.piece.type === 'n') {
      if (primaryChecker.r === enemySecondRow && (primaryChecker.c === 2 || primaryChecker.c === 6)) {
        return decorate({
          title: '卧槽马 · 绝杀',
          badge: '古谱十八杀法 · 卧槽马',
          poem: '“千里良驹跃卧槽，将军抽车气势豪；车炮相随封退路，一骑绝尘斩天骄。”',
          analysis: `战馬精准跃入敌方九宫象位前一格的【卧槽位】发起致命将军，配合车炮锁死将门，乃象棋实战中最凌厉的马杀法之一！`,
          highlightCoords,
          vfxType: 'horse_stomp'
        });
      }
      if (engine.inPalace(primaryChecker.r, primaryChecker.c, loserColor)) {
        return decorate({
          title: '挂角马 · 绝杀',
          badge: '古谱十八杀法 · 挂角马',
          poem: '“骏马凌空挂九宫，斜刺银枪破苍穹；八面威风封去路，将在城头计已穷。”',
          analysis: `战馬占领敌方九宫士角位（挂角位），既直接将军又卡住敌将上下移动的咽喉，配合侧翼子力完成绝杀！`,
          highlightCoords,
          vfxType: 'horse_stomp'
        });
      }
      return decorate({
        title: '高钓马 · 绝杀',
        badge: '古谱十八杀法 · 钓鱼马',
        poem: '“稳坐屏风垂钓钩，金鞍玉勒锁王侯；车马联营施巧计，一朝收网万事休。”',
        analysis: `战馬在敌方九宫外侧的高钓位/屏风位精准控场并发难，与主力车炮协同将敌将困死于九宫之内！`,
        highlightCoords,
        vfxType: 'horse_stomp'
      });
    }

    if (primaryChecker.piece.type === 'r') {
      const assistingHorse = attackerPieces.find(
        a => a.piece.type === 'n' && Math.abs(a.r - kr) <= 2 && Math.abs(a.c - kc) <= 3
      );
      if (assistingHorse) {
        highlightCoords.push({ r: assistingHorse.r, c: assistingHorse.c });
        if (assistingHorse.r === enemyThirdRow && (assistingHorse.c === 2 || assistingHorse.c === 6)) {
          return decorate({
            title: '钓鱼马 · 绝杀',
            badge: '古谱十八杀法 · 钓鱼马',
            poem: '“钓马高悬控将门，长车直入扫千军；马锁咽喉车夺命，千古奇谋妙入神。”',
            analysis: `致胜方战馬高悬于【钓鱼马】要津死死控住敌将出路，强車随即切入完成致命一击，车马冷着妙不可言！`,
            highlightCoords,
            vfxType: 'horse_stomp'
          });
        }
      }
    }

    const palaceAttackers = attackerPieces.filter(
      a => (a.piece.type === 'p' || a.piece.type === 'r') &&
        Math.abs(a.r - enemyBaseRow) <= 1 &&
        (a.c === 3 || a.c === 5)
    );
    if (palaceAttackers.length >= 2) {
      palaceAttackers.forEach(pa => highlightCoords.push({ r: pa.r, c: pa.c }));
      return decorate({
        title: '双鬼拍门 · 绝杀',
        badge: '古谱十八杀法 · 双鬼拍门',
        poem: '“双卒过河赛猛虎，左右叩门入王府；九宫两肋皆失守，纵有良将亦无补。”',
        analysis: `致胜方两路尖兵（或车兵）一左一右紧逼九宫两肋门户，如“双鬼拍门”般锁死敌将所有生路，令其插翅难飞！`,
        highlightCoords,
        vfxType: 'ghost_gate'
      });
    }

    if (
      (primaryChecker.piece.type === 'c' || primaryChecker.piece.type === 'r') &&
      attackerPieces.some(a => a.piece.type === 'c' && Math.abs(a.r - enemyBaseRow) <= 1) &&
      attackerPieces.some(a => a.piece.type === 'r' && Math.abs(a.r - enemyBaseRow) <= 2)
    ) {
      return decorate({
        title: '夹车炮 · 绝杀',
        badge: '古谱十八杀法 · 夹车炮',
        poem: '“车炮联袂下底线，一明一暗锁重关；进退失据无回路，片甲不留凯歌还。”',
        analysis: `致胜方沉底炮与强車在敌方底线及二路线紧密配合，车炮交相掩映、层层逼宫，形成经典的【夹车炮】绝杀！`,
        highlightCoords,
        vfxType: 'cannon_barrage'
      });
    }

    if (primaryChecker.piece.type === 'c' && primaryChecker.c === 4 && kc === 4) {
      return decorate({
        title: '空头炮 · 绝杀',
        badge: '古谱十八杀法 · 空头炮',
        poem: '“当头一炮最堪夸，直指中宫破帝家；莫道隔山方显威，空头落子乱如麻。”',
        analysis: `中路【空头炮】直指九宫核心，待中间落入炮架后瞬间引爆雷霆一击，正所谓“空头炮，凶如虎”！`,
        highlightCoords,
        vfxType: 'cannon_barrage'
      });
    }

    if (primaryChecker.piece.type === 'p') {
      return decorate({
        title: '小鬼坐龙廷 · 绝杀',
        badge: '古谱十八杀法 · 老卒搜山',
        poem: '“过河小卒当车使，步步紧逼入深宫；莫欺微末无大志，一朝擒王立奇功。”',
        analysis: `过河老兵深入敌方九宫腹地，在主力子力的协同封锁下亲自捉拿敌帅，完成【老卒搜山 / 小鬼坐龙廷】的传奇绝杀！`,
        highlightCoords,
        vfxType: 'imperial_pawn'
      });
    }

    if (primaryChecker.piece.type === 'r' && primaryChecker.r === enemyBaseRow) {
      return decorate({
        title: '沉底横车 · 绝杀',
        badge: '古谱十八杀法 · 海底捞月',
        poem: '“铁车沉底卷狂澜，直捣黄龙破敌寒；九宫纵有千重险，一剑封喉定江山。”',
        analysis: `致胜方强車直插敌方底线（九路底线），横向扫荡将门，令敌将无路可退，一剑封喉！`,
        highlightCoords,
        vfxType: 'bottom_tidal'
      });
    }

    return decorate({
      title: `${primaryChecker.piece.char}镇九宫 · 绝杀`,
      badge: '古谱终局判定 · 雷霆绝杀',
      poem: '“运筹帷幄决千里，妙手连珠破敌营；九宫内外天罗布，一着绝杀万古名。”',
      analysis: `致胜方通过严密的子力配合全面封锁九宫出路，由【${primaryChecker.piece.char}】发起致命一击完成绝杀！`,
      highlightCoords,
      vfxType: 'heart_blade'
    });
  }
}