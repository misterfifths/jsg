var ParseTree = (function() {
    var ParseTree = function(root, children) {
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
    
    function prettyPrint(pt, indent, isLast, isRoot) {
        var s = indent;
        
        if(!isRoot) {
            if(isLast) {
                s += '\\-';
                indent += '  ';
            }
            else {
                s += '|-';
                indent += '| ';
            }
        }
        
        s += pt.root.toString() + '\n';
        
        if(pt.children) {
            for(var i = 0; i < pt.children.length; i++)
                s += prettyPrint(pt.children[i], indent, i == pt.children.length - 1);
        }
        
        return s;
    }
    
    ParseTree.prototype.toString = function() {
        return prettyPrint(this, '', false, true);
    };
    
    return ParseTree;
})();

var parse = (function() {
    return function(env, tokens) {
        var toks = tokens.slice(),
            pt = parseE(env, toks);
        
        if(toks.length > 0)
            throw parseError('Unexpected token(s) after end of expression.', toks[0].rangeInInput.start);
        
        return pt;
    };
    
    function parseErrorAtToken(token, message) {
        return parseError(message, token.rangeInInput.start, token.rangeInInput.end);
    }
    
    function parseErrorAtEnd(message) {
        return parseError('Unexpected end of expression: ' + message);
    }
    
    function parseE(env, tokens) {
        var eparse = parseTM(env, tokens);
            
        while(tokens.length > 0 && tokens[0].type == TokenType.AddOp) {
            var temppt = eparse;
            eparse = new ParseTree(tokens.shift(), [temppt, parseTM(env, tokens)]);
        }
        
        return eparse;
    }
    
    function parseTM(env, tokens) {
        var tmparse = parseF(env, tokens);
        
        while(tokens.length > 0 && tokens[0].type == TokenType.MulOp) {
            var temppt = tmparse;
            tmparse = new ParseTree(tokens.shift(), [temppt, parseF(env, tokens)]);
        }
        
        return tmparse;
    }
    
    function parseF(env, tokens) {
        var fparse;
        
        if(tokens.length === 0)
            throw parseErrorAtEnd('Expected a factor.');
        
        if(tokens[0].type == TokenType.Negate)
            fparse = new ParseTree(tokens.shift(), [parseF(env, tokens)]);
        else {
            fparse = parseDAT(env, tokens);
            
            if(tokens.length > 0 && tokens[0].type == TokenType.Pow) {
                var temppt = fparse;
                fparse = new ParseTree(tokens.shift(), [temppt, parseF(env, tokens)]);
            }
        }
        
        return fparse;
    }
    
    function parseFN(env, tokens) {
        var head = eatMandToken(tokens, TokenType.Fn, 'function name'),
            fnparse = new ParseTree(head, []);
        
        eatMandToken(tokens, TokenType.LP, 'left parenthesis', 'Functions must be followed by an opening parenthesis.');
        
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
                eatMandToken(tokens, TokenType.Comma, 'comma', 'Too few arguments to "' + head.val.name + '"? Expected ' + (argsAreMin ? 'at least ' : '') + nargs + ' but got ' + head.val.argCount + '.');
                pendingComma = true;
            }
            else if(argsAreMin && tokens.length > 0 && tokens[0].type == TokenType.Comma) {
                // We seem to have more arguments. Eat the comma and go around again.
                tokens.shift();
                pendingComma = true;
            }
        }
        
        // We may have broken out with a right paren (or end of input) and too few arguments.
        if((argsAreMin && head.val.argCount < nargs) || (!argsAreMin && head.val.argCount != nargs)) {
            var argCountDesc = (argsAreMin ? 'at least ' : '') + nargs,
                message = 'Too few arguments to "' + head.val.name + '"? Expected ' + argCountDesc + ' but got ' + head.val.argCount;
            
            if(tokens.length === 0)
                throw parseErrorAtEnd(message);
            
            throw parseErrorAtToken(tokens[0], message);
        }
        
        // If everything ended but we just ate a comma, that's an error.
        // For example: max(1, 2,
        if(pendingComma)
            throw parseErrorAtEnd('Expected an expression after comma.');
        
        eatRPWithInsertion(tokens, 'Too many arguments to "' + head.val.name + '"? Expected ' + nargs + '.', env);
        
        return fnparse;
    }
    
    function parseDAT(env, tokens) {
        if(tokens.length === 0)
            throw parseErrorAtEnd('Expected a datum.');
        
        switch(tokens[0].type) {
            case TokenType.Var:
            case TokenType.Num:
            case TokenType.Const:
                return new ParseTree(tokens.shift());
                
            case TokenType.Fn:
                return parseFN(env, tokens);
                
            case TokenType.LP:
                tokens.shift();
                var eparse = parseE(env, tokens);
                eatRPWithInsertion(tokens, 'Mismatched parentheses.', env);
                return eparse;
                
            default:
                throw parseErrorAtToken(tokens[0], 'Expected a datum.');
        }
    }
    
    function eatMandToken(tokens, type, friendly, hint) {
        if(tokens.length === 0 || tokens[0].type != type) {
            var errStr = 'Expected ' + (friendly || type) + '.';
            if(hint) errStr += ' ' + hint;
            
            if(tokens.length === 0)
                throw parseErrorAtEnd(errStr);
            
            throw parseErrorAtToken(tokens[0], errStr);
        }
        
        return tokens.shift();
    }
    
    function eatRPWithInsertion(tokens, hint, env) {
        // Emulate the TI-calculator's behavior of adding in missing close
        // parentheses if we've hit the end of the input.
        if(env.options.autoParens && tokens.length === 0)
            return new Token(TokenType.RP);  // TODO: it's ok that this doesn't have a rangeInInput, right?
        
        return eatMandToken(tokens, TokenType.RP, 'right parenthesis', hint);
    }
})();