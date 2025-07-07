\d .com_kx_edi
toStructuredText:{[data; quantity; isAtom; originalType]
 if[(type data) ~ 10h; data: enlist data];
 isTable: .Q.qt data;
 isDict: 99h ~ type data;
 columns: $[
 isTable and isDict; // keyed tables
 raze (generateTableColumns[::;0b;1b;key data]; generateTableColumns[::;0b;0b;value data]);
 isDict; // dictionaries
 (generateColumns[::;0b;1b;key data;"key"]; generateColumns[::;0b;0b;value data;"values"]);
 isTable; // unkeyed tables
 generateTableColumns[originalType;isAtom;0b;data];
 enlist generateColumns[originalType;isAtom;0b;data;"values"]
 ];
 : .j.j `count`columns!(quantity; columns)
 }
generateTableColumns:{[originalType; isAtom; isKey; data]
 if [.Q.qp data;
 ' "Partitioned tables cannot be displayed in this view"];
 if [0b ~ .Q.qp data; // true for splayed tables
 ' "This view is not supported for splayed tables"];
 generateColumns[originalType; isAtom; isKey] ./: flip (value; key) @\: flip data
 }
generateColumns:{[originalType; isAtomic; isKey; data; name]
 attributes: attr data;
 types: $[
 isAtomic;
 originalType;
 originalType ~ `chars;
 `chars;
 i_NONPRIMCODE type data];
 values: ('[removeTrailingNewline; toString] each data);
 values: $[isAtomic and (1 >= count data); enlist values; values];
 formatData: $[1 ~ count data; enlist data; data];
 order:@[{iasc x}; formatData; {"Not Yet Implemented for the input"}];
 returnDictionary: `name`type`values`order!(name;types;values;order);
 if[isKey; returnDictionary[`isKey]: isKey];
 if[attributes <> `; returnDictionary[`attributes]: attributes];
 :returnDictionary
 }
i_PRIMCODE: `undefined`boolean`guid`undefined`byte`short`int`long`real`float`char`symbol`timestamp`month`date`datetime`timespan`minute`second`time`enum;
i_NONPRIMCODE:
 `general`booleans`guids`undefined`bytes`shorts`ints`longs`reals`floats`chars`symbols`timestamps`months`dates`datetimes`timespans`minutes`seconds`times,
 `enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum,
 `enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum,
 `enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum`enum,
 `compoundGeneral`compoundBoolean`compoundGuid`compoundUndefined`compoundByte`compoundShort`compoundInt`compoundLong`compoundReal`compoundFloat,
 `compoundChar`compoundSymbol`compoundTimestamp`compoundMonth`compoundDate`compoundDatetime`compoundTimespan`compoundMinute`compoundSecond,
 `compoundTime`compoundEnum`table`dictionary`lambda`unary`binary`ternary`projection`composition,
 `$("f'";"f/";"f\\";"f':";"f/:";"f\\:";"dynamicload")
typeOf: {$[0>type x; i_PRIMCODE neg type x; i_NONPRIMCODE type x]}
isAtom: {not type[x] within 0 99h}
sample: {[sampleFn; sampleSize; data]
 sampleSize: min (sampleSize; count data);
 fn: $[  sampleFn ~ "random";
 {[sampleSize; data]
 $[  type[data] ~ 99h;
 [   ii: neg[sampleSize]?count data;
 (key[data] ii)!value[data]ii];
 neg[sampleSize]?data]
 };
 sampleFn ~ "first"; #;
 sampleFn ~ "last";  {neg[x]#y};
 ' "Unrecognized sample function"];
 fn[sampleSize; data]
 }
removeTrailingNewline: {[text]
 if ["\n" = last text;
 text: -1 _ text];
 text
 }
toString: {[data]
 text : .Q.s data;
 : $[all text in " \r\n";
 .Q.s1[data] , "\n"; // The newline is for consistency, as .Q.s adds this, but .Q.s1 doesn't
 text];
 }
i.removeMultilineComments: {[text]
 text: "\n" , text;
 lines: (where text = "\n") cut text;
 potentialStart: where lines like "\n/*";
 start: potentialStart where all each (2_/:lines potentialStart) in "\t ";
 potentialEnd: where lines like "\n\\*";
 end: 1 + potentialEnd where all each (2_/:lines potentialEnd) in "\t ";
 lines[0]: 1 _ lines[0];
 boundaries: (`start,' start), (`end,' end);
 boundaries: boundaries iasc boundaries[;1];
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
 }
i.tokenize: {[text]
 parsed: -4!text;
 cmtInd: where ((1 < count each parsed) & parsed[;0] in "/ \t\n") & not  parsed ~\: "/:";
 parsed[cmtInd] : (parsed[cmtInd]?\:"/")#'parsed[cmtInd];
 :parsed where (0 <> count each parsed)
 }
i.stripTrailingSemi: {[str]
 trimTermWS: {[str]
 r: reverse str;
 while [(0 < count r) and (r [0] in "\r\n; \t");
 r: 1 _ r];
 : reverse r;
 };
 if [-10h ~ type str;
 str: string str];
 if [not 10h ~ type str;
 : `InvalidInput];
 str: i.tokenize str;
 if [("" ~ str) or (() ~ str);
 : ""];
 : trimTermWS trim raze str;
 }
i.splitExpression: {[expr]
 tokens: -4!expr;
 newlines: where enlist["\n"] ~/: tokens;
 "c"$raze each (0 , 1 + newlines where not tokens[1 + newlines] in enlist each " \t\r\n") _ tokens
 }
i.wrapLines: {[ctx; expn]
 tokenizeAndSplit: {[expn]
 : $[.z.K <= 3.4;
 "\n" vs expn;
 [   // This needs to have a newline prefixed, as this gets split on newlines,
 tokens: -4!"\n" , expn;
 "" sv/: 1_/:(where tokens like\: "\n*") cut tokens]];
 };
 lines: @[tokenizeAndSplit;
 expn;
 {[expn; e] "\n" vs expn}[expn]];
 mergeDsl:{[acc; line]
 $[0 = count acc;
 acc,: enlist line;
 (last[acc] like "[a-zA-Z])*") and (line[0] in " \t/");
 [acc[count[acc] - 1]: last[acc],"\n",line;acc];
 acc,: enlist line]
 };
 lines: mergeDsl/ [();] lines;
 : "\n" sv i.exprType each (ctx;) each lines;
 }
i.exprType: {[args]
 ctx: args 0;
 expn: args 1;
 if [`ExprHooks in key i;
 hs    : value i.ExprHooks;
 match : where hs[;0] .\: (ctx; expn);
 if [count match;
 : hs[first match][1][ctx; expn]]];
 : expn;
 }
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
 userCode[;3]: reverse 1 + til count userCode;
 userCode[-1 + count userCode; 1; 3]: (neg count suffix) _ (count prefix) _ userCode[-1 + count userCode; 1; 3];
 userCode[-1 + count userCode; 2]-: count prefix;
 (!) . flip (
 (`result;    ::);
 (`errored;   1b);
 (`error;     err);
 (`backtrace; .Q.sbt userCode))
 }[suffix; prefix]];
 if [isLastLine or result`errored;
 system "d ", cachedCtx;
 : result];
 index +: 1];
 }