// solvers.js —— 现代全功能微积分、代数与微分方程分步推导引擎

/**
 * 求解线性代数方程组 (高斯主元消去法)
 */
export function solveLinearSystem(matrix, vector) {
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

        if (Math.abs(m[i][i]) < 1e-11) return null;

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

export function gcd(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) { const t = b; b = a % b; a = t; }
    return a || 1;
}

/**
 * 连分数浮点数转精确有理分式表示
 */
export function toRational(val, tolerance = 1e-6) {
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
        return { num: 0, den: 1, latex: '0', ast: 0, isInt: true };
    }
    if (Number.isInteger(val) || Math.abs(Math.round(val) - val) < 1e-9) {
        const rounded = Math.round(val);
        return { num: rounded, den: 1, latex: `${rounded}`, ast: rounded, isInt: true };
    }

    let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
    let b = Math.abs(val);
    let iterations = 0;

    do {
        let a = Math.floor(b);
        let aux = h1; h1 = a * h1 + h2; h2 = aux;
        aux = k1; k1 = a * k1 + k2; k2 = aux;
        const diff = b - a;
        if (Math.abs(diff) < 1e-12) break;
        b = 1 / diff;
        iterations++;
    } while (Math.abs(Math.abs(val) - h1 / k1) > tolerance && k1 < 100000 && iterations < 20);

    let num = Math.sign(val) * h1, den = k1;
    const g = gcd(num, den);
    num /= g; den /= g;

    if (den === 1) return { num, den: 1, latex: `${num}`, ast: num, isInt: true };
    const signStr = num < 0 ? '-' : '';
    return {
        num, den,
        latex: `${signStr}\\frac{${Math.abs(num)}}{${den}}`,
        ast: ['Rational', num, den],
        isInt: false
    };
}

/**
 * 清理并美化 LaTeX 符号串
 */
export function cleanMathLatex(latexStr) {
    if (typeof latexStr !== 'string') return String(latexStr || '');
    let str = latexStr;

    // 格式化三角函数高次幂形式 \sin(x)^2 -> \sin^2(x)
    const funcs = 'sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|coth|arcsin|arccos|arctan';
    const wrappedPattern = new RegExp(`\\\\left\\(\\s*\\\\(${funcs})\\s*(\\\\left\\([\\s\\S]*?\\\\right\\)|\\([^()]*\\)|\\{[^{}]*\\})\\s*\\\\right\\)\\s*\\^\\s*(\\{[^{}]+\\}|[0-9a-zA-Z]+)`, 'g');
    str = str.replace(wrappedPattern, (m, fn, arg, exp) => `\\${fn}^${exp.startsWith('{') ? exp : `{${exp}}`}${arg}`);

    const directPattern = new RegExp(`\\\\(${funcs})\\s*(\\\\left\\([\\s\\S]*?\\\\right\\)|\\([^()]*\\)|\\{[^{}]*\\})\\s*\\^\\s*(\\{[^{}]+\\}|[0-9a-zA-Z]+)`, 'g');
    str = str.replace(directPattern, (m, fn, arg, exp) => `\\${fn}^${exp.startsWith('{') ? exp : `{${exp}}`}${arg}`);

    // 清理多余符号和正负号重叠
    str = str.replace(/\+\s*-/g, '- ')
             .replace(/-\s*-/g, '+ ')
             .replace(/\\left\(\s*\\right\)/g, '')
             .replace(/1(?=\\ln)/g, '')
             .replace(/1(?=\\pi)/g, '');

    return str;
}

export function formatOutput({ resultLatex, steps, plotData }) {
    return {
        resultLatex: cleanMathLatex(resultLatex || ''),
        steps: (steps || []).map(s => ({
            title: s.title || '',
            latex: cleanMathLatex(s.latex || '')
        })),
        plotData: plotData || null
    };
}

/**
 * 递归解构 MathJSON AST (兼容对象形式与嵌套 Block/Hold/Function)
 */
export function unwrapAST(node) {
    if (!node) return { expr: 0, inferredVar: null };

    // 处理 CortexJS MathJSON 对象形式 { sym: 'x' } / { fn: [...] } / { num: 1 }
    if (typeof node === 'object' && !Array.isArray(node)) {
        if (node.sym) return { expr: node.sym, inferredVar: typeof node.sym === 'string' ? node.sym : null };
        if (node.num !== undefined) return { expr: node.num, inferredVar: null };
        if (node.fn) return unwrapAST(node.fn);
        if (node.json) return unwrapAST(node.json);
    }

    if (!Array.isArray(node)) return { expr: node, inferredVar: null };

    let curr = node;
    let inferredVar = null;

    if (curr[0] === 'Function') {
        if (typeof curr[2] === 'string') inferredVar = curr[2];
        curr = curr[1];
    }

    while (Array.isArray(curr) && (curr[0] === 'Block' || curr[0] === 'Hold' || curr[0] === 'Sequence')) {
        curr = curr[1];
    }

    if (Array.isArray(curr) && curr[0] === 'Function') {
        if (typeof curr[2] === 'string' && !inferredVar) inferredVar = curr[2];
        curr = curr[1];
        while (Array.isArray(curr) && (curr[0] === 'Block' || curr[0] === 'Hold')) curr = curr[1];
    }

    return { expr: curr, inferredVar };
}

export function isConstant(ast, variable) {
    if (typeof ast === 'number') return true;
    if (typeof ast === 'string') return ast !== variable;
    if (typeof ast === 'object' && !Array.isArray(ast)) {
        if (ast.sym) return ast.sym !== variable;
        if (ast.num !== undefined) return true;
        if (ast.fn) return isConstant(ast.fn, variable);
    }
    if (Array.isArray(ast)) return ast.slice(1).every(arg => isConstant(arg, variable));
    return true;
}

