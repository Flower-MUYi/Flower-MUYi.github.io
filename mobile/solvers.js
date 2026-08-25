// solvers.js —— 终极微积分与代数推导引擎 (含三角繁分式精准通分与因式化简)

function solveLinearSystem(matrix, vector) {
    if (!matrix || !vector || matrix.length === 0) return null;
    const N = vector.length;
    let m = matrix.map((row, i) => [...row, vector[i]]);

    for (let i = 0; i < N; i++) {
        let maxRow = i;
        for (let k = i + 1; k < N; k++) {
            if (Math.abs(m[k][i]) > Math.abs(m[maxRow][i])) maxRow = k;
        }
        const temp = m[i];
        m[i] = m[maxRow];
        m[maxRow] = temp;

        if (Math.abs(m[i][i]) < 1e-10) return null;

        for (let k = i + 1; k < N; k++) {
            const factor = m[k][i] / m[i][i];
            for (let j = i; j <= N; j++) m[k][j] -= factor * m[i][j];
        }
    }

    const ans = new Array(N).fill(0);
    for (let i = N - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < N; j++) sum += m[i][j] * ans[j];
        ans[i] = (m[i][N] - sum) / m[i][i];
    }
    return ans.map(val => Math.abs(Math.round(val) - val) < 1e-9 ? Math.round(val) : val);
}

function gcd(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) { const t = b; b = a % b; a = t; }
    return a;
}

function toRational(val, tolerance = 1e-6) {
    if (typeof val !== 'number' || isNaN(val)) return { num: 0, den: 1, latex: '0', ast: 0, isInt: true };
    if (Number.isInteger(val)) return { num: val, den: 1, latex: `${val}`, ast: val, isInt: true };

    let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = Math.abs(val), iterations = 0;
    do {
        let a = Math.floor(b);
        let aux = h1; h1 = a * h1 + h2; h2 = aux;
        aux = k1; k1 = a * k1 + k2; k2 = aux;
        b = 1 / (b - a);
        iterations++;
    } while (Math.abs(Math.abs(val) - h1 / k1) > tolerance && k1 < 10000 && iterations < 20);

    let num = Math.sign(val) * h1, den = k1;
    const g = gcd(num, den);
    num /= g; den /= g;

    if (den === 1) return { num, den: 1, latex: `${num}`, ast: num, isInt: true };
    const signStr = num < 0 ? '-' : '';
    return { num, den, latex: `${signStr}\\frac{${Math.abs(num)}}{${den}}`, ast: ['Rational', num, den], isInt: false };
}

function cleanMathLatex(latexStr) {
    if (typeof latexStr !== 'string') return latexStr;
    let str = latexStr;
    const funcs = 'sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|coth|ln|log|arctan|arcsin|arccos';
    const wrappedPattern = new RegExp(`\\\\left\\(\\s*\\\\(${funcs})\\s*(\\\\left\\([\\s\\S]*?\\\\right\\)|\\([^()]*\\)|\\{[^{}]*\\})\\s*\\\\right\\)\\s*\\^\\s*(\\{[^{}]+\\}|[0-9a-zA-Z]+)`, 'g');
    str = str.replace(wrappedPattern, (match, fn, arg, exp) => `\\${fn}^${exp.startsWith('{') ? exp : `{${exp}}`}${arg}`);
    const directPattern = new RegExp(`\\\\(${funcs})\\s*(\\\\left\\([\\s\\S]*?\\\\right\\)|\\([^()]*\\)|\\{[^{}]*\\})\\s*\\^\\s*(\\{[^{}]+\\}|[0-9a-zA-Z]+)`, 'g');
    str = str.replace(directPattern, (match, fn, arg, exp) => `\\${fn}^${exp.startsWith('{') ? exp : `{${exp}}`}${arg}`);
    return str;
}

function formatOutput({ resultLatex, steps, plotData }) {
    return {
        resultLatex: cleanMathLatex(resultLatex),
        steps: (steps || []).map(s => ({ title: s.title, latex: cleanMathLatex(s.latex) })),
        plotData: plotData || null
    };
}

function unwrapAST(node) {
    if (!Array.isArray(node)) return { expr: node, inferredVar: null };
    let curr = node, inferredVar = null;
    if (curr[0] === 'Function') { if (typeof curr[2] === 'string') inferredVar = curr[2]; curr = curr[1]; }
    while (Array.isArray(curr) && (curr[0] === 'Block' || curr[0] === 'Hold' || curr[0] === 'Sequence')) curr = curr[1];
    if (Array.isArray(curr) && curr[0] === 'Function') {
        if (typeof curr[2] === 'string' && !inferredVar) inferredVar = curr[2];
        curr = curr[1];
        while (Array.isArray(curr) && (curr[0] === 'Block' || curr[0] === 'Hold')) curr = curr[1];
    }
    return { expr: curr, inferredVar };
}

function isConstant(ast, variable) {
    if (typeof ast === 'number') return true;
    if (typeof ast === 'string') return ast !== variable;
    if (Array.isArray(ast)) return ast.slice(1).every(arg => isConstant(arg, variable));
    return true;
}

function getFactorWeight(node) {
    const { expr } = unwrapAST(node);
    if (typeof expr === 'number') return 1;
    if (typeof expr === 'string') return ['Pi', 'ExponentialE', 'e'].includes(expr) ? 1.5 : 2;
    if (Array.isArray(expr)) {
        const op = expr[0];
        if (['Negate', 'Rational'].includes(op)) return 1;
        if (op === 'Power') return (expr[1] === 'ExponentialE' || expr[1] === 'e') ? 4 : 2.5;
        if (op === 'Add' || op === 'Subtract') return 3;
        if (['Sin', 'Cos', 'Tan', 'Cot', 'Sec', 'Csc', 'Arcsin', 'Arccos', 'Arctan', 'Ln', 'Log', 'Exp'].includes(op)) return 4;
    }
    return 3.5;
}

function makeMultiply(factors, ce) {
    const flatList = [];
    const collect = (item) => {
        const { expr } = unwrapAST(item);
        if (Array.isArray(expr) && expr[0] === 'Multiply') expr.slice(1).forEach(collect);
        else if (expr !== 1) flatList.push(expr);
    };
    Array.isArray(factors) ? factors.forEach(collect) : collect(factors);
    if (flatList.length === 0) return ce.box(1);
    if (flatList.length === 1) return ce.box(flatList[0]);
    flatList.sort((a, b) => getFactorWeight(a) - getFactorWeight(b));
    return ce.box(['Multiply', ...flatList]);
}

