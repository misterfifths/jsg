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