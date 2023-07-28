// Generated from q.g4 by ANTLR 4.8
// jshint ignore: start
var antlr4 = require('antlr4/index');

// This class defines a complete listener for a parse tree produced by qParser.
function qListener() {
	antlr4.tree.ParseTreeListener.call(this);
	return this;
}

qListener.prototype = Object.create(antlr4.tree.ParseTreeListener.prototype);
qListener.prototype.constructor = qListener;

// Enter a parse tree produced by qParser#variable_declaration.
qListener.prototype.enterVariable_declaration = function(ctx) {
};

// Exit a parse tree produced by qParser#variable_declaration.
qListener.prototype.exitVariable_declaration = function(ctx) {
};


// Enter a parse tree produced by qParser#storage_type.
qListener.prototype.enterStorage_type = function(ctx) {
};

// Exit a parse tree produced by qParser#storage_type.
qListener.prototype.exitStorage_type = function(ctx) {
};


// Enter a parse tree produced by qParser#variable_name.
qListener.prototype.enterVariable_name = function(ctx) {
};

// Exit a parse tree produced by qParser#variable_name.
qListener.prototype.exitVariable_name = function(ctx) {
};


// Enter a parse tree produced by qParser#expression.
qListener.prototype.enterExpression = function(ctx) {
};

// Exit a parse tree produced by qParser#expression.
qListener.prototype.exitExpression = function(ctx) {
};


// Enter a parse tree produced by qParser#or_expression.
qListener.prototype.enterOr_expression = function(ctx) {
};

// Exit a parse tree produced by qParser#or_expression.
qListener.prototype.exitOr_expression = function(ctx) {
};


// Enter a parse tree produced by qParser#and_expression.
qListener.prototype.enterAnd_expression = function(ctx) {
};

// Exit a parse tree produced by qParser#and_expression.
qListener.prototype.exitAnd_expression = function(ctx) {
};


// Enter a parse tree produced by qParser#comparison_expression.
qListener.prototype.enterComparison_expression = function(ctx) {
};

// Exit a parse tree produced by qParser#comparison_expression.
qListener.prototype.exitComparison_expression = function(ctx) {
};


// Enter a parse tree produced by qParser#additive_expression.
qListener.prototype.enterAdditive_expression = function(ctx) {
};

// Exit a parse tree produced by qParser#additive_expression.
qListener.prototype.exitAdditive_expression = function(ctx) {
};


// Enter a parse tree produced by qParser#multiplicative_expression.
qListener.prototype.enterMultiplicative_expression = function(ctx) {
};

// Exit a parse tree produced by qParser#multiplicative_expression.
qListener.prototype.exitMultiplicative_expression = function(ctx) {
};


// Enter a parse tree produced by qParser#unary_expression.
qListener.prototype.enterUnary_expression = function(ctx) {
};

// Exit a parse tree produced by qParser#unary_expression.
qListener.prototype.exitUnary_expression = function(ctx) {
};


// Enter a parse tree produced by qParser#primary_expression.
qListener.prototype.enterPrimary_expression = function(ctx) {
};

// Exit a parse tree produced by qParser#primary_expression.
qListener.prototype.exitPrimary_expression = function(ctx) {
};


// Enter a parse tree produced by qParser#abs_function.
qListener.prototype.enterAbs_function = function(ctx) {
};

// Exit a parse tree produced by qParser#abs_function.
qListener.prototype.exitAbs_function = function(ctx) {
};


// Enter a parse tree produced by qParser#acos_function.
qListener.prototype.enterAcos_function = function(ctx) {
};

// Exit a parse tree produced by qParser#acos_function.
qListener.prototype.exitAcos_function = function(ctx) {
};


// Enter a parse tree produced by qParser#all_function.
qListener.prototype.enterAll_function = function(ctx) {
};

// Exit a parse tree produced by qParser#all_function.
qListener.prototype.exitAll_function = function(ctx) {
};


// Enter a parse tree produced by qParser#and_function.
qListener.prototype.enterAnd_function = function(ctx) {
};

// Exit a parse tree produced by qParser#and_function.
qListener.prototype.exitAnd_function = function(ctx) {
};


// Enter a parse tree produced by qParser#any_function.
qListener.prototype.enterAny_function = function(ctx) {
};

// Exit a parse tree produced by qParser#any_function.
qListener.prototype.exitAny_function = function(ctx) {
};


// Enter a parse tree produced by qParser#asin_function.
qListener.prototype.enterAsin_function = function(ctx) {
};

// Exit a parse tree produced by qParser#asin_function.
qListener.prototype.exitAsin_function = function(ctx) {
};


