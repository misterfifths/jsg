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
		
        var nargs = head.val.envVal.length,
            argsAreMin = head.val.envVal.lengthIsMinimum,
            pendingComma = false;
        
        while(tokens.length > 0 && tokens[0].type != TokenType.RP &&
              (argsAreMin || head.val.argCount < nargs))
        {
            fnparse.children.push(parseE(env, tokens));
            head.val.argCount++;
            pendingComma = false;
            
            if(head.val.argCount < nargs) {
                // We require more arguments. Eat a comma and go around again.
                eatMandToken(tokens, TokenType.Comma, 'comma', 'Too few arguments to ' + head.val.name + '? Expecting ' + (argsAreMin ? ' at least ' : '') + nargs + ' but got ' + head.val.argCount);
                pendingComma = true;
            }
            else if(argsAreMin && tokens.length > 0 && tokens[0].type == TokenType.Comma) {
                // We seem to have more arguments. Eat the comma and go around again.
                tokens.shift();
                pendingComma = true;
            }
        }
        
        // If everything ended but we just ate a comma, that's an error.
        // For example: max(1, 2,
        if(pendingComma)
            throw new Error('Expected an expression after comma');
        
        if(argsAreMin && head.val.argCount < nargs)
            throw new Error('Invalid number of arguments to ' + head.val.name + ': expected at least ' + nargs + ' but got ' + head.val.argCount);
        
        if(!argsAreMin && head.val.argCount != nargs)
            throw new Error('Invalid number of arguments to ' + head.val.name + ': expected ' + nargs + ' but got ' + head.val.argCount);
        
        eatRPWithInsertion(tokens, 'Too many arguments to ' + head.val.name + '? Expected ' + nargs, env);
        
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
				eatRPWithInsertion(tokens, 'Mismatched parentheses', env);
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
	
	function eatRPWithInsertion(tokens, hint, env) {
	    // Emulate the TI-calculator's behavior of adding in missing close
	    // parentheses if we've hit the end of the input.
	    if(!env.noAutoParens && tokens.length === 0)
            return Token(TokenType.RP);
        
        return eatMandToken(tokens, TokenType.RP, 'right parenthesis', hint);
	}
})();