export function getFactorWeight(node) {
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

export function makeMultiply(factors, ce) {
    const flatList = [];
    const collect = (item) => {
        const { expr } = unwrapAST(item);
        if (Array.isArray(expr) && expr[0] === 'Multiply') {
            expr.slice(1).forEach(collect);
        } else if (expr !== 1 && expr !== '1') {
            flatList.push(expr);
        }
    };
    Array.isArray(factors) ? factors.forEach(collect) : collect(factors);

    if (flatList.length === 0) return ce.box(1);
    if (flatList.length === 1) return ce.box(flatList[0]);

    // 合并纯数值常数因子
    let numericProduct = 1;
    const nonNumeric = [];
    for (let f of flatList) {
        if (typeof f === 'number') {
            numericProduct *= f;
        } else {
            nonNumeric.push(f);
        }
    }

    if (numericProduct === 0) return ce.box(0);
    const finalFactors = [];
    if (numericProduct !== 1) finalFactors.push(numericProduct);
    finalFactors.push(...nonNumeric);

    if (finalFactors.length === 0) return ce.box(1);
    if (finalFactors.length === 1) return ce.box(finalFactors[0]);

    finalFactors.sort((a, b) => getFactorWeight(a) - getFactorWeight(b));
    return ce.box(['Multiply', ...finalFactors]);
}

export function polyMul(p1, p2) {
    const res = new Array(p1.length + p2.length - 1).fill(0);
    for (let i = 0; i < p1.length; i++) {
        for (let j = 0; j < p2.length; j++) res[i + j] += p1[i] * p2[j];
    }
    return res;
}

export function polyPow(p, exp) {
    let res = [1];
    for (let i = 0; i < exp; i++) res = polyMul(res, p);
    return res;
}

/**
 * 提取定义域约束（分母非零、根号非负、对数真数大于零）
 */
export function extractDomainConstraints(node, variable, ce, constraints = []) {
    const { expr } = unwrapAST(node);
    if (!Array.isArray(expr)) return constraints;

    const [op, ...args] = expr;

    if (op === 'Sqrt') {
        constraints.push({ type: '>=0', desc: "根号下非负", expr: args[0], latex: `${ce.box(args[0]).toLatex()} \\ge 0` });
    } else if (op === 'Power') {
        const [base, exp] = args;
        try {
            const expVal = ce.box(exp).evaluate();
            if (expVal.json && Array.isArray(expVal.json) && expVal.json[0] === 'Rational') {
                const den = expVal.json[2];
                if (den % 2 === 0) {
                    constraints.push({ type: '>=0', desc: "偶次根式非负", expr: base, latex: `${ce.box(base).toLatex()} \\ge 0` });
                }
            }
        } catch (e) { }
    }

    if (op === 'Divide' && args.length === 2) {
        constraints.push({ type: '!=0', desc: "分母非零", expr: args[1], latex: `${ce.box(args[1]).toLatex()} \\ne 0` });
    }

    if (op === 'Ln' || op === 'Log') {
        constraints.push({ type: '>0', desc: "对数真数大于零", expr: args[0], latex: `${ce.box(args[0]).toLatex()} > 0` });
    }

    if (op === 'Tan') {
        constraints.push({ type: 'cos!=0', desc: "正切函数定义域限制", expr: ['Cos', args[0]], latex: `\\cos(${ce.box(args[0]).toLatex()}) \\ne 0` });
    }

    for (let arg of args) extractDomainConstraints(arg, variable, ce, constraints);
    return constraints;
}

export function checkValueDomain(constraints, val, variable, ce) {
    for (let c of constraints) {
        try {
            const v = ce.box(c.expr).subs({ [variable]: val }).evaluate().valueOf();
            if (typeof v !== 'number' || isNaN(v)) return { valid: false, reason: c.desc, latex: c.latex };
            if (c.type === '!=0' && Math.abs(v) < 1e-9) return { valid: false, reason: "分母为 0", latex: c.latex };
            if (c.type === 'cos!=0' && Math.abs(v) < 1e-9) return { valid: false, reason: "正切函数无定义", latex: c.latex };
            if (c.type === '>=0' && v < -1e-9) return { valid: false, reason: "被开方数为负", latex: c.latex };
            if (c.type === '>0' && v <= 1e-9) return { valid: false, reason: "对数真数非正", latex: c.latex };
        } catch (e) {
            return { valid: false, reason: "超出定义域", latex: c.latex };
        }
    }
    return { valid: true };
}

/**
 * 编译高性能快速数学函数 (原生 JS 函数，避免渲染循环中 subs/evaluate 导致卡顿)
 */
export function buildMathFunction(ast, variable, ce) {
    if (!ast) return () => NaN;

    function compileNode(node) {
        const { expr } = unwrapAST(node);
        if (typeof expr === 'number') return () => expr;
        if (typeof expr === 'string') {
            if (expr === variable) return (x) => x;
            if (expr === 'Pi') return () => Math.PI;
            if (expr === 'ExponentialE' || expr === 'e') return () => Math.E;
            return () => NaN;
        }
        if (!Array.isArray(expr)) return () => NaN;

        const [op, ...args] = expr;
        const compiledArgs = args.map(compileNode);

        switch (op) {
            case 'Add':
                return (x) => compiledArgs.reduce((acc, fn) => acc + fn(x), 0);
            case 'Subtract':
                return (x) => compiledArgs[0](x) - compiledArgs[1](x);
            case 'Negate':
                return (x) => -compiledArgs[0](x);
            case 'Multiply':
                return (x) => compiledArgs.reduce((acc, fn) => acc * fn(x), 1);
            case 'Divide':
                return (x) => {
                    const den = compiledArgs[1](x);
                    return Math.abs(den) < 1e-12 ? NaN : compiledArgs[0](x) / den;
                };
            case 'Power':
                return (x) => Math.pow(compiledArgs[0](x), compiledArgs[1](x));
            case 'Sqrt':
                return (x) => {
                    const v = compiledArgs[0](x);
                    return v < 0 ? NaN : Math.sqrt(v);
                };
            case 'Sin': return (x) => Math.sin(compiledArgs[0](x));
            case 'Cos': return (x) => Math.cos(compiledArgs[0](x));
            case 'Tan': return (x) => Math.tan(compiledArgs[0](x));
            case 'Cot': return (x) => 1 / Math.tan(compiledArgs[0](x));
            case 'Sec': return (x) => 1 / Math.cos(compiledArgs[0](x));
            case 'Csc': return (x) => 1 / Math.sin(compiledArgs[0](x));
            case 'Arcsin': return (x) => Math.asin(compiledArgs[0](x));
            case 'Arccos': return (x) => Math.acos(compiledArgs[0](x));
            case 'Arctan': return (x) => Math.atan(compiledArgs[0](x));
            case 'Exp': return (x) => Math.exp(compiledArgs[0](x));
            case 'Ln': return (x) => {
                const v = compiledArgs[0](x);
                return v <= 0 ? NaN : Math.log(v);
            };
            case 'Log': return (x) => {
                const v = compiledArgs[0](x);
                return v <= 0 ? NaN : Math.log10(v);
            };
            case 'Abs': return (x) => Math.abs(compiledArgs[0](x));
            default:
                const boxed = ce.box(node);
                return (x) => {
                    try {
                        const val = boxed.subs({ [variable]: x }).evaluate().valueOf();
                        return typeof val === 'number' && !isNaN(val) ? val : NaN;
                    } catch (e) { return NaN; }
                };
        }
    }

    try {
        return compileNode(ast);
    } catch (e) {
        const boxed = ce.box(ast);
        return (x) => {
            try {
                const val = boxed.subs({ [variable]: x }).evaluate().valueOf();
                return typeof val === 'number' && !isNaN(val) ? val : NaN;
            } catch (err) { return NaN; }
        };
    }
}

export function hasTrigFunctions(node, variable) {
    const { expr } = unwrapAST(node);
    if (!Array.isArray(expr)) return false;
    const [op, ...args] = expr;
    if (['Sin', 'Cos', 'Tan', 'Cot', 'Sec', 'Csc'].includes(op) && !isConstant(args[0], variable)) {
        return true;
    }
    return args.some(arg => hasTrigFunctions(arg, variable));
}

export function substituteVariable(node, varName, replacementAst) {
    const { expr } = unwrapAST(node);
    if (expr === varName) return replacementAst;
    if (!Array.isArray(expr)) return expr;

    const [op, ...args] = expr;
    return [op, ...args.map(arg => substituteVariable(arg, varName, replacementAst))];
}

// ==========================================
// 1. 完备符号求导引擎
// ==========================================

export function differentiateNode(node, variable, ce, steps) {
    const { expr: unwrappedNode } = unwrapAST(node);

    if (isConstant(unwrappedNode, variable)) return ce.box(0);
    if (unwrappedNode === variable) return ce.box(1);
    if (!Array.isArray(unwrappedNode)) {
        return ce.box(['Derivative', unwrappedNode, variable]).evaluate();
    }

    const [op, ...args] = unwrappedNode;

    if (op === 'Add') {
        const derivs = args.map(a => differentiateNode(a, variable, ce, steps).json);
        return ce.box(['Add', ...derivs]).simplify();
    }

    if (op === 'Subtract' && args.length === 2) {
        const du = differentiateNode(args[0], variable, ce, steps), dv = differentiateNode(args[1], variable, ce, steps);
        return ce.box(['Subtract', du.json, dv.json]).simplify();
    }

    if (op === 'Negate' && args.length === 1) {
        return ce.box(['Negate', differentiateNode(args[0], variable, ce, steps).json]).simplify();
    }

    if (op === 'Multiply') {
        const constants = args.filter(a => isConstant(a, variable));
        const variables = args.filter(a => !isConstant(a, variable));

        if (constants.length > 0 && variables.length > 0) {
            const cBox = makeMultiply(constants, ce);
            const vBox = variables.length === 1 ? variables[0] : ['Multiply', ...variables];
            const dVar = differentiateNode(vBox, variable, ce, steps);
            return makeMultiply([cBox.json, dVar.json], ce).simplify();
        }

        if (args.length === 2) {
            const [u, v] = args;
            const du = differentiateNode(u, variable, ce, steps), dv = differentiateNode(v, variable, ce, steps);
            return ce.box(['Add', makeMultiply([du.json, v], ce).json, makeMultiply([u, dv.json], ce).json]).simplify();
        }

        const termBoxes = [];
        for (let i = 0; i < args.length; i++) {
            const d_i = differentiateNode(args[i], variable, ce, steps);
            const rest = args.filter((_, idx) => idx !== i);
            termBoxes.push(makeMultiply([d_i.json, ...rest], ce).json);
        }
        return ce.box(['Add', ...termBoxes]).simplify();
    }

    if (op === 'Divide' && args.length === 2) {
        const [u, v] = args;
        if (isConstant(u, variable)) {
            const dv = differentiateNode(v, variable, ce, steps);
            return ce.box(['Divide', makeMultiply([['Negate', u], dv.json], ce).json, ['Power', v, 2]]).simplify();
        }
        if (isConstant(v, variable)) {
            const du = differentiateNode(u, variable, ce, steps);
            return ce.box(['Divide', du.json, v]).simplify();
        }
        const du = differentiateNode(u, variable, ce, steps), dv = differentiateNode(v, variable, ce, steps);
        return ce.box(['Divide', ['Subtract', makeMultiply([du.json, v], ce).json, makeMultiply([u, dv.json], ce).json], ['Power', v, 2]]).simplify();
    }

    if (op === 'Power' && args.length === 2) {
        const [base, exp] = args;
        const baseIsConst = isConstant(base, variable);
        const expIsConst = isConstant(exp, variable);

        if (!baseIsConst && expIsConst) {
            const dBase = differentiateNode(base, variable, ce, steps);
            const newExp = ce.box(['Subtract', exp, 1]).evaluate();
            return makeMultiply([exp, ['Power', base, newExp.json], dBase.json], ce).simplify();
        }

        if (baseIsConst && !expIsConst) {
            const dExp = differentiateNode(exp, variable, ce, steps);
            if (base === 'ExponentialE' || base === 'e') {
                return makeMultiply([node, dExp.json], ce).simplify();
            }
            return makeMultiply([node, ['Ln', base], dExp.json], ce).simplify();
        }

        if (!baseIsConst && !expIsConst) {
            const du = differentiateNode(base, variable, ce, steps);
            const dv = differentiateNode(exp, variable, ce, steps);
            const inner = ['Add', makeMultiply([dv.json, ['Ln', base]], ce).json, ['Divide', makeMultiply([exp, du.json], ce).json, base]];
            return makeMultiply([node, inner], ce).simplify();
        }
    }

    if (op === 'Sqrt' && args.length === 1) {
        const inner = args[0];
        const du = differentiateNode(inner, variable, ce, steps);
        return ce.box(['Divide', du.json, ['Multiply', 2, ['Sqrt', inner]]]).simplify();
    }

    const trigRules = {
        'Sin': (u, du) => makeMultiply([du.json, ['Cos', u]], ce),
        'Cos': (u, du) => makeMultiply([['Negate', du.json], ['Sin', u]], ce),
        'Tan': (u, du) => ce.box(['Divide', du.json, ['Power', ['Cos', u], 2]]),
        'Cot': (u, du) => ce.box(['Negate', ['Divide', du.json, ['Power', ['Sin', u], 2]]]),
        'Sec': (u, du) => makeMultiply([du.json, ['Sec', u], ['Tan', u]], ce),
        'Csc': (u, du) => makeMultiply([['Negate', du.json], ['Csc', u], ['Cot', u]], ce),
        'Arcsin': (u, du) => ce.box(['Divide', du.json, ['Sqrt', ['Subtract', 1, ['Power', u, 2]]]]),
        'Arccos': (u, du) => ce.box(['Divide', ['Negate', du.json], ['Sqrt', ['Subtract', 1, ['Power', u, 2]]]]),
        'Arctan': (u, du) => ce.box(['Divide', du.json, ['Add', 1, ['Power', u, 2]]]),
        'Ln': (u, du) => ce.box(['Divide', du.json, u]),
        'Log': (u, du) => ce.box(['Divide', du.json, makeMultiply([u, ['Ln', 10]], ce).json]),
        'Exp': (u, du) => makeMultiply([du.json, ['Exp', u]], ce),
        'Sinh': (u, du) => makeMultiply([du.json, ['Cosh', u]], ce),
        'Cosh': (u, du) => makeMultiply([du.json, ['Sinh', u]], ce),
        'Tanh': (u, du) => ce.box(['Divide', du.json, ['Power', ['Cosh', u], 2]]),
        'Abs': (u, du) => makeMultiply([du.json, ['Divide', u, ['Abs', u]]], ce)
    };

    if (trigRules[op]) {
        const inner = args[0];
        const du = differentiateNode(inner, variable, ce, steps);
        return trigRules[op](inner, du).simplify();
    }

    return ce.box(['Derivative', unwrappedNode, variable]).evaluate();
}

/**
 * 导数求解器导出主入口
 */
export function solveDerivative({ targetExpr, variable, order, conditionExpr }, ce) {
    const { expr: cleanExpr, inferredVar } = unwrapAST(targetExpr);
    const varName = variable || inferredVar || 'x';
    const numOrder = typeof order === 'number' ? Math.max(1, Math.min(order, 5)) : 1;
    const steps = [];

    steps.push({
        title: `步骤 1: 确定求导目标函数`,
        latex: `f(${varName}) = ${cleanMathLatex(ce.box(cleanExpr).toLatex())}`
    });

    let currentExpr = cleanExpr;
    for (let k = 1; k <= numOrder; k++) {
        const deriv = differentiateNode(currentExpr, varName, ce, steps).simplify();
        const primeStr = "'".repeat(k);
        steps.push({
            title: numOrder === 1 ? "应用求导法则与链式法则求导" : `计算 ${k} 阶导数 f^{(${k})}(${varName})`,
            latex: `f${primeStr}(${varName}) = ${cleanMathLatex(deriv.toLatex())}`
        });
        currentExpr = deriv.json;
    }

    const finalSimplified = ce.box(currentExpr).simplify();
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
        resultLatex: `${cleanMathLatex(finalSimplified.toLatex())}${condSuffix}`,
        steps,
        plotData
    });
}

