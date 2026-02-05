{[args; result]
    toString: {[data]
    text : .Q.s data;
    : $[all text in " \r\n";
    .Q.s1[data] , "\n"; 
    text];
    };
    removeTrailingNewline: {[text]
    if ["\n" = last text;
    text: -1 _ text];
    text
    };
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
    };
    generateColumns:{[removeTrailingNewline; toString; originalType; isAtomic; isKey; data; name]
    attributes: attr data;
    types: $[
    isAtomic;
    originalType;
    originalType ~ `chars;
    `chars;
    .axq.i_NONPRIMCODE type data];
    values: ('[removeTrailingNewline; toString] each data);
    values: $[isAtomic and (1 >= count data); enlist values; values];
    formatData: $[1 ~ count data; enlist data; data];
    order:@[{iasc x}; formatData; {"Not Yet Implemented for the input"}];
    returnDictionary: `name`type`values`order!(name;types;values;order);
    if[isKey; returnDictionary[`isKey]: isKey];
    if[attributes <> `; returnDictionary[`attributes]: attributes];
    :returnDictionary
    }[removeTrailingNewline;toString];
    generateTableColumns:{[generateColumns; originalType; isAtom; isKey; data]
    if [.Q.qp data;
    ' "Partitioned tables cannot be displayed in this view"];
    if [0b ~ .Q.qp data;
    ' "This view is not supported for splayed tables"];
    generateColumns[originalType; isAtom; isKey] ./: flip (value; key) @\: flip data
    }[generateColumns];
    toStructuredText:{[generateTableColumns; generateColumns; sample; data; sampleFn]
    DEFAULT_TABULAR_LIMIT: 600000;
    TABULAR_LIMIT: DEFAULT_TABULAR_LIMIT^"J"$getenv `TABULAR_LIMIT;
    isNumber: {abs[type[x]] within abs[5 9h]};
    itemLimit: TABULAR_LIMIT;
    if[not isNumber itemLimit; itemLimit: DEFAULT_TABULAR_LIMIT];
    isEmpty: {0 ~ count x};
    warnings: ();
    isTable: .Q.qt data;
    isDict: 99h ~ type data;
    truncateSize: $[isTable;ceiling itemLimit%count cols data;isDict;ceiling itemLimit%2;itemLimit];
    if[not isEmpty data;if[(sum count each data) > truncateSize;data: sample["first";truncateSize;data];warnings,: enlist "Results truncated to TABULAR_LIMIT. Console view is faster for large data."];];
    typeOf: {$[0>type x; .axq.i_PRIMCODE neg type x; .axq.i_NONPRIMCODE type x]};
    isAtom: {not type[x] within 0 99h};
    isAtom: isAtom data;
    originalType: typeOf data;
    quantity: count data;
    data: sampleFn data;
    if[(type data) ~ 10h; data: enlist data];
    columns: $[
    isTable and isDict;
    raze (generateTableColumns[::;0b;1b;key data]; generateTableColumns[::;0b;0b;value data]);
    isDict;
    (generateColumns[::;0b;1b;key data;"key"]; generateColumns[::;0b;0b;value data;"values"]);
    isTable;
    generateTableColumns[originalType;isAtom;0b;data];
    enlist generateColumns[originalType;isAtom;0b;data;"values"]
    ];
    : .j.j `count`columns`warnings!(quantity; columns;warnings)
    }[generateTableColumns; generateColumns; sample];

    if [result`error;
        :result];
    if [args[`returnFormat] ~ "text";
        result[`data]: toString result `data];
    if [args[`returnFormat] ~ "structuredText";
        result[`data]: toStructuredText[result`data; args[`sampleFn]]];
    result
    }