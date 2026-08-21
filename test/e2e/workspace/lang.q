/ lang.q — the fixture the language server tests drive. Nothing here is
/ incidental: every construct is what one of them asserts on, so changing it
/ changes what they mean.

/
  A block comment. It folds as one range, from the slash on its own line above
  to the backslash on its own line below.
  LANG_BLOCK_MARKER
\

/ A symbol literal carrying forward slashes. If the lexer stopped at the first
/ one, the rest of the file would be read as something else and none of the
/ definitions below would be found.
path:`:/tmp/e2e/lang/data

.e2e.calc:{[qty;px]
  total:qty*px;
  total
  }

.e2e.report:{[]
  .e2e.calc[10;20.5]
  }

.e2e.calc[2;3.5]
