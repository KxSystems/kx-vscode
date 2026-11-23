Consider a secured process that only allows IPC calls to named functions, and only to those functions in a pre-approved list.
To allow the KX extension to connect to this process, the process
- must have loaded vscode.q, to define the endpoints required by the functions
- must allow functions in the .vscode namespace (excluding the nested internal .vscode.i) to be called

The following gives an simplified version of such a process.
Note that this example is a demonstration only, and not intended to provide robust security.

First, generate out/vs-code.q by running
```
$ node build-api.js
```

```q
\l out/vscode.q

\d .secure

// Calls to named functions are allowed
// (`func; args1; args2)
// ("func"; args1; args2)

// Everything else is blocked
// "1+2"
// ({x+y}; 1; 2)

// Any function in the .vscode namespace is allowed
allowedNames: ".vscode.",/:string key[.vscode] except ``i;

// Return 1b if a string is a valid variable name
isVariable: {(first[x] in .Q.a,.Q.n,".") and (all 1 _ x in .Q.an,".") and not x ~ enlist "."};

.z.pg: .z.ps: {[request]
    if [type[request] <> 0h;
        ' "Only calls to named functions are allowed"];
    
    // Normalize function names to strings
    funcName: first request;
    if [type[first request] ~ -11h;
        funcName: string funcName];
    
    if [type[funcName] <> 10h;
        ' "Only calls to named functions are allowed"];
     
    if [not isVariable funcName;
        ' "Only calls to named functions are allowed"];
    
    if [not funcName in allowedNames;
        ' "Specified function is not allowed"];

    : value request;
    }
```

If the process owner wanted to restrict which expressions could be run from VSCode, such as only allowing "select" expressions,
they can define a .vscode.customQEvaluator function which will be called to evaluate each request.
The context will already be set, using the context in args`ctx

Note that this example is a demonstration only, and not intended to provide security.

```q
// @param args        {dict}
// @desc args.ctx     {string} The context to evaluate code in. This will already be set by the parent function.
// @desc args.code    {string} The code to run, which may be one expression, or multiple expressions, as a single string.
// @desc returnFormat {string} The result format requested by the extension. Formatting is handled by the parent function.
//  "text" will return the stringified value
//  "structuredText" will return stringified values in a tabular format, with metadata
//  "serialized" will return the result as a q value
// @returns {any} The result of the code
.vscode.customQEvaluator: {[args]
    tree: parse args`code;

    // Note: This is for demonstration purposes only, and is not sufficient
    // to ensure users can only run select statements.
    $[  (first[tree] ~ (?)) and count[tree] > 3;
        value args`code;
        ' "Expression must be a select"];
     }
```

It's the responsibility of the process owner to ensure .vscode.customQEvaluator is secured,
e.g. that it prevents overwriting .z.ps, .z.pg, or .vscode.customQEvaluator