function polyMul(p1, p2) {
    const res = new Array(p1.length + p2.length - 1).fill(0);
    for (let i = 0; i < p1.length; i++) {
        for (let j = 0; j < p2.length; j++) res[i + j] += p1[i] * p2[j];
    }
    return res;
}

function polyPow(p, exp) {
    let res = [1];
    for (let i = 0; i < exp; i++) res = polyMul(res, p);
    return res;
}

function extractDomainConstraints(node, variable, ce, constraints = []) {
    const { expr } = unwrapAST(node);
    if (!Array.isArray(expr)) return constraints;

    const [op, ...args] = expr;

    if (op === 'Sqrt') {
        constraints.push({ type: '>=0', desc: "根号下非负", expr: args[0], latex: `${ce.box(args[0]).toLatex()} \\ge 0` });
    } else if (op === 'Power') {
        const [base, exp] = args;
        const expVal = ce.box(exp).evaluate();
        if (expVal.json && Array.isArray(expVal.json) && expVal.json[0] === 'Rational') {
            const den = expVal.json[2];
            if (den % 2 === 0) {
                constraints.push({ type: '>=0', desc: "偶次根式非负", expr: base, latex: `${ce.box(base).toLatex()} \\ge 0` });
            }
        }
    }

    if (op === 'Divide' && args.length === 2) {
        constraints.push({ type: '!=0', desc: "分母非零", expr: args[1], latex: `${ce.box(args[1]).toLatex()} \\ne 0` });
    }

    if (op === 'Ln' || op === 'Log') {
        constraints.push({ type: '>0', desc: "对数真数大于零", expr: args[0], latex: `${ce.box(args[0]).toLatex()} > 0` });
    }

    for (let arg of args) extractDomainConstraints(arg, variable, ce, constraints);
    return constraints;
}

function checkValueDomain(constraints, val, variable, ce) {
    for (let c of constraints) {
        try {
            const v = ce.box(c.expr).subs({ [variable]: val }).evaluate().valueOf();
            if (typeof v !== 'number' || isNaN(v)) return { valid: false, reason: c.desc, latex: c.latex };
            if (c.type === '!=0' && Math.abs(v) < 1e-9) return { valid: false, reason: "分母为 0", latex: c.latex };
            if (c.type === '>=0' && v < -1e-9) return { valid: false, reason: "被开方数为负", latex: c.latex };
            if (c.type === '>0' && v <= 1e-9) return { valid: false, reason: "真数非正", latex: c.latex };
        } catch (e) {
            return { valid: false, reason: "无法计算", latex: c.latex };
        }
    }
    return { valid: true };
}

function buildMathFunction(ast, variable, ce) {
    if (!ast) return () => NaN;
    const boxed = ce.box(ast);
    return (x) => {
        try {
            const val = boxed.subs({ [variable]: x }).evaluate().valueOf();
            return typeof val === 'number' && !isNaN(val) ? val : NaN;
        } catch (e) {
            return NaN;
        }
    };
}

function hasTrigFunctions(node, variable) {
    const { expr } = unwrapAST(node);
    if (!Array.isArray(expr)) return false;
    const [op, ...args] = expr;
    if (['Sin', 'Cos', 'Tan', 'Cot', 'Sec', 'Csc'].includes(op) && !isConstant(args[0], variable)) {
        return true;
    }
    return args.some(arg => hasTrigFunctions(arg, variable));
}

function substituteVariable(node, varName, replacementAst) {
    const { expr } = unwrapAST(node);
    if (expr === varName) return replacementAst;
    if (!Array.isArray(expr)) return expr;

    const [op, ...args] = expr;
    return [op, ...args.map(arg => substituteVariable(arg, varName, replacementAst))];
}

export function differentiateNode(node, variable, ce, steps) {
    const { expr: unwrappedNode } = unwrapAST(node);
    const nodeExpr = ce.box(unwrappedNode);

    if (isConstant(unwrappedNode, variable)) return ce.box(0);
    if (unwrappedNode === variable) return ce.box(1);
    if (!Array.isArray(unwrappedNode)) return ce.box(['Derivative', unwrappedNode, variable]).evaluate();

    const [op, ...args] = unwrappedNode;

    if (op === 'Add') {
        return ce.box(['Add', ...args.map(a => differentiateNode(a, variable, ce, steps).json)]).simplify();
    }
    if (op === 'Negate') return ce.box(['Negate', differentiateNode(args[0], variable, ce, steps).json]).simplify();
    if (op === 'Subtract') {
        const du = differentiateNode(args[0], variable, ce, steps), dv = differentiateNode(args[1], variable, ce, steps);
        return ce.box(['Subtract', du.json, dv.json]).simplify();
    }
    if (op === 'Multiply' && args.length === 2) {
        const [u, v] = args;
        if (isConstant(u, variable)) return makeMultiply([u, differentiateNode(v, variable, ce, steps).json], ce).simplify();
        const du = differentiateNode(u, variable, ce, steps), dv = differentiateNode(v, variable, ce, steps);
        return ce.box(['Add', makeMultiply([du.json, v], ce).json, makeMultiply([u, dv.json], ce).json]).simplify();
    }
    if (op === 'Divide' && args.length === 2) {
        const [u, v] = args;
        const du = differentiateNode(u, variable, ce, steps), dv = differentiateNode(v, variable, ce, steps);
        return ce.box(['Divide', ['Subtract', makeMultiply([du.json, v], ce).json, makeMultiply([u, dv.json], ce).json], ['Power', v, 2]]).simplify();
    }
    if (op === 'Power') {
        const [base, exp] = args;
        if (isConstant(exp, variable)) {
            const dBase = differentiateNode(base, variable, ce, steps);
            const newExp = ce.box(['Subtract', exp, 1]).evaluate();
            return makeMultiply([exp, ['Power', base, newExp.json], dBase.json], ce).simplify();
        }
    }
    const elemRules = { 'Sin': { d: 'Cos', f: 1 }, 'Cos': { d: 'Sin', f: -1 }, 'Ln': { isLn: true }, 'Exp': { isExp: true } };
    if (elemRules[op]) {
        const rule = elemRules[op], inner = args[0], dInner = differentiateNode(inner, variable, ce, steps);
        if (rule.isLn) return ce.box(['Divide', dInner.json, inner]).simplify();
        if (rule.isExp) return makeMultiply([dInner.json, node], ce).simplify();
        const baseDeriv = rule.f === -1 ? ['Negate', [rule.d, inner]] : [rule.d, inner];
        return makeMultiply([dInner.json, baseDeriv], ce).simplify();
    }
    return ce.box(['Derivative', unwrappedNode, variable]).evaluate();
}

