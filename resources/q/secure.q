// A file to mimic a locked-down process.
// This is for testing only, and is not sufficient to secure a production process

// \l resources/q/vscode.q

\d .secure

// Calls to named functions are allowed
// (`func; args1; args2)
// ("func"; args1; args2)

// Everything else is blocked
// "1+2"
// ({x+y}; 1; 2)

allowedNames: $[`vscode in key `;
    ".vscode.",/:string key[.vscode] except ``i;
    ()];

isVariable: {(first[x] in .Q.a,.Q.n,".") and (all 1 _ x in .Q.an,".") and not x ~ enlist "."};

handleIPC: {[request]
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

.z.pg: .z.ps: .secure.handleIPC;
