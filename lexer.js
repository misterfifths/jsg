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