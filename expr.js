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
            
            Token: Token,
            TokenType: TokenType,
            FnCall: FnCall
        }
    };
})();