// Enter a parse tree produced by qParser#atan_function.
qListener.prototype.enterAtan_function = function(ctx) {
};

// Exit a parse tree produced by qParser#atan_function.
qListener.prototype.exitAtan_function = function(ctx) {
};


// Enter a parse tree produced by qParser#avg_function.
qListener.prototype.enterAvg_function = function(ctx) {
};

// Exit a parse tree produced by qParser#avg_function.
qListener.prototype.exitAvg_function = function(ctx) {
};


// Enter a parse tree produced by qParser#ceiling_function.
qListener.prototype.enterCeiling_function = function(ctx) {
};

// Exit a parse tree produced by qParser#ceiling_function.
qListener.prototype.exitCeiling_function = function(ctx) {
};


// Enter a parse tree produced by qParser#cos_function.
qListener.prototype.enterCos_function = function(ctx) {
};

// Exit a parse tree produced by qParser#cos_function.
qListener.prototype.exitCos_function = function(ctx) {
};


// Enter a parse tree produced by qParser#count_function.
qListener.prototype.enterCount_function = function(ctx) {
};

// Exit a parse tree produced by qParser#count_function.
qListener.prototype.exitCount_function = function(ctx) {
};


// Enter a parse tree produced by qParser#cross_function.
qListener.prototype.enterCross_function = function(ctx) {
};

// Exit a parse tree produced by qParser#cross_function.
qListener.prototype.exitCross_function = function(ctx) {
};


// Enter a parse tree produced by qParser#delete_function.
qListener.prototype.enterDelete_function = function(ctx) {
};

// Exit a parse tree produced by qParser#delete_function.
qListener.prototype.exitDelete_function = function(ctx) {
};


// Enter a parse tree produced by qParser#deltas_function.
qListener.prototype.enterDeltas_function = function(ctx) {
};

// Exit a parse tree produced by qParser#deltas_function.
qListener.prototype.exitDeltas_function = function(ctx) {
};


// Enter a parse tree produced by qParser#dev_function.
qListener.prototype.enterDev_function = function(ctx) {
};

// Exit a parse tree produced by qParser#dev_function.
qListener.prototype.exitDev_function = function(ctx) {
};


// Enter a parse tree produced by qParser#distinct_function.
qListener.prototype.enterDistinct_function = function(ctx) {
};

// Exit a parse tree produced by qParser#distinct_function.
qListener.prototype.exitDistinct_function = function(ctx) {
};


// Enter a parse tree produced by qParser#div_function.
qListener.prototype.enterDiv_function = function(ctx) {
};

// Exit a parse tree produced by qParser#div_function.
qListener.prototype.exitDiv_function = function(ctx) {
};


// Enter a parse tree produced by qParser#drop_function.
qListener.prototype.enterDrop_function = function(ctx) {
};

// Exit a parse tree produced by qParser#drop_function.
qListener.prototype.exitDrop_function = function(ctx) {
};


// Enter a parse tree produced by qParser#each_function.
qListener.prototype.enterEach_function = function(ctx) {
};

// Exit a parse tree produced by qParser#each_function.
qListener.prototype.exitEach_function = function(ctx) {
};


// Enter a parse tree produced by qParser#enlist_function.
qListener.prototype.enterEnlist_function = function(ctx) {
};

// Exit a parse tree produced by qParser#enlist_function.
qListener.prototype.exitEnlist_function = function(ctx) {
};


// Enter a parse tree produced by qParser#eval_function.
qListener.prototype.enterEval_function = function(ctx) {
};

// Exit a parse tree produced by qParser#eval_function.
qListener.prototype.exitEval_function = function(ctx) {
};


// Enter a parse tree produced by qParser#except_function.
qListener.prototype.enterExcept_function = function(ctx) {
};

// Exit a parse tree produced by qParser#except_function.
qListener.prototype.exitExcept_function = function(ctx) {
};


// Enter a parse tree produced by qParser#exec_function.
qListener.prototype.enterExec_function = function(ctx) {
};

// Exit a parse tree produced by qParser#exec_function.
qListener.prototype.exitExec_function = function(ctx) {
};


// Enter a parse tree produced by qParser#exp_function.
qListener.prototype.enterExp_function = function(ctx) {
};

// Exit a parse tree produced by qParser#exp_function.
qListener.prototype.exitExp_function = function(ctx) {
};


// Enter a parse tree produced by qParser#fby_function.
qListener.prototype.enterFby_function = function(ctx) {
};

// Exit a parse tree produced by qParser#fby_function.
qListener.prototype.exitFby_function = function(ctx) {
};


