// TODO: these as parts of Environment
var NativeOp = function(name, length) {
	if(!(this instanceof NativeOp))
		return new NativeOp(name, length);

	this.name = name;
	this.length = length;
	this.lengthIsMinimum = false;
	this.nondeterministic = false;
};

var NativeFn = function(name, length, lengthIsMinimum, nondeterministic) {
	if(!(this instanceof NativeFn))
		return new NativeFn(name, length, lengthIsMinimum, nondeterministic);
	
	this.name = name;
	this.length = length;
	this.lengthIsMinimum = !!lengthIsMinimum;
	this.nondeterministic = !!nondeterministic;
};

var Environment = (function() {
	var Environment = function(vars, noImplicitMul, noPowOp, noArityCheck) {
		if(!(this instanceof Environment))
			return new Environment(vars, noImplicitMul, noPowOp, noArityCheck);
	
		this.fns = clone(defFns);
		this.consts = clone(defConsts);
		this.addOps = clone(defAddOps);
		this.mulOps = clone(defMulOps);
		
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
		random: NativeFn('Math.random', 0, false, true),
		rnd: NativeFn('Math.random', 0, false, true),
		rand: NativeFn('Math.random', 0, false, true),
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
	        dieIfBadId(this, name);
        
        this.vars = names.slice(0);
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
		
		if(!env.noArityCheck && fn.length != 2)
			throw new Error('Operators must take exactly 2 arguments');
	}
	
	return Environment;
})();