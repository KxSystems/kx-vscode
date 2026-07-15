/ q debugger support helpers, loaded into the debuggee before the user program.
/ These assist the VS Code debug adapter (see src/classes/qDebugDriver.ts) with
/ operations the native debugger does not expose directly. All live under .dbg.
/ NOTE: never leave a line containing only "/" here - q treats it as the start of
/ a multi-line comment block (ended only by a lone "\") and would swallow the rest.

/ (Breakpoint placement is done by the adapter: it traps the function entry with
/ .dbg.bs and single-steps to the requested line using q's reported backtrace
/ line, so no static bytecode->line map is needed here.)

/ Resolve a (possibly deeply nested) lambda from a globally-named function `nm`
/ and a `path` of source-order child-lambda indices. A nested lambda is stored as
/ a constant of its parent's `value` (the type-100h elements, in source order), so
/ each path step selects the i-th such constant and recurses into it. An empty
/ path yields the named function itself. Signals if `nm` is unset or the path is
/ invalid (caller treats a signal as "not armable yet" and retries).
/   nm   - the outermost function's name as a symbol (e.g. `g or `.ns.f)
/   path - int list of child-lambda indices; () for the function itself
.dbg.nested:{[nm;path]
  {[f;i] c:value f; c (where 100h=type each c) i}/[get nm; (),path] };

/ Arm an entry-trap (bytecode index 0) on the lambda at (nm;path). The trap is set
/ on the function's embedded instance in place - q shares the nested-lambda
/ constant by reference - so calling the outer function suspends inside the nested
/ lambda with a correct nested backtrace frame.
.dbg.bs:{[nm;path] .Q.bs[.dbg.nested[nm;path]; 0] };

/ Recover the lambda at (nm;path): remove its entry-trap and restore the original
/ bytecode (.Q.bd is unreliable on current KDB-X, so .Q.bu is used).
.dbg.bu:{[nm;path] .Q.bu[.dbg.nested[nm;path]; 0] };

/ Parameter and local names of a lambda, as a JSON array of strings, for the
/ debugger's Locals scope. `value f` layout: index 1 is the params, index 2 the
/ locals (both symbol vectors). Resolves the function by name and degrades to an
/ empty array for anything that is not a lambda or whose shape is unexpected.
/ The JSON is WRITTEN to stdout (neg[1]) rather than returned: a returned string
/ would be display-formatted at the prompt and elided at the console width (\c),
/ truncating the JSON the adapter parses; handle writes are never truncated.
/   nm - the function's name as a symbol (e.g. `g or `.ns.f)
.dbg.locals:{[nm]
  f:@[get;nm;::];
  neg[1] $[100h = type f;
    .j.j string @[{raze (value x) 1 2};f;`$()];
    .j.j `$()];
  };

/ Frame-locals dict rendered as JSON and written to stdout (neg[1], untruncated;
/ see .dbg.locals). The adapter calls this with a dict built as a bare expression
/ in the suspended frame, so the values are the live frame locals. Any value
/ larger than .dbg.cap serialized bytes (-22!) is replaced by a type/count
/ summary, so a huge table or vector is never serialized in full; a value whose
/ size cannot be probed is summarized too. A total failure writes nothing and
/ the adapter falls back to querying each name individually.
.dbg.cap:16384;
.dbg.val:{[v]
  $[.dbg.cap >= @[{-22!x};v;{0W}];
    v;
    "<",string[type v],"h type; ",string[count v]," count; too large to display>"] };
.dbg.vals:{[d]
  @[{neg[1] .j.j x};.dbg.val each d;::];
  };
