// router.js —— 算子路由与参数分发中枢
import { solveDerivative, solveIntegral, solveLimit, solveEquation, solveGeneralAlgebra } from './solvers.js';

function isNothing(val) {
    return val === undefined || val === null || val === 'Nothing' || val === '' ||
        (typeof val === 'object' && val?.name === 'Nothing');
}

export function routeCalculation(ast, ce) {
    if (!ast) return { resultLatex: "", steps: [] };

    // 1. 自动剥离外层 Tuple / List / Sequence 附加条件 (如 f(x), x > 0)
    let targetAst = ast;
    let conditionExpr = null;

    if (Array.isArray(ast) && (ast[0] === 'Tuple' || ast[0] === 'Sequence' || ast[0] === 'List')) {
        targetAst = ast[1];
        conditionExpr = ast[2] || null;
    }

    if (!Array.isArray(targetAst)) {
        return {
            resultLatex: String(targetAst),
            steps: [{ title: "识别为独立基元", latex: String(targetAst) }]
        };
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
            } else if (Array.isArray(boundNode) && (boundNode[0] === 'Limits' || boundNode[0] === 'Tuple')) {
                variable = boundNode[1] || 'x';
                const l = boundNode[2];
                const u = boundNode[3];

                if (!isNothing(l) && !isNothing(u)) {
                    isDefinite = true;
                    lower = l;
                    upper = u;
                }
            }
            return solveIntegral({ targetExpr, variable, lower, upper, isDefinite, conditionExpr }, ce);
        }

        case 'Limit': {
            const targetExpr = operands[0];
            const conditionNode = operands[1];
            let variable = 'x';
            let targetValue = 0;

            if (Array.isArray(conditionNode) && conditionNode[0] === 'Equal') {
                variable = conditionNode[1];
                targetValue = conditionNode[2];
            } else if (conditionNode !== undefined) {
                targetValue = conditionNode;
            }

            return solveLimit({ targetExpr, variable, targetValue, conditionExpr }, ce);
        }

        case 'Equal': {
            const [lhs, rhs] = operands;
            const freeVars = ce.box(targetAst).freeVariables;
            const variable = freeVars.length > 0 ? freeVars[0] : 'x';
            return solveEquation({ lhs, rhs, variable, conditionExpr }, ce);
        }

        default:
            return solveGeneralAlgebra({ targetExpr: targetAst, conditionExpr }, ce);
    }
}