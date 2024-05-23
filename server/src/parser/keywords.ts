/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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

import { createToken } from "chevrotain";

export const Identifier = createToken({
  name: "Identifier",
  pattern: /\.?[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*/,
});

export const System = createToken({
  name: "System",
  pattern: /system/,
  longer_alt: Identifier,
});

export const Control = createToken({
  name: "Control",
  pattern: /(?:while|if|do)/,
  longer_alt: Identifier,
});

export const LSql = createToken({
  name: "LSql",
  pattern: /(?:select|exec|update|delete)/,
  longer_alt: Identifier,
});

export const RSql = createToken({
  name: "RSql",
  pattern: /from/,
  longer_alt: Identifier,
});

export const Keyword = createToken({
  name: "Keyword",
  pattern:
    /(?:reciprocal|distinct|ceiling|reverse|sublist|ungroup|delete|deltas|differ|enlist|except|getenv|hclose|hcount|insert|mcount|ratios|rotate|select|setenv|signum|string|system|tables|update|upsert|within|xgroup|count|cross|dsave|fills|first|fkeys|floor|group|gtime|hopen|idesc|inter|lower|ltime|ltrim|parse|peach|prior|read0|read1|reval|rload|rsave|rtrim|union|upper|value|views|where|while|xcols|xdesc|xprev|xrank|acos|ajf0|asin|asof|atan|attr|avgs|binr|cols|desc|each|eval|exec|exit|flip|from|hdel|hsym|iasc|keys|last|like|load|mavg|maxs|mdev|meta|mins|mmax|mmin|msum|next|null|over|prds|prev|rand|rank|raze|save|scan|scov|sdev|show|sqrt|sums|svar|trim|type|view|wavg|wsum|xasc|xbar|xcol|xexp|xkey|xlog|abs|aj0|ajf|all|and|any|asc|avg|bin|cor|cos|cov|csv|cut|dev|div|ema|exp|fby|get|ijf|inv|key|ljf|log|lsq|max|md5|med|min|mmu|mod|neg|not|prd|set|sin|ssr|sum|tan|til|ujf|var|wj1|aj|do|ej|if|ij|in|lj|or|pj|ss|sv|uj|vs|wj)/,
  longer_alt: Identifier,
});

export const Reserved = createToken({
  name: "Reserved",
  pattern:
    /(?:\.h\.(?:iso8601|code|edsn|fram|HOME|htac|html|http|logo|text|hta|htc|hug|nbr|pre|val|xmp|br|c0|c1|cd|ed|ha|hb|hc|he|hn|hp|hr|ht|hu|hy|jx|sa|sb|sc|td|tx|ty|uh|xd|xs|xt|d)|\.j\.(?:jd|[jk])|\.m\.(?:addmonths|dpfts|dsftg|addr|btoa|dpft|hdpf|host|view|chk|def|ens|fmt|fpn|fps|fsn|ind|j10|j12|MAP|opt|par|res|sbt|trp|x10|x12|b6|bt|bv|Cf|cn|dd|en|ff|fk|fs|ft|fu|gc|gz|hg|hp|id|nA|pd|PD|pf|pn|pt|pv|PV|qp|qt|s1|ts|ty|vp|Xf|[aADfklMPsuvVwx])|\.[Qq]\.(?:addmonths|dpfts|dsftg|addr|btoa|dpft|hdpf|host|sha1|view|chk|def|ens|fmt|fpn|fps|fsn|ind|j10|j12|MAP|opt|par|res|sbt|trp|x10|x12|b6|bt|bv|Cf|cn|dd|en|fc|ff|fk|fs|ft|fu|gc|gz|hg|hp|id|nA|pd|PD|pf|pn|pt|pv|PV|qp|qt|s1|ts|ty|vp|Xf|[aADfklMPsSuvVwx])|\.z\.(?:exit|ac|bm|ex|ey|pc|pd|pg|ph|pi|pm|po|pp|pq|ps|pw|ts|vs|wc|wo|ws|zd|[abcdDefhikKlnNopPqstTuwWxXzZ]))/,
  longer_alt: Identifier,
});
