/ main.q — a small pricing snippet used by the end to end REPL tests.
/ Every kind of q comment appears here on purpose, so executing the file
/ exercises comment handling as well as the execution paths themselves.

/
  Block comment: everything between a slash on its own line and a backslash
  on its own line is skipped, so nothing written here reaches the REPL.
  BLOCK_COMMENT_MARKER
\

/ Reference data. Assignments print nothing, so none of these show up.
sym:`AAPL           / trailing comment after an assignment
px:172.5            / last traded price
qty:120             / lot size

/ Two statements share this line. The assignment is silent and the bare name
/ prints, so running the line prints once — while running just the block under
/ the cursor runs only the statement the cursor sits in.
notional:px*qty;notional

/ A multi-line expression: the continuation line is indented, so q reads both
/ lines as one statement. The joined string appears only if both were sent.
"NOT",
 "IONAL"

sym                 / prints the symbol

\
Everything below a lone backslash is an exit comment: q stops reading the file
here, so this must never reach the REPL.
EXIT_COMMENT_MARKER
