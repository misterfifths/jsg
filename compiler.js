var Compile = (function() {
	return function(env, parseTree) {
		// tokToStr assumes the name of the environment inside the string
		// function body will be 'env'. This is a safe assumption until we
		// compile with Closure, where we loose that guarantee.
		// So what we're doing here is making two functions. One takes
		// the environment as an extra argument called 'env'. Then we construct
		// a function that just binds that argument, and return that.
		// Yes, all of this is glorified eval().
		
		var args = env.vars.slice(0);
		args.unshift('env');
		args.push('return ' + ptToStr(env, parseTree) + ';');
		
		var fnWithEnv = Function.apply(null, args);
		
		args.shift();
		
		return function() {
		    // Add back the environment before all the other arguments,
		    // and pass through the value of the real function.
		    
		    var args = Array.prototype.slice.call(arguments);
		    args.unshift(env);
		    return fnWithEnv.apply(null, args);
		};
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