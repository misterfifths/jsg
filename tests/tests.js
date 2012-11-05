function exprEquals(expr, expected, message) {
    equal(JSG.Expr.oneshot(expr), expected, message);
}

function vexprEquals(varMap, expr, expected, message) {
    equal(JSG.Expr.oneshot(varMap, expr), expected, message);
}

function eexprEquals(env, expr, expected, message) {
    equal(JSG.Expr.compile(env, expr)(), expected, message);
}

function veexprEquals(env, varVals, expr, expected, message) {
    equal(JSG.Expr.compile(env, expr).apply(null, varVals), expected, message);
}

function exprThrows(expr, expected, message) {
    throws(function() { JSG.Expr.oneshot(expr); }, expected, message);
}

function vexprThrows(varMap, expr, expected, message) {
    throws(function() { JSG.Expr.oneshot(varMap, expr); }, expected, message);
}

function eexprThrows(env, expr, expected, message) {
    throws(function() { JSG.Expr.compile(env, expr)(); }, expected, message);
}

function veexprThrows(env, varVals, expr, expected, message) {
    throws(function() { JSG.Expr.compile(env, expr).apply(null, varVals); }, expected, message);
}

test('miscellaneous syntax checks', function() {
    var checks = {
        '2-': 'operators need two arguments',
        '+2': 'operators need two arguments',
        '2)': 'mismatched parentheses',
        'z': 'unknown identifier',
        'sin 2': 'functions must be followed by parentheses',
        '$': 'unknown operator',
        'e**e': 'invalid input',
        '2()': 'invalid input',
        '2*-': 'invalid input'
    };
    
    for(var expr in checks) {
        if(checks.hasOwnProperty(expr))
            exprThrows(expr, checks[expr]);
    }
});

test('exponent rules', function() {
    exprEquals('2^3^2', 512, 'exponents stack from the top down');
    exprEquals('3*2^2+1', 13, 'exponents are evaluated before multiplication');
    exprEquals('4+2^2+1', 9, 'exponents are evaluated before addition');
    exprEquals('-2^2', -4, 'negation takes effect after exponentiation');
    
    var env = JSG.Expr.Environment([], { powOp: false });
    eexprThrows(env, '2^2', 'exponentiation disabled by Environment setting');
});

test('implicit multiplication', function() {
    exprEquals('2epi', 2 * Math.E * Math.PI, 'implicit multiplication added between numbers and constants');
    exprEquals('4(2)3', 24, 'implicit multiplication added around parentheses');
    vexprEquals({ x: 2, y: 3 }, '2xye', 12 * Math.E, 'implicit multiplication added around variables');
    exprThrows('1.2.2', 'implicit multiplication not added between adjacent numbers');
    
    var env = JSG.Expr.Environment([], { implicitMul: false });
    eexprThrows(env, '2epi', 'implicit multiplication disabled by Environment setting');
});

test('negation', function() {
	exprEquals('-e', -Math.E, 'negation as first character');
	exprEquals('-(e)', -Math.E, 'negation of parenthetical group');
	exprEquals('2*-e', 2 * -Math.E, 'negation after multiplicative operator');
	exprEquals('2+-e', 2 - Math.E, 'negation after additive operator');
	exprEquals('2---e', 2 - Math.E, 'multiple adjacent negations');
	exprEquals('min(1, -e)', -Math.E, 'negation after comma');
	exprEquals('2^-e', Math.pow(2, -Math.E), 'negation after exponent');
	vexprEquals({ x: 2 }, '3*-x', -6, 'negation of variables');
});

test('paren completion', function() {
    exprEquals('mod(6, 4', 2, 'function parens are completed');
    exprEquals('(2(4*2', 16, 'grouping parens are completed');
    exprThrows('rand(1', 'parens are not completed for an invalid number of arguments');
    exprThrows('sin(2,', 'commas are not consumed at the end of an argument list');
    
    var env = JSG.Expr.Environment([], { autoParens: false });
    eexprThrows(env, 'mod(6, 4', 'paren completion disabled by Environment setting');
});

test('nondeterministic functions', function() {
    var counter = 0,
        inc = function() { return counter++; },
        env = JSG.Expr.Environment();
    
    inc.nondeterministic = true;
    env.addFn('inc', inc);
    
    var fn = JSG.Expr.compile(env, 'inc()');
    notEqual(fn(), fn(), 'subsequent calls to a nondeterministic function do not return the same value');
});

test('function arity checks', function() {
    exprThrows('sin(1, 2)', 'More than the fixed number of arguments disallowed');
    exprThrows('sin()', 'Fewer than the fixed number of arguments disallowed');

    var env = JSG.Expr.Environment(),
        sumFn = function(x, y) {
            var sum = x + y;
            for(var i = 2; i < arguments.length; i++)
                sum += arguments[i];
            
            return sum;
		};
		
    sumFn.lengthIsMinimum = true;
    env.addFn('sum', sumFn);
    
    eexprEquals(env, 'sum(1, 2)', 3, 'minimum arguments allowed');
    eexprEquals(env, 'sum(1, 2, 3)', 6, 'more than the minimum number of arguments allowed');
    eexprThrows(env, 'sum(1)', 'fewer than the minimum arguments not allowed');
});