// Enter a parse tree produced by qParser#fill_function.
qListener.prototype.enterFill_function = function(ctx) {
};

// Exit a parse tree produced by qParser#fill_function.
qListener.prototype.exitFill_function = function(ctx) {
};


// Enter a parse tree produced by qParser#first_function.
qListener.prototype.enterFirst_function = function(ctx) {
};

// Exit a parse tree produced by qParser#first_function.
qListener.prototype.exitFirst_function = function(ctx) {
};


// Enter a parse tree produced by qParser#flip_function.
qListener.prototype.enterFlip_function = function(ctx) {
};

// Exit a parse tree produced by qParser#flip_function.
qListener.prototype.exitFlip_function = function(ctx) {
};


// Enter a parse tree produced by qParser#floor_function.
qListener.prototype.enterFloor_function = function(ctx) {
};

// Exit a parse tree produced by qParser#floor_function.
qListener.prototype.exitFloor_function = function(ctx) {
};


// Enter a parse tree produced by qParser#get_function.
qListener.prototype.enterGet_function = function(ctx) {
};

// Exit a parse tree produced by qParser#get_function.
qListener.prototype.exitGet_function = function(ctx) {
};


// Enter a parse tree produced by qParser#group_function.
qListener.prototype.enterGroup_function = function(ctx) {
};

// Exit a parse tree produced by qParser#group_function.
qListener.prototype.exitGroup_function = function(ctx) {
};


// Enter a parse tree produced by qParser#gtime_function.
qListener.prototype.enterGtime_function = function(ctx) {
};

// Exit a parse tree produced by qParser#gtime_function.
qListener.prototype.exitGtime_function = function(ctx) {
};


// Enter a parse tree produced by qParser#hclose_function.
qListener.prototype.enterHclose_function = function(ctx) {
};

// Exit a parse tree produced by qParser#hclose_function.
qListener.prototype.exitHclose_function = function(ctx) {
};


// Enter a parse tree produced by qParser#hcount_function.
qListener.prototype.enterHcount_function = function(ctx) {
};

// Exit a parse tree produced by qParser#hcount_function.
qListener.prototype.exitHcount_function = function(ctx) {
};


// Enter a parse tree produced by qParser#hdel_function.
qListener.prototype.enterHdel_function = function(ctx) {
};

// Exit a parse tree produced by qParser#hdel_function.
qListener.prototype.exitHdel_function = function(ctx) {
};


// Enter a parse tree produced by qParser#hopen_function.
qListener.prototype.enterHopen_function = function(ctx) {
};

// Exit a parse tree produced by qParser#hopen_function.
qListener.prototype.exitHopen_function = function(ctx) {
};


// Enter a parse tree produced by qParser#hsym_function.
qListener.prototype.enterHsym_function = function(ctx) {
};

// Exit a parse tree produced by qParser#hsym_function.
qListener.prototype.exitHsym_function = function(ctx) {
};


// Enter a parse tree produced by qParser#iasc_function.
qListener.prototype.enterIasc_function = function(ctx) {
};

// Exit a parse tree produced by qParser#iasc_function.
qListener.prototype.exitIasc_function = function(ctx) {
};


// Enter a parse tree produced by qParser#idesc_function.
qListener.prototype.enterIdesc_function = function(ctx) {
};

// Exit a parse tree produced by qParser#idesc_function.
qListener.prototype.exitIdesc_function = function(ctx) {
};


// Enter a parse tree produced by qParser#ij_function.
qListener.prototype.enterIj_function = function(ctx) {
};

// Exit a parse tree produced by qParser#ij_function.
qListener.prototype.exitIj_function = function(ctx) {
};


// Enter a parse tree produced by qParser#in_function.
qListener.prototype.enterIn_function = function(ctx) {
};

// Exit a parse tree produced by qParser#in_function.
qListener.prototype.exitIn_function = function(ctx) {
};


// Enter a parse tree produced by qParser#insert_function.
qListener.prototype.enterInsert_function = function(ctx) {
};

// Exit a parse tree produced by qParser#insert_function.
qListener.prototype.exitInsert_function = function(ctx) {
};


// Enter a parse tree produced by qParser#inter_function.
qListener.prototype.enterInter_function = function(ctx) {
};

// Exit a parse tree produced by qParser#inter_function.
qListener.prototype.exitInter_function = function(ctx) {
};


// Enter a parse tree produced by qParser#inv_function.
qListener.prototype.enterInv_function = function(ctx) {
};

// Exit a parse tree produced by qParser#inv_function.
qListener.prototype.exitInv_function = function(ctx) {
};


// Enter a parse tree produced by qParser#keys_function.
qListener.prototype.enterKeys_function = function(ctx) {
};

