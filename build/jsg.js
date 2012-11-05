var JSG = (function() {
    'use strict';
    
    function applyDefaults(obj, defaults) {
        var res = {};
        for(var key in defaults) {
            if(defaults.hasOwnProperty(key)) {
                if(obj && obj.hasOwnProperty(key))
                    res[key] = obj[key];
                else
                    res[key] = defaults[key];
            }
        }
        
        return res;
    }
        

/** environment.js **/

var NativeOp = function(name, length) {
    if(!(this instanceof NativeOp))
        return new NativeOp(name, length);

    this.name = name;
    this.length = length;
    this.lengthIsMinimum = false;
    this.nondeterministic = false;
};

var NativeFn = function(name, length, options) {
    if(!(this instanceof NativeFn))
        return new NativeFn(name, length, options);
    
    options = applyDefaults(options, { lengthIsMinimum: false, nondeterministic: false });
    
    this.name = name;
    this.length = length;
    this.lengthIsMinimum = options.lengthIsMinimum;
    this.nondeterministic = options.nondeterministic;
};

NativeOp.prototype.toString = NativeFn.prototype.toString = function() {
    return this.name;
};

var Environment = (function() {
    var Environment = function(vars, options) {
        if(!(this instanceof Environment))
            return new Environment(vars, options);
    
        this.options = applyDefaults(options, { autoParens: true, implicitMul: true, powOp: true });
    
        this.fns = clone(defFns);
        this.consts = clone(defConsts);
        this.addOps = clone(defAddOps);
        this.mulOps = clone(defMulOps);
        
        // important things for the parser & lexer
        this._implicitMulOpId = '*';
        this._subtractOpId = '-';
        this._negate = NativeOp('-', 1);
        this._pow = NativeFn('Math.pow', 2);
        this._powOpId = '^';
        
        this.vars = [];
        if(vars)
            this.setVars(vars);
    };

    var defFns,
        defConsts,
        defAddOps,
        defMulOps;
    
    defFns = {
        // trig
        sin: NativeFn('Math.sin', 1),
        cos: NativeFn('Math.cos', 1),
        tan: NativeFn('Math.tan', 1),
        asin: NativeFn('Math.asin', 1),
        arcsin: NativeFn('Math.asin', 1),
        acos: NativeFn('Math.acos', 1),
        arccos: NativeFn('Math.acos', 1),
        atan: NativeFn('Math.atan', 1),
        arctan: NativeFn('Math.atan', 1),
        atan2: NativeFn('Math.atan2', 2),
        arctan2: NativeFn('Math.atan2', 2),
        
        // exponentiation, etc.
        exp: NativeFn('Math.exp', 1),
        sqrt: NativeFn('Math.sqrt', 1),
        pow: NativeFn('Math.pow', 2),
        log: NativeFn('Math.log', 1),
        ln: NativeFn('Math.log', 1),
        log10: function(x) { return Math.log(x) / Math.LN10; },
        log2: function(x) { return Math.log(x) / Math.LN2; },
        logn: function(n, x) { return Math.log(x) / Math.log(n); },
        
        // miscellaneous
        max: NativeFn('Math.max', 2, { lengthIsMinimum: true }),
        min: NativeFn('Math.min', 2, { lengthIsMinimum: true }),
        abs: NativeFn('Math.abs', 1),
        floor: NativeFn('Math.floor', 1),
        ceil: NativeFn('Math.ceil', 1),
        ceiling: NativeFn('Math.ceil', 1),
        round: NativeFn('Math.round', 1),
        random: NativeFn('Math.random', 0, { nondeterministic: true }),
        rnd: NativeFn('Math.random', 0, { nondeterministic: true }),
        rand: NativeFn('Math.random', 0, { nondeterministic: true }),
        mod: NativeOp('%', 2)
    };
    
    defConsts = {
        e: Math.E,
        ln10: Math.LN10,
        log10: Math.LN10,
        ln2: Math.LN2,
        log2: Math.LN2,
        log10e: Math.LOG10E,
        log2e: Math.LOG2E,
        pi: Math.PI,
        sqrt1_2: Math.SQRT1_2,
        sqrt2: Math.SQRT2
    };
    
    defAddOps = {
        '+': NativeOp('+', 2),
        '-': NativeOp('-', 2)
    };
    
    defMulOps = {
        '*': NativeOp('*', 2),
        '/': NativeOp('/', 2),
        '%': NativeOp('%', 2)
    };

    function clone(obj) {
        var res = {};
        for(var key in obj) {
            if(obj.hasOwnProperty(key))
                res[key] = obj[key];
        }
        
        return res;
    }
    
    var eproto = Environment.prototype;
    
    eproto.setVars = function(names) {
        for(var i = 0; i < names.length; i++)
            dieIfBadId(this, names[i]);
        
        this.vars = names.slice();
    };
    
    eproto.addFn = function(name, fn) {
        dieIfBadId(this, name);
        this.fns[name] = fn;
    };
    
    eproto.removeFn = function(name) {
        delete this.fns[name];
    };
    
    eproto.addConst = function(name, val) {
        dieIfBadId(this, name);
        this.consts[name] = val;
    };
    
    eproto.removeConst = function(name) {
        delete this.consts[name];
    };
    
    eproto.addAddOp = function(name, fn) {
        dieIfBadOp(this, name, fn);
        this.addOps[name] = fn;
    };
    
    eproto.removeAddOp = function(name) {
        delete this.addOps[name];
    };
    
    eproto.addMulOp = function(name, fn) {
        dieIfBadOp(this, name, fn);
        this.mulOps[name] = fn;
    };
    
    eproto.removeMulOp = function(name) {
        delete this.mulOps[name];
    };
    
    eproto.isVarName = function(name) {
        for(var i = 0; i < this.vars.length; i++)
            if(this.vars[i] == name)
                return true;
    };
    
    eproto.isFnName = function(name) {
        return this.fns.hasOwnProperty(name);
    };
    
    eproto.isConst = function(name) {
        return this.consts.hasOwnProperty(name);
    };
    
    eproto.isAddOp = function(name) {
        return this.addOps.hasOwnProperty(name);
    };
    
    eproto.isMulOp = function(name) {
        return this.mulOps.hasOwnProperty(name);
    };
    
    eproto.getFnVal = function(name) {
        if(this.isMulOp(name)) return this.mulOps[name];
        if(this.isAddOp(name)) return this.addOps[name];
        if(name == '_pow') return this._pow;
        if(name == '_negate') return this._negate;
        return this.fns[name];
    };
    
    eproto.isValidId = function(id) {
        return typeof id == 'string' && /^[A-Za-z_][A-Za-z_0-9]*$/.test(id);
    };
    
    eproto.isKnownId = function(id) {
        return this.isFnName(id) ||
               this.isConst(id) ||
               this.isAddOp(id) ||
               this.isMulOp(id) ||
               this.isVarName(id) ||
               id == this._powOpId;
    };
    
    function dieIfBadId(env, id) {
        if(!env.isValidId(id))
            throw new Error('Invalid ID: ' + id);
        
        if(env.isKnownId(id))
            throw new Error('ID ' + id + ' is already in use');
    }
    
    function dieIfBadOp(env, id, fn) {
        if(typeof id != 'string' || id.length != 1 || id == ' ')
            throw new Error('Operators IDs be a single, non-space character');
        
        if(env.isKnownId(id))
            throw new Error('Operator ID ' + id + ' is already in use');
        
        if(fn.length != 2)
            throw new Error('Operators must take exactly 2 arguments');
    }
    
    return Environment;
})();

/** lexer.js **/

var parseError = function(message, start, end) {
    var e = new Error(message);
    e.name = 'ParseError';
    
    e.range = { start: start, end: end };
    return e;
};

var Token = function(type, val, rangeInInput) {
    if(!(this instanceof Token))
        return new Token(type, val, rangeInInput);

    this.type = type;
    this.val = val;
    this.rangeInInput = rangeInInput;
};

Token.prototype.toString = function() {
    return this.type + (this.val ? '(' + this.val.toString() + ')' : '');
};

var TokenType = {
    Num: 'num',
    Const: 'const',
    Var: 'var',
    Negate: 'negate',
    Pow: 'pow',
    MulOp: 'mulop',
    AddOp: 'addop',
    Fn: 'fn',
    LP: 'lp',
    RP: 'rp',
    Comma: 'comma'
};

var FnCall = function(env, name) {
    if(!(this instanceof FnCall))
        return new FnCall(env, name);
    
    this.name = name;
    this.argCount = 0;
    this.envVal = env.getFnVal(name);
};

FnCall.prototype.toString = function() {
    return this.envVal.name ? this.envVal.name : this.name;
};

var lex = (function() {
    var idRegex = /^([A-Za-z_][A-Za-z_0-9]*)(.*)/,
        numRegex = /^([0-9]*\.?[0-9]+)(.*)/,
        simpleNumRegex = /^[0-9.]/;
    
    var LexState = function(env, s) {
        if(!(this instanceof LexState))
            return new LexState(env, s);
        
        var unwhitespaced = removeWhitespaceWithMap(s);
        
        this.env = env;
        this.s = unwhitespaced.s;
        this._origLength = unwhitespaced.s.length;
        this._whitespaceMap = unwhitespaced.map;
        this.tokens = [];
    };
    
    LexState.prototype.consumeOneChar = function() {
        this.s = this.s.substring(1);
    };
    
    LexState.prototype.currentPositionInInput = function() {
        return this._origLength - this.s.length;
    };
    
    LexState.prototype.rangeFromCurrentS = function(length) {
        var startIdx = this.currentPositionInInput(),
            endIdx = startIdx + length - 1,
            start = this._whitespaceMap[startIdx],
            end = length === 0 ? start : this._whitespaceMap[endIdx] + 1;
        
        return { start: start, end: end };
    };
    
    LexState.prototype.parseErrorAtCurrentS = function(message, length) {
        if(length === undefined) length = 1;
        var range = this.rangeFromCurrentS(length);
        
        return parseError(message, range.start, range.end);
    };
    
    function removeWhitespaceWithMap(s) {
        var idxMap = [],
            whitespaceRegex = /\s/,
            res = '';
        
        for(var i = 0; i < s.length; i++) {
            var char = s.charAt(i);
            if(!whitespaceRegex.test(char)) {
                idxMap.push(i);
                res += char;
            }
        }
        
        return { s: res, map: idxMap };
    }

    return function(env, expr) {
        var state = LexState(env, expr);
        
        while(state.s.length > 0)
            realLex(state);
    
        return state.tokens;
    };
    
    function realLex(state) {
        if(state.s.length === 0) return;
        
        switch(state.s.charAt(0)) {
            case '(':
                addImplicitMul(state);
                pushToken(state, TokenType.LP);
                state.consumeOneChar();
                return;
            
            case ')':
                pushToken(state, TokenType.RP);
                state.consumeOneChar();
                return;
                
            case ',':
                pushToken(state, TokenType.Comma);
                state.consumeOneChar();
                return;
            
            case '-':
                lexMinus(state);
                return;
        }
        
        if(idRegex.test(state.s))
            lexId(state);
        else if(simpleNumRegex.test(state.s))
            lexNum(state);
        else {
            try {
                lexOp(state);
            }
            catch(e) {
                throw state.parseErrorAtCurrentS('Invalid character "' + state.s.charAt(0) + '".');
            }
        }
    }
    
    function pushToken(state, type, val, length) {
        if(!val)
            length = 1;
        
        state.tokens.push(Token(type, val, state.rangeFromCurrentS(length)));
    }
    
    function pushFnToken(state, type, id, lengthOverride) {
        var length = lengthOverride !== undefined ? lengthOverride : id.length;
        
        pushToken(state, type, FnCall(state.env, id), length);
    }
    
    function addImplicitMul(state, numOk) {
        numOk = numOk !== false;
        if(!state.env.options.implicitMul || state.tokens.length === 0) return;
        
        var lastType = state.tokens[state.tokens.length - 1].type;
        if(lastType == TokenType.RP ||
           lastType == TokenType.Var ||
           lastType == TokenType.Const ||
           (numOk && lastType == TokenType.Num))
                pushFnToken(state, TokenType.MulOp, state.env._implicitMulOpId, 0);
    }
    
    function lexNum(state) {
        var res = numRegex.exec(state.s);
        if(!res)
            throw state.parseErrorAtCurrentS('Expected a number.');
        
        addImplicitMul(state, false);
        pushToken(state, TokenType.Num, parseFloat(res[1]), res[1].length);
        state.s = res[2];
    }
    
    function lexId(state) {
        var res = idRegex.exec(state.s);
        if(!res)
            throw state.parseErrorAtCurrentS('Expected a identifier.');
        
        var id = res[1],
            newS = res[2],
            tok = idToToken(state, id);
            
        if(tok) {
            addImplicitMul(state);
            state.tokens.push(tok);
            state.s = newS;
            return;
        }
        else if(state.env.options.implicitMul && id.length > 1) {
            while(id.length > 1) {
                newS = id.charAt(id.length - 1) + newS;
                id = id.substr(0, id.length - 1);
                
                tok = idToToken(state, id);
                if(tok) {
                    addImplicitMul(state);
                    state.tokens.push(tok);
                    state.s = newS;
                    return;
                }
            }
        }
        
        throw state.parseErrorAtCurrentS('Unknown identifier "' + id + '".', id.length);
    }
    
    function idToToken(state, id) {
        var tok,
            env = state.env;
        
        if(env.isFnName(id)) tok = Token(TokenType.Fn, FnCall(state.env, id), state.rangeFromCurrentS(id.length));
        else if(env.isConst(id)) tok = Token(TokenType.Const, env.consts[id], state.rangeFromCurrentS(id.length));
        else if(env.isVarName(id)) tok = Token(TokenType.Var, id, state.rangeFromCurrentS(id.length));
        
        return tok;
    }
    
    function lexMinus(state) {
        if(state.s.charAt(0) != '-')
            throw state.parseErrorAtCurrentS('Expected a minus sign.');
        
        if(shouldNegate(state))
            pushFnToken(state, TokenType.Negate, '_negate', 1);
        else
            pushFnToken(state, TokenType.AddOp, state.env._subtractOpId);
            
        state.consumeOneChar();
    }
    
    function shouldNegate(state) {
        if(state.tokens.length === 0) return true;
        
        var last = state.tokens[state.tokens.length - 1];
        return last.type == TokenType.LP ||
               last.type == TokenType.AddOp ||
               last.type == TokenType.MulOp ||
               last.type == TokenType.Comma ||
               last.type == TokenType.Pow ||
               last.type == TokenType.Negate;
    }
    
    function lexOp(state) {
        var c = state.s.charAt(0),
            env = state.env;
        
        if(env.isAddOp(c))
            pushFnToken(state, TokenType.AddOp, c);
        else if(env.isMulOp(c))
            pushFnToken(state, TokenType.MulOp, c);
        else if(env.options.powOp && c == env._powOpId)
            pushFnToken(state, TokenType.Pow, '_pow', 1);
        else
            throw state.parseErrorAtCurrentS('Expected an operator.');
        
        state.consumeOneChar();
    }
})();

/** parser.js **/

var ParseTree = (function() {
    var ParseTree = function(root, children) {
        if(!(this instanceof ParseTree))
            return new ParseTree(root, children);
        
        this.root = root;
        this.children = children;
    };
    
    ParseTree.prototype.isLeaf = function() {
        return !this.children || this.children.length === 0;
    };
    
    ParseTree.prototype.isConstant = function() {
        return this.root.type != TokenType.Var &&
               !(this.root.type == TokenType.Fn && this.root.val.envVal.nondeterministic) &&
               (this.isLeaf() || areConstant(this.children));
    };
    
    function areConstant(pts) {
        for(var i = 0; i < pts.length; i++)
            if(!pts[i].isConstant()) return false;
            
        return true;
    }
    
    function prettyPrint(pt, indent, isLast, isRoot) {
        var s = indent;
        
        if(!isRoot) {
            if(isLast) {
                s += '\\-';
                indent += '  ';
            }
            else {
                s += '|-';
                indent += '| ';
            }
        }
        
        s += pt.root.toString() + '\n';
        
        if(pt.children) {
            for(var i = 0; i < pt.children.length; i++)
                s += prettyPrint(pt.children[i], indent, i == pt.children.length - 1);
        }
        
        return s;
    }
    
    ParseTree.prototype.toString = function() {
        return prettyPrint(this, '', false, true);
    };
    
    return ParseTree;
})();

var parse = (function() {
    return function(env, tokens) {
        var toks = tokens.slice(),
            pt = parseE(env, toks);
        
        if(toks.length > 0)
            throw parseError('Unexpected token(s) after end of expression.', toks[0].rangeInInput.start);
        
        return pt;
    };
    
    function parseErrorAtToken(token, message) {
        return parseError(message, token.rangeInInput.start, token.rangeInInput.end);
    }
    
    function parseErrorAtEnd(message) {
        return parseError('Unexpected end of expression: ' + message);
    }
    
    function parseE(env, tokens) {
        var eparse = parseTM(env, tokens);
            
        while(tokens.length > 0 && tokens[0].type == TokenType.AddOp) {
            var temppt = eparse;
            eparse = ParseTree(tokens.shift(), [temppt, parseTM(env, tokens)]);
        }
        
        return eparse;
    }
    
    function parseTM(env, tokens) {
        var tmparse = parseF(env, tokens);
        
        while(tokens.length > 0 && tokens[0].type == TokenType.MulOp) {
            var temppt = tmparse;
            tmparse = ParseTree(tokens.shift(), [temppt, parseF(env, tokens)]);
        }
        
        return tmparse;
    }
    
    function parseF(env, tokens) {
        var fparse;
        
        if(tokens.length === 0)
            throw parseErrorAtEnd('Expected a factor.');
        
        if(tokens[0].type == TokenType.Negate)
            fparse = ParseTree(tokens.shift(), [parseF(env, tokens)]);
        else {
            fparse = parseDAT(env, tokens);
            
            if(tokens.length > 0 && tokens[0].type == TokenType.Pow) {
                var temppt = fparse;
                fparse = ParseTree(tokens.shift(), [temppt, parseF(env, tokens)]);
            }
        }
        
        return fparse;
    }
    
    function parseFN(env, tokens) {
        var head = eatMandToken(tokens, TokenType.Fn, 'function name'),
            fnparse = ParseTree(head, []);
        
        eatMandToken(tokens, TokenType.LP, 'left parenthesis', 'Functions must be followed by an opening parenthesis.');
        
        var nargs = head.val.envVal.length,
            argsAreMin = head.val.envVal.lengthIsMinimum,
            pendingComma = false;
        
        while(tokens.length > 0 && tokens[0].type != TokenType.RP &&
              (argsAreMin || head.val.argCount < nargs))
        {
            fnparse.children.push(parseE(env, tokens));
            head.val.argCount++;
            pendingComma = false;
            
            if(head.val.argCount < nargs) {
                // We require more arguments. Eat a comma and go around again.
                eatMandToken(tokens, TokenType.Comma, 'comma', 'Too few arguments to "' + head.val.name + '"? Expected ' + (argsAreMin ? 'at least ' : '') + nargs + ' but got ' + head.val.argCount + '.');
                pendingComma = true;
            }
            else if(argsAreMin && tokens.length > 0 && tokens[0].type == TokenType.Comma) {
                // We seem to have more arguments. Eat the comma and go around again.
                tokens.shift();
                pendingComma = true;
            }
        }
        
        // We may have broken out with a right paren (or end of input) and too few arguments.
        if((argsAreMin && head.val.argCount < nargs) || (!argsAreMin && head.val.argCount != nargs)) {
            var argCountDesc = (argsAreMin ? 'at least ' : '') + nargs,
                message = 'Too few arguments to "' + head.val.name + '"? Expected ' + argCountDesc + ' but got ' + head.val.argCount;
            
            if(tokens.length === 0)
                throw parseErrorAtEnd(message);
            
            throw parseErrorAtToken(tokens[0], message);
        }
        
        // If everything ended but we just ate a comma, that's an error.
        // For example: max(1, 2,
        if(pendingComma)
            throw parseErrorAtEnd('Expected an expression after comma.');
        
        eatRPWithInsertion(tokens, 'Too many arguments to "' + head.val.name + '"? Expected ' + nargs + '.', env);
        
        return fnparse;
    }
    
    function parseDAT(env, tokens) {
        if(tokens.length === 0)
            throw parseErrorAtEnd('Expected a datum.');
        
        switch(tokens[0].type) {
            case TokenType.Var:
            case TokenType.Num:
            case TokenType.Const:
                return ParseTree(tokens.shift());
                
            case TokenType.Fn:
                return parseFN(env, tokens);
                
            case TokenType.LP:
                tokens.shift();
                var eparse = parseE(env, tokens);
                eatRPWithInsertion(tokens, 'Mismatched parentheses.', env);
                return eparse;
                
            default:
                throw parseErrorAtToken(tokens[0], 'Expected a datum.');
        }
    }
    
    function eatMandToken(tokens, type, friendly, hint) {
        if(tokens.length === 0 || tokens[0].type != type) {
            var errStr = 'Expected ' + (friendly || type) + '.';
            if(hint) errStr += ' ' + hint;
            
            if(tokens.length === 0)
                throw parseErrorAtEnd(errStr);
            
            throw parseErrorAtToken(tokens[0], errStr);
        }
        
        return tokens.shift();
    }
    
    function eatRPWithInsertion(tokens, hint, env) {
        // Emulate the TI-calculator's behavior of adding in missing close
        // parentheses if we've hit the end of the input.
        if(env.options.autoParens && tokens.length === 0)
            return Token(TokenType.RP);  // TODO: it's ok that this doesn't have a rangeInInput, right?
        
        return eatMandToken(tokens, TokenType.RP, 'right parenthesis', hint);
    }
})();

/** compiler.js **/

var compile = (function() {
    function internalCompile(env, parseTree, options) {
        options = applyDefaults(options, { optimize: true });
    
        // envAccumulator becomes a map of all the things used from the
        // Environment in the final compiled form of the function. It is from
        // names in the eval string to the version that reference 'env', so we
        // can reflect them into eval-space in a Closure Compiler-safe way.
        // We have to ensure 'env' is the actual name for env after Closure has
        // its way, though... hence that final variable we add at the end.
        // The names in the eval code are mangled using the function below so
        // we are less likely to get issues if, say, the user names a variable
        // something like "env".
        
        var args = mangledVarNamesAsArgString(env),
            envAccumulator = {},
            envAccumulatorHasProps = false,
            body;
        
        body = '(function(' + args + ') { return ' + ptToStr(env, parseTree, envAccumulator, options.optimize) + '; })';
        
        for(var propName in envAccumulator) {
            if(envAccumulator.hasOwnProperty(propName)) {
                envAccumulatorHasProps = true;
                body = 'var ' + propName + ' = ' + envAccumulator[propName] + '; ' + body;
            }
        }
        
        if(envAccumulatorHasProps)
            body = 'var env = arguments[0]; ' + body;
        
        return eval(body);
    }
    
    return internalCompile;
    
    function mangledVarNamesAsArgString(env) {
        var s = '';
        for(var i = 0; i < env.vars.length; i++) {
            s += mangleVarNameForEval(env.vars[i]);
            if(i != env.vars.length - 1)
                s += ', ';
        }
        
        return s;
    }
    
    function mangleEnvNameForEval(name) {
        return '__env_' + name + '__';
    }
    
    function mangleVarNameForEval(name) {
        return '__var_' + name + '__';
    }
    
    function tokToStr(env, tok, envAccumulator) {
        var mangledName, s;
        
        if(tok.val instanceof FnCall) {
            if(tok.val.envVal instanceof NativeFn)
                return tok.val.envVal.name;
            if(tok.val.envVal instanceof NativeOp)
                return tok.val.envVal.name;
        }
        
        switch(tok.type) {
            case TokenType.Num:
            case TokenType.Const:
                return tok.val.toString();
            
            case TokenType.Var:
                return mangleVarNameForEval(tok.val);
            
            case TokenType.Negate:
            case TokenType.Pow:
                mangledName = mangleEnvNameForEval(tok.val.name);
                if(envAccumulator)
                    envAccumulator[mangledName] = 'env["' + tok.val.name + '"]';

                return mangledName;
            
            case TokenType.MulOp: s = 'mulOps'; break;
            case TokenType.AddOp: s = 'addOps'; break;
            case TokenType.Fn: s = 'fns'; break;
        }
        
        mangledName = mangleEnvNameForEval(tok.val.name);
        
        if(envAccumulator)
            envAccumulator[mangledName] = 'env.' + s + '["' + tok.val.name + '"]';
        
        return mangledName;
    }
    
    function tokIsFn(tok) {
        return tok.val instanceof FnCall && !(tok.val.envVal instanceof NativeOp);
    }
    
    function tokIsNativeOp(tok) {
        return tok.val instanceof FnCall && tok.val.envVal instanceof NativeOp;
    }
    
    function ptToStr(env, pt, envAccumulator, optimize) {
        var rootIsFn = tokIsFn(pt.root),
            rootIsOp = tokIsNativeOp(pt.root),
            s, t;
        
        // Numbers and constants can just pass through; no need to go through
        // the whole compile() shebang on them.
        if(pt.root.type == TokenType.Num || pt.root.type == TokenType.Const)
            return tokToStr(env, pt.root);
        
        if(optimize !== false && pt.isConstant()) {
            // If this parse tree is constant, generate a function out of it and
            // replace the whole shebang with its value. Note that it's fine
            // to call the resulting argument with no values (i.e., all arguments
            // undefined) because we're guaranteed the parsetree contains no
            // variables (otherwise it wouldn't be constant).
            // We obviously have to turn off optimizations in this go-round,
            // or we'll just recurse endlessly.
            return internalCompile(env, pt, { optimize: false })().toString();
        }
        
        // Otherwise, convert other things as appropriate...
        s = tokToStr(env, pt.root, envAccumulator);
        
        if(rootIsFn)
           s += '(';
        else if(rootIsOp) {
           t = s;
           s = '(';
        }
        
        if(rootIsOp) {
            if(pt.children.length == 1)
                s += t + ptToStr(env, pt.children[0], envAccumulator, optimize);
            else if(pt.children.length == 2)
                s += ptToStr(env, pt.children[0], envAccumulator, optimize) + ' ' + t + ' ' + ptToStr(env, pt.children[1], envAccumulator, optimize);
            else {
                // There's really no way this should ever happen unless we were
                // handed a manually-constructed broken parse tree.
                throw new Error('Invalid parse tree; a native operator was specified with ' + pt.children.length + ' arguments.');
            }
        }
        else if(pt.children) {
            for(var i = 0; i < pt.children.length; i++) {
                s += ptToStr(env, pt.children[i], envAccumulator, optimize);
                
                if(rootIsFn && i != pt.children.length - 1)
                    s += ', ';
            }
        }
        
        if(rootIsFn || rootIsOp)
            s += ')';
            
        return s;
    }
})();

/** expr.js **/

var Expr = (function() {
    function exprCompile() {
        var env, s;
        
        switch(arguments.length) {
            case 0:
                throw new Error('Invalid arguments');
            case 1:
                if(typeof arguments[0] != 'string')
                    throw new Error('Invalid arguments');
                
                env = Environment();
                s = arguments[0];
                break;
            case 2:
                if(typeof arguments[1] != 'string')
                    throw new Error('Invalid arguments');
                
                s = arguments[1];
            
                if(arguments[0] instanceof Environment)
                    env = arguments[0];
                else if(typeof arguments[0] == 'string')
                    env = Environment(arguments[0].split(','));
                else if(Object.prototype.toString.call(arguments[0]) === '[object Array]')
                    env = Environment(arguments[0]);
                else
                    throw new Error('Invalid arguments');
                break;
            default:
                var vars = [];
                for(var i = 0; i < arguments.length - 1; i++) {
                    if(typeof arguments[i] != 'string')
                        throw new Error('Invalid arguments');
                    vars.push.apply(vars, arguments[i].split(','));
                }
                
                if(typeof arguments[arguments.length - 1] != 'string')
                    throw new Error('Invalid arguments');
                
                env = Environment(vars);
                s = arguments[arguments.length - 1];
        }
        
        return compile(env, parse(env, lex(env, s)));
    }
    
    function oneshot(vars, s) {
        var env,
            vals = [];

        if(arguments.length == 1) {
            if(typeof vars != 'string')
                throw new Error('Invalid arguments');
            env = Environment();
            s = vars;
        }
        else {
            var vns = [];
            
            for(var vn in vars) {
                if(vars.hasOwnProperty(vn)) {
                    vns.push(vn);
                    vals.push(vars[vn]);
                }
            }
            
            env = Environment(vns);
        }
        
        return compile(env, parse(env, lex(env, s))).apply(null, vals);
    }
    
    return {
        compile: exprCompile,
        oneshot: oneshot,

        Environment: Environment,
        NativeOp: NativeOp,
        NativeFn: NativeFn,
        
        Core: {
            compile: compile,
            lex: lex,
            parse: parse,
            
            ParseTree: ParseTree,
            Token: Token,
            TokenType: TokenType,
            FnCall: FnCall
        }
    };
})();

    var _exports = { Expr: Expr };
    
    // Support node's modules
    if(typeof module != 'undefined' && module.exports)
        module.exports = _exports;
    
    return _exports;
})();
