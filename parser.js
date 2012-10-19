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
		       !(this.root.type == 'fn' && this.root.val.envVal.nondeterministic) &&
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