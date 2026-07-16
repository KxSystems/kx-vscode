/ ============================================================================
/ Sample q program for the VS Code q debugger.
/ ----------------------------------------------------------------------------
/ Open this file, choose a REPL, and start debugging ("Run and Debug" /
/ F5). Each section points out a debugger feature to try; suggested breakpoint
/ lines are marked  <-- BREAKPOINT.
/ ----------------------------------------------------------------------------
/ Features exercised: breakpoints, Step Over / Into / Out, the Locals view
/ (params + locals of the current frame, including a stepped-into callee),
/ Watch / hover evaluation, control-construct stepping, and debugging code
/ defined under a namespace.
/ NOTE: a line containing only "/" starts a q block comment - avoid it here.
/ ============================================================================

/ Everything below is defined under the `.stats` namespace, so the functions
/ become `.stats.scale`, `.stats.summary`, ... The debugger resolves the
/ qualified names automatically for breakpoints, locals and stepping.
\d .stats

/ A global helper. At the `scale[...]` call site inside `summary`, Step Into
/ (F11) descends here; Step Out (Shift+F11) returns to the caller. Its params
/ (x, factor) and local (base) show up in the Locals view while you are here.
scale:{[x;factor]
  base:x*factor;
  base+factor }

/ The main entry point. Put a breakpoint on the first line and drive it with
/ Step Over (F10): the Locals view fills in as each local is assigned.
summary:{[xs]
  n:count xs;                     / <-- BREAKPOINT: step over (F10) from here
  total:sum xs;                   / long local
  mean:total%n;                   / float local
  size:$[n>10;`large;`small];     / $[...] conditional, one statement

  / A named local lambda. Step Into (F11) on `bump[...]` descends into it;
  / a breakpoint on its body line also stops here. (Keep nested lambdas free
  / of local assignments so their entry breakpoints fire.)
  bump:{
    x+1 };
  bumped:bump total;

  / Step Into `scale[...]` to enter the global helper defined above.
  scaled:scale[total;2];

  / Loops written on single lines: Step Over advances one statement / one
  / iteration at a time (the loop counter is stepped over, not stopped on).
  acc:0;
  do[n;acc:acc+1];
  while[acc>0;acc:acc-1];

  / A dictionary and a table local. Large values are summarized in the Locals
  / view (type/count) rather than serialized in full.
  result:`n`total`mean`max`size!(n;total;mean;max xs;size);
  rows:([] x:xs; doubled:2*xs);
  result }

/ `each` applies a lambda per element. `divide` is a named local lambda, so a
/ breakpoint on its body line stops once per element, and Step Into works.
normalise:{[xs]
  hi:max xs;
  divide:{[v;mx]
    v%mx };            / <-- BREAKPOINT: stops once per element
  divide[;hi] each xs }

/ An error breaks into the debugger too: uncomment the next line and the
/ session stops on the signal, with the failing frame on the call stack.
/ boom:{[x] x+`sym };

\d .

/ ----------------------------------------------------------------------------
/ Top-level driver. The calls below trigger the breakpoints above. While
/ paused, add a Watch on `total`, `result`, or `rows`, or hover a variable.
/ ----------------------------------------------------------------------------
sample:10 4 7 3 9 1 6;
stats:.stats.summary sample;
scaled:.stats.normalise sample;
stats
