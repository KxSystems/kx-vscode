outer:{[a;b]
  c:a+b;
  inner:{[x] y:x*2; {z+1}[y]};
  r:0; do[3; r:r+inner c];
  if[r>10; r:10; s:1];
  $[r>5; t:1; t:2];
  f[a; b];
  r}
.ns.g:{x+1}
\d .q2
h::{[p] q:p; .ns.g q}
k:{x}
\d .
each[{x+1}; til 3]
m:1; n:2; o:{x+y}[m;n]
w:{[x]
  v:{[y]
    {[z] z}[y]};
  v x}
