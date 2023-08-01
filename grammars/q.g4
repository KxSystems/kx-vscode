grammar q;

// Define a rule for a variable declaration
variable_declaration:
	storage_type variable_name '=' expression ';';

// Define a rule for a storage type
storage_type:
	'int'
	| 'long'
	| 'float'
	| 'double'
	| 'char'
	| 'symbol'
	| 'timestamp';

// Define a rule for a variable name
variable_name: ID;

// Define a rule for an expression
expression: or_expression;

or_expression: and_expression ('or' and_expression)*;
and_expression:
	comparison_expression ('and' comparison_expression)*;
comparison_expression:
	additive_expression (EQUALS additive_expression)*;
additive_expression:
	multiplicative_expression (PLUS multiplicative_expression)*;
multiplicative_expression:
	unary_expression (MULTIPLY unary_expression)*;
unary_expression: primary_expression | MINUS primary_expression;
primary_expression:
	NUMBER
	| STRING
	| variable_name
	| '(' expression ')';

// Define lexer rules for symbols and keywords
PLUS: '+';
MINUS: '-';
MULTIPLY: '*';
DIVIDE: '%';
EQUALS: '=';
NOT_EQUALS: '<>';
LESS_THAN: '<';
LESS_THAN_OR_EQUAL: '<=';
GREATER_THAN: '>';
GREATER_THAN_OR_EQUAL: '>=';
AND: 'and';
OR: 'or';
NOT: 'not';
INT: 'int';
LONG: 'long';
FLOAT: 'float';
DOUBLE: 'double';
CHAR: 'char';
SYMBOL: 'symbol';
TIMESTAMP: 'timestamp';

