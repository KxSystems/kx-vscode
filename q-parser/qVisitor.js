// Generated from q.g4 by ANTLR 4.8
// jshint ignore: start
var antlr4 = require('antlr4/index');

// This class defines a complete generic visitor for a parse tree produced by qParser.

function qVisitor() {
	antlr4.tree.ParseTreeVisitor.call(this);
	return this;
}

qVisitor.prototype = Object.create(antlr4.tree.ParseTreeVisitor.prototype);
qVisitor.prototype.constructor = qVisitor;

// Visit a parse tree produced by qParser#variable_declaration.
qVisitor.prototype.visitVariable_declaration = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#storage_type.
qVisitor.prototype.visitStorage_type = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#variable_name.
qVisitor.prototype.visitVariable_name = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#expression.
qVisitor.prototype.visitExpression = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#or_expression.
qVisitor.prototype.visitOr_expression = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#and_expression.
qVisitor.prototype.visitAnd_expression = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#comparison_expression.
qVisitor.prototype.visitComparison_expression = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#additive_expression.
qVisitor.prototype.visitAdditive_expression = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#multiplicative_expression.
qVisitor.prototype.visitMultiplicative_expression = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#unary_expression.
qVisitor.prototype.visitUnary_expression = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#primary_expression.
qVisitor.prototype.visitPrimary_expression = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#abs_function.
qVisitor.prototype.visitAbs_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#acos_function.
qVisitor.prototype.visitAcos_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#all_function.
qVisitor.prototype.visitAll_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#and_function.
qVisitor.prototype.visitAnd_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#any_function.
qVisitor.prototype.visitAny_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#asin_function.
qVisitor.prototype.visitAsin_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#atan_function.
qVisitor.prototype.visitAtan_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#avg_function.
qVisitor.prototype.visitAvg_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#ceiling_function.
qVisitor.prototype.visitCeiling_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#cos_function.
qVisitor.prototype.visitCos_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#count_function.
qVisitor.prototype.visitCount_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#cross_function.
qVisitor.prototype.visitCross_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#delete_function.
qVisitor.prototype.visitDelete_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#deltas_function.
qVisitor.prototype.visitDeltas_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#dev_function.
qVisitor.prototype.visitDev_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#distinct_function.
qVisitor.prototype.visitDistinct_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#div_function.
qVisitor.prototype.visitDiv_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#drop_function.
qVisitor.prototype.visitDrop_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#each_function.
qVisitor.prototype.visitEach_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#enlist_function.
qVisitor.prototype.visitEnlist_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#eval_function.
qVisitor.prototype.visitEval_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#except_function.
qVisitor.prototype.visitExcept_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#exec_function.
qVisitor.prototype.visitExec_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#exp_function.
qVisitor.prototype.visitExp_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#fby_function.
qVisitor.prototype.visitFby_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#fill_function.
qVisitor.prototype.visitFill_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#first_function.
qVisitor.prototype.visitFirst_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#flip_function.
qVisitor.prototype.visitFlip_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#floor_function.
qVisitor.prototype.visitFloor_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#get_function.
qVisitor.prototype.visitGet_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#group_function.
qVisitor.prototype.visitGroup_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#gtime_function.
qVisitor.prototype.visitGtime_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#hclose_function.
qVisitor.prototype.visitHclose_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#hcount_function.
qVisitor.prototype.visitHcount_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#hdel_function.
qVisitor.prototype.visitHdel_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#hopen_function.
qVisitor.prototype.visitHopen_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#hsym_function.
qVisitor.prototype.visitHsym_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#iasc_function.
qVisitor.prototype.visitIasc_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#idesc_function.
qVisitor.prototype.visitIdesc_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#ij_function.
qVisitor.prototype.visitIj_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#in_function.
qVisitor.prototype.visitIn_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#insert_function.
qVisitor.prototype.visitInsert_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#inter_function.
qVisitor.prototype.visitInter_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#inv_function.
qVisitor.prototype.visitInv_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#keys_function.
qVisitor.prototype.visitKeys_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#last_function.
qVisitor.prototype.visitLast_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#like_function.
qVisitor.prototype.visitLike_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#list_function.
qVisitor.prototype.visitList_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#lj_function.
qVisitor.prototype.visitLj_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#load_function.
qVisitor.prototype.visitLoad_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#log_function.
qVisitor.prototype.visitLog_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#lower_function.
qVisitor.prototype.visitLower_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#lsq_function.
qVisitor.prototype.visitLsq_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#ltime_function.
qVisitor.prototype.visitLtime_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#ltrim_function.
qVisitor.prototype.visitLtrim_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#mavg_function.
qVisitor.prototype.visitMavg_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#max_function.
qVisitor.prototype.visitMax_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#maxs_function.
qVisitor.prototype.visitMaxs_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#mcount_function.
qVisitor.prototype.visitMcount_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#md5_function.
qVisitor.prototype.visitMd5_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#mdev_function.
qVisitor.prototype.visitMdev_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#med_function.
qVisitor.prototype.visitMed_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#meta_function.
qVisitor.prototype.visitMeta_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#min_function.
qVisitor.prototype.visitMin_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#mins_function.
qVisitor.prototype.visitMins_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#mmax_function.
qVisitor.prototype.visitMmax_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#mmin_function.
qVisitor.prototype.visitMmin_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#mmu_function.
qVisitor.prototype.visitMmu_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#mod_function.
qVisitor.prototype.visitMod_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#msum_function.
qVisitor.prototype.visitMsum_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#neg_function.
qVisitor.prototype.visitNeg_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#next_function.
qVisitor.prototype.visitNext_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#not_function.
qVisitor.prototype.visitNot_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#null_function.
qVisitor.prototype.visitNull_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#or_function.
qVisitor.prototype.visitOr_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#over_function.
qVisitor.prototype.visitOver_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#parse_function.
qVisitor.prototype.visitParse_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#peach_function.
qVisitor.prototype.visitPeach_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#pj_function.
qVisitor.prototype.visitPj_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#plist_function.
qVisitor.prototype.visitPlist_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#prd_function.
qVisitor.prototype.visitPrd_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#prev_function.
qVisitor.prototype.visitPrev_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#prior_function.
qVisitor.prototype.visitPrior_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#rand_function.
qVisitor.prototype.visitRand_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#rank_function.
qVisitor.prototype.visitRank_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#ratios_function.
qVisitor.prototype.visitRatios_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#raze_function.
qVisitor.prototype.visitRaze_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#read0_function.
qVisitor.prototype.visitRead0_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#read1_function.
qVisitor.prototype.visitRead1_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#reciprocal_function.
qVisitor.prototype.visitReciprocal_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#reverse_function.
qVisitor.prototype.visitReverse_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#rload_function.
qVisitor.prototype.visitRload_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#rotate_function.
qVisitor.prototype.visitRotate_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#rsave_function.
qVisitor.prototype.visitRsave_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#rtrim_function.
qVisitor.prototype.visitRtrim_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#save_function.
qVisitor.prototype.visitSave_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#scan_function.
qVisitor.prototype.visitScan_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#select_function.
qVisitor.prototype.visitSelect_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#set_function.
qVisitor.prototype.visitSet_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#show_function.
qVisitor.prototype.visitShow_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#signum_function.
qVisitor.prototype.visitSignum_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#sin_function.
qVisitor.prototype.visitSin_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#sqrt_function.
qVisitor.prototype.visitSqrt_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#ssr_function.
qVisitor.prototype.visitSsr_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#string_function.
qVisitor.prototype.visitString_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#sublist_function.
qVisitor.prototype.visitSublist_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#sum_function.
qVisitor.prototype.visitSum_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#sums_function.
qVisitor.prototype.visitSums_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#sv_function.
qVisitor.prototype.visitSv_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#system_function.
qVisitor.prototype.visitSystem_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#tables_function.
qVisitor.prototype.visitTables_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#tan_function.
qVisitor.prototype.visitTan_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#til_function.
qVisitor.prototype.visitTil_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#trim_function.
qVisitor.prototype.visitTrim_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#type_function.
qVisitor.prototype.visitType_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#uj_function.
qVisitor.prototype.visitUj_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#ungroup_function.
qVisitor.prototype.visitUngroup_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#union_function.
qVisitor.prototype.visitUnion_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#update_function.
qVisitor.prototype.visitUpdate_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#upper_function.
qVisitor.prototype.visitUpper_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#upsert_function.
qVisitor.prototype.visitUpsert_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#value_function.
qVisitor.prototype.visitValue_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#var_function.
qVisitor.prototype.visitVar_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#view_function.
qVisitor.prototype.visitView_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#vs_function.
qVisitor.prototype.visitVs_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#wavg_function.
qVisitor.prototype.visitWavg_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#where_function.
qVisitor.prototype.visitWhere_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#within_function.
qVisitor.prototype.visitWithin_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#wj1_function.
qVisitor.prototype.visitWj1_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#wj2_function.
qVisitor.prototype.visitWj2_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#ww_function.
qVisitor.prototype.visitWw_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xasc_function.
qVisitor.prototype.visitXasc_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xbar_function.
qVisitor.prototype.visitXbar_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xcols_function.
qVisitor.prototype.visitXcols_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xdesc_function.
qVisitor.prototype.visitXdesc_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xexp_function.
qVisitor.prototype.visitXexp_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xgroup_function.
qVisitor.prototype.visitXgroup_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xkey_function.
qVisitor.prototype.visitXkey_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xlog_function.
qVisitor.prototype.visitXlog_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xprev_function.
qVisitor.prototype.visitXprev_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xrank_function.
qVisitor.prototype.visitXrank_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xranked_function.
qVisitor.prototype.visitXranked_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xrecs_function.
qVisitor.prototype.visitXrecs_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xrows_function.
qVisitor.prototype.visitXrows_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xss_function.
qVisitor.prototype.visitXss_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#xtype_function.
qVisitor.prototype.visitXtype_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#yield_function.
qVisitor.prototype.visitYield_function = function(ctx) {
  return this.visitChildren(ctx);
};


// Visit a parse tree produced by qParser#zip_function.
qVisitor.prototype.visitZip_function = function(ctx) {
  return this.visitChildren(ctx);
};



exports.qVisitor = qVisitor;