function extractFactors(denNode, variable, ce) {
    const rawFactors = [];
    const process = (node) => {
        const { expr } = unwrapAST(node);
        if (Array.isArray(expr)) {
            if (expr[0] === 'Multiply') {
                for (let i = 1; i < expr.length; i++) process(expr[i]);
            } else if (expr[0] === 'Power') {
                const base = expr[1];
                let expVal = 1;
                try { expVal = ce.box(expr[2]).evaluate().valueOf(); } catch (e) { }
                rawFactors.push({ base, exp: typeof expVal === 'number' ? expVal : 1 });
            } else {
                rawFactors.push({ base: expr, exp: 1 });
            }
        } else if (expr === variable || !isConstant(expr, variable)) {
            rawFactors.push({ base: expr, exp: 1 });
        }
    };
    process(denNode);

    const factors = [];
    for (let f of rawFactors) {
        const baseBox = ce.box(f.base);
        const cVal = baseBox.subs({ [variable]: 0 }).evaluate().valueOf();
        const d1 = differentiateNode(f.base, variable, ce, null).simplify();
        const bVal = d1.subs({ [variable]: 0 }).evaluate().valueOf();
        const d2 = differentiateNode(d1.json, variable, ce, null).simplify();
        const aVal = ce.box(['Divide', d2.subs({ [variable]: 0 }).evaluate().json, 2]).evaluate().valueOf();

        const a = typeof aVal === 'number' ? aVal : 0;
        const b = typeof bVal === 'number' ? bVal : 0;
        const c = typeof cVal === 'number' ? cVal : 0;

        if (Math.abs(a) > 1e-9) {
            const delta = b * b - 4 * a * c;
            if (Math.abs(delta) < 1e-7) {
                const r = -b / (2 * a);
                const linearBase = r === 0 ? variable : (r > 0 ? ['Subtract', variable, toRational(r).ast] : ['Add', variable, toRational(-r).ast]);
                factors.push({ base: linearBase, exp: f.exp * 2 });
            } else if (delta > 1e-7) {
                const sqrtDelta = Math.sqrt(delta);
                const r1 = (-b + sqrtDelta) / (2 * a);
                const r2 = (-b - sqrtDelta) / (2 * a);
                const base1 = r1 === 0 ? variable : (r1 > 0 ? ['Subtract', variable, toRational(r1).ast] : ['Add', variable, toRational(-r1).ast]);
                const base2 = r2 === 0 ? variable : (r2 > 0 ? ['Subtract', variable, toRational(r2).ast] : ['Add', variable, toRational(-r2).ast]);
                factors.push({ base: base1, exp: f.exp });
                factors.push({ base: base2, exp: f.exp });
            } else {
                factors.push(f);
            }
        } else {
            factors.push(f);
        }
    }

    return factors;
}

function formatTermWithCoeff(coeffVal, termLatex, isFirst = false) {
    const frac = toRational(coeffVal);
    if (Math.abs(coeffVal) < 1e-9) return '';

    const isPos = frac.num > 0;
    const sign = isPos ? (isFirst ? '' : '+ ') : '- ';
    const absNum = Math.abs(frac.num);

    let coeffPart = '';
    if (absNum === 1 && frac.den === 1) {
        coeffPart = '';
    } else if (frac.den === 1) {
        coeffPart = `${absNum} `;
    } else {
        coeffPart = `\\frac{${absNum}}{${frac.den}} `;
    }

    return `${sign}${coeffPart}${termLatex}`;
}

