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
import { Identifier } from "./tokens";

export const Keyword = createToken({
  name: "Keyword",
  pattern:
    /(?:\.h\.(br|code|fram|ha|hb|ht|hta|htac|htc|html|http|nbr|pre|he|hn|hp|hy|hu|hug|sc|uh|sa|text|xmp|cd|d|ed|edsn|hc|hr|iso8601|jx|td|tx|xd|xs|xt|c0|c1|HOME|logo|sb|ty|val)|\.j\.(j|k|jd)|\.[Qq]\.(addmonths|Cf|Xf|btoa|j10|j12|M|ty|x10|x12|chk|dpft|dpfts|dsftg|en|ens|fk|hdpf|qt|qp|bv|ind|cn|MAP|D|par|PD|pd|pf|pn|qp|pt|PV|pv|vp|D|P|u|bt|dd|def|f|ff|fmt|ft|fu|gc|gz|id|qt|res|s|s1|sbt|trp|ts|u|V|v|view|A|a|b6|nA|k|opt|w|x|addr|fps|fpn|fs|fsn|hg|host|hp|l|sha1|fc|S)|\.z\.(a|b|c|D|d|e|ex|ey|f|h|i|K|k|l|N|n|o|P|p|pm|q|s|T|t|u|W|w|X|x|Z|z|zd|ac|bm|exit|pc|pd|pg|ph|pi|po|pp|pq|ps|pw|ts|vs|wc|wo|ws|d|D)|\.m\.(btoa|j10|j12|M|ty|x10|x12|chk|dpft|dpfts|dsftg|en|ens|fk|hdpf|qt|qp|bv|ind|cn|MAP|D|par|PD|pd|pf|pn|qp|pt|PV|pv|vp|D|P|u|addmonths|bt|dd|def|f|ff|fmt|ft|fu|gc|gz|id|qt|res|s|s1|sbt|trp|ts|u|V|v|view|A|a|b6|nA|k|opt|w|x|addr|fps|fs|hg|host|hp|l|fpn|fsn|Cf|Xf)|\.[hjqQzm]|do|exit|if|while|getenv|gtime|ltime|setenv|eval|parse|reval|show|system|value|dsave|get|hclose|hcount|hdel|hopen|hsym|load|read0|read1|rload|rsave|save|set|each|over|peach|prior|scan|aj|aj0|ajf|ajf0|asof|ej|ij|ijf|lj|ljf|pj|uj|ujf|wj|wj1|count|cross|cut|enlist|except|fills|first|flip|group|in|inter|last|mcount|next|prev|raze|reverse|rotate|sublist|sv|til|union|vs|where|xprev|abs|acos|asin|atan|avg|avgs|ceiling|cor|cos|cov|deltas|dev|div|ema|exp|floor|inv|log|lsq|mavg|max|maxs|mdev|med|min|mins|mmax|mmin|mmu|mod|msum|neg|prd|prds|rand|ratios|reciprocal|scov|sdev|signum|sin|sqrt|sum|sums|svar|tan|var|wavg|within|wsum|xexp|xlog|attr|null|tables|type|view|views|delete|exec|fby|from|select|update|all|and|any|not|or|asc|bin|binr|desc|differ|distinct|iasc|idesc|rank|xbar|xrank|cols|csv|fkeys|insert|key|keys|meta|ungroup|upsert|xasc|xcol|xcols|xdesc|xgroup|xkey|like|lower|ltrim|md5|rtrim|ss|ssr|string|trim|upper)/,
  longer_alt: Identifier,
});