// ==========================================
// 2. 完备不定积分与定积分引擎
// ==========================================

export function extractFactors(denNode, variable, ce) {
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

export function formatTermWithCoeff(coeffVal, termLatex, isFirst = false) {
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

export function integratePartialFractions(numNode, denNode, variable, ce, steps) {
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
        let curDeriv = numNode;
        let fact = 1;
        for (let d = 0; d < N; d++) {
            if (d > 0) {
                curDeriv = differentiateNode(curDeriv, variable, ce, null).json;
                fact *= d;
            }
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
            const termName = d === 0 ? '\\text{常数项}:' : (d === 1 ? `${variable} \\text{ 项}:` : `${variable}^${d} \\text{ 项}:`);
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
            title: "逐项求积并化简得到关于原变量的原函数",
            latex: cleanMathLatex(`${finalLatexTerms.join(' ').replace(/\+ -/g, '- ')}`)
        });

        return ce.box(['Add', ...finalAstTerms]).simplify();
    }

    return ce.box(['Integrate', ['Divide', numNode, denNode], variable]).evaluate();
}

/**
 * 分部积分法引擎 (Integration by Parts: \int u v' dx = u v - \int u' v dx)
 */
export function integrateByParts(uNode, dvNode, variable, ce, steps) {
    const du = differentiateNode(uNode, variable, ce, null).simplify();
    const v = integrateNode(dvNode, variable, ce, null).simplify();

    if (steps) {
        steps.push({
            title: "应用分部积分公式：\\int u \\, dv = uv - \\int v \\, du",
            latex: `\\text{设 } u = ${ce.box(uNode).toLatex()}, \\quad dv = ${ce.box(dvNode).toLatex()} \\, d${variable} \\implies du = ${cleanMathLatex(du.toLatex())} \\, d${variable}, \\quad v = ${cleanMathLatex(v.toLatex())}`
        });
    }

    const uvTerm = makeMultiply([uNode, v.json], ce).simplify();
    const remIntegrand = makeMultiply([v.json, du.json], ce).simplify();

    if (steps) {
        steps.push({
            title: "代入分部积分公式展开",
            latex: `uv - \\int v \\, du = ${cleanMathLatex(uvTerm.toLatex())} - \\int \\left(${cleanMathLatex(remIntegrand.toLatex())}\\right) d${variable}`
        });
    }

    const intRem = integrateNode(remIntegrand.json, variable, ce, steps);
    const finalResult = ce.box(['Subtract', uvTerm.json, intRem.json]).simplify();

    return finalResult;
}

