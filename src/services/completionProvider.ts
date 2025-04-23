/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import {
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider,
  CompletionList,
  ProviderResult,
} from "vscode";

import { ext } from "../extensionVariables";
import { KdbNode } from "./kdbTreeProvider";

export class CompletionProvider implements CompletionItemProvider {
  provideCompletionItems(): ProviderResult<
    CompletionItem[] | CompletionList<CompletionItem>
  > {
    if (ext.connectionNode instanceof KdbNode) {
      const items: CompletionItem[] = [];
      [ext.functions, ext.tables, ext.variables].forEach((group) =>
        group.forEach((item) =>
          items.push({
            label: item,
            detail: `${ext.connectionNode?.label}`,
            insertText: item,
            kind: CompletionItemKind.Variable,
          }),
        ),
      );
      return items;
    }
    return qLangParserItems.map((item) => {
      item.kind = CompletionItemKind.Variable;
      return item;
    });
  }
}

const qLangParserItems: CompletionItem[] = [
  {
    label: "abs",
    detail: "absolute value",
    documentation: "abs[numbers]",
  },
  {
    label: "acos",
    detail: "arccosine",
    documentation: "acos[numbers]",
  },
  {
    label: "aj",
    detail: "as-of join(boundary time from LHS)",
    documentation: "aj[syms;table;table]",
  },
  {
    label: "aj0",
    detail: "as-of join(actual time from RHS)",
    documentation: "aj0[syms;table;table]",
  },
  {
    label: "ajf",
    detail: "as-of join(only fill null values from LHS)",
    documentation: "ajf[syms;table;table]",
  },
  {
    label: "ajf0",
    detail: "as-of join(only fill null values from RHS)",
    documentation: "ajf0[syms;table;table]",
  },
  {
    label: "all",
    detail: ":true if all true",
    documentation: "all[numbers]",
  },
  {
    label: "and",
    detail: "AND(min)",
    documentation: "and[numbers;numbers]   ",
  },
  {
    label: "any",
    detail: ":true if any true",
    documentation: "any[numbers]",
  },
  {
    label: "asc",
    detail: "ascending sort",
    documentation: "asc[list]",
  },
  {
    label: "asin",
    detail: "arcsine",
    documentation: "asin[numbers]",
  },
  {
    label: "asof",
    detail: "as-of join",
    documentation: "asof[table;<table|dict>]",
  },
  {
    label: "atan",
    detail: "arctangent",
    documentation: "atan[numbers]",
  },
  {
    label: "attr",
    detail: "attribute",
    documentation: "attr[any]",
  },
  {
    label: "avg",
    detail: "arithmetic mean",
    documentation: "avg[numbers]",
  },
  {
    label: "avgs",
    detail: "running average",
    documentation: "avgs[numbers]",
  },
  {
    label: "bin",
    detail: "binary search(<=x)",
    documentation: "bin[numbers!;numbers]",
  },
  {
    label: "binr",
    detail: "binary search right(>=x)",
    documentation: "binr[numbers!;numbers]",
  },
  {
    label: "ceiling",
    detail: "round up",
    documentation: "ceiling[numbers]",
  },
  {
    label: "cols",
    detail: "column names",
    documentation: "cols[table]",
  },
  {
    label: "cor",
    detail: "correlation",
    documentation: "cor[numbers;numbers]",
  },
  {
    label: "cos",
    detail: "cosine",
    documentation: "cos[numbers]",
  },
  {
    label: "count",
    detail: "count items",
    documentation: "count[any]",
  },
  {
    label: "cov",
    detail: "covariance",
    documentation: "cov[numbers;numbers]",
  },
  {
    label: "cross",
    detail: "cross product",
    documentation: "cross[list;list]",
  },
  {
    label: "cut",
    detail: "cut into lists",
    documentation: "cut[ints;list]",
  },
  {
    label: "delete",
    detail: "delete rows or columns from a table",
    documentation: "delete [col1,col2] from t [where cond]",
  },
  {
    label: "deltas",
    detail: "difference between list items",
    documentation: "deltas[<default;>numbers or temporals]",
  },
  {
    label: "desc",
    detail: "descending sort",
    documentation: "desc[list]",
  },
  {
    label: "dev",
    detail: "deviation",
    documentation: "dev[numbers]",
  },
  {
    label: "differ",
    detail: "find changes by comparing to next",
    documentation: "differ[list]",
  },
  {
    label: "distinct",
    detail: "remove duplicates",
    documentation: "distinct[list]",
  },
  {
    label: "div",
    detail: "integer division",
    documentation: "div[numbers;numbers]",
  },
  {
    label: "do",
    detail: "evaluate expression repeatedly",
    documentation: "do[times;e1;e2...]",
  },
  {
    label: "dsave",
    detail: "save global tables to disk",
    documentation: "dsave[hsym;syms]",
  },
  {
    label: "each",
    detail: "each iterator",
    documentation: " each[v1;list]",
  },
  {
    label: "ej",
    detail: "equal join",
    documentation: "ej[syms;table;table]",
  },
  {
    label: "ema",
    detail: "exponential moving average",
    documentation: "ema[smoothing factors;numbers]",
  },
  {
    label: "enlist",
    detail: "make a list",
    documentation: "enlist[any]",
  },
  {
    label: "eval",
    detail: "evaluate a parse tree",
    documentation: "eval[list]",
  },
  {
    label: "except",
    detail: "exclude items",
    documentation: "except[list;exclusions]",
  },
  {
    label: "exec",
    detail: "select rows and columns as a list or dict",
    documentation: "exec col1,col2 [by col3] from t [where cond]",
  },
  {
    label: "exit",
    detail: "terminate with code number",
    documentation: "exit[int]",
  },
  {
    label: "exp",
    detail: "power of the base of the natural logarithm",
    documentation: "exp[numbers]",
  },
  {
    label: "fby",
    detail: "apply aggregate to groups",
    documentation: "(function;list) fby group|([]group1;group2)",
  },
  {
    label: "fills",
    detail: "replace nulls with preceding non-nulls",
    documentation: "fills[list]",
  },
  {
    label: "first",
    detail: "first item",
    documentation: "first[any]",
  },
  {
    label: "fkeys",
    detail: "foreign-key columns",
    documentation: "fkeys[table]",
  },
  {
    label: "flip",
    detail: "transposed",
    documentation: "flip[list|dict|table]",
  },
  {
    label: "floor",
    detail: "round down",
    documentation: "floor[numbers]",
  },
  {
    label: "get",
    detail: "read or memory-map a variable or kdb+ file",
    documentation: "get[sym|file]",
  },
  {
    label: "getenv",
    detail: "get an environment variable",
    documentation: "getenv[sym]",
  },
  {
    label: "group",
    detail: "group items into a dict",
    documentation: "group[list|dict]",
  },
  {
    label: "gtime",
    detail: "convert to UTC",
    documentation: "gtime[timestamps]",
  },
  {
    label: "hclose",
    detail: "close a file or process handle",
    documentation: "hclose[handle]",
  },
  {
    label: "hcount",
    detail: "size of a file in bytes",
    documentation: "hcount[file]",
  },
  {
    label: "hdel",
    detail: "delete a file or folder",
    documentation: "hdel[file|dir]",
  },
  {
    label: "hopen",
    detail: "open a file or process handle",
    documentation: "hopen[file|socket|string<;timeout ms>]",
  },
  {
    label: "hsym",
    detail: "convert to process symbols",
    documentation: "hsym[syms]",
  },
  {
    label: "iasc",
    detail: "ascending grade",
    documentation: "iasc[list]",
  },
  {
    label: "idesc",
    detail: "descending grade",
    documentation: "idesc[list]",
  },
  {
    label: "if",
    detail: "evaluate expressions if true",
    documentation: "if[test;e1;e2...]",
  },
  {
    label: "ij",
    detail: "inner join",
    documentation: "ij[table;table]",
  },
  {
    label: "ijf",
    detail: "inner join(fill null values from RHS)",
    documentation: "ijf[table;table]",
  },
  {
    label: "in",
    detail: "test if items in the list",
    documentation: "in[items;list]",
  },
  {
    label: "insert",
    detail: "insert or append records",
    documentation: "insert[table;records]|insert[undefined sym;table]",
  },
  {
    label: "inter",
    detail: "intersection",
    documentation: "inter[list;list]",
  },
  {
    label: "inv",
    detail: "matrix inverse",
    documentation: "inv[matrix]",
  },
  {
    label: "key",
    detail: "key of a dict",
    documentation: "key[sym|dict]",
  },
  {
    label: "keys",
    detail: "key columns of a table",
    documentation: "keys[table]",
  },
  {
    label: "last",
    detail: "last item",
    documentation: "last[x]",
  },
  {
    label: "like",
    detail: "match text",
    documentation: "like[syms|strings|dict<any!syms|strings>;string]",
  },
  {
    label: "lj",
    detail: "left join",
    documentation: "lj[table;keyed table]",
  },
  {
    label: "ljf",
    detail: "left join(ignore nulls from RHS)",
    documentation: "ljf[table;keyed table]",
  },
  {
    label: "load",
    detail: "load binary file|dir",
    documentation: "load[file|dir]",
  },
  {
    label: "log",
    detail: "natural logarithm",
    documentation: "log[numbers]",
  },
  {
    label: "lower",
    detail: "lower case",
    documentation: "lower[<symbols|strings>]",
  },
  {
    label: "lsq",
    detail: "least squares",
    documentation: "lsq[matrixes;matrixes]",
  },
  {
    label: "ltime",
    detail: "convert to local timestamp",
    documentation: "ltime[ts]",
  },
  {
    label: "ltrim",
    detail: "trim leading spaces",
    documentation: "ltrim[string]",
  },
  {
    label: "mavg",
    detail: "moving average",
    documentation: "mavg[int;numbers]",
  },
  {
    label: "max",
    detail: "maximum",
    documentation: "max[numbers|characters|temporals]",
  },
  {
    label: "maxs",
    detail: "running maximums",
    documentation: "maxs[<default;>numbers|characters|temporals]",
  },
  {
    label: "mcount",
    detail: "moving count",
    documentation: "mcount[int;list]",
  },
  {
    label: "md5",
    detail: "message digest hash",
    documentation: "md5[string]",
  },
  {
    label: "mdev",
    detail: "moving deviations",
    documentation: "mdev[int;numbers]",
  },
  {
    label: "med",
    detail: "median",
    documentation: "med[numbers]",
  },
  {
    label: "meta",
    detail: "metadata for a table",
    documentation: "meta[table]",
  },
  {
    label: "min",
    detail: "minimum",
    documentation: "min[numbers|characters|temporals]",
  },
  {
    label: "mins",
    detail: "running minimums",
    documentation: "maxs[<default;>numbers|characters|temporals]",
  },
  {
    label: "mmax",
    detail: "moving maximums",
    documentation: "mmax[int;numbers|characters|temporals]",
  },
  {
    label: "mmin",
    detail: "moving minimums",
    documentation: "mmin[int;numbers|characters|temporals]",
  },
  {
    label: "mmu",
    detail: "matrix multiply",
    documentation: "mmu[matrix;matrix]",
  },
  {
    label: "mod",
    detail: "modulus",
    documentation: "mod[divisors;dividends]",
  },
  {
    label: "msum",
    detail: "moving sums",
    documentation: "msum[int;numbers|characters|temporals]",
  },
  {
    label: "neg",
    detail: "negate",
    documentation: "neg[numbers]",
  },
  {
    label: "next",
    detail: "shift each to next(last is null)",
    documentation: "next[list]",
  },
  {
    label: "not",
    detail: "1b if non-zero else 0b",
    documentation: "not[numbers]",
  },
  {
    label: "null",
    detail: "is null",
    documentation: "null[x]",
  },
  {
    label: "over",
    detail: "apply progressively and :last evaluation",
    documentation: "over[v1|vv;list]",
  },
  {
    label: "parse",
    detail: "parse a string to ast",
    documentation: "parse[string]",
  },
  {
    label: "peach",
    detail: "each parallel iterator",
    documentation: " x peach list",
  },
  {
    label: "pj",
    detail: "plus join",
    documentation: "pj[table;keyed table]",
  },
  {
    label: "prd",
    detail: "product",
    documentation: "prd[numbers]",
  },
  {
    label: "prds",
    detail: "running products",
    documentation: "prds[numbers]",
  },
  {
    label: "prev",
    detail: "shift each to prev(first is null)",
    documentation: "prev[list]",
  },
  {
    label: "prior",
    detail: "apply to each item and its preceding item",
    documentation: "prior[v2|vv;list]",
  },
  {
    label: "rand",
    detail: "pick randomly",
    documentation: "rand[number]|rand[list]",
  },
  {
    label: "rank",
    detail: "position in the sorted list",
    documentation: "rank[list]",
  },
  {
    label: "ratios",
    detail: "running ratios",
    documentation: "ratios[<default;>numbers]",
  },
  {
    label: "raze",
    detail: "flat a list",
    documentation: "raze[list]",
  },
  {
    label: "read0",
    detail: "read text from a file or process handle",
    documentation: "read0[hsym|(hsym;offset;length)]",
  },
  {
    label: "read1",
    detail: "read bytes from a file or process handle",
    documentation: "read1[hsym|(hsym;offset;length)]",
  },
  {
    label: "reciprocal",
    detail: "reciprocal",
    documentation: "reciprocal[numbers]",
  },
  {
    label: "reval",
    detail: "evaluate a parse tree in read only mode",
    documentation: "reval[list]",
  },
  {
    label: "reverse",
    detail: "reverse a list",
    documentation: "reverse[list]",
  },
  {
    label: "rload",
    detail: "load a splayed table",
    documentation: "rload[dir]",
  },
  {
    label: "rotate",
    detail: "rotate a list",
    documentation: "rotate[int;list]",
  },
  {
    label: "rsave",
    detail: "save as a splayed table to pwd",
    documentation: "rsave[sym]",
  },
  {
    label: "rtrim",
    detail: "trim tailing spaces",
    documentation: "rtrim[string]",
  },
  {
    label: "save",
    detail: "save to pwd",
    documentation: "save[sym]",
  },
  {
    label: "scan",
    detail: "apply progressively and :all evaluations",
    documentation: "scan[v1|vv;list]",
  },
  {
    label: "scov",
    detail: "sample covariance",
    documentation: "scov[numbers;numbers]",
  },
  {
    label: "sdev",
    detail: "sample standard deviation",
    documentation: "sdev[numbers]",
  },
  {
    label: "select",
    detail: "select rows and columns as a table",
    documentation: "select col1,col2 [by col3] from table [where cond]",
  },
  {
    label: "set",
    detail: "assign a value to a variable or file",
    documentation: "set[sym|file|dir;any]",
  },
  {
    label: "setenv",
    detail: "set an environment variable",
    documentation: "setenv[sym;string]",
  },
  {
    label: "show",
    detail: "display at the console",
    documentation: "show[any]",
  },
  {
    label: "signum",
    detail: "sign",
    documentation: "signum[numbers]",
  },
  {
    label: "sin",
    detail: "sine",
    documentation: "sin[numbers]",
  },
  {
    label: "sqrt",
    detail: "square root",
    documentation: "sqrt[numbers]",
  },
  {
    label: "ss",
    detail: "string search",
    documentation: "ss[string;pattern]",
  },
  {
    label: "ssr",
    detail: "string search and replace",
    documentation: "ssr[string;pattern;string|function]",
  },
  {
    label: "string",
    detail: "cast to string",
    documentation: "string[any]",
  },
  {
    label: "sublist",
    detail: "select a sublist",
    documentation: "sublist[int;list]",
  },
  {
    label: "sum",
    detail: "total",
    documentation: "sum[numbers]",
  },
  {
    label: "sums",
    detail: "running sums",
    documentation: "sums[numbers]",
  },
  {
    label: "sv",
    detail: "concatenate strings|syms",
    documentation: "sv[string;strings]|sv[`;syms]|sv[numbers;numbers]",
  },
  {
    label: "svar",
    detail: "sample variance",
    documentation: "svar[numbers]",
  },
  {
    label: "system",
    detail: "execute a system command",
    documentation: "system[string]",
  },
  {
    label: "tables",
    detail: "list tables",
    documentation: "tables[namespace sym]",
  },
  {
    label: "tan",
    detail: "tangent",
    documentation: "tan[numbers]",
  },
  {
    label: "til",
    detail: "generate long sequence",
    documentation: "til[long]",
  },
  {
    label: "trim",
    detail: "trim leading and trailing spaces",
    documentation: "trim[string]",
  },
  {
    label: "type",
    detail: "datatype",
    documentation: "type[x]",
  },
  {
    label: "uj",
    detail: "union join",
    documentation: "uj[table;table]",
  },
  {
    label: "ujf",
    detail: "union join(ignore nulls from RHS)",
    documentation: "ujf[table;table]",
  },
  {
    label: "ungroup",
    detail: "ungroup list type columns in a table into rows",
    documentation: "ungroup[table]",
  },
  {
    label: "union",
    detail: "union of two lists",
    documentation: "union[list;list]",
  },
  {
    label: "update",
    detail: "amend table|dict",
    documentation: "update col1,col2 [by col3] from table [where cond]",
  },
  {
    label: "upper",
    detail: "upper case",
    documentation: "upper[sym|string]",
  },
  {
    label: "upsert",
    detail: "add new records",
    documentation: "upsert[table|sym;records|table]",
  },
  {
    label: "value",
    detail: "value",
    documentation: "value[symbol|string|list|dict]",
  },
  {
    label: "var",
    detail: "variance",
    documentation: "var[numbers]",
  },
  {
    label: "view",
    detail: "expression defining a view",
    documentation: "view[sym]",
  },
  {
    label: "views",
    detail: "list veiws defined",
    documentation: "views[namespace sym]",
  },
  {
    label: "vs",
    detail: "split string|symbol",
    documentation: "vs[string;string]|sv[`;sym|dir]|sv[number;number]",
  },
  {
    label: "wavg",
    detail: "weighted average",
    documentation: "wavg[weights;numbers]",
  },
  {
    label: "where",
    detail: "to indices",
    documentation: "where[numbers]|where[booleans]",
  },
  {
    label: "while",
    detail: "evaluate expression repeatedly",
    documentation: "while[test;e1;e2...]",
  },
  {
    label: "within",
    detail: "check bounds",
    documentation: "within[list;range]",
  },
  {
    label: "wj",
    detail: "window join(consider prevailing quotes before window)",
    documentation: "wj[windows;syms;table;(table;(aggr;sym)<;(aggr;sym)>)]",
  },
  {
    label: "wj1",
    detail: "window join(consider quotes after entry to the window)",
    documentation: "wj1[windows;syms;table;(table;(aggr;sym)<;(aggr;sym)>)]",
  },
  {
    label: "wsum",
    detail: "weighted sum",
    documentation: "wsum[weights;numbers]",
  },
  {
    label: "xasc",
    detail: "ascending sort table by columns",
    documentation: "xasc[syms;table]",
  },
  {
    label: "xcol",
    detail: "rename columns",
    documentation: "xcol[syms;table]",
  },
  {
    label: "xcols",
    detail: "reorder columns",
    documentation: "xcols[syms;table]",
  },
  {
    label: "xdesc",
    detail: "descending sort table by columns",
    documentation: "xdesc[syms;table]",
  },
  {
    label: "xexp",
    detail: "power",
    documentation: "xexp[bases;powers]",
  },
  {
    label: "xlog",
    detail: "logarithm",
    documentation: "xlog[bases;numbers]",
  },
  {
    label: "xprev",
    detail: "shift each to prev by number",
    documentation: "xprev[int;list]",
  },
  {
    label: "xbar",
    detail: "round down to multiples",
    documentation: "xbar[base;numbers|termporals]",
  },
  {
    label: "xgroup",
    detail: "group by values in selected columns",
    documentation: "xgroup[syms;table]",
  },
  {
    label: "xkey",
    detail: "set key columns",
    documentation: "xkey[syms;table]",
  },
  {
    label: "xrank",
    detail: "group by value",
    documentation: "xrank[int;list]",
  },
  {
    label: ".h.br",
    detail: "linebreak",
    documentation: ".h.br",
  },
  {
    label: ".h.c0",
    detail: "web color",
    documentation: ".h.c0",
  },
  {
    label: ".h.c1",
    detail: "web color",
    documentation: ".h.c1",
  },
  {
    label: ".h.cd",
    detail: "CSV from data",
    documentation: ".h.cd[table|list]",
  },
  {
    label: ".h.code",
    detail: "code after Tab",
    documentation: ".h.code[string]",
  },
  {
    label: ".h.d",
    detail: "delimiter",
    documentation: ".h.d",
  },
  {
    label: ".h.ed",
    detail: "Excel from data",
    documentation: ".h.ed[table]",
  },
  {
    label: ".h.edsn",
    detail: "Excel from tables",
    documentation: ".h.edsn[sheet syms!tables]",
  },
  {
    label: ".h.fram",
    detail: "frame",
    documentation:
      ".h.fram[title string;strings;(left frame strings;right frame strings)]",
  },
  {
    label: ".h.ha",
    detail: "anchor",
    documentation: ".h.ha[url;string]",
  },
  {
    label: ".h.hb",
    detail: "anchor target",
    documentation: ".h.hb[url;string]",
  },
  {
    label: ".h.hc",
    detail: "escape lt",
    documentation: ".h.hc[string]",
  },
  {
    label: ".h.he",
    detail: "HTTP 400",
    documentation: ".h.he[string]",
  },
  {
    label: ".h.hn",
    detail: "HTTP response",
    documentation: ".h.hn[status code string;content type sym;content string]",
  },
  {
    label: ".h.HOME",
    detail: "webserver root",
    documentation: ".h.HOME",
  },
  {
    label: ".h.hp",
    detail: "HTTP response pre",
    documentation: ".h.hp[string]",
  },
  {
    label: ".h.hr",
    detail: "horizontal rule",
    documentation: ".h.hr[string]",
  },
  {
    label: ".h.ht",
    detail: "Marqdown to HTML",
    documentation: ".h.ht[file]",
  },
  {
    label: ".h.hta",
    detail: "start tag",
    documentation: ".h.hta[HTML tag sym;attributes!values]",
  },
  {
    label: ".h.htac",
    detail: "element",
    documentation: ".h.htac[HTML tag sym;attributes!values;content]",
  },
  {
    label: ".h.htc",
    detail: "element",
    documentation: ".h.htc[HTML tag sym;content]",
  },
  {
    label: ".h.html",
    detail: "document",
    documentation: ".h.html[html body string]",
  },
  {
    label: ".h.http",
    detail: "hyperlinks",
    documentation: ".h.http[string]",
  },
  {
    label: ".h.hu",
    detail: "URI escape",
    documentation: ".h.hu[string]",
  },
  {
    label: ".h.hug",
    detail: "URI map",
    documentation: ".h.hug[string]",
  },
  {
    label: ".h.hy",
    detail: "HTTP response content",
    documentation: ".h.hy[http content type sym;string]",
  },
  {
    label: ".h.iso8601",
    detail: "ISO timestamp",
    documentation: ".h.iso8601[nanoseconds]",
  },
  {
    label: ".h.jx",
    detail: "table",
    documentation: ".h.jx[offset;table sym]",
  },
  {
    label: ".h.logo",
    detail: "Kx logo",
    documentation: ".h.logo",
  },
  {
    label: ".h.nbr",
    detail: "no break",
    documentation: ".h.nbr[string]",
  },
  {
    label: ".h.pre",
    detail: "pre",
    documentation: ".h.pre[strings]",
  },
  {
    label: ".h.sa",
    detail: "anchor style",
    documentation: ".h.sa",
  },
  {
    label: ".h.sb",
    detail: "body style",
    documentation: ".h.sb",
  },
  {
    label: ".h.sc",
    detail: "URI-safe",
    documentation: ".h.sc",
  },
  {
    label: ".h.td",
    detail: "TSV from data",
    documentation: ".h.td[table]",
  },
  {
    label: ".h.text",
    detail: "paragraphs",
    documentation: ".h.text[strings]",
  },
  {
    label: ".h.tx",
    detail: "filetypes",
    documentation: ".h.tx",
  },
  {
    label: ".h.ty",
    detail: "MIME types",
    documentation: ".h.ty",
  },
  {
    label: ".h.uh",
    detail: "URI unescape",
    documentation: ".h.uh[string]",
  },
  {
    label: ".h.val",
    detail: "value",
    documentation: ".h.val:{[expression]}",
  },
  {
    label: ".h.xd",
    detail: "XML",
    documentation: ".h.xd[table]",
  },
  {
    label: ".h.xmp",
    detail: "XMP",
    documentation: ".h.xmp[strings]",
  },
  {
    label: ".h.xs",
    detail: "XML escape",
    documentation: ".h.xs[string]",
  },
  {
    label: ".h.xt",
    detail: "JSON",
    documentation: ".h.xt[`json;json string]",
  },
  {
    label: ".j.j",
    detail: "serialize",
    documentation: ".j.j[any]",
  },
  {
    label: ".j.k",
    detail: "deserialize",
    documentation: ".j.k[string]",
  },
  {
    label: ".j.jd",
    detail: "serialize infinity",
    documentation: ".j.jd[any;()!()|(!). 1#'`null0w,1b]",
  },
  {
    label: ".Q.a",
    detail: "lowercase alphabet",
    documentation: ".Q.a",
  },
  {
    label: ".Q.A",
    detail: "uppercase alphabet",
    documentation: ".Q.A",
  },
  {
    label: ".Q.addmonths",
    detail: "add months to date",
    documentation: ".Q.addmonths[dates;ints]",
  },
  {
    label: ".Q.addr",
    detail: "IP address",
    documentation: ".Q.addr[sym]",
  },
  {
    label: ".Q.b6",
    detail: "bicameral-alphanums",
    documentation: ".Q.b6",
  },
  {
    label: ".Q.bt",
    detail: "backtrace(error or debug)",
    documentation: ".Q.bt[]",
  },
  {
    label: ".Q.btoa",
    detail: "b64 encode",
    documentation: ".Q.btoa[string]",
  },
  {
    label: ".Q.bv",
    detail: "build schema for tables missing from partitions",
    documentation: ".Q.bv[<`>]",
  },
  {
    label: ".Q.Cf",
    detail: "create empty nested char file",
    documentation: ".Q.Cf[file]",
  },
  {
    label: ".Q.chk",
    detail: "fill HDB",
    documentation: ".Q.chk[dir]",
  },
  {
    label: ".Q.cn",
    detail: "count partitioned table",
    documentation: ".Q.cn[partitioned table]",
  },
  {
    label: ".Q.D",
    detail: "partitions",
    documentation: ".Q.D",
  },
  {
    label: ".Q.dd",
    detail: "join symbols",
    documentation: ".Q.dd[sym|dir;sym]",
  },
  {
    label: ".Q.def",
    detail: "provide defaults for .Q.opt",
    documentation: ".Q.def[default dict;params dict]",
  },
  {
    label: ".Q.dpft",
    detail: "save table",
    documentation: ".Q.dpft[dir;partition date;column sym;table sym]",
  },
  {
    label: ".Q.dpfts",
    detail: "save table with sym",
    documentation: ".Q.dpfts[dir;part;column sym;table sym;sym]",
  },
  {
    label: ".Q.dsftg",
    detail: "load process save",
    documentation:
      ".Q.dsftg[(dir;part;sym);(dir;offset;length);column syms;(types;widths);v1]",
  },
  {
    label: ".Q.en",
    detail: "enumerate varchar cols",
    documentation: ".Q.en[dir;table]",
  },
  {
    label: ".Q.ens",
    detail: "enumerate against domain",
    documentation: ".Q.ens[dir;table;sym]",
  },
  {
    label: ".Q.f",
    detail: "format",
    documentation: ".Q.f[int;number]",
  },
  {
    label: ".Q.fc",
    detail: "parallel on cut(apply parallel)",
    documentation: ".Q.fc[v1;list]",
  },
  {
    label: ".Q.ff",
    detail: "append columns",
    documentation: ".Q.ff[table;table]",
  },
  {
    label: ".Q.fk",
    detail: "foreign key",
    documentation: ".Q.fk[column sym]",
  },
  {
    label: ".Q.fmt",
    detail: "format",
    documentation: ".Q.fmt[length;decimal;number]",
  },
  {
    label: ".Q.fps",
    detail: "streaming algorithm",
    documentation: ".Q.fps[v1;file]",
  },
  {
    label: ".Q.fqk",
    detail: "if system and built-in functions",
    documentation: ".Q.fqk[string]",
  },
  {
    label: ".Q.fs",
    detail: "streaming algorithm",
    documentation: ".Q.fs[v1;file]",
  },
  {
    label: ".Q.fsn",
    detail: "streaming algorithm",
    documentation: ".Q.fsn[v1;file;chunk size]",
  },
  {
    label: ".Q.ft",
    detail: "apply simple",
    documentation: ".Q.ft[v1;keyed table]",
  },
  {
    label: ".Q.fu",
    detail: "apply unique",
    documentation: ".Q.fu[v1;list]",
  },
  {
    label: ".Q.gc",
    detail: "garbage collect",
    documentation: ".Q.gc[]",
  },
  {
    label: ".Q.gz",
    detail: "GZip",
    documentation: ".Q.gz[chars|bytes|(level;chars)|(level;bytes)]",
  },
  {
    label: ".Q.hdpf",
    detail: "save tables",
    documentation: ".Q.hdpf[hdb handle;dir;part;column sym]",
  },
  {
    label: ".Q.hg",
    detail: "HTTP get",
    documentation: ".Q.hg[url|string]",
  },
  {
    label: ".Q.host",
    detail: "hostname",
    documentation: ".Q.host[ip int]",
  },
  {
    label: ".Q.hp",
    detail: "HTTP post",
    documentation: ".Q.hp[url|string;MIME string;query string]",
  },
  {
    label: ".Q.id",
    detail: "sanitize",
    documentation: ".Q.id[sym|table]",
  },
  {
    label: ".Q.ind",
    detail: "partitioned index",
    documentation: ".Q.ind[partitioned table;indices]",
  },
  {
    label: ".Q.j10",
    detail: "encode binhex",
    documentation: ".Q.j10[string]",
  },
  {
    label: ".Q.j12",
    detail: "encode base64",
    documentation: ".Q.j12[string]",
  },
  {
    label: ".Q.k",
    detail: "version",
    documentation: ".Q.k",
  },
  {
    label: ".Q.l",
    detail: "load",
    documentation: ".Q.l[file|dir]",
  },
  {
    label: ".Q.M",
    detail: "long infinity",
    documentation: ".Q.M",
  },
  {
    label: ".Q.MAP",
    detail: "maps partitions",
    documentation: ".Q.MAP[]",
  },
  {
    label: ".Q.nA",
    detail: "alphanums",
    documentation: ".Q.nA",
  },
  {
    label: ".Q.opt",
    detail: "command parameters",
    documentation: ".Q.opt[strings|.z.x]",
  },
  {
    label: ".Q.P",
    detail: "segments",
    documentation: ".Q.P",
  },
  {
    label: ".Q.par",
    detail: "locate partition",
    documentation: ".Q.par[dir;part;table sym]",
  },
  {
    label: ".Q.pd",
    detail: "modified partition locations",
    documentation: ".Q.pd",
  },
  {
    label: ".Q.PD",
    detail: "partition locations",
    documentation: ".Q.PD",
  },
  {
    label: ".Q.pf",
    detail: "partition field",
    documentation: ".Q.pf",
  },
  {
    label: ".Q.pn",
    detail: "partition counts",
    documentation: ".Q.pn",
  },
  {
    label: ".Q.prf0",
    detail: "code profiler",
    documentation: ".Q.prf0[pid]",
  },
  {
    label: ".Q.pt",
    detail: "partitioned tables",
    documentation: ".Q.pt",
  },
  {
    label: ".Q.pv",
    detail: "modified partition values",
    documentation: ".Q.pv",
  },
  {
    label: ".Q.PV",
    detail: "partition values",
    documentation: ".Q.PV",
  },
  {
    label: ".Q.qp",
    detail: "is partitioned",
    documentation: ".Q.qp[table]",
  },
  {
    label: ".Q.qt",
    detail: "is table",
    documentation: ".Q.qt[table]",
  },
  {
    label: ".Q.res",
    detail: "keywords",
    documentation: ".Q.res",
  },
  {
    label: ".Q.s",
    detail: "plain text",
    documentation: ".Q.s[any]",
  },
  {
    label: ".Q.s1",
    detail: "string representation",
    documentation: ".Q.s1[any]",
  },
  {
    label: ".Q.sbt",
    detail: "string backtrace",
    documentation: ".Q.sbt[backtrace object]",
  },
  {
    label: ".Q.sha1",
    detail: "SHA-1 encode",
    documentation: ".Q.sha1[string]",
  },
  {
    label: ".Q.trp",
    detail: "extend trap",
    documentation: ".Q.trp[v1;any;v2]",
  },
  {
    label: ".Q.ts",
    detail: "time and space",
    documentation: ".Q.ts[v;args]",
  },
  {
    label: ".Q.ty",
    detail: "type",
    documentation: ".Q.ty[list]",
  },
  {
    label: ".Q.u",
    detail: "is date based",
    documentation: ".Q.u",
  },
  {
    label: ".Q.V",
    detail: "table to dict",
    documentation: ".Q.V[table]",
  },
  {
    label: ".Q.v",
    detail: "value",
    documentation: ".Q.v[file|sym]",
  },
  {
    label: ".Q.view",
    detail: "subview",
    documentation: ".Q.view[parts]",
  },
  {
    label: ".Q.vp",
    detail: "missing partitions",
    documentation: ".Q.vp",
  },
  {
    label: ".Q.w",
    detail: "memory stats",
    documentation: ".Q.w[]",
  },
  {
    label: ".Q.x",
    detail: "non-command parameters",
    documentation: ".Q.x",
  },
  {
    label: ".Q.x10",
    detail: "decode binhex",
    documentation: ".Q.x10[long]",
  },
  {
    label: ".Q.x12",
    detail: "decode base64",
    documentation: ".Q.x12[long]",
  },
  {
    label: ".Q.Xf",
    detail: "create file",
    documentation: ".Q.Xf[upper case char|type sym]",
  },
  {
    label: ".z.a",
    detail: "Returns the IP address as a 32-bit integer.",
    documentation: ".z.a[{x;y}]",
  },
  {
    label: ".z.ac",
    detail:
      "Http authenticate from cookie. Allows users to define custom code to extract Single Sign On (SSO) token cookies from the http header and verify it, decoding and returning the username, or instructing what action to take.",
    documentation: ".z.ac[]",
  },
  {
    label: ".z.b",
    detail: "Returns the dependency dictionary.",
    documentation: ".z.b[]",
  },
  {
    label: ".z.bm",
    detail:
      "KDB+ validates incoming ipc messages to check that data structures are well formed, reporting 'badMsg and disconnecting senders of malformed data structures. The raw message is captured for analysis via the callback .z.bm.",
    documentation: ".z.bm[]",
  },
  {
    label: ".z.c",
    detail: "Physical core count.",
    documentation: ".z.c[]",
  },
  {
    label: ".z.e",
    detail: "TLS connection status.",
    documentation: ".z.e[]",
  },
  {
    label: ".z.exit",
    detail: "Exit behavior callback. Default: NOOP.",
    documentation: ".z.exit[]",
  },
  {
    label: ".z.f",
    detail: "Returns the name of the q script as a symbol.",
    documentation: ".z.f[]",
  },
  {
    label: ".z.h",
    detail: "Returns the host name as a symbol.",
    documentation: ".z.h[filename]",
  },
  {
    label: ".z.i",
    detail: "Returns the process id as an integer.",
    documentation: ".z.i[]",
  },
  {
    label: ".z.k",
    detail:
      "Returns the date on which the version of kdb+ being used was released.",
    documentation: ".z.k[x]",
  },
  {
    label: ".z.K",
    detail:
      "Return the major version number of the version of kdb+ being used as a float.",
    documentation: ".z.K[table]",
  },
  {
    label: ".z.l",
    detail: "Returns the license information as a list of strings.",
    documentation: ".z.l[]",
  },
  {
    label: ".z.n",
    detail: "System GMT time (as timespan) in nanoseconds.",
    documentation: ".z.n[]",
  },
  {
    label: ".z.N",
    detail: "System local time (as timespan) in nanoseconds.",
    documentation: ".z.N[]",
  },
  {
    label: ".z.o",
    detail: "Return the kdb+ operating system version as a symbol.",
    documentation: '.z.o["Hello, world!"]',
  },
  {
    label: ".z.p",
    detail: "System gmt timestamp in nanoseconds.",
    documentation: '.z.p["Hello, world!"]',
  },
  {
    label: ".z.P",
    detail: "System localtime timestamp in nanoseconds.",
    documentation: ".z.P[]",
  },
  {
    label: ".z.pc",
    detail: "Port close - Called AFTER a connection has been closed.",
    documentation: ".z.pc[]",
  },
  {
    label: ".z.pg",
    detail:
      "Port get - When .z.pg is set, it is called with the object that is passed to this kdb+ session via a synchronous request. The return value, if any, is returned to the calling task.",
    documentation: ".z.pg[]",
  },
  {
    label: ".z.pd",
    detail:
      "Peach handles - Indicating that N worker processes should be used for executing the function supplied to peach, kdb+ gets the handles to those worker processes by calling .z.pd[]. Syntax: .z.pd:`u#hopen each 20000+til 4",
    documentation: ".z.pd:5",
  },
  {
    label: ".z.ph",
    detail:
      "Port HttpGet - Called when a synchronous http request comes into the kdb+ session.",
    documentation: ".z.ph:10",
  },
  {
    label: ".z.pi",
    detail: "The default handler for input.",
    documentation: ".z.pi:2",
  },
  {
    label: ".z.pm",
    detail:
      "Pass http OPTIONS method through to .z.pm as (`OPTIONS;requestText;requestHeaderDict).",
    documentation: ".z.pm:80",
  },
  {
    label: ".z.po",
    detail:
      "Port open - Called when a connection to a kdb+ session has been initialized.",
    documentation: ".z.po:4",
  },
  {
    label: ".z.pp",
    detail:
      "Port post - Called when an http postrequest comes into the kdb+ session.",
    documentation: ".z.pp:3",
  },
  {
    label: ".z.ps",
    detail:
      "Port set - When .z.ps is set, it is called with the object that is passed to this kdb+ session via an asynchronous request. The return value is discarded.",
    documentation: ".z.ps:10",
  },
  {
    label: ".z.pw",
    detail:
      "Validate user - Called AFTER the -u/-U checks, and BEFORE .z.po when opening a new connection to a kdb+ session.",
    documentation: ".z.pw:80",
  },
  {
    label: ".z.q",
    detail: "Quiet mode",
    documentation: ".z.q[]",
  },
  {
    label: ".z.s",
    detail:
      "Self - Returns the current function. Can be used to generate recursive function calls.",
    documentation: ".z.s[]",
  },
  {
    label: ".z.ts",
    detail:
      "Function which is invoked on intervals of the timer variable (\t).",
    documentation: ".z.ts[]",
  },
  {
    label: ".z.u",
    detail: "User ID - Returns user's name as a symbol.",
    documentation: ".z.u[]",
  },
  {
    label: ".z.vs",
    detail:
      "Value set - Once .z.vs is defined, it is called with two arguments. The first argument is the symbol of the variable that is being modified and the second is the index.",
    documentation:
      '.z.vs:{[sym;idx;val] .Q.s[sym,"[",string idx,"]=",string val]}',
  },
  {
    label: ".z.w",
    detail: "Connection handle, 0 for current session console.",
    documentation: ".z.w[]",
  },
  {
    label: ".z.wc",
    detail:
      "Websocket close - Called after a websocket connection has been closed.",
    documentation:
      '.z.wc:{[handle;code;reason] .Q.s["Websocket closed: ",string code," ",reason]}',
  },
  {
    label: ".z.wo",
    detail:
      "Websocket open - Called when a websocket connection to a kdb+ session has been initialized.",
    documentation:
      '.z.wo:{[handle;headers] .Q.s["Websocket opened: ",string handle]}',
  },
  {
    label: ".z.W",
    detail:
      "Handles - Returns a dictionary of ipc handles with the number of bytes waiting in their output queues.",
    documentation: ".z.W[]",
  },
  {
    label: ".z.ws",
    detail: "Websockets - Called when a message on a websocket arrives.",
    documentation: '.z.ws:{[handle;msg] .Q.s["Websocket message: ",msg]}',
  },
  {
    label: ".z.x",
    detail: "Returns the command line arguments as a list of strings.",
    documentation: ".z.x[]",
  },
  {
    label: ".z.X",
    detail:
      "Returns a list of char vectors of the raw, unfiltered cmd line with which kdb+ was invoked, including the name under which q was invoked as well as single-letter arguments.",
    documentation: ".z.X[]",
  },
  {
    label: ".z.z",
    detail: "Returns UTC time as a datetime scalar.",
    documentation: ".z.z[]",
  },
  {
    label: ".z.Z",
    detail: "Returns local time as a datetime scalar.",
    documentation: ".z.Z[]",
  },
  {
    label: ".z.t",
    detail: "Returns UTC time as `time. Shorthand for `time$.z.z",
    documentation: ".z.t[]",
  },
  {
    label: ".z.T",
    detail: "Returns local time as `time. Shorthand for `time$.z.Z",
    documentation: '.z.T:{[ex] .Q.s["Exception: ",string ex]}',
  },
  {
    label: ".z.d",
    detail: "Returns UTC time as `date. Shorthand for `date$.z.z",
    documentation: ".z.d[]",
  },
  {
    label: ".z.D",
    detail: "Returns local time as `date. Shorthand for `date$.z.Z",
    documentation: ".z.D[]",
  },
  {
    label: ".z.zd",
    detail:
      "Zip defaults - If defined, is an integer list of default parameters for logical block size, compression algorithm and compression level that apply when saving to files with no file extension.",
    documentation: ".z.zd:100 1 9",
  },
  {
    label: ".com_kx_edi.getMeta",
    detail: "This function returns the metadata of the databases.",
    documentation: ".com_kx_edi.getMeta[]",
  },
  {
    label: ".com_kx_edi.sql",
    detail: "This function runs an SQL query.",
    documentation: ".com_kx_edi.sql[query]",
  },
  {
    label: ".com_kx_edi.qsql",
    detail:
      "This is a QSQL query builder that assembles QSQL queries based on a q expression.",
    documentation: ".com_kx_edi.qsql[args]",
  },
  {
    label: ".com_kx_edi.queryBuilder",
    detail:
      "The queryBuilder function uses the GetData API to construct queries.",
    documentation: ".com_kx_edi.queryBuilder[args]",
  },
  {
    label: ".com_kx_edi.uda",
    detail: "Use this function to query a UDA.",
    documentation: ".com_kx_edi.uda[args;name]",
  },
];