// Exit a parse tree produced by qParser#keys_function.
qListener.prototype.exitKeys_function = function(ctx) {
};


// Enter a parse tree produced by qParser#last_function.
qListener.prototype.enterLast_function = function(ctx) {
};

// Exit a parse tree produced by qParser#last_function.
qListener.prototype.exitLast_function = function(ctx) {
};


// Enter a parse tree produced by qParser#like_function.
qListener.prototype.enterLike_function = function(ctx) {
};

// Exit a parse tree produced by qParser#like_function.
qListener.prototype.exitLike_function = function(ctx) {
};


// Enter a parse tree produced by qParser#list_function.
qListener.prototype.enterList_function = function(ctx) {
};

// Exit a parse tree produced by qParser#list_function.
qListener.prototype.exitList_function = function(ctx) {
};


// Enter a parse tree produced by qParser#lj_function.
qListener.prototype.enterLj_function = function(ctx) {
};

// Exit a parse tree produced by qParser#lj_function.
qListener.prototype.exitLj_function = function(ctx) {
};


// Enter a parse tree produced by qParser#load_function.
qListener.prototype.enterLoad_function = function(ctx) {
};

// Exit a parse tree produced by qParser#load_function.
qListener.prototype.exitLoad_function = function(ctx) {
};


// Enter a parse tree produced by qParser#log_function.
qListener.prototype.enterLog_function = function(ctx) {
};

// Exit a parse tree produced by qParser#log_function.
qListener.prototype.exitLog_function = function(ctx) {
};


// Enter a parse tree produced by qParser#lower_function.
qListener.prototype.enterLower_function = function(ctx) {
};

// Exit a parse tree produced by qParser#lower_function.
qListener.prototype.exitLower_function = function(ctx) {
};


// Enter a parse tree produced by qParser#lsq_function.
qListener.prototype.enterLsq_function = function(ctx) {
};

// Exit a parse tree produced by qParser#lsq_function.
qListener.prototype.exitLsq_function = function(ctx) {
};


// Enter a parse tree produced by qParser#ltime_function.
qListener.prototype.enterLtime_function = function(ctx) {
};

// Exit a parse tree produced by qParser#ltime_function.
qListener.prototype.exitLtime_function = function(ctx) {
};


// Enter a parse tree produced by qParser#ltrim_function.
qListener.prototype.enterLtrim_function = function(ctx) {
};

// Exit a parse tree produced by qParser#ltrim_function.
qListener.prototype.exitLtrim_function = function(ctx) {
};


// Enter a parse tree produced by qParser#mavg_function.
qListener.prototype.enterMavg_function = function(ctx) {
};

// Exit a parse tree produced by qParser#mavg_function.
qListener.prototype.exitMavg_function = function(ctx) {
};


// Enter a parse tree produced by qParser#max_function.
qListener.prototype.enterMax_function = function(ctx) {
};

// Exit a parse tree produced by qParser#max_function.
qListener.prototype.exitMax_function = function(ctx) {
};


// Enter a parse tree produced by qParser#maxs_function.
qListener.prototype.enterMaxs_function = function(ctx) {
};

// Exit a parse tree produced by qParser#maxs_function.
qListener.prototype.exitMaxs_function = function(ctx) {
};


// Enter a parse tree produced by qParser#mcount_function.
qListener.prototype.enterMcount_function = function(ctx) {
};

// Exit a parse tree produced by qParser#mcount_function.
qListener.prototype.exitMcount_function = function(ctx) {
};


// Enter a parse tree produced by qParser#md5_function.
qListener.prototype.enterMd5_function = function(ctx) {
};

// Exit a parse tree produced by qParser#md5_function.
qListener.prototype.exitMd5_function = function(ctx) {
};


// Enter a parse tree produced by qParser#mdev_function.
qListener.prototype.enterMdev_function = function(ctx) {
};

// Exit a parse tree produced by qParser#mdev_function.
qListener.prototype.exitMdev_function = function(ctx) {
};


// Enter a parse tree produced by qParser#med_function.
qListener.prototype.enterMed_function = function(ctx) {
};

// Exit a parse tree produced by qParser#med_function.
qListener.prototype.exitMed_function = function(ctx) {
};


// Enter a parse tree produced by qParser#meta_function.
qListener.prototype.enterMeta_function = function(ctx) {
};

// Exit a parse tree produced by qParser#meta_function.
qListener.prototype.exitMeta_function = function(ctx) {
};


// Enter a parse tree produced by qParser#min_function.
qListener.prototype.enterMin_function = function(ctx) {
};

