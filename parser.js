var parse = (function() {
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
		return this.root.type != TokenType.Var &&
		       !(this.root.type == TokenType.Fn && this.root.val.envVal.nondeterministic) &&
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
			
		while(tokens.length > 0 && tokens[0].type == TokenType.AddOp) {
			var temppt = eparse;
			eparse = ParseTree(tokens.shift(), [temppt, parseTM(env, tokens)]);
		}
		
		return eparse;
	}
	
	function parseTM(env, tokens) {
		var tmparse = parseF(env, tokens);
		
		while(tokens.length > 0 && tokens[0].type == TokenType.MulOp) {
			var temppt = tmparse;
			tmparse = ParseTree(tokens.shift(), [temppt, parseF(env, tokens)]);
		}
		
		return tmparse;
	}
	
	function parseF(env, tokens) {
		var fparse;
		
		if(tokens.length === 0)
			throw new Error('Expected a factor');
		
		if(tokens[0].type == TokenType.Negate)
			fparse = ParseTree(tokens.shift(), [parseF(env, tokens)]);
		else {
			fparse = parseDAT(env, tokens);
			
			if(tokens.length > 0 && tokens[0].type == TokenType.Pow) {
				var temppt = fparse;
				fparse = ParseTree(tokens.shift(), [temppt, parseF(env, tokens)]);
			}
		}
		
		return fparse;
	}
	
	function parseFN(env, tokens) {
		var head = eatMandToken(tokens, TokenType.Fn, 'function name'),
			fnparse = ParseTree(head, []);
		
		eatMandToken(tokens, TokenType.LP, 'left parenthesis', 'Functions must be followed by an opening parenthesis');

		if(tokens[0].type == TokenType.RP)
			tokens.shift();
		else {
			fnparse.children.push(parseE(env, tokens));
			head.val.argCount++;
			
			while(tokens[0].type != TokenType.RP) {
				eatMandToken(tokens, TokenType.Comma, 'comma', 'Too few arguments to a function?');
				fnparse.children.push(parseE(env, tokens));
				head.val.argCount++;
			}
			
			eatMandToken(tokens, TokenType.RP, 'right parenthesis', 'Too many arguments to a function?');
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
			case TokenType.Var:
			case TokenType.Num:
			case TokenType.Const:
				return ParseTree(tokens.shift());
				
			case TokenType.Fn:
				return parseFN(env, tokens);
				
			case TokenType.LP:
				tokens.shift();
				var eparse = parseE(env, tokens);
				eatMandToken(tokens, TokenType.RP, 'right parenthesis', 'Mismatched parentheses');
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