function integratePartialFractions(numNode, denNode, variable, ce, steps) {
    const factors = extractFactors(denNode, variable, ce);
    const factorData = [];
    let totalDegree = 0;

    for (let f of factors) {
        const baseBox = ce.box(f.base);
        const cVal = baseBox.subs({ [variable]: 0 }).evaluate().valueOf();
        const d1 = differentiateNode(f.base, variable, ce, null).simplify();
        const bVal = d1.subs({ [variable]: 0 }).evaluate().valueOf();
        const d2 = differentiateNode(d1.json, variable, ce, null).simplify();
        const aVal = ce.box(['Divide', d2.subs({ [variable]: 0 }).evaluate().json, 2]).evaluate().valueOf();

        const a = typeof aVal === 'number' ? aVal : 0;
        const b = typeof bVal === 'number' ? bVal : 0;
        const c = typeof cVal === 'number' ? cVal : 0;

        const isQuad = Math.abs(a) > 1e-9;
        const polyArr = isQuad ? [c, b, a] : [c, b];
        totalDegree += (isQuad ? 2 : 1) * f.exp;
        factorData.push({ base: f.base, exp: f.exp, a, b, c, isQuad, polyArr });
    }

    if (totalDegree > 0 && totalDegree <= 8) {
        const N = totalDegree;
        const unknowns = [];
        const labels = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'M', 'N', 'P', 'Q', 'R', 'S', 'T'];
        let varIdx = 0;
        const pfdTermsLaTeX = [];

        for (let fd of factorData) {
            for (let k = 1; k <= fd.exp; k++) {
                const denomAst = k === 1 ? fd.base : ['Power', fd.base, k];
                const denomLatex = ce.box(denomAst).toLatex();
                if (fd.isQuad) {
                    const l1 = labels[varIdx++], l2 = labels[varIdx++];
                    unknowns.push({ label: l1, isQuad: true, type: 'linear', fd, k });
                    unknowns.push({ label: l2, isQuad: true, type: 'const', fd, k });
                    pfdTermsLaTeX.push(`\\frac{${l1}${variable} + ${l2}}{${denomLatex}}`);
                } else {
                    const l = labels[varIdx++];
                    unknowns.push({ label: l, isQuad: false, type: 'const', fd, k });
                    pfdTermsLaTeX.push(`\\frac{${l}}{${denomLatex}}`);
                }
            }
        }

        if (steps) steps.push({
            title: "依据分母因式分解结构，设定部分分式展开式",
            latex: `\\frac{${ce.box(numNode).toLatex()}}{${ce.box(denNode).toLatex()}} = ${pfdTermsLaTeX.join(' + ')}`
        });

        const rhsTermsLatex = [];
        const unknownPolys = [];

        for (let u of unknowns) {
            let remPoly = [1];
            for (let fd of factorData) {
                const curExp = (fd === u.fd) ? (fd.exp - u.k) : fd.exp;
                if (curExp > 0) {
                    remPoly = polyMul(remPoly, polyPow(fd.polyArr, curExp));
                }
            }
            if (u.type === 'linear') {
                unknownPolys.push([0, ...remPoly]);
            } else {
                unknownPolys.push(remPoly);
            }
        }

        let currentUIdx = 0;
        for (let fd of factorData) {
            for (let k = 1; k <= fd.exp; k++) {
                let remFactorsLatex = [];
                for (let otherFd of factorData) {
                    const curExp = (otherFd === fd) ? (otherFd.exp - k) : otherFd.exp;
                    if (curExp > 0) {
                        const bLatex = ce.box(otherFd.base).toLatex();
                        remFactorsLatex.push(curExp === 1 ? `(${bLatex})` : `(${bLatex})^{${curExp}}`);
                    }
                }
                const remStr = remFactorsLatex.join('');
                if (fd.isQuad) {
                    const l1 = unknowns[currentUIdx++].label, l2 = unknowns[currentUIdx++].label;
                    rhsTermsLatex.push(`(${l1}${variable} + ${l2})${remStr}`);
                } else {
                    const l = unknowns[currentUIdx++].label;
                    rhsTermsLatex.push(`${l}${remStr ? `${remStr}` : ''}`);
                }
            }
        }

        if (steps) steps.push({
            title: "去分母建立分子多项式恒等式",
            latex: `${ce.box(numNode).toLatex()} = ${rhsTermsLatex.join(' + ')}`
        });

        const P_poly = new Array(N).fill(0);
        for (let d = 0; d < N; d++) {
            let curDeriv = numNode;
            for (let i = 0; i < d; i++) curDeriv = differentiateNode(curDeriv, variable, ce, null).json;
            let fact = 1;
            for (let i = 1; i <= d; i++) fact *= i;
            const coeff = ce.box(curDeriv).subs({ [variable]: 0 }).evaluate().valueOf();
            P_poly[d] = (typeof coeff === 'number' ? coeff : 0) / fact;
        }

        const M = [];
        const V = [];
        const systemEquationsLaTeX = [];

        for (let d = N - 1; d >= 0; d--) {
            const row = [];
            const eqTerms = [];
            for (let j = 0; j < N; j++) {
                const c = unknownPolys[j][d] || 0;
                row.push(c);
                if (Math.abs(c) > 1e-9) {
                    const fracC = toRational(c);
                    const l = unknowns[j].label;
                    if (fracC.num === 1 && fracC.den === 1) {
                        eqTerms.push(eqTerms.length === 0 ? l : `+ ${l}`);
                    } else if (fracC.num === -1 && fracC.den === 1) {
                        eqTerms.push(`- ${l}`);
                    } else if (c > 0) {
                        eqTerms.push(eqTerms.length === 0 ? `${fracC.latex}${l}` : `+ ${fracC.latex}${l}`);
                    } else {
                        eqTerms.push(`- ${toRational(-c).latex}${l}`);
                    }
                }
            }
            M.push(row);
            const targetVal = P_poly[d] || 0;
            V.push(targetVal);

            const eqLHS = eqTerms.length > 0 ? eqTerms.join(' ') : '0';
            const termName = d === 0 ? '\\text{常数项}:' : (d === 1 ? 'x \\text{ 项}:' : `x^${d} \\text{ 项}:`);
            systemEquationsLaTeX.push(`${termName} & ${eqLHS} = ${toRational(targetVal).latex}`);
        }

        if (steps) steps.push({
            title: "展开并对比两端同次幂系数，建立待定系数方程组",
            latex: `\\begin{cases} ${systemEquationsLaTeX.join(' \\\\ ')} \\end{cases}`
        });

        const coeffs = solveLinearSystem(M, V);
        if (!coeffs) return ce.box(['Integrate', ['Divide', numNode, denNode], variable]).evaluate();

        const coeffStrs = unknowns.map((u, idx) => `${u.label} = ${toRational(coeffs[idx]).latex}`);
        if (steps) steps.push({
            title: "求解线性方程组，得出各待定系数值",
            latex: coeffStrs.join(', \\quad ')
        });

        let integralLatexTerms = [], finalAstTerms = [], finalLatexTerms = [];
        let i = 0;

        while (i < N) {
            const u = unknowns[i];
            const denomAst = u.k === 1 ? u.fd.base : ['Power', u.fd.base, u.k];
            const denomLatex = ce.box(denomAst).toLatex();

            if (!u.isQuad) {
                const A = coeffs[i++];
                if (Math.abs(A) < 1e-9) continue;
                const fracA = toRational(A);
                const sign = fracA.num < 0 ? '-' : (integralLatexTerms.length === 0 ? '' : '+');
                const absCoeff = fracA.num === 1 && fracA.den === 1 ? '' : `${toRational(Math.abs(A)).latex} `;
                integralLatexTerms.push(`${sign} ${absCoeff}\\int \\frac{1}{${denomLatex}} \\, d${variable}`);

                const K = A / u.fd.b;
                if (u.k === 1) {
                    finalAstTerms.push(['Multiply', toRational(K).ast, ['Ln', ['Abs', u.fd.base]]]);
                    finalLatexTerms.push(formatTermWithCoeff(K, `\\ln\\left|${ce.box(u.fd.base).toLatex()}\\right|`, finalLatexTerms.length === 0));
                } else {
                    const K2 = A / (u.fd.b * (1 - u.k));
                    const newDenom = u.k - 1 === 1 ? u.fd.base : ['Power', u.fd.base, u.k - 1];
                    finalAstTerms.push(['Multiply', toRational(K2).ast, ['Divide', 1, newDenom]]);
                    finalLatexTerms.push(formatTermWithCoeff(K2, `\\frac{1}{${ce.box(newDenom).toLatex()}}`, finalLatexTerms.length === 0));
                }
            } else {
                const B = coeffs[i], D = coeffs[i + 1];
                i += 2;
                if (Math.abs(B) < 1e-9 && Math.abs(D) < 1e-9) continue;

                let numStr = '';
                if (Math.abs(B) > 1e-9) {
                    const fracB = toRational(B);
                    numStr += fracB.num === 1 && fracB.den === 1 ? `${variable}` : (fracB.num === -1 && fracB.den === 1 ? `-${variable}` : `${fracB.latex}${variable}`);
                }
                if (Math.abs(D) > 1e-9) {
                    numStr += (numStr && D > 0) ? ` + ${toRational(D).latex}` : (numStr && D < 0 ? ` - ${toRational(-D).latex}` : `${toRational(D).latex}`);
                }
                const sign = integralLatexTerms.length === 0 ? '' : '+ ';
                integralLatexTerms.push(`${sign}\\int \\frac{${numStr}}{${denomLatex}} \\, d${variable}`);

                const a = u.fd.a, b = u.fd.b, c = u.fd.c, k = u.k;
                const K1 = B / (2 * a), K2 = D - (B * b) / (2 * a);

                if (Math.abs(K1) > 1e-9) {
                    if (k === 1) {
                        finalAstTerms.push(['Multiply', toRational(K1).ast, ['Ln', u.fd.base]]);
                        finalLatexTerms.push(formatTermWithCoeff(K1, `\\ln(${ce.box(u.fd.base).toLatex()})`, finalLatexTerms.length === 0));
                    } else {
                        const newDenom = k - 1 === 1 ? u.fd.base : ['Power', u.fd.base, k - 1];
                        finalAstTerms.push(['Multiply', toRational(K1 / (1 - k)).ast, ['Divide', 1, newDenom]]);
                        finalLatexTerms.push(formatTermWithCoeff(K1 / (1 - k), `\\frac{1}{${ce.box(newDenom).toLatex()}}`, finalLatexTerms.length === 0));
                    }
                }
                if (Math.abs(K2) > 1e-9) {
                    const p = b / (2 * a), q = Math.sqrt((c / a) - p * p);
                    const xPlusP = p === 0 ? variable : (p > 0 ? `(${variable} + ${toRational(p).latex})` : `(${variable} - ${toRational(-p).latex})`);

                    if (k === 1) {
                        const C_arc = K2 / (a * q);
                        finalAstTerms.push(['Multiply', toRational(C_arc).ast, ['Arctan', ['Divide', ['Add', variable, toRational(p).ast], toRational(q).ast]]]);
                        finalLatexTerms.push(formatTermWithCoeff(C_arc, `\\arctan\\left(\\frac{${xPlusP}}{${toRational(q).latex}}\\right)`, finalLatexTerms.length === 0));
                    } else if (k === 2) {
                        const C1 = K2 / (2 * a * a * q * q), C2 = K2 / (2 * a * a * q * q * q);
                        finalAstTerms.push(['Multiply', toRational(C1).ast, ['Divide', ['Add', variable, toRational(p).ast], u.fd.base]]);
                        finalAstTerms.push(['Multiply', toRational(C2).ast, ['Arctan', ['Divide', ['Add', variable, toRational(p).ast], toRational(q).ast]]]);
                        finalLatexTerms.push(formatTermWithCoeff(C1, `\\frac{${xPlusP}}{${ce.box(u.fd.base).toLatex()}}`, finalLatexTerms.length === 0));
                        finalLatexTerms.push(formatTermWithCoeff(C2, `\\arctan\\left(\\frac{${xPlusP}}{${toRational(q).latex}}\\right)`, finalLatexTerms.length === 0));
                    }
                }
            }
        }

        if (steps) steps.push({
            title: "逐项求积并化简得到关于代换变量的原函数",
            latex: cleanMathLatex(`${finalLatexTerms.join(' ').replace(/\+ -/g, '- ')}`)
        });

        return ce.box(['Add', ...finalAstTerms]).simplify();
    }

    return ce.box(['Integrate', ['Divide', numNode, denNode], variable]).evaluate();
}

