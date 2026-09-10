// router.js —— 算子路由与参数分发中枢
import {
    solveDerivative,
    solveIntegral,
    solveLimit,
    solveEquation,
    solveFunctionDeclaration,
    solveGeneralAlgebra,
    solveFirstOrderODE,
    cleanMathLatex
} from './solvers.js';

function isNothing(val) {
    return val === undefined || val === null || val === 'Nothing' || val === '' ||
        (typeof val === 'object' && val?.name === 'Nothing');
}

// 递归检测 AST 是否包含导数记号 (y', f'(x), dy/dx 等)
function hasDifferentialTerms(node) {
    if (!node) return false;
    if (typeof node === 'string') {
        return node === "y'" || node === 'dy' || node.includes('Prime') || node.includes('Derivative');
    }
    if (Array.isArray(node)) {
        const [op, ...args] = node;
        if (op === 'Prime' || op === 'Derivative' || op === 'D') return true;
        if (Array.isArray(op) && (op[0] === 'Prime' || op[0] === 'Derivative')) return true;
        if (op === 'Divide' && args[0] === 'dy' && args[1] === 'dx') return true;
        return hasDifferentialTerms(op) || args.some(hasDifferentialTerms);
    }
    return false;
}

// 安全提取方程中的主未知数
function getEquationVariable(targetAst, ce) {
    try {
        const boxed = ce.box(targetAst);
        const vars = boxed.unknowns || boxed.freeVariables || [];
        if (Array.isArray(vars) && vars.length > 0) return String(vars[0]);
    } catch (e) { }
    return 'x';
}

export function routeCalculation(ast, ce) {
    if (!ast) return { resultLatex: "", steps: [] };

    try {
        let targetAst = ast;
        let conditionExpr = null;

        if (Array.isArray(ast) && (ast[0] === 'Tuple' || ast[0] === 'Sequence' || ast[0] === 'List')) {
            targetAst = ast[1];
            conditionExpr = ast[2] || null;
        }

        if (!Array.isArray(targetAst)) {
            return solveGeneralAlgebra({ targetExpr: targetAst, conditionExpr }, ce);
        }

        const [operator, ...operands] = targetAst;

        switch (operator) {
            case 'D':
            case 'Derivative': {
                const targetExpr = operands[0];
                const variable = typeof operands[1] === 'string' ? operands[1] : 'x';
                const order = typeof operands[2] === 'number' ? operands[2] : 1;
                return solveDerivative({ targetExpr, variable, order, conditionExpr }, ce);
            }

            case 'Integrate': {
                const targetExpr = operands[0];
                let variable = 'x';
                let lower = null;
                let upper = null;
                let isDefinite = false;

                const boundNode = operands[1];
                if (typeof boundNode === 'string') {
                    variable = boundNode;
                    if (operands.length >= 4 && !isNothing(operands[2]) && !isNothing(operands[3])) {
                        isDefinite = true;
                        lower = operands[2];
                        upper = operands[3];
                    }
                } else if (Array.isArray(boundNode) && (boundNode[0] === 'Limits' || boundNode[0] === 'Tuple')) {
                    variable = boundNode[1] || 'x';
                    const l = boundNode[2];
                    const u = boundNode[3];

                    if (!isNothing(l) && !isNothing(u)) {
                        isDefinite = true;
                        lower = l;
                        upper = u;
                    }
                } else if (operands.length >= 3 && !isNothing(operands[1]) && !isNothing(operands[2])) {
                    isDefinite = true;
                    lower = operands[1];
                    upper = operands[2];
                }

                return solveIntegral({ targetExpr, variable, lower, upper, isDefinite, conditionExpr }, ce);
            }

            case 'Limit': {
                const targetExpr = operands[0];
                const conditionNode = operands[1];
                let variable = 'x';
                let targetValue = 0;

                if (Array.isArray(conditionNode) && conditionNode[0] === 'Equal') {
                    variable = conditionNode[1] || 'x';
                    targetValue = conditionNode[2] !== undefined ? conditionNode[2] : 0;
                } else if (conditionNode !== undefined) {
                    targetValue = conditionNode;
                    if (typeof operands[2] === 'string') variable = operands[2];
                }

                return solveLimit({ targetExpr, variable, targetValue, conditionExpr }, ce);
            }

            case 'Equal': {
                const [lhs, rhs] = operands;

                // 分支 1：常微分方程 (含 y', f'(x), dy/dx)
                if (hasDifferentialTerms(lhs) || hasDifferentialTerms(rhs)) {
                    return solveFirstOrderODE({ lhs, rhs, conditionExpr }, ce);
                }

                // 分支 2：显函数定义 (如 y = x + 1, f(x) = x^2)
                const isFuncLHS = lhs === 'y' ||
                    (Array.isArray(lhs) && (lhs[0] === 'f' || lhs[0] === 'g' || lhs[0] === 'Apply' || lhs[0] === 'Function'));
                if (isFuncLHS) {
                    return solveFunctionDeclaration({ name: lhs, expr: rhs, conditionExpr }, ce);
                }

                // 分支 3：普通代数方程求解 (安全提取变量)
                const variable = getEquationVariable(targetAst, ce);
                return solveEquation({ lhs, rhs, variable, conditionExpr }, ce);
            }

            default:
                return solveGeneralAlgebra({ targetExpr: targetAst, conditionExpr }, ce);
        }
    } catch (err) {
        console.error("Calculation router error:", err);
        return {
            resultLatex: `\\text{计算出现异常: } ${err.message || '未知错误'}`,
            steps: [
                { title: "推导异常中断", latex: `\\text{错误信息: } ${err.message || '格式无法解析'}` }
            ],
            plotData: null
        };
    }
}