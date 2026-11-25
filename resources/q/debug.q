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
.dbg.width:1000;
.dbg.size:1000 2000;
.dbg.big:{[v]
  $[.dbg.cap < @[{-22!x};v;{0W}];
    "<",string[type v],"h type; ",string[count v]," count; too large to display>";
    ""] };
.dbg.console:{[hw;f;v;e]
  c:system"c";
  system"c "," " sv string hw;
  r:@[f;v;e];
  system"c "," " sv string c;
  r };
.dbg.flat:{[s]
  $["\n" in s; " " sv {@[x;1_til count x;ltrim]} "\n" vs s except "\r"; s] };
.dbg.line:{[v]
  $[count b:.dbg.big v; b; .dbg.flat .dbg.console[25,.dbg.width;-3!;v;{"'",x}]] };
.dbg.text:{[v]
  if[count b:.dbg.big v; :enlist b];
  t:.dbg.console[.dbg.size;.Q.S[.dbg.size;0];v;{enlist "'",x}];
  t:raze {"\n" vs (),x except "\r"} each t;
  $[all raze[t] in " \n"; enlist .dbg.line v; t] };
.dbg.gen:-1;
.dbg.held:enlist (::);
.dbg.hold:{[g;v]
  if[not g~.dbg.gen; .dbg.gen::g; .dbg.held::enlist (::)];
  .dbg.held::@[.dbg.held,(::);count .dbg.held;:;v];
  -1+count .dbg.held };
.dbg.view:{[g;v]
  l:.dbg.line v;
  t:.dbg.text v;
  (l; $[(1<count t) or not l~first t; .dbg.hold[g;v]; 0]) };
.dbg.vals:{[g;d]
  @[.dbg.out;.dbg.view[g] each d;::];
  };
.dbg.show:{[g;v] .dbg.out .dbg.view[g;v] };
.dbg.rows:{[g;r]
  ok:(g~.dbg.gen) and r within 1,-1+count .dbg.held;
  .dbg.out $[ok; .dbg.text .dbg.held r; ()] };
.dbg.watchable:{[s]
  $[.dbg.wraps s; [p:parse s; not (0h=type p) and ";"~first p]; 0b] };

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

.dbg.frame:{
  fs:.Q.btx .Q.Ll`;
  i:1+first where {".Q.dbg"~x[1;0]} each fs;
  (fs; i; $[i<count fs; fs[i;0]; ()]) };

.dbg.pc:{
  f:.dbg.frame[]; fs:f 0; i:f 1; v:f 2;
  .dbg.out $[2=count v; (v 1; $[100h=type v 0; count first value v 0; -1]; count[fs]-i; fs[i;2]); -1 -1 -1 0];
  };

.dbg.atTrap:{
  v:.dbg.frame[] 2;
  .dbg.out $[(2=count v) and 100h=type v 0; 0xff=(first value v 0) v 1; 0b];
  };