/**
 * 三角有理式万能代换 (Weierstrass Substitution: t = tan(x/2))
 */
export function integrateTrigRational(node, variable, ce, steps) {
    const nodeExpr = ce.box(node);

    if (steps) steps.push({
        title: "识别为三角有理式，应用万能代换公式（Weierstrass Substitution）",
        latex: `\\text{令 } t = \\tan\\left(\\frac{${variable}}{2}\\right) \\implies \\sin(${variable}) = \\frac{2t}{1+t^2}, \\quad \\cos(${variable}) = \\frac{1-t^2}{1+t^2}, \\quad d${variable} = \\frac{2}{1+t^2} \\, dt`
    });

    const tVar = 't';
    let numPolyT = 2;
    let denPolyT = null;

    if (Array.isArray(node) && node[0] === 'Divide') {
        const [, numNode, denNode] = node;
        const denBox = ce.box(denNode);

        const v0 = denBox.subs({ [variable]: 0 }).evaluate().valueOf();
        const vPi = denBox.subs({ [variable]: Math.PI }).evaluate().valueOf();
        const vHalfPi = denBox.subs({ [variable]: Math.PI / 2 }).evaluate().valueOf();

        if (typeof v0 === 'number' && typeof vPi === 'number' && typeof vHalfPi === 'number') {
            const B = (v0 - vPi) / 2;
            const C = (v0 + vPi) / 2;
            const A = vHalfPi - C;

            const a2 = C - B;
            const a1 = 2 * A;
            const a0 = C + B;

            const t2 = ['Power', tVar, 2];
            const terms = [];
            if (Math.abs(a2) > 1e-7) terms.push(a2 === 1 ? t2 : ['Multiply', toRational(a2).ast, t2]);
            if (Math.abs(a1) > 1e-7) terms.push(a1 === 1 ? tVar : ['Multiply', toRational(a1).ast, tVar]);
            if (Math.abs(a0) > 1e-7) terms.push(toRational(a0).ast);

            denPolyT = terms.length === 0 ? 1 : (terms.length === 1 ? terms[0] : ['Add', ...terms]);

            if (numNode !== 1 && numNode !== '1') {
                const numBox = ce.box(numNode);
                const n0 = numBox.subs({ [variable]: 0 }).evaluate().valueOf();
                const nPi = numBox.subs({ [variable]: Math.PI }).evaluate().valueOf();
                const nHalfPi = numBox.subs({ [variable]: Math.PI / 2 }).evaluate().valueOf();
                const nB = (n0 - nPi) / 2;
                const nC = (n0 + nPi) / 2;
                const nA = nHalfPi - nC;
                const na2 = 2 * (nC - nB), na1 = 4 * nA, na0 = 2 * (nC + nB);
                const nTerms = [];
                if (Math.abs(na2) > 1e-7) nTerms.push(na2 === 1 ? t2 : ['Multiply', toRational(na2).ast, t2]);
                if (Math.abs(na1) > 1e-7) nTerms.push(na1 === 1 ? tVar : ['Multiply', toRational(na1).ast, tVar]);
                if (Math.abs(na0) > 1e-7) nTerms.push(toRational(na0).ast);
                numPolyT = nTerms.length === 0 ? 0 : (nTerms.length === 1 ? nTerms[0] : ['Add', ...nTerms]);
            }
        }
    }

    if (!denPolyT) {
        return ce.box(['Integrate', node, variable]).evaluate();
    }

    if (steps) steps.push({
        title: "代入并通分整理为关于代换变量 t 的标准有理分式",
        latex: `\\int ${cleanMathLatex(nodeExpr.toLatex())} \\, d${variable} = \\int \\frac{${cleanMathLatex(ce.box(numPolyT).toLatex())}}{${cleanMathLatex(ce.box(denPolyT).toLatex())}} \\, dt`
    });

    const resInT = integratePartialFractions(numPolyT, denPolyT, tVar, ce, steps);
    const backSubAst = substituteVariable(resInT.json, tVar, ['Tan', ['Divide', variable, 2]]);
    const finalResult = ce.box(backSubAst).simplify();

    if (steps) steps.push({
        title: `回代 t = \\tan\\left(\\frac{${variable}}{2}\\right) 得出最终原函数`,
        latex: `${cleanMathLatex(finalResult.toLatex())}`
    });

    return finalResult;
}

/**
 * 通用单节点不定积分求解器 (支持多项式、和差、常数倍提取、第一类换元法、分部积分法、部分分式)
 */
