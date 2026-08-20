# exec.py — sample used by the REPL execution tests.
# It never runs to completion on a REPL: the extension wraps Python for pykx,
# and a plain q process has no pykx loaded.

alpha = "ALPHA_PY"
bravo = "BRAVO_PY"

print(alpha, bravo)
