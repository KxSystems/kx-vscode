// To secure remote processes, IPC calls are often limited to calls to named functions, e.g. 0i (`add; 1; 2)
// where the function and arguments can be validated before execution.

// This extension will normally send requests over as a lambda and its arguments,
// but to support connecting to processes which only allow calls to named functions,
// these functions must already exist in that process. This file defines all the functions required by the extension.

// Since the VS Code extension allows user to execute arbitrary strings,
// there exists a hook .vscode.customQEvaluator which can be defined to take over execution of requests from the extension,
// allowing requests to be rejected, modified, or to allow processing of the result.

// The public API that must be allowed for IPC calls is any function in .vscode, except those under .vscode.i
\d .vscode

version: "1.0.0"

getManifest:{[]
    `version`features!(version; `evaluateQ`listMem)
    }

reservedWords: {.Q.res}

getViews: {views[]}

i.evaluateQ: //{{resources/q/evaluateQ.q}}


i.formatQ: //{{resources/q/formatQ.q}}

i.evaluatePy: {[args]
    // TBD
    }
i.formatPy: {[args]
    // TBD
    }

listMem: //{{resources/q/listMem.q}}

// entrypoint for IPC calls
// This is the function that the remote process owner needs to mark as allowed
runQQuery: {[args]
    // TODO document the properties of args, so people know how to write customQEvaluator functions
    // args contains `ctx and `code, and non-public properties for formatting the results
    
    cachedContext: string system "d";
    system "d " , args`ctx;

    evaluator: $[`customQEvaluator in key .vscode;
        {@[.vscode.customQEvaluator; x; {`data`error`errorMsg!(::; 1b; x)}]};
        i.evaluateQ];
    
    result: .vscode.i.formatQ[args] evaluator args;
    
    system "d " , cachedContext;

    result
    }

// Here's an example of a .vscode.customQEvaluator function
// args contains `ctx and `code, and non-public properties for formatting the results
// .vscode.customQEvaluator: {[args]
//     tree: parse args`expression;
//
//     if [type[tree] <> -11h;
//         ' "Only variable names are permitted"];
//  
//     // Don't let the user see the secret table
//     if [tree ~ `secretTable;
//         ' "The secret table is off-limits!"];
//
//     result: reval parse tree;
//
//     // Don't let the user see the secret rows
//     result[`data]: delete from result`data where isSecret;
//
//     result
//     }
