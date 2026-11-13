noop:{[q] q+0};
h:{[z]
  a:z+1;
  a+2};
g:{[y]
  r:h[y*2];
  r:noop r;
  r+1};
f:{[x]
  s:g[x+1];
  s:noop s;
  s+1};
f[5];
exit 0;
