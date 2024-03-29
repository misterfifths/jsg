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
    this.name = name;
    this.length = length;
    this.lengthIsMinimum = false;
    this.nondeterministic = false;
};

var NativeFn = function(name, length, options) {
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
        this.options = applyDefaults(options, { autoParens: true, implicitMul: true, powOp: true });
    
        this.fns = clone(defFns);
        this.consts = clone(defConsts);
        this.addOps = clone(defAddOps);
        this.mulOps = clone(defMulOps);
        
        // important things for the parser & lexer
        this._implicitMulOpId = '*';
        this._subtractOpId = '-';
        this._negate = new NativeOp('-', 1);
        this._pow = new NativeFn('Math.pow', 2);
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
        sin: new NativeFn('Math.sin', 1),
        cos: new NativeFn('Math.cos', 1),
        tan: new NativeFn('Math.tan', 1),
        asin: new NativeFn('Math.asin', 1),
        arcsin: new NativeFn('Math.asin', 1),
        acos: new NativeFn('Math.acos', 1),
        arccos: new NativeFn('Math.acos', 1),
        atan: new NativeFn('Math.atan', 1),
        arctan: new NativeFn('Math.atan', 1),
        atan2: new NativeFn('Math.atan2', 2),
        arctan2: new NativeFn('Math.atan2', 2),
        
        // exponentiation, etc.
        exp: new NativeFn('Math.exp', 1),
        sqrt: new NativeFn('Math.sqrt', 1),
        pow: new NativeFn('Math.pow', 2),
        log: new NativeFn('Math.log', 1),
        ln: new NativeFn('Math.log', 1),
        log10: function(x) { return Math.log(x) / Math.LN10; },
        log2: function(x) { return Math.log(x) / Math.LN2; },
        logn: function(n, x) { return Math.log(x) / Math.log(n); },
        
        // miscellaneous
        max: new NativeFn('Math.max', 2, { lengthIsMinimum: true }),
        min: new NativeFn('Math.min', 2, { lengthIsMinimum: true }),
        abs: new NativeFn('Math.abs', 1),
        floor: new NativeFn('Math.floor', 1),
        ceil: new NativeFn('Math.ceil', 1),
        ceiling: new NativeFn('Math.ceil', 1),
        round: new NativeFn('Math.round', 1),
        random: new NativeFn('Math.random', 0, { nondeterministic: true }),
        rnd: new NativeFn('Math.random', 0, { nondeterministic: true }),
        rand: new NativeFn('Math.random', 0, { nondeterministic: true }),
        mod: new NativeOp('%', 2)
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
        '+': new NativeOp('+', 2),
        '-': new NativeOp('-', 2)
    };
    
    defMulOps = {
        '*': new NativeOp('*', 2),
        '/': new NativeOp('/', 2),
        '%': new NativeOp('%', 2)
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
        var state = new LexState(env, expr);
        
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
        
        state.tokens.push(new Token(type, val, state.rangeFromCurrentS(length)));
    }
    
    function pushFnToken(state, type, id, lengthOverride) {
        var length = lengthOverride !== undefined ? lengthOverride : id.length;
        
        pushToken(state, type, new FnCall(state.env, id), length);
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
        
        if(env.isFnName(id)) tok = new Token(TokenType.Fn, new FnCall(state.env, id), state.rangeFromCurrentS(id.length));
        else if(env.isConst(id)) tok = new Token(TokenType.Const, env.consts[id], state.rangeFromCurrentS(id.length));
        else if(env.isVarName(id)) tok = new Token(TokenType.Var, id, state.rangeFromCurrentS(id.length));
        
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
            eparse = new ParseTree(tokens.shift(), [temppt, parseTM(env, tokens)]);
        }
        
        return eparse;
    }
    
    function parseTM(env, tokens) {
        var tmparse = parseF(env, tokens);
        
        while(tokens.length > 0 && tokens[0].type == TokenType.MulOp) {
            var temppt = tmparse;
            tmparse = new ParseTree(tokens.shift(), [temppt, parseF(env, tokens)]);
        }
        
        return tmparse;
    }
    
    function parseF(env, tokens) {
        var fparse;
        
        if(tokens.length === 0)
            throw parseErrorAtEnd('Expected a factor.');
        
        if(tokens[0].type == TokenType.Negate)
            fparse = new ParseTree(tokens.shift(), [parseF(env, tokens)]);
        else {
            fparse = parseDAT(env, tokens);
            
            if(tokens.length > 0 && tokens[0].type == TokenType.Pow) {
                var temppt = fparse;
                fparse = new ParseTree(tokens.shift(), [temppt, parseF(env, tokens)]);
            }
        }
        
        return fparse;
    }
    
    function parseFN(env, tokens) {
        var head = eatMandToken(tokens, TokenType.Fn, 'function name'),
            fnparse = new ParseTree(head, []);
        
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
                return new ParseTree(tokens.shift());
                
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
            return new Token(TokenType.RP);  // TODO: it's ok that this doesn't have a rangeInInput, right?
        
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

    // Parses and compiles a mathematical expression. The return value is a
    // Javascript function that takes as its arguments the variables in the
    // associated Environment, in order.
    //
    // This function can be called with a number of argument combinations:
    // (string[, options])
    //    A new Environment is created with no variables, and string is taken to
    //    be the expression.
    // (string, string[, options])
    //    The first string is taken to be a variable name, which is used to
    //    create a new Environment. The second string is the expression.
    // ([array of strings], string[, options])
    //    The array is taken to be a list of variable names which are used to
    //    create a new environment. The string is the expression.
    // (Environment, string[, options])
    //    The given Environment is used to parse the string expression.
    //
    // Options:
    //    optimize: Perform optimization when compiling (right now, just simple
    //      constant subtree evaluation). Default: true.
    //    debug: Instead of a function, return an object with all the
    //      intermediate work in compiling the expression. Default: false.
    //
    //    The following options have no effect if you pass in an Environment
    //    to the function. Instead, use them when creating the Environment.
    //
    //    autoParens: Automatically complete missing parentheses at the end of
    //      the expression. Default: true.
    //    implicitMul: Insert implicit multiplication in the appropriate
    //      circumstances. Default: true.
    //    powOp: Process the caret (^) as an exponentiation operator. Default:
    //      true.
    function friendlyCompile() {
        var env, s, options, args, debug;
        
        if(arguments.length === 0) throw new Error('Invalid arguments');
        
        args = Array.prototype.slice.apply(arguments);
        
        // Remove the options argument from the end
        if(typeof args[args.length - 1] == 'object') {
            options = args.pop();
            if(args.length === 0) throw new Error('Invalid arguments');
        }
        
        debug = applyDefaults(options, { debug: false }).debug;
        
        // Now, the new last argument must be the expression string
        if(typeof args[args.length - 1] != 'string')
            throw new Error('Invalid arguments');
        
        s = args.pop();
        
        // Ok, now we're down to the argument that determines the environment.
        
        if(args.length === 0) {
            // No variables
            env = new Environment([], options);
        }
        else if(args.length == 1) {
            // 1 argument: either an Environment, a variable name, or an array
            // of variable names.
            if(arguments[0] instanceof Environment)
                env = arguments[0];
            else if(typeof arguments[0] == 'string')
                env = new Environment(arguments[0], options);
            else if(Object.prototype.toString.call(arguments[0]) === '[object Array]')
                env = new Environment(arguments[0], options);
            else
                throw new Error('Invalid arguments');
        }
        else {
            // Too many arguments
            throw new Error('Invalid arguments');
        }
        
        if(!debug) {
            var tokens = lex(env, s),
                parseTree = parse(env, tokens),
                fn = compile(env, parseTree, options);
            
            return fn;
        }
        else {
            var res = { env: env };
            try {
                res.tokens = lex(env, s);
                
                try {
                    res.parseTree = parse(env, res.tokens);
                    
                    try {
                        res.fn = compile(env, res.parseTree, options);
                    }
                    catch(compileError) {
                        compileError.when = 'compile';
                        res.error = compileError;
                    }
                }
                catch(parseError) {
                    parseError.when = 'parse';
                    res.error = parseError;
                }
            }
            catch(lexError) {
                lexError.when = 'lex';
                res.error = lexError;
            }
            
            return res;
        }
    }
    
    // Parses and evaluates a mathematical expression. Unlike friendlyCompile,
    // this function returns a Number, not a function.
    //
    // This function can be called in two ways:
    // (string[, options])
    //    A new Environment is created with no variables, and string is taken to
    //    be the expression.
    // (object, string[, options])
    //    The object is taken to be a map from variable names to their values
    //    (for instance, { x: 2, y: 1 }). A new Environment is created with the
    //    variable names in the object, and the string is taken to be the
    //    expression. It is evaluated using the values in the object.
    //
    // The options are the same as those passed to friendlyCompile.
    function oneshot(vars, s, options) {
        var env,
            vals = [];
            
        if(typeof vars == 'string') {
            // No variables
            options = s;
            s = vars;
            
            env = new Environment(options);
        }
        else {
            var vns = [];
            
            for(var vn in vars) {
                if(vars.hasOwnProperty(vn)) {
                    vns.push(vn);
                    vals.push(vars[vn]);
                }
            }
            
            env = new Environment(vns, options);
        }
        
        var tokens = lex(env, s),
            parseTree = parse(env, tokens),
            fn = compile(env, parseTree, options);
        
        return fn.apply(null, vals);
    }
    
    
    // Assemble the public interface:
    var toExpose = {
        oneshot: oneshot,
        Environment: Environment,
        NativeOp: NativeOp,
        NativeFn: NativeFn,
        
        compile: compile,
        lex: lex,
        parse: parse,
        
        ParseTree: ParseTree,
        Token: Token,
        TokenType: TokenType,
        FnCall: FnCall
    };
    
    for(var key in toExpose) {
        if(toExpose.hasOwnProperty(key))
            friendlyCompile[key] = toExpose[key];
    }
    
    return friendlyCompile;
})();

    var _exports = { Expr: Expr };
    
    // Support node's modules
    if(typeof module != 'undefined' && module.exports)
        module.exports = _exports;
    
    return _exports;
})();
