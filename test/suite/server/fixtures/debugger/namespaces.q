root:1
\d .foo
helper:{[x] x*2}
scale:3
use1:helper 4
\d .bar
helper:9
other:helper
\d .
tail:.foo.helper 5