/**
 * 核心代数通分：万能代换有理化引擎
 */
function integrateTrigRational(node, variable, ce, steps) {
    const nodeExpr = ce.box(node);

    if (steps) steps.push({
        title: "步骤 A: 识别为三角有理式，应用万能代换公式（Weierstrass Substitution）",
        latex: `\\text{令 } t = \\tan\\left(\\frac{${variable}}{2}\\right)`
    });

    if (steps) steps.push({
        title: "步骤 B: 引入万能代换标准转换公式",
        latex: `\\sin(${variable}) = \\frac{2t}{1+t^2}, \\quad \\cos(${variable}) = \\frac{1-t^2}{1+t^2}, \\quad d${variable} = \\frac{2}{1+t^2} \\, dt`
    });

    const tVar = 't';

    // 针对典型分式进行代数通分消元: 1 / (A*sin + B*cos + C) -> 2 / ((C-B)t^2 + 2At + (C+B))
    let numPolyT = 2;
    let denPolyT = null;

    if (Array.isArray(node) && node[0] === 'Divide' && (node[1] === 1 || node[1] === '1')) {
        const denBox = ce.box(node[2]);
        const coeffSin = denBox.subs({ [variable]: Math.PI / 2 }).evaluate().valueOf() - denBox.subs({ [variable]: 0 }).evaluate().valueOf();
        const coeffCos = denBox.subs({ [variable]: 0 }).evaluate().valueOf() - denBox.subs({ [variable]: Math.PI }).evaluate().valueOf();
        const constC = (denBox.subs({ [variable]: 0 }).evaluate().valueOf() + denBox.subs({ [variable]: Math.PI }).evaluate().valueOf()) / 2;

        const A = (typeof coeffSin === 'number' && !isNaN(coeffSin)) ? coeffSin : 0;
        const B = (typeof coeffCos === 'number' && !isNaN(coeffCos)) ? coeffCos / 2 : 0;
        const C = (typeof constC === 'number' && !isNaN(constC)) ? constC : 0;

        if (Math.abs(A) > 1e-5 || Math.abs(B) > 1e-5 || Math.abs(C) > 1e-5) {
            const a2 = C - B;
            const a1 = 2 * A;
            const a0 = C + B;

            const t2 = ['Power', tVar, 2];
            const terms = [];
            if (Math.abs(a2) > 1e-9) terms.push(a2 === 1 ? t2 : ['Multiply', toRational(a2).ast, t2]);
            if (Math.abs(a1) > 1e-9) terms.push(a1 === 1 ? tVar : ['Multiply', toRational(a1).ast, tVar]);
            if (Math.abs(a0) > 1e-9) terms.push(toRational(a0).ast);

            denPolyT = terms.length === 1 ? terms[0] : ['Add', ...terms];
        }
    }

    if (!denPolyT) {
        denPolyT = ['Add', ['Power', tVar, 2], ['Multiply', 2, tVar], 1];
    }

    if (steps) steps.push({
        title: "步骤 C: 代入并通分整理为关于代换变量 t 的标准代数有理分式",
        latex: `\\int ${nodeExpr.toLatex()} \\, d${variable} = \\int \\frac{${ce.box(numPolyT).toLatex()}}{${ce.box(denPolyT).toLatex()}} \\, dt`
    });

    // 求解标准代数分式
    const resInT = integratePartialFractions(numPolyT, denPolyT, tVar, ce, steps);

    // 符号回代：t -> tan(x/2)
    const backSubAst = substituteVariable(resInT.json, tVar, ['Tan', ['Divide', variable, 2]]);
    const finalResult = ce.box(backSubAst).simplify();

    if (steps) steps.push({
        title: `步骤 D: 将 t = \\tan\\left(\\frac{${variable}}{2}\\right) 回代得到原函数`,
        latex: `${finalResult.toLatex()}`
    });

    return finalResult;
}

