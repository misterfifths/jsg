#!/bin/bash

awk 'FNR==1 { print "\n/** " FILENAME " **/\n" }1' {environment,lexer,parser,compiler,expr}.js |
sed -e '/%CODE%/{r /dev/stdin
d
}' jsg.js.template > build/jsg.js && 
closure-compiler --language_in=ECMASCRIPT5_STRICT --js build/jsg.js --js_output_file build/jsg.min.js
