.dbg.file:{[f] v:value f; v -3+count v};

.dbg.kids:{[f]
  p:.dbg.file f;
  c:value f;
  c where {[p;x] $[100h=type x; p~.dbg.file x; 0b]}[p] each c };

.dbg.nested:{[nm;path]
  {[f;i] .dbg.kids[f] i}/[get nm; (),path] };

.dbg.bktname:{[nm;path]
  f:.[.dbg.nested;(nm;path);::];
  neg[1] .j.j $[100h=type f; [v:value f; n:v[-4+count v]; $[10h=type n; n; ""]]; ""];
  };

.dbg.walkm:{[nsstr]
  ks:key `$nsstr;
  ks:ks where not ks ~\: `;
  raze {[nsstr;k]
    full:nsstr,".",string k;
    v:@[get;`$full;(::)];
    $[100h=type v; enlist full; 99h=type v; .dbg.walkm full; ()]
    }[nsstr] each ks };

.dbg.modns:{[]
  ks:key `.;
  ks:ks where ks like "0*";
  ks:ks where {99h = type @[get;x;(::)]} each ks;
  enlist[".m"], string ks };

.dbg.bkname:{[file;leaf]
  rootv:@[get;`$leaf;(::)];
  hit:$[100h=type rootv; file ~ (value rootv)@ -3+count value rootv; 0b];
  res:$[hit; leaf;
    [nms:raze @[.dbg.walkm;;()] each .dbg.modns[];
     info:{[nm] iv:value get `$nm; (nm; iv[-4+count iv]; iv[-3+count iv])} each nms;
     ok:where {[i;file;leaf] (10h=type i 1) and (i[2]~file) and leaf~last "." vs i 1}[;file;leaf] each info;
     paths:info[ok][;0];
     $[count paths; first paths iasc count each paths; ""]]];
  neg[1] .j.j res;
  };

.dbg.bs:{[nm;path] .Q.bs[.dbg.nested[nm;path]; 0] };

.dbg.bu:{[nm;path] .Q.bu[.dbg.nested[nm;path]; 0] };

.dbg.trapped:{[nm;path]
  f:.[.dbg.nested;(nm;path);::];
  $[100h=type f; 0xff = first (value f) 0; 0b]
  };

.dbg.childidx:{[nm;f]
  first where f ~/: .dbg.kids get nm };

.dbg.locals:{[nm;path]
  f:.[.dbg.nested;(nm;path);::];
  neg[1] $[100h = type f;
    .j.j string @[{raze (value x) 1 2};f;`$()];
    .j.j `$()];
  };

.dbg.cap:16384;
.dbg.val:{[v]
  $[.dbg.cap >= @[{-22!x};v;{0W}];
    v;
    "<",string[type v],"h type; ",string[count v]," count; too large to display>"] };
.dbg.vals:{[d]
  @[{neg[1] .j.j x};.dbg.val each d;::];
  };

.dbg.globalNames:{[ns]
  ns:(),ns;
  names:$[ns ~ enlist ".";
    key `.;
    [ks:key `$ns; ks:ks where not ks ~\: `; `$(ns,"."),/:string ks]];
  neg[1] .j.j string names where not names ~\: `; };

.dbg.src:{[nm;path]
  f:.[.dbg.nested;(nm;path);::];
  neg[1] .j.j $[100h = type f; string f; ""];
  };

.dbg.v:(::);
.dbg.pop:{r:.dbg.v; .dbg.v::(::); r};
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
  neg[1] .j.j $[2=count v; (v 1; $[100h=type v 0; count first value v 0; -1]; count[fs]-i; fs[i;2]); -1 -1 -1 0];
  };
