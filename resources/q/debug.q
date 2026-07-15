/ q debugger support helpers, loaded into the debuggee before the user program.
/ These assist the VS Code debug adapter (see src/classes/qDebugDriver.ts) with
/ operations the native debugger does not expose directly. All live under .dbg.
/ NOTE: never leave a line containing only "/" here - q treats it as the start of
/ a multi-line comment block (ended only by a lone "\") and would swallow the rest.

/ The per-bytecode source-offset map of a function. The element layout of
/ `value f` varies (params/locals/globals presence shifts it), so identify the
/ map robustly: the long (7h) vector whose length equals the bytecode length.
.dbg.posmap:{[f]
  v:value f;
  bc:count first v;
  first v where (7h = type each v) & bc = count each v };

/ Map a 1-based source line (RELATIVE to a function's own definition) to a valid
/ bytecode index on that line, for use with .Q.bs[f;index]; returns -1 when no
/ bytecode maps to the line. Among the bytecodes on a line, pick the one with the
/ greatest source offset: that is the instruction boundary q's debugger stops at.
/ Lower offsets on the same line are mid-instruction bytes (e.g. an assignment
/ colon); trapping there does not stop and can crash q.
/   f  - the function value
/   rl - 1-based line within the function's source (last value f)
.dbg.lineToIndex:{[f;rl]
  pm:.dbg.posmap f;
  src:last value f;
  ln:{[s;o] 1 + sum "\n" = s til o & count s}[src] each pm;
  cand:where ln = rl;
  $[count cand; cand first idesc pm cand; -1] };

/ Number of source lines a function spans (for validating breakpoint lines).
.dbg.lineCount:{[f] 1 + sum "\n" = last value f};

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
