var compile = (function() {
    function internalCompile(env, parseTree, skipOptimizations) {
		skipOptimizations = !!skipOptimizations;
		
		// envAccumulator becomes a map of all the things used from the
		// Environment in the final compiled form of the function. It is from
		// names in the eval string to the version that reference 'env', so we
		// can reflect them into eval-space in a Closure Compiler-safe way.
		// We have to ensure 'env' is the actual name for env after Closure has
		// its way, though... hence that final variable we add at the end.
		// The names in the eval code are mangled using the function below so
		// we are less likely to get issues if, say, the user names a variable
		// something like "env".
		
	    var args = env.vars.join(','),
	        envAccumulator = {},
	        body = '(function(' + args + ') { return ' + ptToStr(env, parseTree, envAccumulator, !skipOptimizations) + '; })',
	        props = Object.getOwnPropertyNames(envAccumulator);

	    for(var i = 0; i < props.length; i++) {
	        var propName = props[i];
	        body = 'var ' + propName + ' = ' + envAccumulator[propName] + '; ' + body;
	    }
	    
	    if(props.length > 0)
	        body = 'var env = arguments[0]; ' + body;
	    
	    return eval(body);
    }
    
    return internalCompile;
	
	function mangleNameForEval(name) {
	    return '__env_' + name + '__';
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
				return tok.val;
				
			case TokenType.Negate:
			case TokenType.Pow:
			    mangledName = mangleNameForEval(tok.val.name);
			    if(envAccumulator)
                    envAccumulator[mangledName] = 'env["' + tok.val.name + '"]';

			    return mangledName;
			
			case TokenType.MulOp: s = 'mulOps'; break;
			case TokenType.AddOp: s = 'addOps'; break;
			case TokenType.Fn: s = 'fns'; break;
		}
		
		mangledName = mangleNameForEval(tok.val.name);
		
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
			return internalCompile(env, pt, true)().toString();
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
				s += t + ptToStr(env, pt.children[0], envAccumulator);
			else if(pt.children.length == 2)
				s += ptToStr(env, pt.children[0], envAccumulator) + ' ' + t + ' ' + ptToStr(env, pt.children[1], envAccumulator);
			else
				throw new Error('Invalid parse tree; a native operator was specified with ' + pt.children.length + ' arguments');
		}
		else if(pt.children) {
			for(var i = 0; i < pt.children.length; i++) {
				s += ptToStr(env, pt.children[i], envAccumulator);
				
				if(rootIsFn && i != pt.children.length - 1)
					s += ', ';
			}
		}
		
		if(rootIsFn || rootIsOp)
			s += ')';
			
		return s;
	}
})();