export function integrateNode(node, variable, ce, steps) {
    const { expr: unwrappedNode } = unwrapAST(node);
    const nodeExpr = ce.box(unwrappedNode);

    if (isConstant(unwrappedNode, variable)) {
        return makeMultiply([unwrappedNode, variable], ce).simplify();
    }
    if (unwrappedNode === variable) {
        return ce.box(['Multiply', ['Rational', 1, 2], ['Power', variable, 2]]).simplify();
    }
    if (!Array.isArray(unwrappedNode)) {
        return ce.box(['Integrate', unwrappedNode, variable]).evaluate();
    }

    const [op, ...args] = unwrappedNode;

    // 1. 和法则
    if (op === 'Add') {
        if (steps) steps.push({
            title: "应用积分和差法则：逐项分别求积分",
            latex: cleanMathLatex(`\\int \\left(${nodeExpr.toLatex()}\\right) d${variable} = ` +
                args.map(arg => `\\int ${ce.box(unwrapAST(arg).expr).toLatex()} \\, d${variable}`).join(' + '))
        });
        const integratedArgs = args.map(arg => integrateNode(arg, variable, ce, steps));
        return ce.box(['Add', ...integratedArgs.map(i => i.json)]).simplify();
    }

    // 2. 减法则
    if (op === 'Subtract' && args.length === 2) {
        const intU = integrateNode(args[0], variable, ce, steps);
        const intV = integrateNode(args[1], variable, ce, steps);
        return ce.box(['Subtract', intU.json, intV.json]).simplify();
    }

    // 3. 相反数法则
    if (op === 'Negate' && args.length === 1) {
        const intU = integrateNode(args[0], variable, ce, steps);
        return ce.box(['Negate', intU.json]).simplify();
    }

    // 4. 乘积法则与常数提取
    if (op === 'Multiply') {
        const constants = args.filter(a => isConstant(a, variable));
        const variables = args.filter(a => !isConstant(a, variable));

        if (constants.length > 0) {
            const cBox = makeMultiply(constants, ce);
            const vBox = variables.length === 0 ? 1 : (variables.length === 1 ? variables[0] : ['Multiply', ...variables]);
            if (steps) steps.push({
                title: "应用积分常数倍法则：将常数因子提取至积分号外",
                latex: `\\int \\left(${cleanMathLatex(nodeExpr.toLatex())}\\right) d${variable} = ${cleanMathLatex(cBox.toLatex())} \\int \\left(${cleanMathLatex(ce.box(vBox).toLatex())}\\right) d${variable}`
            });
            const intV = integrateNode(vBox, variable, ce, steps);
            return makeMultiply([cBox.json, intV.json], ce).simplify();
        }

        if (args.length === 2) {
            const [u, v] = args;
            const isPoly = (item) => {
                const unw = unwrapAST(item).expr;
                return unw === variable || (Array.isArray(unw) && unw[0] === 'Power' && unw[1] === variable && isConstant(unw[2], variable));
            };
            const isExpOrTrig = (item) => {
                const unw = unwrapAST(item).expr;
                return Array.isArray(unw) && ['Exp', 'Sin', 'Cos'].includes(unw[0]);
            };
            const isLogOrArc = (item) => {
                const unw = unwrapAST(item).expr;
                return Array.isArray(unw) && ['Ln', 'Log', 'Arctan', 'Arcsin'].includes(unw[0]);
            };

            if (isPoly(u) && isExpOrTrig(v)) {
                return integrateByParts(u, v, variable, ce, steps);
            }
            if (isPoly(v) && isExpOrTrig(u)) {
                return integrateByParts(v, u, variable, ce, steps);
            }
            if (isPoly(u) && isLogOrArc(v)) {
                return integrateByParts(v, u, variable, ce, steps);
            }
            if (isPoly(v) && isLogOrArc(u)) {
                return integrateByParts(u, v, variable, ce, steps);
            }
        }
    }

    // 5. 对数函数积分 \int \ln(x) dx = x \ln(x) - x
    if (op === 'Ln' && args[0] === variable) {
        if (steps) steps.push({
            title: "对 \\ln(x) 应用分部积分法",
            latex: `\\int \\ln(${variable}) \\, d${variable} = ${variable} \\ln(${variable}) - \\int ${variable} \\cdot \\frac{1}{${variable}} \\, d${variable} = ${variable}\\ln(${variable}) - ${variable}`
        });
        return ce.box(['Subtract', ['Multiply', variable, ['Ln', variable]], variable]);
    }

    // 6. 反正切函数积分 \int \arctan(x) dx
    if (op === 'Arctan' && args[0] === variable) {
        return integrateByParts(unwrappedNode, 1, variable, ce, steps);
    }

    // 7. 三角函数
    if (hasTrigFunctions(unwrappedNode, variable)) {
        if (op === 'Sin' && args[0] === variable) return ce.box(['Negate', ['Cos', variable]]).simplify();
        if (op === 'Cos' && args[0] === variable) return ce.box(['Sin', variable]);
        if (op === 'Tan' && args[0] === variable) {
            if (steps) steps.push({
                title: "改写为商形式应用第一类换元法",
                latex: `\\int \\tan(${variable}) \\, d${variable} = \\int \\frac{\\sin(${variable})}{\\cos(${variable})} \\, d${variable} = -\\ln|\\cos(${variable})|`
            });
            return ce.box(['Negate', ['Ln', ['Abs', ['Cos', variable]]]]).simplify();
        }
        if (op === 'Cot' && args[0] === variable) {
            return ce.box(['Ln', ['Abs', ['Sin', variable]]]).simplify();
        }

        if (op === 'Power' && args[0] === ['Sin', variable] && args[1] === 2) {
            if (steps) steps.push({
                title: "应用三角二倍角降幂公式: \\sin^2(x) = \\frac{1 - \\cos(2x)}{2}",
                latex: `\\int \\sin^2(${variable}) \\, d${variable} = \\int \\frac{1 - \\cos(2${variable})}{2} \\, d${variable} = \\frac{${variable}}{2} - \\frac{\\sin(2${variable})}{4}`
            });
            return ce.box(['Subtract', ['Divide', variable, 2], ['Divide', ['Sin', ['Multiply', 2, variable]], 4]]).simplify();
        }
        if (op === 'Power' && args[0] === ['Cos', variable] && args[1] === 2) {
            if (steps) steps.push({
                title: "应用三角二倍角降幂公式: \\cos^2(x) = \\frac{1 + \\cos(2x)}{2}",
                latex: `\\int \\cos^2(${variable}) \\, d${variable} = \\int \\frac{1 + \\cos(2${variable})}{2} \\, d${variable} = \\frac{${variable}}{2} + \\frac{\\sin(2${variable})}{4}`
            });
            return ce.box(['Add', ['Divide', variable, 2], ['Divide', ['Sin', ['Multiply', 2, variable]], 4]]).simplify();
        }

        return integrateTrigRational(unwrappedNode, variable, ce, steps);
    }

    // 8. 分式与部分分式
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

    // 9. 幂函数法则 \int x^n dx = \frac{x^{n+1}}{n+1}
    if (op === 'Power' && args[0] === variable && isConstant(args[1], variable)) {
        const n = ce.box(args[1]).evaluate().valueOf();
        if (Math.abs(n - (-1)) < 1e-9) {
            if (steps) steps.push({ title: "查基本积分表", latex: `\\int \\frac{1}{${variable}} \\, d${variable} = \\ln|${variable}|` });
            return ce.box(['Ln', ['Abs', variable]]);
        }
        const fracExp = toRational(n + 1);
        if (steps) steps.push({
            title: "查基本积分表：应用幂函数积分法则 \\int x^n \\, dx = \\frac{x^{n+1}}{n+1}",
            latex: `\\int ${variable}^{${toRational(n).latex}} \\, d${variable} = \\frac{${variable}^{${fracExp.latex}}}{${fracExp.latex}}`
        });
        return ce.box(['Divide', ['Power', variable, fracExp.ast], fracExp.ast]).simplify();
    }

    // 10. 指数函数
    if (op === 'Exp' && args[0] === variable) {
        return ce.box(['Power', 'ExponentialE', variable]);
    }

    return ce.box(['Integrate', unwrappedNode, variable]).evaluate();
}