// Exit a parse tree produced by qParser#min_function.
qListener.prototype.exitMin_function = function(ctx) {
};


// Enter a parse tree produced by qParser#mins_function.
qListener.prototype.enterMins_function = function(ctx) {
};

// Exit a parse tree produced by qParser#mins_function.
qListener.prototype.exitMins_function = function(ctx) {
};


// Enter a parse tree produced by qParser#mmax_function.
qListener.prototype.enterMmax_function = function(ctx) {
};

// Exit a parse tree produced by qParser#mmax_function.
qListener.prototype.exitMmax_function = function(ctx) {
};


// Enter a parse tree produced by qParser#mmin_function.
qListener.prototype.enterMmin_function = function(ctx) {
};

// Exit a parse tree produced by qParser#mmin_function.
qListener.prototype.exitMmin_function = function(ctx) {
};


// Enter a parse tree produced by qParser#mmu_function.
qListener.prototype.enterMmu_function = function(ctx) {
};

// Exit a parse tree produced by qParser#mmu_function.
qListener.prototype.exitMmu_function = function(ctx) {
};


// Enter a parse tree produced by qParser#mod_function.
qListener.prototype.enterMod_function = function(ctx) {
};

// Exit a parse tree produced by qParser#mod_function.
qListener.prototype.exitMod_function = function(ctx) {
};


// Enter a parse tree produced by qParser#msum_function.
qListener.prototype.enterMsum_function = function(ctx) {
};

// Exit a parse tree produced by qParser#msum_function.
qListener.prototype.exitMsum_function = function(ctx) {
};


// Enter a parse tree produced by qParser#neg_function.
qListener.prototype.enterNeg_function = function(ctx) {
};

// Exit a parse tree produced by qParser#neg_function.
qListener.prototype.exitNeg_function = function(ctx) {
};


// Enter a parse tree produced by qParser#next_function.
qListener.prototype.enterNext_function = function(ctx) {
};

// Exit a parse tree produced by qParser#next_function.
qListener.prototype.exitNext_function = function(ctx) {
};


// Enter a parse tree produced by qParser#not_function.
qListener.prototype.enterNot_function = function(ctx) {
};

// Exit a parse tree produced by qParser#not_function.
qListener.prototype.exitNot_function = function(ctx) {
};


// Enter a parse tree produced by qParser#null_function.
qListener.prototype.enterNull_function = function(ctx) {
};

// Exit a parse tree produced by qParser#null_function.
qListener.prototype.exitNull_function = function(ctx) {
};


// Enter a parse tree produced by qParser#or_function.
qListener.prototype.enterOr_function = function(ctx) {
};

// Exit a parse tree produced by qParser#or_function.
qListener.prototype.exitOr_function = function(ctx) {
};


// Enter a parse tree produced by qParser#over_function.
qListener.prototype.enterOver_function = function(ctx) {
};

// Exit a parse tree produced by qParser#over_function.
qListener.prototype.exitOver_function = function(ctx) {
};


// Enter a parse tree produced by qParser#parse_function.
qListener.prototype.enterParse_function = function(ctx) {
};

// Exit a parse tree produced by qParser#parse_function.
qListener.prototype.exitParse_function = function(ctx) {
};


// Enter a parse tree produced by qParser#peach_function.
qListener.prototype.enterPeach_function = function(ctx) {
};

// Exit a parse tree produced by qParser#peach_function.
qListener.prototype.exitPeach_function = function(ctx) {
};


// Enter a parse tree produced by qParser#pj_function.
qListener.prototype.enterPj_function = function(ctx) {
};

// Exit a parse tree produced by qParser#pj_function.
qListener.prototype.exitPj_function = function(ctx) {
};


// Enter a parse tree produced by qParser#plist_function.
qListener.prototype.enterPlist_function = function(ctx) {
};

// Exit a parse tree produced by qParser#plist_function.
qListener.prototype.exitPlist_function = function(ctx) {
};


// Enter a parse tree produced by qParser#prd_function.
qListener.prototype.enterPrd_function = function(ctx) {
};

// Exit a parse tree produced by qParser#prd_function.
qListener.prototype.exitPrd_function = function(ctx) {
};


// Enter a parse tree produced by qParser#prev_function.
qListener.prototype.enterPrev_function = function(ctx) {
};

// Exit a parse tree produced by qParser#prev_function.
qListener.prototype.exitPrev_function = function(ctx) {
};


// Enter a parse tree produced by qParser#prior_function.
qListener.prototype.enterPrior_function = function(ctx) {
};

// Exit a parse tree produced by qParser#prior_function.
qListener.prototype.exitPrior_function = function(ctx) {
};


