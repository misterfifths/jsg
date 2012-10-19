var Token = function(type, val) {
	if(!(this instanceof Token))
		return new Token(type, val);

	this.type = type;
	this.val = val;
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
				pushToken(state, 'lp');
				state.s = state.s.substring(1);
				return;
			
			case ')':
				pushToken(state, 'rp');
				state.s = state.s.substring(1);
				return;
				
			case ',':
				pushToken(state, 'comma');
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
		if(lastType == 'rp' ||
		   lastType == 'var' ||
		   lastType == 'const' ||
		   (numOk && lastType == 'num'))
                pushFnToken(state, 'mulop', state.env._implicitMulOpId);
	}
	
	function lexNum(state) {
		var res = numRegex.exec(state.s);
		if(!res) throw new Error('Expected a number');
		
		addImplicitMul(state, false);
		pushToken(state, 'num', parseFloat(res[1]));
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
		
		if(env.isFnName(id)) tok = Token('fn', FnCall(state.env, id));
		else if(env.isConst(id)) tok = Token('const', env.consts[id]);
		else if(env.isVarName(id)) tok = Token('var', id);
		
		return tok;
	}
	
	function lexMinus(state) {
		if(state.s.charAt(0) != '-') throw new Error('Expected a minus');
		
		if(shouldNegate(state))
			pushFnToken(state, 'negate', '_negate');
		else
			pushFnToken(state, 'addop', state.env._subtractOpId);
			
		state.s = state.s.substring(1);
	}
	
	function shouldNegate(state) {
		if(state.tokens.length === 0) return true;
		
		var last = state.tokens[state.tokens.length - 1];
		return last.type == 'lp' ||
			   last.type == 'addop' ||
			   last.type == 'mulop' ||
			   last.type == 'comma' ||
			   last.type == 'pow' ||
			   last.type == 'negate';
	}
	
	function lexOp(state) {
		var c = state.s.charAt(0),
			env = state.env;
		
		if(env.isAddOp(c))
			pushFnToken(state, 'addop', c);
		else if(env.isMulOp(c))
			pushFnToken(state, 'mulop', c);
		else if(!env.noPowOp && c == env._powOpId)
			pushFnToken(state, 'pow', '_pow');
		else
			throw new Error('Expected an operator');
		
		state.s = state.s.substring(1);
	}
})();