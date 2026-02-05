{[args]
  ctx:args`ctx;
  code:args`code;
  returnFormat:args`returnFormat;

  if [`histogram in key `.qp;
  if [not `display2 in key `.qp; 
  .qp.display2: (')[{x[`output][`bytes]}; .qp.display]
  ]]; 
  if [-10h ~ type ctx;
  ctx: enlist ctx];
  removeMultilineComments: {[text]
  text: "\n" , text;
  lines: (where text = "\n") cut text;
  potentialStart: where lines like "\n/*";
  start: potentialStart where all each (2_/:lines potentialStart) in "\t ";
  potentialEnd: where lines like "\n\\*";
  end: 1 + potentialEnd where all each (2_/:lines potentialEnd) in "\t ";
  lines[0]: 1 _ lines[0];
  boundaries: (`start,' start), (`end,' end);
  boundaries: boundaries iasc boundaries[;1];
  if [`end ~ first first boundaries;
  : "\n" sv (boundaries[0;1] - 1) # lines];
  filteredList: ();
  lastBoundary: `end;
  index: 0;
  do [count boundaries;
  if [lastBoundary <> first boundaries index;
  lastBoundary: first boundaries index;
  filteredList,: enlist boundaries index];
  index+: 1];
  result: raze first each 2 cut raze each (0, filteredList[;1]) cut lines;
  : $[result ~ ();
  "";
  result];
  };
  tokenize: {[text]
  parsed: -4!text;
  cmtInd: where ((1 < count each parsed) & parsed[;0] in "/ \t\n") & not  parsed ~\: "/:";
  parsed[cmtInd] : (parsed[cmtInd]?\:"/")#'parsed[cmtInd];
  parsed where (0 <> count each parsed)
  };
  stripTrailingSemi: {[tokenize; str]
  str: tokenize str;
  $[  ("" ~ str) or (() ~ str);
  "";
  {(neg sum &\[reverse x in "\r\n; \t"]) _ x} trim raze str]
  } tokenize;
  splitExpression: {[expr]
  tokens: -4!expr;
  newlines: where enlist["\n"] ~/: tokens;
  : "c"$raze each (0 , 1 + newlines where not tokens[1 + newlines] in enlist each " \t\r\n") _ tokens
  };
  fixSpecialSyntax: {[stripTrailingSemi; expr]
  escape: {[str]
  chars: (`char$til 255)!(string each `char$til 255);
  chars[("\\";"\"";"\t";"\n";"\r")]: ("\\\\";"\\\"";"\\t";"\\n";"\\r");
  : raze chars str;
  };
  $[  
  expr like "[kq])*";
  "value \"",(2#expr), escape[stripTrailingSemi 2_expr], "\";";
  expr like "\\*";
  "system \"", escape[trim 1_expr], "\";";
  {s:rtrim first l:(0,x ss "::")_x; (1<count l) & (all s in .Q.an) and 0 < count s} expr;
  "value \"", escape[trim expr], "\";";
  expr like "[a-zA-Z])*";
  "value \"",(2#expr), escape[2_expr], "\";";
  expr]
  } stripTrailingSemi;
  wrapLines: {[fixSpecialSyntax; expn]
  tokenizeAndSplit: {[expn]
  : $[.z.K <= 3.4;
  "\n" vs expn;
  [   
  tokens: -4!"\n" , expn;
  tokens: raze {[token; isMerged]
  $[  isMerged;
  (enlist "\n"; 1 _ token);
  enlist token]
  } ./: flip (tokens; tokens like "\n/*");
  "" sv/: 1_/:(where tokens ~\: enlist "\n") cut tokens]];
  };
  lines: @[tokenizeAndSplit;
  expn;
  {[expn; err] "\n" vs expn} expn];
  lines:{[acc; line]
  $[  0 = count acc;
  acc,: enlist line;
  (last[acc] like "[a-zA-Z])*") and line[0] in " \t/";
  [   acc[count[acc] - 1]: last[acc],"\n",line;
  acc];
  acc,: enlist line]
  }/[();] lines;
  : "\n" sv fixSpecialSyntax each lines;
  } fixSpecialSyntax;
  evalInContext: {[ctx; expressions]
  cachedCtx: string system "d";
  system "d ", ctx;
  index: 0;
  do [count expressions;
  expr: expressions index;
  isLastLine: (index + 1) = count expressions;
  if ["\n" ~ last expr;
  expr: -1_expr];
  prefix: ";[::;";
  suffix: $[(not isLastLine) and not ";" ~ last expr; ";]"; "]"];
  expr: prefix , expr , suffix;
  result: .Q.trp[{[expr] `data`error`errorMsg`stacktrace!({$[x ~ (::); (::); x]} value expr; 0b; ""; ())};
  expr;
  {[suffix; prefix; err; stacktrace]
  if [err ~ enlist " ";
  err: "syntax error"];
  userCode: (-1 + last where (.Q.trp ~ first first @) each stacktrace) # stacktrace;
  userCode[;3]: reverse 1 + til count userCode;
  userCode[-1 + count userCode; 1; 3]: (neg count suffix) _ (count prefix) _ userCode[-1 + count userCode; 1; 3];
  userCode[-1 + count userCode; 2]-: count prefix;
  (!) . flip (
  (`data;    ::);
  (`error;   1b);
  (`errorMsg;     err);
  (`stacktrace; .Q.sbt userCode))
  }[suffix; prefix]];
  if [isLastLine or result`error;
  system "d ", cachedCtx;
  : result];
  index +: 1];
  };
  .axq.i_PRIMCODE: `undefined`boolean`guid`undefined`byte`short`int`long`real`float`char`symbol`timestamp`month`date`datetime`timespan`minute`second`time`enum;
  .axq.i_NONPRIMCODE:
  `general`booleans`guids`undefined`bytes`shorts`ints`longs`reals`floats`chars`symbols`timestamps`months`dates`datetimes`timespans`minutes`seconds`times,
  `enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum,
  `enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum,
  `enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum,
  `compoundGeneral`compoundBoolean`compoundGuid`compoundUndefined`compoundByte`compoundShort`compoundInt`compoundLong`compoundReal`compoundFloat,
  `compoundChar`compoundSymbol`compoundTimestamp`compoundMonth`compoundDate`compoundDatetime`compoundTimespan`compoundMinute`compoundSecond,
  `compoundTime`compoundEnum`table`dictionary`lambda`unary`binary`ternary`projection`composition,
  `$("f'";"f/";"f\\";"f':";"f/:";"f\\:";"dynamicload");
  typeOf: {$[0>type x; .axq.i_PRIMCODE neg type x; .axq.i_NONPRIMCODE type x]};
  isAtom: {not type[x] within 0 99h};
  evalInContext[ctx; splitExpression stripTrailingSemi wrapLines removeMultilineComments code]
  }