// Enter a parse tree produced by qParser#rand_function.
qListener.prototype.enterRand_function = function(ctx) {
};

// Exit a parse tree produced by qParser#rand_function.
qListener.prototype.exitRand_function = function(ctx) {
};


// Enter a parse tree produced by qParser#rank_function.
qListener.prototype.enterRank_function = function(ctx) {
};

// Exit a parse tree produced by qParser#rank_function.
qListener.prototype.exitRank_function = function(ctx) {
};


// Enter a parse tree produced by qParser#ratios_function.
qListener.prototype.enterRatios_function = function(ctx) {
};

// Exit a parse tree produced by qParser#ratios_function.
qListener.prototype.exitRatios_function = function(ctx) {
};


// Enter a parse tree produced by qParser#raze_function.
qListener.prototype.enterRaze_function = function(ctx) {
};

// Exit a parse tree produced by qParser#raze_function.
qListener.prototype.exitRaze_function = function(ctx) {
};


// Enter a parse tree produced by qParser#read0_function.
qListener.prototype.enterRead0_function = function(ctx) {
};

// Exit a parse tree produced by qParser#read0_function.
qListener.prototype.exitRead0_function = function(ctx) {
};


// Enter a parse tree produced by qParser#read1_function.
qListener.prototype.enterRead1_function = function(ctx) {
};

// Exit a parse tree produced by qParser#read1_function.
qListener.prototype.exitRead1_function = function(ctx) {
};


// Enter a parse tree produced by qParser#reciprocal_function.
qListener.prototype.enterReciprocal_function = function(ctx) {
};

// Exit a parse tree produced by qParser#reciprocal_function.
qListener.prototype.exitReciprocal_function = function(ctx) {
};


// Enter a parse tree produced by qParser#reverse_function.
qListener.prototype.enterReverse_function = function(ctx) {
};

// Exit a parse tree produced by qParser#reverse_function.
qListener.prototype.exitReverse_function = function(ctx) {
};


// Enter a parse tree produced by qParser#rload_function.
qListener.prototype.enterRload_function = function(ctx) {
};

// Exit a parse tree produced by qParser#rload_function.
qListener.prototype.exitRload_function = function(ctx) {
};


// Enter a parse tree produced by qParser#rotate_function.
qListener.prototype.enterRotate_function = function(ctx) {
};

// Exit a parse tree produced by qParser#rotate_function.
qListener.prototype.exitRotate_function = function(ctx) {
};


// Enter a parse tree produced by qParser#rsave_function.
qListener.prototype.enterRsave_function = function(ctx) {
};

// Exit a parse tree produced by qParser#rsave_function.
qListener.prototype.exitRsave_function = function(ctx) {
};


// Enter a parse tree produced by qParser#rtrim_function.
qListener.prototype.enterRtrim_function = function(ctx) {
};

// Exit a parse tree produced by qParser#rtrim_function.
qListener.prototype.exitRtrim_function = function(ctx) {
};


// Enter a parse tree produced by qParser#save_function.
qListener.prototype.enterSave_function = function(ctx) {
};

// Exit a parse tree produced by qParser#save_function.
qListener.prototype.exitSave_function = function(ctx) {
};


// Enter a parse tree produced by qParser#scan_function.
qListener.prototype.enterScan_function = function(ctx) {
};

// Exit a parse tree produced by qParser#scan_function.
qListener.prototype.exitScan_function = function(ctx) {
};


// Enter a parse tree produced by qParser#select_function.
qListener.prototype.enterSelect_function = function(ctx) {
};

// Exit a parse tree produced by qParser#select_function.
qListener.prototype.exitSelect_function = function(ctx) {
};


// Enter a parse tree produced by qParser#set_function.
qListener.prototype.enterSet_function = function(ctx) {
};

// Exit a parse tree produced by qParser#set_function.
qListener.prototype.exitSet_function = function(ctx) {
};


// Enter a parse tree produced by qParser#show_function.
qListener.prototype.enterShow_function = function(ctx) {
};

// Exit a parse tree produced by qParser#show_function.
qListener.prototype.exitShow_function = function(ctx) {
};


// Enter a parse tree produced by qParser#signum_function.
qListener.prototype.enterSignum_function = function(ctx) {
};

// Exit a parse tree produced by qParser#signum_function.
qListener.prototype.exitSignum_function = function(ctx) {
};


// Enter a parse tree produced by qParser#sin_function.
qListener.prototype.enterSin_function = function(ctx) {
};

// Exit a parse tree produced by qParser#sin_function.
qListener.prototype.exitSin_function = function(ctx) {
};