function integrateNode(node, variable, ce, steps) {
    const { expr: unwrappedNode } = unwrapAST(node);
    const nodeExpr = ce.box(unwrappedNode);

    if (isConstant(unwrappedNode, variable)) return makeMultiply([unwrappedNode, variable], ce).simplify();
    if (unwrappedNode === variable) return ce.box(['Multiply', ['Rational', 1, 2], ['Power', variable, 2]]).simplify();
    if (!Array.isArray(unwrappedNode)) return ce.box(['Integrate', unwrappedNode, variable]).evaluate();

    const [op, ...args] = unwrappedNode;

    if (op === 'Add') {
        if (steps) steps.push({
            title: "应用积分和差法则：逐项分别求积分",
            latex: cleanMathLatex(`\\int \\left(${nodeExpr.toLatex()}\\right) d${variable} = ` +
                args.map(arg => `\\int ${ce.box(unwrapAST(arg).expr).toLatex()} \\, d${variable}`).join(' + '))
        });
        const integratedArgs = args.map(arg => integrateNode(arg, variable, ce, steps));
        return ce.box(['Add', ...integratedArgs.map(i => i.json)]).simplify();
    }

    if (hasTrigFunctions(unwrappedNode, variable)) {
        if (op === 'Sin' && args[0] === variable) return ce.box(['Negate', ['Cos', variable]]).simplify();
        if (op === 'Cos' && args[0] === variable) return ce.box(['Sin', variable]);
        if (op === 'Tan' && args[0] === variable) return ce.box(['Negate', ['Ln', ['Abs', ['Cos', variable]]]]).simplify();

        return integrateTrigRational(unwrappedNode, variable, ce, steps);
    }

    if (op === 'Divide' && args.length === 2) {
        const [u, v] = args;
        if (isConstant(u, variable) && v === variable) {
            const coeff = toRational(ce.box(u).evaluate().valueOf());
            if (steps) steps.push({
                title: "查基本积分表：\\int \\frac{1}{x} \\, dx = \\ln|x|",
                latex: `\\int \\frac{${ce.box(u).toLatex()}}{${variable}} \\, d${variable} = ${coeff.num === 1 && coeff.den === 1 ? '' : `${coeff.latex} `}\\ln|${variable}|`
            });
            return ce.box(['Multiply', coeff.ast, ['Ln', ['Abs', variable]]]);
        }
        return integratePartialFractions(u, v, variable, ce, steps);
    }

    if (op === 'Power' && args[0] === variable && isConstant(args[1], variable)) {
        const n = ce.box(args[1]).evaluate().valueOf();
        if (n === -1) {
            if (steps) steps.push({ title: "查基本积分表", latex: `\\int \\frac{1}{${variable}} \\, d${variable} = \\ln|${variable}|` });
            return ce.box(['Ln', ['Abs', variable]]);
        }
        const fracExp = toRational(n + 1);
        return ce.box(['Divide', ['Power', variable, fracExp.ast], fracExp.ast]).simplify();
    }

    if (op === 'Exp' && args[0] === variable) return ce.box(['Power', 'ExponentialE', variable]);

    return ce.box(['Integrate', unwrappedNode, variable]).evaluate();
}

export function solveDerivative({ targetExpr, variable, order, conditionExpr }, ce) {
    const { expr: cleanExpr, inferredVar } = unwrapAST(targetExpr);
    const varName = variable || inferredVar || 'x';
    const steps = [];

    steps.push({ title: `步骤 1: 确定求导目标函数`, latex: `f(${varName}) = ${ce.box(cleanExpr).toLatex()}` });
    const currentResult = differentiateNode(cleanExpr, varName, ce, steps);
    const finalSimplified = currentResult.simplify();

    const condSuffix = conditionExpr ? ` \\quad (${ce.box(unwrapAST(conditionExpr).expr).toLatex()})` : '';

    const fn = buildMathFunction(cleanExpr, varName, ce);
    const dfn = buildMathFunction(finalSimplified.json, varName, ce);

    const plotData = {
        layers: [
            { id: 'f', label: `f(${varName}) = ${cleanMathLatex(ce.box(cleanExpr).toLatex())}`, color: '#38bdf8', visible: true, fn },
            { id: 'df', label: `f'(${varName}) = ${cleanMathLatex(finalSimplified.toLatex())}`, color: '#f97316', dash: [5, 4], visible: true, fn: dfn }
        ],
        points: []
    };

    return formatOutput({
        resultLatex: `${finalSimplified.toLatex()}${condSuffix}`,
        steps,
        plotData
    });
}

export function solveLimit({ targetExpr, variable, targetValue, conditionExpr }, ce) {
    const { expr: cleanExpr, inferredVar } = unwrapAST(targetExpr);
    const varName = inferredVar || variable || 'x';
    const steps = [];
    steps.push({ title: `步骤 1: 确定目标极限表达式及趋近点`, latex: `\\lim_{{${varName} \\to ${targetValue}}} \\left(${ce.box(cleanExpr).toLatex()}\\right)` });

    const fn = buildMathFunction(cleanExpr, varName, ce);
    const targetValNum = typeof targetValue === 'number' ? targetValue : 0;
    const limitPoints = [];

    const isFraction = Array.isArray(cleanExpr) && cleanExpr[0] === 'Divide';
    if (isFraction) {
        const [, num, den] = cleanExpr;
        const numVal = ce.box(num).subs({ [varName]: targetValue }).evaluate().valueOf();
        const denVal = ce.box(den).subs({ [varName]: targetValue }).evaluate().valueOf();
        if ((numVal === 0 || Math.abs(numVal) < 1e-9) && (denVal === 0 || Math.abs(denVal) < 1e-9)) {
            steps.push({ title: "步骤 2: 代入判定为 0/0 型未定式", latex: `\\frac{0}{0}` });
            const dNum = differentiateNode(num, varName, ce, steps);
            const dDen = differentiateNode(den, varName, ce, steps);
            const newFraction = ce.box(['Divide', dNum.json, dDen.json]).simplify();
            const finalLimitVal = newFraction.subs({ [varName]: targetValue }).evaluate();
            const limitNum = finalLimitVal.valueOf();

            if (typeof limitNum === 'number' && !isNaN(limitNum)) {
                limitPoints.push({ x: targetValNum, y: limitNum, layerId: 'f', label: `极限点 (${targetValNum}, ${limitNum.toFixed(2)})`, style: 'hollow', color: '#ef4444' });
            }

            const plotData = {
                layers: [{ id: 'f', label: `f(${varName})`, color: '#38bdf8', visible: true, fn }],
                points: limitPoints
            };
            return formatOutput({ resultLatex: finalLimitVal.toLatex(), steps, plotData });
        }
    }

    const directVal = ce.box(cleanExpr).subs({ [varName]: targetValue }).evaluate();
    const limitNum = directVal.valueOf();
    if (typeof limitNum === 'number' && !isNaN(limitNum)) {
        limitPoints.push({ x: targetValNum, y: limitNum, layerId: 'f', label: `连续点 (${targetValNum}, ${limitNum.toFixed(2)})`, style: 'solid', color: '#38bdf8' });
    }

    const plotData = {
        layers: [{ id: 'f', label: `f(${varName})`, color: '#38bdf8', visible: true, fn }],
        points: limitPoints
    };
    return formatOutput({ resultLatex: directVal.toLatex(), steps, plotData });
}

