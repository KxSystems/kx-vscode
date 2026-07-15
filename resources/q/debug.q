/ q debugger support helpers, loaded into the debuggee before the user program.
/ These assist the VS Code debug adapter (see src/classes/qDebugDriver.ts) with
/ operations the native debugger does not expose directly. All live under .dbg.
/ NOTE: never leave a line containing only "/" here - q treats it as the start of
/ a multi-line comment block (ended only by a lone "\") and would swallow the rest.

/ (Breakpoint placement is done by the adapter: it traps the function entry with
/ .Q.bs[f;0] and single-steps to the requested line using q's reported backtrace
/ line, so no static bytecode->line map is needed here.)

/ User-defined data globals in the root namespace, as a JSON name->repr map, for
/ the debugger's Globals scope. Functions and namespaces (types 100-112h) are
/ excluded. Globals are visible from inside this lambda (unlike frame locals), so
/ it works both at the top-level prompt and while suspended in a function.
.dbg.globals:{[]
  k:key `.;
  v:@[get;;::] each k;
  m:not (type each v) within 100 112h;
  k:k where m; v:v where m;
  .j.j k ! {@[.Q.s1;x;{"?"}]} each v };

/ Parameter and local names of a lambda, as a JSON array of strings, for the
/ debugger's Locals scope. `value f` layout: index 1 is the params, index 2 the
/ locals (both symbol vectors). Resolves the function by name and degrades to an
/ empty array for anything that is not a lambda or whose shape is unexpected.
/   nm - the function's name as a symbol (e.g. `g or `.ns.f)
.dbg.locals:{[nm]
  f:@[get;nm;::];
  $[100h = type f;
    .j.j string @[{raze (value x) 1 2};f;`$()];
    .j.j `$()] };
