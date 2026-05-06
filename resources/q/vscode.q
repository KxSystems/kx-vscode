// The default q IPC handler is value, so a remote process can be passed strings, symbols, function calls
// 0i "two: 1 + 1"
// 0i `two
// 0i (`add; 1; 2)
// or other types, as covered here https://code.kx.com/q/ref/value/#value

// To secure remote processes, inputs should be limited to function calls, such as 0i (`add; 1; 2)
// where the function and arguments can be validated before execution.

// Since the VS Code extension allows user to execute arbitrary strings,
// there needs to be a function to execute the expression and format the results,
// while allowing the remote process owner to limit which expressions can be run.

// .vscode.evaluateQ and .vscode.evaluatePy evaluate q and Python respsectively.
// These can be modified by the process owner to enforce any restrictions.

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
    // TBD This is going to me more complicated, since the result formatting is tightly integrated with the Python code evaluation
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