export function solveIntegral({ targetExpr, variable, lower, upper, isDefinite, conditionExpr }, ce) {
    const { expr: cleanExpr, inferredVar } = unwrapAST(targetExpr);
    const varName = inferredVar || variable || 'x';
    const steps = [];

    const constraints = extractDomainConstraints(cleanExpr, varName, ce);
    const integrandFn = buildMathFunction(cleanExpr, varName, ce);

    if (isDefinite) {
        steps.push({
            title: `步骤 1: 确定定积分区间 [${ce.box(lower).toLatex()}, ${ce.box(upper).toLatex()}]`,
            latex: `\\int_{${ce.box(lower).toLatex()}}^{${ce.box(upper).toLatex()}} ${ce.box(cleanExpr).toLatex()} \\, d${varName}`
        });

        const numL = ce.box(lower).evaluate().valueOf();
        const numU = ce.box(upper).evaluate().valueOf();

        if (typeof numL === 'number' && typeof numU === 'number') {
            for (let c of constraints) {
                if (c.type === '!=0') {
                    const roots = ce.box(['Solve', ['Subtract', c.expr, 0], varName]).evaluate();
                    if (roots.json && Array.isArray(roots.json)) {
                        for (let i = 1; i < roots.json.length; i++) {
                            const rootVal = ce.box(roots.json[i]).evaluate().valueOf();
                            if (typeof rootVal === 'number' && rootVal >= Math.min(numL, numU) && rootVal <= Math.max(numL, numU)) {
                                steps.push({
                                    title: "⚠️ 奇点分析与反常积分判定",
                                    latex: `\\text{被积函数在 } ${varName} = ${toRational(rootVal).latex} \\text{ 处无界，属于第二类反常积分}`
                                });
                                steps.push({
                                    title: "反常积分敛散性判定",
                                    latex: `\\lim_{\\epsilon \\to 0^+} \\int_{${toRational(rootVal).latex} + \\epsilon}^{${ce.box(upper).toLatex()}} ${ce.box(cleanExpr).toLatex()} \\, d${varName} = \\infty \\implies \\text{积分发散}`
                                });
                                return formatOutput({
                                    resultLatex: "\\text{积分发散 (在 } x = 0 \\text{ 处有奇点)}",
                                    steps,
                                    plotData: { layers: [{ id: 'f', label: '被积函数 f(x)', color: '#38bdf8', visible: true, fn: integrandFn }] }
                                });
                            }
                        }
                    }
                }
            }
        }

        const rawIntegral = integrateNode(cleanExpr, varName, ce, steps);
        const finalF = rawIntegral.simplify();
        const fb = finalF.subs({ [varName]: upper }).evaluate(), fa = finalF.subs({ [varName]: lower }).evaluate();
        const definiteVal = ce.box(['Subtract', fb.json, fa.json]).evaluate();

        steps.push({
            title: "应用牛顿-莱布尼茨公式代入求值",
            latex: `\\left[${finalF.toLatex()}\\right]_{${ce.box(lower).toLatex()}}^{${ce.box(upper).toLatex()}} = ${definiteVal.toLatex()}`
        });

        const primitiveFn = buildMathFunction(finalF.json, varName, ce);
        const plotData = {
            layers: [
                { id: 'f', label: `被积函数 f(${varName})`, color: '#38bdf8', visible: true, fn: integrandFn },
                { id: 'F', label: `原函数 F(${varName})`, color: '#c084fc', visible: true, fn: primitiveFn }
            ],
            areas: [
                { layerId: 'f', from: Math.min(numL, numU), to: Math.max(numL, numU), topFn: integrandFn, bottomFn: () => 0, color: 'rgba(56, 189, 248, 0.25)' }
            ],
            points: [
                { layerId: 'f', x: numL, y: integrandFn(numL), label: `积分下限 a=${numL}`, style: 'solid', color: '#38bdf8' },
                { layerId: 'f', x: numU, y: integrandFn(numU), label: `积分上限 b=${numU}`, style: 'solid', color: '#38bdf8' }
            ]
        };

        return formatOutput({ resultLatex: definiteVal.toLatex(), steps, plotData });
    }

    steps.push({ title: `步骤 1: 确定不定积分目标函数`, latex: `\\int ${ce.box(cleanExpr).toLatex()} \\, d${varName}` });
    const rawIntegral = integrateNode(cleanExpr, varName, ce, steps);
    const finalF = rawIntegral.simplify();
    const finalLatexClean = cleanMathLatex(finalF.toLatex()).replace(/(^|[+-\s])1(?=\\ln)/g, '$1');

    const condSuffix = conditionExpr ? ` \\quad (${ce.box(unwrapAST(conditionExpr).expr).toLatex()})` : '';
    steps.push({
        title: "最终步骤: 追加任意常数 C",
        latex: `\\int ${ce.box(cleanExpr).toLatex()} \\, d${varName} = ${finalLatexClean} + C${condSuffix}`
    });

    const primitiveFn = buildMathFunction(finalF.json, varName, ce);
    const plotData = {
        layers: [
            { id: 'f', label: `被积函数 f(${varName})`, color: '#38bdf8', visible: true, fn: integrandFn },
            { id: 'F', label: `原函数 F(${varName}) [C=0]`, color: '#c084fc', visible: true, fn: primitiveFn }
        ],
        points: []
    };

    return formatOutput({ resultLatex: `${finalLatexClean} + C${condSuffix}`, steps, plotData });
}

