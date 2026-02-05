\d .vscode

version: 1.0f

getManifest:{[]
    `version`features!(version; `evaluateQ`listMem)
    }

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
evaluateQ: {[args]
    evaluator: $[`customQEvaluator in key .vscode;
        .vscode.customQEvaluator;
        {[args] .vscode.i.formatQ[args] .vscode.i.evaluateQ args}];
    evaluator args
}s