// Define lexer rules for identifiers and literals
ID: [a-zA-Z_][a-zA-Z0-9_]*;
DIGIT: [0-9];
NUMBER: DIGIT+ ('.' DIGIT+)?;
STRING: '"' (ESC | ~["\\])* '"';
ESC: '\\' ["\\/bfnrt];
WS: [ \t\r\n]+ -> skip;

// Define rules for supported functions
abs_function: 'abs' '(' expression ')';
acos_function: 'acos' '(' expression ')';
all_function: 'all' '(' expression ')';
and_function: 'and' '(' expression ')';
any_function: 'any' '(' expression ')';
asin_function: 'asin' '(' expression ')';
atan_function: 'atan' '(' expression ')';
avg_function: 'avg' '(' expression ')';
ceiling_function: 'ceiling' '(' expression ')';
cos_function: 'cos' '(' expression ')';
count_function: 'count' '(' expression ')';
cross_function: 'cross' '(' expression ',' expression ')';
delete_function: 'delete' '(' expression ')';
deltas_function: 'deltas' '(' expression ')';
dev_function: 'dev' '(' expression ')';
distinct_function: 'distinct' '(' expression ')';
div_function: 'div' '(' expression ',' expression ')';
drop_function: 'drop' '(' expression ')';
each_function: 'each' '(' expression ')';
enlist_function: 'enlist' '(' expression ')';
eval_function: 'eval' '(' expression ')';
except_function: 'except' '(' expression ',' expression ')';
exec_function: 'exec' '(' expression ',' expression ')';
exp_function: 'exp' '(' expression ')';
fby_function: 'fby' '(' expression ')';
fill_function: 'fill' '(' expression ',' expression ')';
first_function: 'first' '(' expression ')';
flip_function: 'flip' '(' expression ')';
floor_function: 'floor' '(' expression ')';
get_function: 'get' '(' expression ')';
group_function: 'group' '(' expression ',' expression ')';
gtime_function: 'gtime' '(' expression ')';
hclose_function: 'hclose' '(' expression ')';
hcount_function: 'hcount' '(' expression ')';
hdel_function: 'hdel' '(' expression ',' expression ')';
hopen_function: 'hopen' '(' expression ')';
hsym_function: 'hsym' '(' expression ')';
iasc_function: 'iasc' '(' expression ')';
idesc_function: 'idesc' '(' expression ')';
ij_function: 'ij' '(' expression ',' expression ')';
in_function: 'in' '(' expression ',' expression ')';
insert_function: 'insert' '(' expression ',' expression ')';
inter_function: 'inter' '(' expression ',' expression ')';
inv_function: 'inv' '(' expression ')';
keys_function: 'keys' '(' expression ')';
last_function: 'last' '(' expression ')';
like_function: 'like' '(' expression ',' expression ')';
list_function: 'list' '(' expression ')';
lj_function: 'lj' '(' expression ',' expression ')';
load_function: 'load' '(' expression ')';
log_function: 'log' '(' expression ')';
lower_function: 'lower' '(' expression ')';
lsq_function: 'lsq' '(' expression ',' expression ')';
ltime_function: 'ltime' '(' expression ')';
ltrim_function: 'ltrim' '(' expression ')';
mavg_function: 'mavg' '(' expression ',' expression ')';
max_function: 'max' '(' expression ')';
maxs_function: 'maxs' '(' expression ')';
mcount_function: 'mcount' '(' expression ')';
md5_function: 'md5' '(' expression ')';
mdev_function: 'mdev' '(' expression ',' expression ')';
med_function: 'med' '(' expression ')';
meta_function: 'meta' '(' expression ')';
min_function: 'min' '(' expression ')';
mins_function: 'mins' '(' expression ')';
mmax_function: 'mmax' '(' expression ',' expression ')';
mmin_function: 'mmin' '(' expression ',' expression ')';
mmu_function: 'mmu' '(' expression ')';
mod_function: 'mod' '(' expression ',' expression ')';
msum_function: 'msum' '(' expression ')';
neg_function: 'neg' '(' expression ')';
next_function: 'next' '(' expression ')';
not_function: 'not' '(' expression ')';
null_function: 'null' '(' expression ')';
or_function: 'or' '(' expression ')';
over_function: 'over' '(' expression ')';
parse_function: 'parse' '(' expression ')';
peach_function: 'peach' '(' expression ')';
pj_function: 'pj' '(' expression ',' expression ')';
plist_function: 'plist' '(' expression ')';
prd_function: 'prd' '(' expression ')';
prev_function: 'prev' '(' expression ')';
prior_function: 'prior' '(' expression ')';
rand_function: 'rand' '(' expression ')';
rank_function: 'rank' '(' expression ')';
ratios_function: 'ratios' '(' expression ')';
raze_function: 'raze' '(' expression ')';
read0_function: 'read0' '(' expression ')';
read1_function: 'read1' '(' expression ')';
reciprocal_function: 'reciprocal' '(' expression ')';
reverse_function: 'reverse' '(' expression ')';
rload_function: 'rload' '(' expression ')';
rotate_function: 'rotate' '(' expression ',' expression ')';
rsave_function: 'rsave' '(' expression ',' expression ')';
rtrim_function: 'rtrim' '(' expression ')';
save_function: 'save' '(' expression ',' expression ')';
scan_function: 'scan' '(' expression ',' expression ')';
select_function: 'select' '(' expression ')';
set_function: 'set' '(' expression ',' expression ')';
show_function: 'show' '(' expression ')';
signum_function: 'signum' '(' expression ')';
sin_function: 'sin' '(' expression ')';
sqrt_function: 'sqrt' '(' expression ')';
ssr_function: 'ssr' '(' expression ',' expression ')';
string_function: 'string' '(' expression ')';
sublist_function: 'sublist' '(' expression ',' expression ')';
sum_function: 'sum' '(' expression ')';
sums_function: 'sums' '(' expression ')';
sv_function: 'sv' '(' expression ')';
system_function: 'system' '(' expression ')';
tables_function: 'tables' '(' expression ')';
tan_function: 'tan' '(' expression ')';
til_function: 'til' '(' expression ')';
trim_function: 'trim' '(' expression ')';
type_function: 'type' '(' expression ')';
uj_function: 'uj' '(' expression ',' expression ')';
ungroup_function: 'ungroup' '(' expression ')';
union_function: 'union' '(' expression ',' expression ')';
update_function: 'update' '(' expression ',' expression ')';
upper_function: 'upper' '(' expression ')';
upsert_function: 'upsert' '(' expression ',' expression ')';
value_function: 'value' '(' expression ')';
var_function: 'var' '(' expression ')';
view_function: 'view' '(' expression ')';
vs_function: 'vs' '(' expression ')';
wavg_function: 'wavg' '(' expression ',' expression ')';
where_function: 'where' '(' expression ')';
within_function: 'within' '(' expression ',' expression ')';
wj1_function: 'wj1' '(' expression ',' expression ')';
wj2_function: 'wj2' '(' expression ',' expression ')';
ww_function: 'ww' '(' expression ')';
xasc_function: 'xasc' '(' expression ')';
xbar_function: 'xbar' '(' expression ',' expression ')';
xcols_function: 'xcols' '(' expression ')';
xdesc_function: 'xdesc' '(' expression ')';
xexp_function: 'xexp' '(' expression ')';
xgroup_function: 'xgroup' '(' expression ',' expression ')';
xkey_function: 'xkey' '(' expression ',' expression ')';
xlog_function: 'xlog' '(' expression ')';
xprev_function: 'xprev' '(' expression ')';
xrank_function: 'xrank' '(' expression ')';
xranked_function: 'xranked' '(' expression ')';
xrecs_function: 'xrecs' '(' expression ')';
xrows_function: 'xrows' '(' expression ')';
xss_function: 'xss' '(' expression ')';
xtype_function: 'xtype' '(' expression ')';
yield_function: 'yield' '(' expression ')';
zip_function: 'zip' '(' expression ',' expression ')';