// Enter a parse tree produced by qParser#sqrt_function.
qListener.prototype.enterSqrt_function = function(ctx) {
};

// Exit a parse tree produced by qParser#sqrt_function.
qListener.prototype.exitSqrt_function = function(ctx) {
};


// Enter a parse tree produced by qParser#ssr_function.
qListener.prototype.enterSsr_function = function(ctx) {
};

// Exit a parse tree produced by qParser#ssr_function.
qListener.prototype.exitSsr_function = function(ctx) {
};


// Enter a parse tree produced by qParser#string_function.
qListener.prototype.enterString_function = function(ctx) {
};

// Exit a parse tree produced by qParser#string_function.
qListener.prototype.exitString_function = function(ctx) {
};


// Enter a parse tree produced by qParser#sublist_function.
qListener.prototype.enterSublist_function = function(ctx) {
};

// Exit a parse tree produced by qParser#sublist_function.
qListener.prototype.exitSublist_function = function(ctx) {
};


// Enter a parse tree produced by qParser#sum_function.
qListener.prototype.enterSum_function = function(ctx) {
};

// Exit a parse tree produced by qParser#sum_function.
qListener.prototype.exitSum_function = function(ctx) {
};


// Enter a parse tree produced by qParser#sums_function.
qListener.prototype.enterSums_function = function(ctx) {
};

// Exit a parse tree produced by qParser#sums_function.
qListener.prototype.exitSums_function = function(ctx) {
};


// Enter a parse tree produced by qParser#sv_function.
qListener.prototype.enterSv_function = function(ctx) {
};

// Exit a parse tree produced by qParser#sv_function.
qListener.prototype.exitSv_function = function(ctx) {
};


// Enter a parse tree produced by qParser#system_function.
qListener.prototype.enterSystem_function = function(ctx) {
};

// Exit a parse tree produced by qParser#system_function.
qListener.prototype.exitSystem_function = function(ctx) {
};


// Enter a parse tree produced by qParser#tables_function.
qListener.prototype.enterTables_function = function(ctx) {
};

// Exit a parse tree produced by qParser#tables_function.
qListener.prototype.exitTables_function = function(ctx) {
};


// Enter a parse tree produced by qParser#tan_function.
qListener.prototype.enterTan_function = function(ctx) {
};

// Exit a parse tree produced by qParser#tan_function.
qListener.prototype.exitTan_function = function(ctx) {
};


// Enter a parse tree produced by qParser#til_function.
qListener.prototype.enterTil_function = function(ctx) {
};

// Exit a parse tree produced by qParser#til_function.
qListener.prototype.exitTil_function = function(ctx) {
};


// Enter a parse tree produced by qParser#trim_function.
qListener.prototype.enterTrim_function = function(ctx) {
};

// Exit a parse tree produced by qParser#trim_function.
qListener.prototype.exitTrim_function = function(ctx) {
};


// Enter a parse tree produced by qParser#type_function.
qListener.prototype.enterType_function = function(ctx) {
};

// Exit a parse tree produced by qParser#type_function.
qListener.prototype.exitType_function = function(ctx) {
};


// Enter a parse tree produced by qParser#uj_function.
qListener.prototype.enterUj_function = function(ctx) {
};

// Exit a parse tree produced by qParser#uj_function.
qListener.prototype.exitUj_function = function(ctx) {
};


// Enter a parse tree produced by qParser#ungroup_function.
qListener.prototype.enterUngroup_function = function(ctx) {
};

// Exit a parse tree produced by qParser#ungroup_function.
qListener.prototype.exitUngroup_function = function(ctx) {
};


// Enter a parse tree produced by qParser#union_function.
qListener.prototype.enterUnion_function = function(ctx) {
};

// Exit a parse tree produced by qParser#union_function.
qListener.prototype.exitUnion_function = function(ctx) {
};


// Enter a parse tree produced by qParser#update_function.
qListener.prototype.enterUpdate_function = function(ctx) {
};

// Exit a parse tree produced by qParser#update_function.
qListener.prototype.exitUpdate_function = function(ctx) {
};


// Enter a parse tree produced by qParser#upper_function.
qListener.prototype.enterUpper_function = function(ctx) {
};

// Exit a parse tree produced by qParser#upper_function.
qListener.prototype.exitUpper_function = function(ctx) {
};


// Enter a parse tree produced by qParser#upsert_function.
qListener.prototype.enterUpsert_function = function(ctx) {
};

// Exit a parse tree produced by qParser#upsert_function.
qListener.prototype.exitUpsert_function = function(ctx) {
};


// Enter a parse tree produced by qParser#value_function.
qListener.prototype.enterValue_function = function(ctx) {
};

