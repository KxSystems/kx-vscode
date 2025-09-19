.load.dyn[] / File reload OK
\d .struct
DEFAULT_TABULAR_LIMIT: 600000;
TABULAR_LIMIT: DEFAULT_TABULAR_LIMIT^"J"$getenv `TABULAR_LIMIT;
PRIMCODE: `undefined`boolean`guid`undefined`byte`short`int`long`real`float`char`symbol`timestamp`month`date`datetime`timespan`minute`second`time`enum;
NONPRIMCODE:
	`general`booleans`guids`undefined`bytes`shorts`ints`longs`reals`floats`chars`symbols`timestamps`months`dates`datetimes`timespans`minutes`seconds`times,
	(57#`enum),
	`compoundGeneral`compoundBoolean`compoundGuid`compoundUndefined`compoundByte`compoundShort`compoundInt`compoundLong`compoundReal`compoundFloat,
	`compoundChar`compoundSymbol`compoundTimestamp`compoundMonth`compoundDate`compoundDatetime`compoundTimespan`compoundMinute`compoundSecond,
	`compoundTime`compoundEnum`table`dictionary`lambda`unary`binary`ternary`projection`composition,
	`$("f'";"f/";"f\\";"f':";"f/:";"f\\:";"dynamicload")
toString: {[data]
 text : .Q.s data;
 : $[all text in " \r\n";
 .Q.s1[data] , "\n"; // The newline is for consistency, as .Q.s adds this, but .Q.s1 doesn't
 text];
 }
typeOf: {$[0>type x; PRIMCODE neg type x; NONPRIMCODE type x]}
isAtom: {not type[x] within 0 99h}
isKeyed: {$[99h~type x;(98h~type key x)&98h~type value x;0b]}
isDict: {$[99h~type x;not isKeyed x;0b]}
isNumber: {abs[type[x]] within abs[5 9h]}
removeTrailingNewline: {[text]
 if ["\n" = last text;
 text: -1 _ text];
 text
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
 NONPRIMCODE type data];
 values: ('[removeTrailingNewline; toString] each data);
 values: $[isAtomic and (1 >= count data); enlist values; values];
 formatData: $[1 ~ count data; enlist data; data];
 order:@[{iasc x}; formatData; {"Not Yet Implemented for the input"}];
 returnDictionary: `name`type`values`order!(name;types;values;order);
 if[isKey; returnDictionary[`isKey]: isKey];
 if[attributes <> `; returnDictionary[`attributes]: attributes];
 :returnDictionary
 }
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
toStructuredText:{[data; sampleFn]
 itemLimit: TABULAR_LIMIT;
 if[not isNumber itemLimit; itemLimit: DEFAULT_TABULAR_LIMIT];
 isTable: .Q.qt data;
 isDict: 99h ~ type data;
 isEmpty: {0 ~ count x};
 warnings: ();
 truncateSize: $[
 isTable;
 ceiling itemLimit%count cols data;
 isDict;
 ceiling itemLimit%2;
 itemLimit
 ];
 if[not isEmpty data;
 if[(sum count each data) > truncateSize;
 data: sample["first";truncateSize;data];
 warnings,: enlist "Results truncated to TABULAR_LIMIT. Console view is faster for large data."
 ];
 ];
 isAtom: .struct.isAtom data;
 originalType: .struct.typeOf data;
 quantity: count data; 
 data: sampleFn data; 
 if[(type data) ~ 10h; data: enlist data];
 columns: $[
 isKeyed data; // keyed tables
 raze (generateTableColumns[::;0b;1b;key data]; generateTableColumns[::;0b;0b;value data]);
 isDict; // dictionaries
 (generateColumns[::;0b;1b;key data;"key"]; generateColumns[::;0b;0b;value data;"values"]);
 isTable; // unkeyed tables
 generateTableColumns[originalType;isAtom;0b;data];
 enlist generateColumns[originalType;isAtom;0b;data;"values"]
 ];
 `count`columns`warnings!(quantity; columns;warnings)
 }
