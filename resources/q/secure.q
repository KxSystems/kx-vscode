// A file to mimic a locked-down process
\l resources/q/vscode.q

\d .secure

// Calls to named functions are allowed
// (`func; args1; args2)
// ("func"; args1; args2)

// Everything else is blocked
// "1+2"
// ({x+y}; 1; 2)

allowedNames: (".vscode.getManifest"; ".vscode.listMem"; ".vscode.evaluateQ");

isVariable: {(first[x] in .Q.a,.Q.n,".") and (all 1 _ x in .Q.an,".") and not x ~ enlist "."};

handleIPC:{[request]
    // Rule: Expressions (e.g. "1+1" or `$"func[]"), either as strings or symbols, are Administrator only
    if [type[request] <> 0h;
        ' "Only calls to named functions are allowed"];
    
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


// TODO: We must make it clear that to use this feature, if they have their own .z.ps and .z.pg, they need to have it call .vscode.handleIncoming
.z.pg: .z.ps: .secure.handleIPC;
