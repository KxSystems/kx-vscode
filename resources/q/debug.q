.dbg.out:{neg[1] .j.j x;};

.dbg.named:{x where not x ~\: `};

.dbg.file:{[f] v:value f; v -3+count v};

.dbg.name:{[f] v:value f; v -4+count v};

.dbg.children:{[f]
  p:.dbg.file f;
  c:value f;
  c where {[p;x] $[100h=type x; p~.dbg.file x; 0b]}[p] each c };

.dbg.nested:{[nm;path]
  {[f;i] .dbg.children[f] i}/[get nm; (),path] };

.dbg.lookup:{[nm;path] .[.dbg.nested;(nm;path);::] };

.dbg.traceName:{[nm;path]
  f:.dbg.lookup[nm;path];
  .dbg.out $[100h=type f; [n:.dbg.name f; $[10h=type n; n; ""]]; ""] };

.dbg.functionsIn:{[nsstr]
  ks:.dbg.named key `$nsstr;
  raze {[nsstr;k]
    full:nsstr,".",string k;
    v:@[get;`$full;(::)];
    $[100h=type v; enlist full; 99h=type v; .dbg.functionsIn full; ()]
    }[nsstr] each ks };

.dbg.moduleNamespaces:{[]
  ks:key `.;
  ks:ks where ks like "0*";
  ks:ks where {99h = type @[get;x;(::)]} each ks;
  enlist[".m"], string ks };

.dbg.resolveName:{[file;leaf]
  rootv:@[get;`$leaf;(::)];
  hit:$[100h=type rootv; file ~ .dbg.file rootv; 0b];
  res:$[hit; leaf;
    [nms:raze @[.dbg.functionsIn;;()] each .dbg.moduleNamespaces[];
     info:{[nm] f:get `$nm; (nm; .dbg.name f; .dbg.file f)} each nms;
     ok:where {[i;file;leaf] (10h=type i 1) and (i[2]~file) and leaf~last "." vs i 1}[;file;leaf] each info;
     paths:info[ok][;0];
     $[count paths; first paths iasc count each paths; ""]]];
  .dbg.out res };

.dbg.bs:{[nm;path] .Q.bs[.dbg.nested[nm;path]; 0] };

.dbg.bu:{[nm;path] .Q.bu[.dbg.nested[nm;path]; 0] };

.dbg.trapped:{[nm;path]
  f:.dbg.lookup[nm;path];
  $[100h=type f; 0xff = first (value f) 0; 0b]
  };

.dbg.childIndex:{[nm;f]
  first where f ~/: .dbg.children get nm };

.dbg.locals:{[nm;path]
  f:.dbg.lookup[nm;path];
  .dbg.out $[100h = type f; string @[{raze (value x) 1 2};f;`$()]; `$()] };

.dbg.cap:16384;
.dbg.val:{[v]
  $[.dbg.cap >= @[{-22!x};v;{0W}];
    v;
    "<",string[type v],"h type; ",string[count v]," count; too large to display>"] };
.dbg.vals:{[d]
  @[.dbg.out;.dbg.val each d;::];
  };

.dbg.globalNames:{[ns]
  ns:(),ns;
  names:$[ns ~ enlist "."; key `.; `$(ns,"."),/:string .dbg.named key `$ns];
  .dbg.out string .dbg.named names };

.dbg.src:{[nm;path]
  f:.dbg.lookup[nm;path];
  .dbg.out $[100h = type f; string f; ""] };

.dbg.v:(::);
.dbg.pop:{r:.dbg.v; .dbg.v::(::); r};
.dbg.ns:"";
.dbg.popNs:{r:.dbg.ns; .dbg.ns::""; .dbg.out r};
.dbg.wraps:{[s]
  p:@[parse;s;{`.dbg.noparse}];
  if[`.dbg.noparse~p; :0b];
  if[0>type p; :1b];
  h:first p;
  if[$[-11h=type h; h in `if`while`do; 0b]; :0b];
  if[(3=count p) and (type h) within 100 112h; if[":"=last string h; :0b]];
  1b };

.dbg.pc:{
  fs:.Q.btx .Q.Ll`;
  i:1+first where {".Q.dbg"~x[1;0]} each fs;
  v:$[i<count fs; fs[i;0]; ()];
  .dbg.out $[2=count v; (v 1; $[100h=type v 0; count first value v 0; -1]; count[fs]-i; fs[i;2]); -1 -1 -1 0];
  };
