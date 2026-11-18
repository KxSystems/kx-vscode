\d .foo
helper:{[x]
  y:x*2;
  y}
\d .
a:1
show .foo.helper 21
