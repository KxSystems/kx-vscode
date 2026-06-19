.debug.bps:([]file:`$();line:`int$();enabled:0#0b);
.debug.paused:0b;
.debug.stepMode:`none;
.debug.currentLocals:`$()!();
.debug.currentFile:"";
.debug.currentLine:0;

.debug.send:{-1"__DBG__:",.j.j x;};

.debug.str:{
  $[x~(::);"::";
    10h=type x;x;
    98h=type x;"[table]";
    99h=type x;.j.j x;
    100h<=type x;"[function]";
    @[.j.j;x;{"[error]"}]]};

.debug.checkBp:{[fp;ln]
  f:`$fp;
  any((.debug.bps`file)=f)&((.debug.bps`line)=ln)&.debug.bps`enabled};

.debug.bp:{[file;line;locals]
  if[.debug.checkBp[file;line] or `over=.debug.stepMode;
    .debug.paused:1b;
    .debug.stepMode:`none;
    .debug.currentLocals:locals;
    .debug.currentFile:file;
    .debug.currentLine:line;
    .debug.send`event`reason`file`line!("stopped";"breakpoint";file;line);
    .debug.waitForCmd[];
    .debug.paused:0b]};

.debug.readLines:{
  raw:read0 0;
  lines:$[10h=type raw;"\n" vs raw;raw];
  lines where 0<count each lines};

.debug.setBreakpoints:{[cmd]
  file:`$cmd`file;
  rawlines:cmd`lines;
  lines:`int$$[0>type rawlines;enlist rawlines;rawlines];
  .debug.bps::.debug.bps where not(.debug.bps[`file])=file;
  if[count lines;
    .debug.bps,:([]file:count[lines]#file;line:lines;enabled:count[lines]#1b)];
  .debug.send`event`file`lines!("setBreakpointsResponse";string file;lines)};

.debug.doLaunch:{[cmd]
  file:cmd`file;
  .debug.send`event`data!("launched";file);
  @[system;("l ",file);{[e].debug.send`event`msg!("runtimeError";e)}];
  .debug.send`event`data!("terminated";"")};

.debug.sendVariables:{
  locs:@[{.debug.str each x};.debug.currentLocals;{()!()}];
  globs:@[{[_]
    k:key `.;
    gvals:@[get;;{""}]each k;
    mask:not 99h=type each gvals;
    (k where mask)!.debug.str each gvals where mask
    };(::);{()!()}];
  .debug.send`event`locals`globals!("variables";locs;globs)};

.debug.sendStack:{
  .debug.send`event`data!("stackTrace";"")};

.debug.sendEval:{[cmd]
  expr:cmd`expression;
  res:.[{[locs;e]
    s:$[-10h=type e;enlist e;10h=type e;e;string e];
    sym:`$s;
    $[any sym=key locs;locs sym;@[value;s;{x}]]
    };(.debug.currentLocals;expr);{x}];
  .debug.send`event`result!("evaluate";.debug.str res)};

.debug.handleSetupCmd:{[line]
  if[0=count line;:0b];
  cmd:.j.k line;
  c:cmd`cmd;
  $[c~"setBreakpoints";[.debug.setBreakpoints[cmd];0b];
    c~"clearBreakpoints";[.debug.bps::.debug.bps where 0b;0b];
    c~"launch";[.debug.doLaunch[cmd];1b];
    [.debug.send`event`msg!("log";"unknown setup cmd: ",c);0b]]};

.debug.handlePausedCmd:{[line]
  if[0=count line;:0b];
  cmd:.j.k line;
  c:cmd`cmd;
  $[c~"continue";1b;
    c~"stepOver";[.debug.stepMode:`over;1b];
    c~"variables";[.debug.sendVariables[];0b];
    c~"stackTrace";[.debug.sendStack[];0b];
    c~"evaluate";[.debug.sendEval[cmd];0b];
    [.debug.send`event`msg!("log";"unknown cmd: ",c);0b]]};

.debug.setupLoop:{
  done:0b;
  while[not done;
    lines:.debug.readLines[];
    if[0=count lines;:[]];  
    done:any .debug.handleSetupCmd each lines]};

.debug.waitForCmd:{
  done:0b;
  while[not done;
    lines:.debug.readLines[];
    if[0=count lines;:[]];  
    done:any .debug.handlePausedCmd each lines]};

.debug.send`event`data!("ready";"");
.debug.setupLoop[];
