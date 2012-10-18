var JSG = (function() {
    'use strict';

/** environment.js **/

// TODO: these as parts of Environment
var NativeOp = function(name, length) {
	if(!(this instanceof NativeOp))
		return new NativeOp(name);

	this.name = name;
	this.length = length;
};

var NativeFn = function(name, length, lengthIsMinimum) {
	if(!(this instanceof NativeFn))
		return new NativeFn(name, length, lengthIsMinimum);
	
	this.name = name;
	this.length = length;
	this.lengthIsMinimum = !!lengthIsMinimum;
};

var Environment = (function() {
	var Environment = function(vars, noImplicitMul, noPowOp, noArityCheck) {
		if(!(this instanceof Environment))
			return new Environment(vars, noImplicitMul, noPowOp, noArityCheck);
	
		this.fns = clone(defFns);
		this.consts = clone(defConsts);
		this.addops = clone(defAddOps);
		this.mulops = clone(defMulOps);
		
		this.noImplicitMul = !!noImplicitMul;
		this.noPowOp = !!noPowOp;
		this.noArityCheck = !!noArityCheck;
	
		if(vars)
			this.vars = vars.slice();
		else
			this.vars = [];
		
		// important things for the parser & lexer
		this._implicitMulOpId = '*';
		this._subtractOpId = '-';
		this._negate = NativeOp('-', 1);
		this._pow = NativeFn('Math.pow', 2);
		this._powOpId = '^';
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
		max: NativeFn('Math.max', 2, true),
		min: NativeFn('Math.min', 2, true),
		abs: NativeFn('Math.abs', 1),
		floor: NativeFn('Math.floor', 1),
		ceil: NativeFn('Math.ceil', 1),
		ceiling: NativeFn('Math.ceil', 1),
		round: NativeFn('Math.round', 1),
		random: NativeFn('Math.random', 0),
		rnd: NativeFn('Math.random', 0),
		rand: NativeFn('Math.random', 0),
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
	
	eproto.addVar = function(name) {
		dieIfBadId(this, name);
		this.vars.push(name);
	};
	
	eproto.addFn = function(name, fn) {
		dieIfBadId(this, name);
		this.fns[name] = fn;
	};
	
	eproto.addConst = function(name, val) {
		dieIfBadId(this, name);
		this.consts[name] = val;
	};
	
	eproto.addAddOp = function(name, fn) {
		dieIfBadOp(this, name, fn);
		this.addops[name] = fn;
	};
	
	eproto.addMulOp = function(name, fn) {
		dieIfBadOp(this, name, fn);
		this.mulops[name] = fn;
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
		return this.addops.hasOwnProperty(name);
	};
	
	eproto.isMulOp = function(name) {
		return this.mulops.hasOwnProperty(name);
	};
	
	eproto.getFnVal = function(name) {
		if(this.isMulOp(name)) return this.mulops[name];
		if(this.isAddOp(name)) return this.addops[name];
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
		
		if(!env.noArityCheck && fn.length != 2)
			throw new Error('Operators must take exactly 2 arguments');
	}
	
	return Environment;
})();

/** lexer.js **/

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

var Lex = (function() {
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

/** parser.js **/

var Parse = (function() {
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
		return this.root.type != 'var' &&
		       (this.isLeaf() || areConstant(this.children));
	};
	
	function areConstant(pts) {
		for(var i = 0; i < pts.length; i++)
			if(!pts[i].isConstant()) return false;
			
		return true;
	}

	return function(env, tokens) {
		var toks = tokens.slice(),
			pt = parseE(env, toks);
		
		if(toks.length > 0)
			throw new Error('Unexpected token(s) after end of expression');
		
		return pt;
	};
	
	function parseE(env, tokens) {
		var eparse = parseTM(env, tokens);
			
		while(tokens.length > 0 && tokens[0].type == 'addop') {
			var temppt = eparse;
			eparse = ParseTree(tokens.shift(), [temppt, parseTM(env, tokens)]);
		}
		
		return eparse;
	}
	
	function parseTM(env, tokens) {
		var tmparse = parseF(env, tokens);
		
		while(tokens.length > 0 && tokens[0].type == 'mulop') {
			var temppt = tmparse;
			tmparse = ParseTree(tokens.shift(), [temppt, parseF(env, tokens)]);
		}
		
		return tmparse;
	}
	
	function parseF(env, tokens) {
		var fparse;
		
		if(tokens.length === 0)
			throw new Error('Expected a factor');
		
		if(tokens[0].type == 'negate')
			fparse = ParseTree(tokens.shift(), [parseF(env, tokens)]);
		else {
			fparse = parseDAT(env, tokens);
			
			if(tokens.length > 0 && tokens[0].type == 'pow') {
				var temppt = fparse;
				fparse = ParseTree(tokens.shift(), [temppt, parseF(env, tokens)]);
			}
		}
		
		return fparse;
	}
	
	function parseFN(env, tokens) {
		var head = eatMandToken(tokens, 'fn', 'function name'),
			fnparse = ParseTree(head, []);
		
		eatMandToken(tokens, 'lp', 'left parenthesis', 'Functions must be followed by an opening parenthesis');

		if(tokens[0].type == 'rp')
			tokens.shift();
		else {
			fnparse.children.push(parseE(env, tokens));
			head.val.argCount++;
			
			while(tokens[0].type != 'rp') {
				eatMandToken(tokens, 'comma', 'comma', 'Too few arguments to a function?');
				fnparse.children.push(parseE(env, tokens));
				head.val.argCount++;
			}
			
			eatMandToken(tokens, 'rp', 'right parenthesis', 'Too many arguments to a function?');
		}
		
		if(!env.noArityCheck) {
			if(head.val.envVal.lengthIsMinimum) {
				if(head.val.argCount < head.val.envVal.length)
					throw new Error('Invalid number of arguments to ' + head.val.name + ': expected at least ' + head.val.envVal.length + ' but got ' + head.val.argCount);
			}
			else if(head.val.argCount != head.val.envVal.length)
				throw new Error('Invalid number of arguments to ' + head.val.name + ': expected ' + head.val.envVal.length + ' but got ' + head.val.argCount);
		}
		
		return fnparse;
	}
	
	function parseDAT(env, tokens) {
		if(tokens.length === 0)
			throw new Error('Expected a datum');
		
		switch(tokens[0].type) {
			case 'var':
			case 'num':
			case 'const':
				return ParseTree(tokens.shift());
				
			case 'fn':
				return parseFN(env, tokens);
				
			case 'lp':
				tokens.shift();
				var eparse = parseE(env, tokens);
				eatMandToken(tokens, 'rp', 'right parenthesis', 'Mismatched parentheses');
				return eparse;
				
			default:
				throw new Error('Expected a datum');
		}
	}
	
	function eatMandToken(tokens, type, friendly, hint) {
		if(tokens.length === 0 || tokens[0].type != type) {
			var errStr = 'Expected ' + (friendly || type);
			if(hint) errStr += ' - ' + hint;
			throw new Error(errStr);
		}
		
		return tokens.shift();
	}
})();

/** expr.js **/

var Expr = (function() {
	function compile() {
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
		
		return Compile(env, Parse(env, Lex(env, s)));
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
		
		return Compile(env, Parse(env, Lex(env, s))).apply(null, vals);
	}
	
	return {
		compile: compile,
		oneshot: oneshot
	};
})();

/** compiler.js **/

var Compile = (function() {
	return function(env, parseTree) {
		// tokToStr assumes the name of the environment inside the string
		// function body will be 'env'. This is a safe assumption until we
		// compile with Closure, where we loose that guarantee.
		// So here we force it back to having that name in the eval. A little
		// janky, but not terrible.
		
	    var args = env.vars.join(','),
	        body = 'var env = arguments[0]; (function(' + args + ') { return ' + ptToStr(env, parseTree) + '; })';
	    
	    return eval(body);
	};
	
	function tokToStr(env, tok) {
		var s;
		
		if(tok.val instanceof FnCall) {
			if(tok.val.envVal instanceof NativeFn)
				return tok.val.envVal.name;
			if(tok.val.envVal instanceof NativeOp)
				return tok.val.envVal.name;
		}
		
		switch(tok.type) {
			case 'num':
			case 'const':
				return tok.val.toString();
			
			case 'var':
				return tok.val;
				
			case 'negate':
			case 'pow':
				return 'env["' + tok.val.name + '"]';
			
			case 'mulop': s = 'mulops'; break;
			case 'addop': s = 'addops'; break;
			case 'fn': s = 'fns'; break;
		}
		
		return 'env.' + s + '["' + tok.val.name + '"]';
	}
	
	function tokIsFn(tok) {
		return tok.val instanceof FnCall && !(tok.val.envVal instanceof NativeOp);
	}
	
	function tokIsNativeOp(tok) {
		return tok.val instanceof FnCall && tok.val.envVal instanceof NativeOp;
	}
	
	function ptToStr(env, pt, optimize) {
		var rootIsFn = tokIsFn(pt.root),
			rootIsOp = tokIsNativeOp(pt.root),
			s = tokToStr(env, pt.root),
			t;
		
		if(rootIsFn)
			s += '(';
		else if(rootIsOp) {
			t = s;
			s = '(';
		}
		
		if(optimize !== false && pt.isConstant()) {
		    // Yes, this is glorified eval().
		    // Same Closure issue as above; we need to get the environment into
		    // the eval'ed code with the literal name 'env'.
			var evalFn = new Function('env', 'return ' + ptToStr(env, pt, false));
			
			return evalFn(env).toString();
		}
		else if(rootIsOp) {
			if(pt.children.length == 1)
				s += t + ptToStr(env, pt.children[0]);
			else if(pt.children.length == 2)
				s += ptToStr(env, pt.children[0]) + ' ' + t + ' ' + ptToStr(env, pt.children[1]);
			else
				throw new Error('Invalid parse tree; a native operator was specified with ' + pt.children.length + ' arguments');
		}
		else if(pt.children) {
			for(var i = 0; i < pt.children.length; i++) {
				s += ptToStr(env, pt.children[i]);
				
				if(rootIsFn && i != pt.children.length - 1)
					s += ', ';
			}
		}
		
		if(rootIsFn || rootIsOp)
			s += ')';
			
		return s;
	}
})();

    return { Expr: {
                compile: Expr.compile,
                oneshot: Expr.oneshot,
                
                Compile: Compile,
                
                NativeOp: NativeOp,
                NativeFn: NativeFn,
                Environment: Environment,
                
                Lex: Lex,
                Token: Token,
                FnCall: FnCall,
             
                Parse: Parse }
           };
})();
