{[ctx; code]
 if [-10h ~ type ctx;
 ctx: enlist ctx];
 toString: {[data]
 text : .Q.s data;
 : $[all text in " \r\n";
 .Q.s1[data] , "\n"; 
 text];
 };
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
 result: .Q.trp[{[expr] `result`errored`error`backtrace!({$[x ~ (::); (::); x]} value expr; 0b; ""; ())};
 expr;
 {[suffix; prefix; err; backtrace]
 if [err ~ enlist " ";
 err: "syntax error"];
 userCode: (-1 + last where (.Q.trp ~ first first @) each backtrace) # backtrace;
 callstack: {`name`text`index!(x[1;0]; x[1;3]; x 2)} each userCode;
 callstack[-1 + count callstack; `text]: (neg count suffix) _ (count prefix) _ (last callstack) `text;
 callstack[-1 + count callstack; `index]-: count prefix;
 (!) . flip (
 (`result;    ::);
 (`errored;   1b);
 (`error;     err);
 (`backtrace; callstack))
 }[suffix; prefix]];
 if [isLastLine or result`errored;
 system "d ", cachedCtx;
 : result];
 index +: 1];
 };
 result: evalInContext[ctx; splitExpression stripTrailingSemi wrapLines removeMultilineComments code];
 if [not result `errored;
 result[`result]: toString result `result];
 result
 }