// Exit a parse tree produced by qParser#value_function.
qListener.prototype.exitValue_function = function(ctx) {
};


// Enter a parse tree produced by qParser#var_function.
qListener.prototype.enterVar_function = function(ctx) {
};

// Exit a parse tree produced by qParser#var_function.
qListener.prototype.exitVar_function = function(ctx) {
};


// Enter a parse tree produced by qParser#view_function.
qListener.prototype.enterView_function = function(ctx) {
};

// Exit a parse tree produced by qParser#view_function.
qListener.prototype.exitView_function = function(ctx) {
};


// Enter a parse tree produced by qParser#vs_function.
qListener.prototype.enterVs_function = function(ctx) {
};

// Exit a parse tree produced by qParser#vs_function.
qListener.prototype.exitVs_function = function(ctx) {
};


// Enter a parse tree produced by qParser#wavg_function.
qListener.prototype.enterWavg_function = function(ctx) {
};

// Exit a parse tree produced by qParser#wavg_function.
qListener.prototype.exitWavg_function = function(ctx) {
};


// Enter a parse tree produced by qParser#where_function.
qListener.prototype.enterWhere_function = function(ctx) {
};

// Exit a parse tree produced by qParser#where_function.
qListener.prototype.exitWhere_function = function(ctx) {
};


// Enter a parse tree produced by qParser#within_function.
qListener.prototype.enterWithin_function = function(ctx) {
};

// Exit a parse tree produced by qParser#within_function.
qListener.prototype.exitWithin_function = function(ctx) {
};


// Enter a parse tree produced by qParser#wj1_function.
qListener.prototype.enterWj1_function = function(ctx) {
};

// Exit a parse tree produced by qParser#wj1_function.
qListener.prototype.exitWj1_function = function(ctx) {
};


// Enter a parse tree produced by qParser#wj2_function.
qListener.prototype.enterWj2_function = function(ctx) {
};

// Exit a parse tree produced by qParser#wj2_function.
qListener.prototype.exitWj2_function = function(ctx) {
};


// Enter a parse tree produced by qParser#ww_function.
qListener.prototype.enterWw_function = function(ctx) {
};

// Exit a parse tree produced by qParser#ww_function.
qListener.prototype.exitWw_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xasc_function.
qListener.prototype.enterXasc_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xasc_function.
qListener.prototype.exitXasc_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xbar_function.
qListener.prototype.enterXbar_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xbar_function.
qListener.prototype.exitXbar_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xcols_function.
qListener.prototype.enterXcols_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xcols_function.
qListener.prototype.exitXcols_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xdesc_function.
qListener.prototype.enterXdesc_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xdesc_function.
qListener.prototype.exitXdesc_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xexp_function.
qListener.prototype.enterXexp_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xexp_function.
qListener.prototype.exitXexp_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xgroup_function.
qListener.prototype.enterXgroup_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xgroup_function.
qListener.prototype.exitXgroup_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xkey_function.
qListener.prototype.enterXkey_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xkey_function.
qListener.prototype.exitXkey_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xlog_function.
qListener.prototype.enterXlog_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xlog_function.
qListener.prototype.exitXlog_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xprev_function.
qListener.prototype.enterXprev_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xprev_function.
qListener.prototype.exitXprev_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xrank_function.
qListener.prototype.enterXrank_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xrank_function.
qListener.prototype.exitXrank_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xranked_function.
qListener.prototype.enterXranked_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xranked_function.
qListener.prototype.exitXranked_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xrecs_function.
qListener.prototype.enterXrecs_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xrecs_function.
qListener.prototype.exitXrecs_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xrows_function.
qListener.prototype.enterXrows_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xrows_function.
qListener.prototype.exitXrows_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xss_function.
qListener.prototype.enterXss_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xss_function.
qListener.prototype.exitXss_function = function(ctx) {
};


// Enter a parse tree produced by qParser#xtype_function.
qListener.prototype.enterXtype_function = function(ctx) {
};

// Exit a parse tree produced by qParser#xtype_function.
qListener.prototype.exitXtype_function = function(ctx) {
};


// Enter a parse tree produced by qParser#yield_function.
qListener.prototype.enterYield_function = function(ctx) {
};

// Exit a parse tree produced by qParser#yield_function.
qListener.prototype.exitYield_function = function(ctx) {
};


// Enter a parse tree produced by qParser#zip_function.
qListener.prototype.enterZip_function = function(ctx) {
};

// Exit a parse tree produced by qParser#zip_function.
qListener.prototype.exitZip_function = function(ctx) {
};



exports.qListener = qListener;