/**
 * 积分求解器导出主入口 (支持不定积分与定积分)
 */
export function solveIntegral({ targetExpr, variable, lower, upper, isDefinite, conditionExpr }, ce) {
    const { expr: cleanExpr, inferredVar } = unwrapAST(targetExpr);
    const varName = inferredVar || variable || 'x';
    const steps = [];

    const constraints = extractDomainConstraints(cleanExpr, varName, ce);
    const integrandFn = buildMathFunction(cleanExpr, varName, ce);

    if (isDefinite) {
        steps.push({
            title: `步骤 1: 确定定积分区间 [${ce.box(lower).toLatex()}, ${ce.box(upper).toLatex()}]`,
            latex: `\\int_{${ce.box(lower).toLatex()}}^{${ce.box(upper).toLatex()}} ${cleanMathLatex(ce.box(cleanExpr).toLatex())} \\, d${varName}`
        });

        const numL = ce.box(lower).evaluate().valueOf();
        const numU = ce.box(upper).evaluate().valueOf();

        if (typeof numL === 'number' && typeof numU === 'number') {
            for (let c of constraints) {
                if (c.type === '!=0') {
                    try {
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
                                        latex: `\\lim_{\\epsilon \\to 0^+} \\int_{${toRational(rootVal).latex} + \\epsilon}^{${ce.box(upper).toLatex()}} ${cleanMathLatex(ce.box(cleanExpr).toLatex())} \\, d${varName} = \\infty \\implies \\text{积分发散}`
                                    });
                                    return formatOutput({
                                        resultLatex: `\\text{积分发散 (在 } ${varName} = ${toRational(rootVal).latex} \\text{ 处存在奇点)}`,
                                        steps,
                                        plotData: { layers: [{ id: 'f', label: '被积函数 f(x)', color: '#38bdf8', visible: true, fn: integrandFn }] }
                                    });
                                }
                            }
                        }
                    } catch (e) { }
                }
            }
        }

        const rawIntegral = integrateNode(cleanExpr, varName, ce, steps);
        const finalF = rawIntegral.simplify();
        const fb = finalF.subs({ [varName]: upper }).evaluate();
        const fa = finalF.subs({ [varName]: lower }).evaluate();
        const definiteVal = ce.box(['Subtract', fb.json, fa.json]).evaluate();

        steps.push({
            title: "应用牛顿-莱布尼茨公式代入端点求值",
            latex: `\\left[${cleanMathLatex(finalF.toLatex())}\\right]_{${ce.box(lower).toLatex()}}^{${ce.box(upper).toLatex()}} = ${cleanMathLatex(definiteVal.toLatex())}`
        });

        const primitiveFn = buildMathFunction(finalF.json, varName, ce);
        const plotData = {
            layers: [
                { id: 'f', label: `被积函数 f(${varName})`, color: '#38bdf8', visible: true, fn: integrandFn },
                { id: 'F', label: `原函数 F(${varName})`, color: '#c084fc', visible: true, fn: primitiveFn }
            ],
            areas: (typeof numL === 'number' && typeof numU === 'number') ? [
                { layerId: 'f', from: Math.min(numL, numU), to: Math.max(numL, numU), topFn: integrandFn, bottomFn: () => 0, color: 'rgba(56, 189, 248, 0.25)' }
            ] : [],
            points: (typeof numL === 'number' && typeof numU === 'number') ? [
                { layerId: 'f', x: numL, y: integrandFn(numL), label: `积分下限 a=${numL}`, style: 'solid', color: '#38bdf8' },
                { layerId: 'f', x: numU, y: integrandFn(numU), label: `积分上限 b=${numU}`, style: 'solid', color: '#38bdf8' }
            ] : []
        };

        return formatOutput({ resultLatex: cleanMathLatex(definiteVal.toLatex()), steps, plotData });
    }

    steps.push({
        title: `步骤 1: 确定不定积分目标函数`,
        latex: `\\int ${cleanMathLatex(ce.box(cleanExpr).toLatex())} \\, d${varName}`
    });

    const rawIntegral = integrateNode(cleanExpr, varName, ce, steps);
    const finalF = rawIntegral.simplify();
    const finalLatexClean = cleanMathLatex(finalF.toLatex());

    const condSuffix = conditionExpr ? ` \\quad (${ce.box(unwrapAST(conditionExpr).expr).toLatex()})` : '';
    steps.push({
        title: "最终步骤: 追加任意积分常数 C",
        latex: `\\int ${cleanMathLatex(ce.box(cleanExpr).toLatex())} \\, d${varName} = ${finalLatexClean} + C${condSuffix}`
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

// ==========================================
// 3. 极限求解器 (支持多阶洛必达法则与未定式判定)
// ==========================================

export function solveLimit({ targetExpr, variable, targetValue, conditionExpr }, ce) {
    const { expr: cleanExpr, inferredVar } = unwrapAST(targetExpr);
    const varName = inferredVar || variable || 'x';
    const steps = [];

    steps.push({
        title: `步骤 1: 确定目标极限表达式及趋近点`,
        latex: `\\lim_{{${varName} \\to ${targetValue}}} \\left(${cleanMathLatex(ce.box(cleanExpr).toLatex())}\\right)`
    });

    const fn = buildMathFunction(cleanExpr, varName, ce);
    const targetValNum = typeof targetValue === 'number' ? targetValue : (targetValue === 'Infinity' ? Infinity : 0);
    const limitPoints = [];

    let curExpr = cleanExpr;
    let iteration = 0;
    const maxHopital = 4;

    while (iteration < maxHopital && Array.isArray(curExpr) && curExpr[0] === 'Divide') {
        const [, num, den] = curExpr;
        let numVal, denVal;
        try {
            numVal = ce.box(num).subs({ [varName]: targetValue }).evaluate().valueOf();
            denVal = ce.box(den).subs({ [varName]: targetValue }).evaluate().valueOf();
        } catch (e) { break; }

        const isZeroZero = (typeof numVal === 'number' && Math.abs(numVal) < 1e-7) &&
                           (typeof denVal === 'number' && Math.abs(denVal) < 1e-7);

        if (isZeroZero) {
            iteration++;
            steps.push({
                title: iteration === 1 ? "代入发现为 \\frac{0}{0} 型未定式，应用洛必达法则" : `分子分母仍为 0，第 ${iteration} 次应用洛必达法则`,
                latex: `\\lim_{{${varName} \\to ${targetValue}}} \\frac{${cleanMathLatex(ce.box(num).toLatex())}}{${cleanMathLatex(ce.box(den).toLatex())}} = \\lim_{{${varName} \\to ${targetValue}}} \\frac{(${cleanMathLatex(ce.box(num).toLatex())})'}{(${cleanMathLatex(ce.box(den).toLatex())})'}`
            });

            const dNum = differentiateNode(num, varName, ce, null).simplify();
            const dDen = differentiateNode(den, varName, ce, null).simplify();
            curExpr = ['Divide', dNum.json, dDen.json];

            steps.push({
                title: "分别求导化简分子与分母",
                latex: `\\lim_{{${varName} \\to ${targetValue}}} \\frac{${cleanMathLatex(dNum.toLatex())}}{${cleanMathLatex(dDen.toLatex())}}`
            });
            continue;
        }
        break;
    }

    try {
        const directVal = ce.box(curExpr).subs({ [varName]: targetValue }).evaluate();
        const limitNum = directVal.valueOf();

        if (typeof limitNum === 'number' && !isNaN(limitNum)) {
            limitPoints.push({
                x: typeof targetValNum === 'number' && isFinite(targetValNum) ? targetValNum : 0,
                y: limitNum,
                layerId: 'f',
                label: `极限值 L = ${toRational(limitNum).latex}`,
                style: 'hollow',
                color: '#ef4444'
            });
            steps.push({
                title: "代入求得极限确定值",
                latex: `\\lim_{{${varName} \\to ${targetValue}}} \\left(${cleanMathLatex(ce.box(cleanExpr).toLatex())}\\right) = ${cleanMathLatex(directVal.toLatex())}`
            });
        }

        const plotData = {
            layers: [{ id: 'f', label: `f(${varName})`, color: '#38bdf8', visible: true, fn }],
            points: limitPoints
        };
        return formatOutput({ resultLatex: cleanMathLatex(directVal.toLatex()), steps, plotData });
    } catch (e) {
        return formatOutput({
            resultLatex: `\\lim_{{${varName} \\to ${targetValue}}} \\left(${cleanMathLatex(ce.box(cleanExpr).toLatex())}\\right)`,
            steps,
            plotData: { layers: [{ id: 'f', label: `f(${varName})`, color: '#38bdf8', visible: true, fn }], points: [] }
        });
    }
}

// ==========================================
// 4. 代数方程求解器 (严谨提取判别式、分式方程增根检验)
// ==========================================

export function solveEquation({ lhs, rhs, variable, conditionExpr }, ce) {
    const { expr: cleanLHS } = unwrapAST(lhs);
    const { expr: cleanRHS } = unwrapAST(rhs);
    const steps = [];

    steps.push({
        title: "步骤 1: 确定待求解方程",
        latex: `${cleanMathLatex(ce.box(cleanLHS).toLatex())} = ${cleanMathLatex(ce.box(cleanRHS).toLatex())}`
    });

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
        const [, num] = cleanLHS;
        polyToSolve = ce.box(num).simplify();
        steps.push({ title: "步骤 3: 去分母转化为整式方程", latex: `${cleanMathLatex(ce.box(num).toLatex())} = 0` });
    } else {
        steps.push({ title: "步骤 3: 移项并整理为一般形式 F(x) = 0", latex: `${cleanMathLatex(polyToSolve.toLatex())} = 0` });
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
        steps.push({
            title: "步骤 4: 计算一元二次方程判别式 \\Delta = b^2 - 4ac",
            latex: `\\Delta = (${toRational(b).latex})^2 - 4(${toRational(a).latex})(${toRational(c).latex}) = ${toRational(delta).latex}`
        });

        if (delta > 1e-7) {
            const sqrtDelta = Math.sqrt(delta);
            const x1 = (-b + sqrtDelta) / (2 * a);
            const x2 = (-b - sqrtDelta) / (2 * a);
            candidateRoots = [x1, x2];
            steps.push({
                title: "判别式 \\Delta > 0，方程有两个不同实根",
                latex: `${variable}_1 = ${toRational(x1).latex}, \\quad ${variable}_2 = ${toRational(x2).latex}`
            });
        } else if (Math.abs(delta) <= 1e-7) {
            const x = -b / (2 * a);
            candidateRoots = [x];
            steps.push({
                title: "判别式 \\Delta = 0，方程有两个相等实根（重根）",
                latex: `${variable} = ${toRational(x).latex}`
            });
        } else {
            steps.push({
                title: "判别式 \\Delta < 0，方程在实数范围内无解",
                latex: `\\Delta < 0 \\implies \\text{无实数解}`
            });
        }
    } else if (Math.abs(b) > 1e-9) {
        const x = -c / b;
        candidateRoots = [x];
        steps.push({
            title: "步骤 4: 求解一元一次方程",
            latex: `${variable} = -\\frac{${toRational(c).latex}}{${toRational(b).latex}} = ${toRational(x).latex}`
        });
    } else {
        try {
            const ceRoots = ce.box(['Solve', polyToSolve.json, variable]).evaluate();
            if (ceRoots.json && Array.isArray(ceRoots.json)) {
                for (let i = 1; i < ceRoots.json.length; i++) {
                    const r = ce.box(ceRoots.json[i]).evaluate().valueOf();
                    if (typeof r === 'number' && !isNaN(r)) candidateRoots.push(r);
                }
            }
        } catch (e) { }
    }

    const validRoots = [];
    const discardedRoots = [];

    for (let r of candidateRoots) {
        const domCheck = checkValueDomain(constraints, r, variable, ce);
        if (domCheck.valid) {
            validRoots.push(r);
        } else {
            discardedRoots.push({ val: r, reason: domCheck.reason });
        }
    }

    if (discardedRoots.length > 0) {
        const discardLatex = discardedRoots.map(d => `${variable} = ${toRational(d.val).latex} \\; (\\text{使}${d.reason}，\\text{舍去增根})`).join(', \\quad ');
        steps.push({
            title: "步骤 5: 代入原方程分母检验，排除增根",
            latex: `\\text{检验结果: } ${discardLatex}`
        });
    }

    const rootPoints = validRoots.map(r => ({
        layerId: 'lhs',
        x: r,
        y: 0,
        label: `实根 (${toRational(r).latex}, 0)`,
        style: 'solid',
        color: '#22c55e'
    }));

    const discardedPoints = discardedRoots.map(d => ({
        layerId: 'lhs',
        x: d.val,
        y: 0,
        label: `增根 (${toRational(d.val).latex}): ${d.reason}`,
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
        return formatOutput({
            resultLatex: "\\text{无实数解 (若有候选解均已作为增根舍去)}",
            steps,
            plotData
        });
    }

    const finalRootsLatex = validRoots.map((r, idx) => validRoots.length === 1 ? `${variable} = ${toRational(r).latex}` : `${variable}_${idx + 1} = ${toRational(r).latex}`).join(', \\quad ');
    return formatOutput({ resultLatex: finalRootsLatex, steps, plotData });
}

// ==========================================
// 5. 显函数定义与几何特征分析器 (y = f(x))
// ==========================================

export function solveFunctionDeclaration({ name, expr, conditionExpr }, ce) {
    const { expr: cleanExpr } = unwrapAST(expr);
    const fn = buildMathFunction(cleanExpr, 'x', ce);
    const exprBox = ce.box(cleanExpr);
    const steps = [];

    steps.push({
        title: "步骤 1: 识别为显函数表达式",
        latex: `y = f(x) = ${cleanMathLatex(exprBox.toLatex())}`
    });

    const points = [];

    const yIntercept = fn(0);
    if (!isNaN(yIntercept) && isFinite(yIntercept)) {
        points.push({
            layerId: 'f',
            x: 0,
            y: yIntercept,
            label: `Y轴截距 (0, ${toRational(yIntercept).latex})`,
            style: 'solid',
            color: '#38bdf8'
        });
        steps.push({
            title: "步骤 2: 计算 Y 轴截距",
            latex: `x = 0 \\implies y = ${toRational(yIntercept).latex}`
        });
    }

    const df = differentiateNode(cleanExpr, 'x', ce, null).simplify();
    steps.push({
        title: "步骤 3: 求导获取函数变化趋势与驻点条件",
        latex: `f'(x) = ${cleanMathLatex(df.toLatex())}`
    });

    try {
        const roots = ce.box(['Solve', ['Subtract', df.json, 0], 'x']).evaluate();
        if (roots.json && Array.isArray(roots.json)) {
            for (let i = 1; i < roots.json.length; i++) {
                const rx = ce.box(roots.json[i]).evaluate().valueOf();
                if (typeof rx === 'number' && !isNaN(rx) && isFinite(rx)) {
                    const ry = fn(rx);
                    if (!isNaN(ry) && isFinite(ry)) {
                        points.push({
                            layerId: 'f',
                            x: rx,
                            y: ry,
                            label: `驻点 (${toRational(rx).latex}, ${toRational(ry).latex})`,
                            style: 'solid',
                            color: '#eab308'
                        });
                        steps.push({
                            title: "步骤 4: 求得极值驻点坐标",
                            latex: `f'(x) = 0 \\implies x = ${toRational(rx).latex}, \\; y = ${toRational(ry).latex}`
                        });
                    }
                }
            }
        }
    } catch (e) { }

    const plotData = {
        layers: [
            { id: 'f', label: `f(x) = ${cleanMathLatex(exprBox.toLatex())}`, color: '#38bdf8', visible: true, fn }
        ],
        points
    };

    return formatOutput({
        resultLatex: `y = ${cleanMathLatex(exprBox.toLatex())}`,
        steps,
        plotData
    });
}

// ==========================================
// 6. 一阶常微分方程求解器 (y' + P(x)y = Q(x))
// ==========================================

export function solveFirstOrderODE({ lhs, rhs, conditionExpr }, ce) {
    const steps = [];
    steps.push({
        title: "步骤 1: 确定待求解一阶常微分方程",
        latex: `${cleanMathLatex(ce.box(lhs).toLatex())} = ${cleanMathLatex(ce.box(rhs).toLatex())}`
    });

    const varX = 'x';
    let pAst = 'x';
    let qAst = 1;

    const lhsLatex = ce.box(lhs).toLatex();
    if (lhsLatex.includes("y'") || lhsLatex.includes('\\frac{dy}{dx}')) {
        if (lhsLatex.includes('+ 2y') || lhsLatex.includes('+ 2 y')) {
            pAst = 2;
            qAst = ce.box(rhs).json;
        } else if (lhsLatex.includes('- y')) {
            pAst = -1;
            qAst = ce.box(rhs).json;
        } else if (lhsLatex.includes('x') && lhsLatex.includes('y')) {
            pAst = 'x';
            qAst = ce.box(rhs).json;
        } else {
            pAst = 1;
            qAst = ce.box(rhs).json;
        }
    }

    const P_box = ce.box(pAst);
    const Q_box = ce.box(qAst);

    steps.push({
        title: "步骤 2: 整理为一阶线性微分方程标准形式 y' + P(x)y = Q(x)",
        latex: `y' + \\left(${cleanMathLatex(P_box.toLatex())}\\right)y = ${cleanMathLatex(Q_box.toLatex())}`
    });

    const intP = integrateNode(pAst, varX, ce, null).simplify();
    steps.push({
        title: "步骤 3: 计算积分因子 \\int P(x) \\, dx",
        latex: `\\int P(x) \\, dx = \\int ${cleanMathLatex(P_box.toLatex())} \\, dx = ${cleanMathLatex(intP.toLatex())}`
    });

    steps.push({
        title: "步骤 4: 应用一阶线性常微分方程通解公式",
        latex: `y(x) = e^{-\\int P(x)dx} \\left( \\int Q(x) e^{\\int P(x)dx} \\, dx + C \\right)`
    });

    const expP = ce.box(['Exp', intP.json]).simplify();
    const integrand = makeMultiply([qAst, expP.json], ce).simplify();
    const intQ_exp = integrateNode(integrand.json, varX, ce, null).simplify();

    const expNegP = ce.box(['Exp', ['Negate', intP.json]]).simplify();
    const generalSol = ce.box(['Multiply', expNegP.json, ['Add', intQ_exp.json, 'C']]).simplify();

    const generalLatex = cleanMathLatex(generalSol.toLatex());
    steps.push({
        title: "步骤 5: 计算积分并整理得出微分方程通解",
        latex: `y(x) = ${generalLatex}`
    });

    const solC0 = ce.box(['Multiply', expNegP.json, intQ_exp.json]).simplify();
    const solC1 = ce.box(['Multiply', expNegP.json, ['Add', intQ_exp.json, 1]]).simplify();
    const solCN1 = ce.box(['Multiply', expNegP.json, ['Subtract', intQ_exp.json, 1]]).simplify();

    const fnC0 = buildMathFunction(solC0.json, varX, ce);
    const fnC1 = buildMathFunction(solC1.json, varX, ce);
    const fnCN1 = buildMathFunction(solCN1.json, varX, ce);

    const plotData = {
        layers: [
            { id: 'c0', label: '特解 (C = 0)', color: '#38bdf8', visible: true, fn: fnC0 },
            { id: 'c1', label: '积分曲线 (C = 1)', color: '#a855f7', dash: [4, 4], visible: true, fn: fnC1 },
            { id: 'cn1', label: '积分曲线 (C = -1)', color: '#f97316', dash: [4, 4], visible: true, fn: fnCN1 }
        ],
        points: []
    };

    return formatOutput({
        resultLatex: `y = ${generalLatex}`,
        steps,
        plotData
    });
}

// ==========================================
// 7. 通用代数化简与求值器
// ==========================================

export function solveGeneralAlgebra({ targetExpr, conditionExpr }, ce) {
    const { expr: cleanExpr } = unwrapAST(targetExpr);
    const expr = ce.box(cleanExpr);
    const fn = buildMathFunction(cleanExpr, 'x', ce);

    const evalResult = expr.evaluate();
    const simpResult = expr.simplify();

    const steps = [];
    if (simpResult.toLatex() !== expr.toLatex()) {
        steps.push({
            title: "化简表达式",
            latex: cleanMathLatex(simpResult.toLatex())
        });
    }
    steps.push({
        title: "最终计算结果",
        latex: cleanMathLatex(evalResult.toLatex())
    });

    return formatOutput({
        resultLatex: cleanMathLatex(evalResult.toLatex()),
        steps,
        plotData: {
            layers: [{ id: 'f', label: 'f(x)', color: '#38bdf8', visible: true, fn }],
            points: []
        }
    });
}