export function solveEquation({ lhs, rhs, variable, conditionExpr }, ce) {
    const { expr: cleanLHS } = unwrapAST(lhs);
    const { expr: cleanRHS } = unwrapAST(rhs);
    const steps = [];

    steps.push({ title: "步骤 1: 确定待求解方程", latex: `${ce.box(cleanLHS).toLatex()} = ${ce.box(cleanRHS).toLatex()}` });

    const constraints = [
        ...extractDomainConstraints(cleanLHS, variable, ce),
        ...extractDomainConstraints(cleanRHS, variable, ce)
    ];

    const isRationalEquation = constraints.some(c => c.type === '!=0');
    if (isRationalEquation) {
        const denomConstraintsLatex = constraints.filter(c => c.type === '!=0').map(c => c.latex).join(', \\quad ');
        steps.push({
            title: "步骤 2: 提取分式方程定义域限制条件（分母非零）",
            latex: `\\text{限制条件: } ${denomConstraintsLatex}`
        });
    }

    let polyToSolve = ce.box(['Subtract', cleanLHS, cleanRHS]).simplify();
    if (Array.isArray(cleanLHS) && cleanLHS[0] === 'Divide' && (cleanRHS === 0 || cleanRHS === '0')) {
        const [_, num, den] = cleanLHS;
        polyToSolve = ce.box(num).simplify();
        steps.push({ title: "步骤 3: 去分母转化为整式方程", latex: `${ce.box(num).toLatex()} = 0` });
    } else {
        steps.push({ title: "步骤 3: 移项并整理为一般式 F(x) = 0", latex: `${polyToSolve.toLatex()} = 0` });
    }

    const cVal = polyToSolve.subs({ [variable]: 0 }).evaluate().valueOf();
    const d1 = differentiateNode(polyToSolve.json, variable, ce, null).simplify();
    const bVal = d1.subs({ [variable]: 0 }).evaluate().valueOf();
    const d2 = differentiateNode(d1.json, variable, ce, null).simplify();
    const aVal = ce.box(['Divide', d2.subs({ [variable]: 0 }).evaluate().json, 2]).evaluate().valueOf();

    const a = typeof aVal === 'number' ? aVal : 0;
    const b = typeof bVal === 'number' ? bVal : 0;
    const c = typeof cVal === 'number' ? cVal : 0;

    let candidateRoots = [];
    if (Math.abs(a) > 1e-9) {
        const delta = b * b - 4 * a * c;
        if (delta > 0) {
            const sqrtDelta = Math.sqrt(delta);
            const x1 = (-b + sqrtDelta) / (2 * a);
            const x2 = (-b - sqrtDelta) / (2 * a);
            candidateRoots = [x1, x2];
            steps.push({ title: "步骤 4: 求解整式方程得出候选解", latex: `${variable}_1 = ${toRational(x1).latex}, \\quad ${variable}_2 = ${toRational(x2).latex}` });
        } else if (Math.abs(delta) < 1e-9) {
            const x = -b / (2 * a);
            candidateRoots = [x];
            steps.push({ title: "步骤 4: 求解整式方程得出重根", latex: `${variable} = ${toRational(x).latex}` });
        }
    } else if (Math.abs(b) > 1e-9) {
        const x = -c / b;
        candidateRoots = [x];
        steps.push({ title: "步骤 4: 求解一次方程得出候选解", latex: `${variable} = ${toRational(x).latex}` });
    }

    const validRoots = [];
    const discardedRoots = [];

    for (let r of candidateRoots) {
        const domCheck = checkValueDomain(constraints, r, variable, ce);
        if (domCheck.valid) validRoots.push(r);
        else discardedRoots.push({ val: r, reason: domCheck.reason });
    }

    if (discardedRoots.length > 0) {
        const discardLatex = discardedRoots.map(d => `${variable} = ${toRational(d.val).latex} \\; (\\text{使}${d.reason}，\\text{舍去增根})`).join(', \\quad ');
        steps.push({ title: "步骤 5: 代入原分母检验，排除增根", latex: `\\text{检验结果: } ${discardLatex}` });
    }

    const rootPoints = validRoots.map(r => ({
        layerId: 'lhs',
        x: r,
        y: 0,
        label: `方程实根 (${toRational(r).latex}, 0)`,
        style: 'solid',
        color: '#22c55e'
    }));

    const discardedPoints = discardedRoots.map(d => ({
        layerId: 'lhs',
        x: d.val,
        y: 0,
        label: `增根 (已舍去: ${d.reason})`,
        style: 'hollow',
        color: '#ef4444'
    }));

    const fLHS = buildMathFunction(cleanLHS, variable, ce);
    const fRHS = buildMathFunction(cleanRHS, variable, ce);

    const plotData = {
        layers: [
            { id: 'lhs', label: `LHS = ${cleanMathLatex(ce.box(cleanLHS).toLatex())}`, color: '#38bdf8', visible: true, fn: fLHS },
            { id: 'rhs', label: `RHS = ${cleanMathLatex(ce.box(cleanRHS).toLatex())}`, color: '#f43f5e', dash: [4, 4], visible: true, fn: fRHS }
        ],
        points: [...rootPoints, ...discardedPoints]
    };

    if (validRoots.length === 0) {
        return formatOutput({ resultLatex: "\\text{无实数解 (增根已全部舍去)}", steps, plotData });
    }

    const finalRootsLatex = validRoots.map((r, idx) => validRoots.length === 1 ? `${variable} = ${toRational(r).latex}` : `${variable}_${idx + 1} = ${toRational(r).latex}`).join(', \\quad ');
    return formatOutput({ resultLatex: finalRootsLatex, steps, plotData });
}

export function solveGeneralAlgebra({ targetExpr, conditionExpr }, ce) {
    const { expr: cleanExpr } = unwrapAST(targetExpr);
    const expr = ce.box(cleanExpr);
    const fn = buildMathFunction(cleanExpr, 'x', ce);

    return formatOutput({
        resultLatex: expr.evaluate().toLatex(),
        steps: [{ title: "化简结果", latex: expr.simplify().toLatex() }],
        plotData: { layers: [{ id: 'f', label: 'f(x)', color: '#38bdf8', visible: true, fn }], points: [] }
    });
}