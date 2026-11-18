system "d .sd"
sdfun:{"in-sd"}
system "d ."
system "l syslib.q"
r:syshelper 2
nested:{system "d .inside"; 1}
z:nested[]
afterNested:4
