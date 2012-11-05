var Expr = (function() {

    // Parses and compiles a mathematical expression. The return value is a
    // Javascript function that takes as its arguments the variables in the
    // associated Environment, in order.
    //
    // This function can be called with a number of argument combinations:
    // (string[, options])
    //    A new Environment is created with no variables, and string is taken to
    //    be the expression.
    // (string, string[, options])
    //    The first string is taken to be a variable name, which is used to
    //    create a new Environment. The second string is the expression.
    // ([array of strings], string[, options])
    //    The array is taken to be a list of variable names which are used to
    //    create a new environment. The string is the expression.
    // (Environment, string[, options])
    //    The given Environment is used to parse the string expression.
    //
    // Options:
    //    optimize: Perform optimization when compiling (right now, just simple
    //      constant subtree evaluation). Default: true.
    //    debug: Instead of a function, return an object with all the
    //      intermediate work in compiling the expression. Default: false.
    //
    //    The following options have no effect if you pass in an Environment
    //    to the function. Instead, use them when creating the Environment.
    //
    //    autoParens: Automatically complete missing parentheses at the end of
    //      the expression. Default: true.
    //    implicitMul: Insert implicit multiplication in the appropriate
    //      circumstances. Default: true.
    //    powOp: Process the caret (^) as an exponentiation operator. Default:
    //      true.
    function friendlyCompile() {
        var env, s, options, args, debug;
        
        if(arguments.length === 0) throw new Error('Invalid arguments');
        
        args = Array.prototype.slice.apply(arguments);
        
        // Remove the options argument from the end
        if(typeof args[args.length - 1] == 'object') {
            options = args.pop();
            if(args.length === 0) throw new Error('Invalid arguments');
        }
        
        debug = applyDefaults(options, { debug: false }).debug;
        
        // Now, the new last argument must be the expression string
        if(typeof args[args.length - 1] != 'string')
            throw new Error('Invalid arguments');
        
        s = args.pop();
        
        // Ok, now we're down to the argument that determines the environment.
        
        if(args.length === 0) {
            // No variables
            env = new Environment([], options);
        }
        else if(args.length == 1) {
            // 1 argument: either an Environment, a variable name, or an array
            // of variable names.
            if(arguments[0] instanceof Environment)
                env = arguments[0];
            else if(typeof arguments[0] == 'string')
                env = new Environment(arguments[0], options);
            else if(Object.prototype.toString.call(arguments[0]) === '[object Array]')
                env = new Environment(arguments[0], options);
            else
                throw new Error('Invalid arguments');
        }
        else {
            // Too many arguments
            throw new Error('Invalid arguments');
        }
        
        if(!debug) {
            var tokens = lex(env, s),
                parseTree = parse(env, tokens),
                fn = compile(env, parseTree, options);
            
            return fn;
        }
        else {
            var res = { env: env };
            try {
                res.tokens = lex(env, s);
                
                try {
                    res.parseTree = parse(env, res.tokens);
                    
                    try {
                        res.fn = compile(env, res.parseTree, options);
                    }
                    catch(compileError) {
                        compileError.when = 'compile';
                        res.error = compileError;
                    }
                }
                catch(parseError) {
                    parseError.when = 'parse';
                    res.error = parseError;
                }
            }
            catch(lexError) {
                lexError.when = 'lex';
                res.error = lexError;
            }
            
            return res;
        }
    }
    
    // Parses and evaluates a mathematical expression. Unlike friendlyCompile,
    // this function returns a Number, not a function.
    //
    // This function can be called in two ways:
    // (string[, options])
    //    A new Environment is created with no variables, and string is taken to
    //    be the expression.
    // (object, string[, options])
    //    The object is taken to be a map from variable names to their values
    //    (for instance, { x: 2, y: 1 }). A new Environment is created with the
    //    variable names in the object, and the string is taken to be the
    //    expression. It is evaluated using the values in the object.
    //
    // The options are the same as those passed to friendlyCompile.
    function oneshot(vars, s, options) {
        var env,
            vals = [];
            
        if(typeof vars == 'string') {
            // No variables
            options = s;
            s = vars;
            
            env = new Environment(options);
        }
        else {
            var vns = [];
            
            for(var vn in vars) {
                if(vars.hasOwnProperty(vn)) {
                    vns.push(vn);
                    vals.push(vars[vn]);
                }
            }
            
            env = new Environment(vns, options);
        }
        
        var tokens = lex(env, s),
            parseTree = parse(env, tokens),
            fn = compile(env, parseTree, options);
        
        return fn.apply(null, vals);
    }
    
    
    // Assemble the public interface:
    var toExpose = {
        oneshot: oneshot,
        Environment: Environment,
        NativeOp: NativeOp,
        NativeFn: NativeFn,
        
        compile: compile,
        lex: lex,
        parse: parse,
        
        ParseTree: ParseTree,
        Token: Token,
        TokenType: TokenType,
        FnCall: FnCall
    };
    
    for(var key in toExpose) {
        if(toExpose.hasOwnProperty(key))
            friendlyCompile[key] = toExpose[key];
    }
    
    return friendlyCompile;
})();