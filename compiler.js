var Compile = (function() {
	return function(env, parseTree) {
		var s = ptToStr(env, parseTree),
			varStr = env.vars.join(', '),
			f;
		
		eval('f = function(' + varStr + ') { return ' + s + '; };');
		return f;
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
			t = ptToStr(env, pt, false);
			return eval(t).toString();
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