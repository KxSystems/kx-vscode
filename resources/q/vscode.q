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

// Note: This file is built using templates. If these function definitions are just file paths,
// run `node build-api.js` to generate `out/vscode.q`
i.evaluateQ: //{{resources/q/evaluateQ.q}}

i.formatQ: //{{resources/q/formatQ.q}}

i.evaluatePy: {[args]
    // TBD
    }
i.formatPy: {[args]
    // TBD
    }

listMem: //{{resources/q/listMem.q}}

runPyQuery: {[args]
    `data`error`errorMsg!(::; 1b; "Running Python code in secured processes is not yet supported")
    }

// entrypoint for IPC calls
// This is the function that the remote process owner needs to mark as allowed
runQQuery: {[args]
    // TODO document the properties of args, so people know how to write customQEvaluator functions
    // args contains `ctx and `code, and non-public properties for formatting the results
    
    cachedContext: string system "d";
    system "d " , args`ctx;

    evaluator: $[`customQEvaluator in key .vscode;
        {[args]
            @[  {[args] `data`error`errorMsg!(.vscode.customQEvaluator args; 0b; "")};
                args;
                {[err] `data`error`errorMsg!(::; 1b; err)}]};
        i.evaluateQ];
    
    result: .vscode.i.formatQ[args] evaluator args;
    
    system "d " , cachedContext;

    result
    }

// Here's an example of a .vscode.customQEvaluator function that rejects invalid queries, and filters the results.
// It is not intended as an example of how to write a secure .vscode.customQEvaluator.
// secure-processes.md has more details.
//
// .vscode.customQEvaluator: {[args]
//     if [not args[`code] like "select *";
//         ' "Only select statements are allowed"];  
//
//     reval parse args`code
//     }
