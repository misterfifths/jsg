var Token = function(type, val) {
	if(!(this instanceof Token))
		return new Token(type, val);

	this.type = type;
	this.val = val;
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

var lex = (function() {
	var idRegex = /^([A-Za-z_][A-Za-z_0-9]*)(.*)/,
		numRegex = /^([0-9]*\.?[0-9]+)(.*)/,
		simpleNumRegex = /^[0-9.]/;

	return function(env, expr) {
		var s = expr.replace(/\s/g, ''),
			tokens = [],
			state = { env: env, s: s, tokens: tokens };
		
		while(state.s.length > 0)
			realLex(state);
	
		return tokens;
	};
	
	function realLex(state) {
		if(state.s.length === 0) return;
		
		switch(state.s.charAt(0)) {
			case '(':
				addImplicitMul(state);
				pushToken(state, TokenType.LP);
				state.s = state.s.substring(1);
				return;
			
			case ')':
				pushToken(state, TokenType.RP);
				state.s = state.s.substring(1);
				return;
				
			case ',':
				pushToken(state, TokenType.Comma);
				state.s = state.s.substring(1);
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
				throw new Error('Invalid input: ' + state.s);
			}
		}
	}
	
	function pushToken(state, type, val) {
		state.tokens.push(Token(type, val));
	}
	
	function pushFnToken(state, type, id) {
		pushToken(state, type, FnCall(state.env, id));
	}
	
	function addImplicitMul(state, numOk) {
		numOk = numOk !== false;
		if(state.env.noImplicitMul || state.tokens.length === 0) return;
		
		var lastType = state.tokens[state.tokens.length - 1].type;
		if(lastType == TokenType.RP ||
		   lastType == TokenType.Var ||
		   lastType == TokenType.Const ||
		   (numOk && lastType == TokenType.Num))
                pushFnToken(state, TokenType.MulOp, state.env._implicitMulOpId);
	}
	
	function lexNum(state) {
		var res = numRegex.exec(state.s);
		if(!res) throw new Error('Expected a number');
		
		addImplicitMul(state, false);
		pushToken(state, TokenType.Num, parseFloat(res[1]));
		state.s = res[2];
	}
	
	function lexId(state) {
		var res = idRegex.exec(state.s);
		if(!res) throw new Error('Expected an identifier');
		
		var id = res[1],
			newS = res[2],
			tok = idToToken(state, id);
			
		if(tok) {
			addImplicitMul(state);
			state.tokens.push(tok);
			state.s = newS;
			return;
		}
		else if(!state.env.noImplicitMul && id.length > 1) {
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
		
		throw new Error('Unknown identifier ' + id);
	}
	
	function idToToken(state, id) {
		var tok,
			env = state.env;
		
		if(env.isFnName(id)) tok = Token(TokenType.Fn, FnCall(state.env, id));
		else if(env.isConst(id)) tok = Token(TokenType.Const, env.consts[id]);
		else if(env.isVarName(id)) tok = Token(TokenType.Var, id);
		
		return tok;
	}
	
	function lexMinus(state) {
		if(state.s.charAt(0) != '-') throw new Error('Expected a minus');
		
		if(shouldNegate(state))
			pushFnToken(state, TokenType.Negate, '_negate');
		else
			pushFnToken(state, TokenType.AddOp, state.env._subtractOpId);
			
		state.s = state.s.substring(1);
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
		else if(!env.noPowOp && c == env._powOpId)
			pushFnToken(state, TokenType.Pow, '_pow');
		else
			throw new Error('Expected an operator');
		
		state.s = state.s.substring(1);
	}
})();