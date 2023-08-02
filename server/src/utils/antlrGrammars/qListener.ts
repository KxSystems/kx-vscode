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

// Generated from grammars/q.g4 by ANTLR 4.13.0

import { ParseTreeListener } from "antlr4";

import {
  Abs_functionContext,
  Acos_functionContext,
  Additive_expressionContext,
  All_functionContext,
  And_expressionContext,
  And_functionContext,
  Any_functionContext,
  Asin_functionContext,
  Atan_functionContext,
  Avg_functionContext,
  Ceiling_functionContext,
  Comparison_expressionContext,
  Cos_functionContext,
  Count_functionContext,
  Cross_functionContext,
  Delete_functionContext,
  Deltas_functionContext,
  Dev_functionContext,
  Distinct_functionContext,
  Div_functionContext,
  Drop_functionContext,
  Each_functionContext,
  Enlist_functionContext,
  Eval_functionContext,
  Except_functionContext,
  Exec_functionContext,
  Exp_functionContext,
  ExpressionContext,
  Fby_functionContext,
  Fill_functionContext,
  First_functionContext,
  Flip_functionContext,
  Floor_functionContext,
  Get_functionContext,
  Group_functionContext,
  Gtime_functionContext,
  Hclose_functionContext,
  Hcount_functionContext,
  Hdel_functionContext,
  Hopen_functionContext,
  Hsym_functionContext,
  Iasc_functionContext,
  Idesc_functionContext,
  Ij_functionContext,
  In_functionContext,
  Insert_functionContext,
  Inter_functionContext,
  Inv_functionContext,
  Keys_functionContext,
  Last_functionContext,
  Like_functionContext,
  List_functionContext,
  Lj_functionContext,
  Load_functionContext,
  Log_functionContext,
  Lower_functionContext,
  Lsq_functionContext,
  Ltime_functionContext,
  Ltrim_functionContext,
  Mavg_functionContext,
  Max_functionContext,
  Maxs_functionContext,
  Mcount_functionContext,
  Md5_functionContext,
  Mdev_functionContext,
  Med_functionContext,
  Meta_functionContext,
  Min_functionContext,
  Mins_functionContext,
  Mmax_functionContext,
  Mmin_functionContext,
  Mmu_functionContext,
  Mod_functionContext,
  Msum_functionContext,
  Multiplicative_expressionContext,
  Neg_functionContext,
  Next_functionContext,
  Not_functionContext,
  Null_functionContext,
  Or_expressionContext,
  Or_functionContext,
  Over_functionContext,
  Parse_functionContext,
  Peach_functionContext,
  Pj_functionContext,
  Plist_functionContext,
  Prd_functionContext,
  Prev_functionContext,
  Primary_expressionContext,
  Prior_functionContext,
  Rand_functionContext,
  Rank_functionContext,
  Ratios_functionContext,
  Raze_functionContext,
  Read0_functionContext,
  Read1_functionContext,
  Reciprocal_functionContext,
  Reverse_functionContext,
  Rload_functionContext,
  Rotate_functionContext,
  Rsave_functionContext,
  Rtrim_functionContext,
  Save_functionContext,
  Scan_functionContext,
  Select_functionContext,
  Set_functionContext,
  Show_functionContext,
  Signum_functionContext,
  Sin_functionContext,
  Sqrt_functionContext,
  Ssr_functionContext,
  Storage_typeContext,
  String_functionContext,
  Sublist_functionContext,
  Sum_functionContext,
  Sums_functionContext,
  Sv_functionContext,
  System_functionContext,
  Tables_functionContext,
  Tan_functionContext,
  Til_functionContext,
  Trim_functionContext,
  Type_functionContext,
  Uj_functionContext,
  Unary_expressionContext,
  Ungroup_functionContext,
  Union_functionContext,
  Update_functionContext,
  Upper_functionContext,
  Upsert_functionContext,
  Value_functionContext,
  Var_functionContext,
  Variable_declarationContext,
  Variable_nameContext,
  View_functionContext,
  Vs_functionContext,
  Wavg_functionContext,
  Where_functionContext,
  Within_functionContext,
  Wj1_functionContext,
  Wj2_functionContext,
  Ww_functionContext,
  Xasc_functionContext,
  Xbar_functionContext,
  Xcols_functionContext,
  Xdesc_functionContext,
  Xexp_functionContext,
  Xgroup_functionContext,
  Xkey_functionContext,
  Xlog_functionContext,
  Xprev_functionContext,
  Xrank_functionContext,
  Xranked_functionContext,
  Xrecs_functionContext,
  Xrows_functionContext,
  Xss_functionContext,
  Xtype_functionContext,
  Yield_functionContext,
  Zip_functionContext,
} from "./qParser";

/**
 * This interface defines a complete listener for a parse tree produced by
 * `qParser`.
 */
export default class qListener extends ParseTreeListener {
  /**
   * Enter a parse tree produced by `qParser.variable_declaration`.
   * @param ctx the parse tree
   */
  enterVariable_declaration?: (ctx: Variable_declarationContext) => void;
  /**
   * Exit a parse tree produced by `qParser.variable_declaration`.
   * @param ctx the parse tree
   */
  exitVariable_declaration?: (ctx: Variable_declarationContext) => void;
  /**
   * Enter a parse tree produced by `qParser.storage_type`.
   * @param ctx the parse tree
   */
  enterStorage_type?: (ctx: Storage_typeContext) => void;
  /**
   * Exit a parse tree produced by `qParser.storage_type`.
   * @param ctx the parse tree
   */
  exitStorage_type?: (ctx: Storage_typeContext) => void;
  /**
   * Enter a parse tree produced by `qParser.variable_name`.
   * @param ctx the parse tree
   */
  enterVariable_name?: (ctx: Variable_nameContext) => void;
  /**
   * Exit a parse tree produced by `qParser.variable_name`.
   * @param ctx the parse tree
   */
  exitVariable_name?: (ctx: Variable_nameContext) => void;
  /**
   * Enter a parse tree produced by `qParser.expression`.
   * @param ctx the parse tree
   */
  enterExpression?: (ctx: ExpressionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.expression`.
   * @param ctx the parse tree
   */
  exitExpression?: (ctx: ExpressionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.or_expression`.
   * @param ctx the parse tree
   */
  enterOr_expression?: (ctx: Or_expressionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.or_expression`.
   * @param ctx the parse tree
   */
  exitOr_expression?: (ctx: Or_expressionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.and_expression`.
   * @param ctx the parse tree
   */
  enterAnd_expression?: (ctx: And_expressionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.and_expression`.
   * @param ctx the parse tree
   */
  exitAnd_expression?: (ctx: And_expressionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.comparison_expression`.
   * @param ctx the parse tree
   */
  enterComparison_expression?: (ctx: Comparison_expressionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.comparison_expression`.
   * @param ctx the parse tree
   */
  exitComparison_expression?: (ctx: Comparison_expressionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.additive_expression`.
   * @param ctx the parse tree
   */
  enterAdditive_expression?: (ctx: Additive_expressionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.additive_expression`.
   * @param ctx the parse tree
   */
  exitAdditive_expression?: (ctx: Additive_expressionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.multiplicative_expression`.
   * @param ctx the parse tree
   */
  enterMultiplicative_expression?: (
    ctx: Multiplicative_expressionContext
  ) => void;
  /**
   * Exit a parse tree produced by `qParser.multiplicative_expression`.
   * @param ctx the parse tree
   */
  exitMultiplicative_expression?: (
    ctx: Multiplicative_expressionContext
  ) => void;
  /**
   * Enter a parse tree produced by `qParser.unary_expression`.
   * @param ctx the parse tree
   */
  enterUnary_expression?: (ctx: Unary_expressionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.unary_expression`.
   * @param ctx the parse tree
   */
  exitUnary_expression?: (ctx: Unary_expressionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.primary_expression`.
   * @param ctx the parse tree
   */
  enterPrimary_expression?: (ctx: Primary_expressionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.primary_expression`.
   * @param ctx the parse tree
   */
  exitPrimary_expression?: (ctx: Primary_expressionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.abs_function`.
   * @param ctx the parse tree
   */
  enterAbs_function?: (ctx: Abs_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.abs_function`.
   * @param ctx the parse tree
   */
  exitAbs_function?: (ctx: Abs_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.acos_function`.
   * @param ctx the parse tree
   */
  enterAcos_function?: (ctx: Acos_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.acos_function`.
   * @param ctx the parse tree
   */
  exitAcos_function?: (ctx: Acos_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.all_function`.
   * @param ctx the parse tree
   */
  enterAll_function?: (ctx: All_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.all_function`.
   * @param ctx the parse tree
   */
  exitAll_function?: (ctx: All_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.and_function`.
   * @param ctx the parse tree
   */
  enterAnd_function?: (ctx: And_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.and_function`.
   * @param ctx the parse tree
   */
  exitAnd_function?: (ctx: And_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.any_function`.
   * @param ctx the parse tree
   */
  enterAny_function?: (ctx: Any_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.any_function`.
   * @param ctx the parse tree
   */
  exitAny_function?: (ctx: Any_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.asin_function`.
   * @param ctx the parse tree
   */
  enterAsin_function?: (ctx: Asin_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.asin_function`.
   * @param ctx the parse tree
   */
  exitAsin_function?: (ctx: Asin_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.atan_function`.
   * @param ctx the parse tree
   */
  enterAtan_function?: (ctx: Atan_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.atan_function`.
   * @param ctx the parse tree
   */
  exitAtan_function?: (ctx: Atan_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.avg_function`.
   * @param ctx the parse tree
   */
  enterAvg_function?: (ctx: Avg_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.avg_function`.
   * @param ctx the parse tree
   */
  exitAvg_function?: (ctx: Avg_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.ceiling_function`.
   * @param ctx the parse tree
   */
  enterCeiling_function?: (ctx: Ceiling_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.ceiling_function`.
   * @param ctx the parse tree
   */
  exitCeiling_function?: (ctx: Ceiling_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.cos_function`.
   * @param ctx the parse tree
   */
  enterCos_function?: (ctx: Cos_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.cos_function`.
   * @param ctx the parse tree
   */
  exitCos_function?: (ctx: Cos_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.count_function`.
   * @param ctx the parse tree
   */
  enterCount_function?: (ctx: Count_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.count_function`.
   * @param ctx the parse tree
   */
  exitCount_function?: (ctx: Count_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.cross_function`.
   * @param ctx the parse tree
   */
  enterCross_function?: (ctx: Cross_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.cross_function`.
   * @param ctx the parse tree
   */
  exitCross_function?: (ctx: Cross_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.delete_function`.
   * @param ctx the parse tree
   */
  enterDelete_function?: (ctx: Delete_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.delete_function`.
   * @param ctx the parse tree
   */
  exitDelete_function?: (ctx: Delete_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.deltas_function`.
   * @param ctx the parse tree
   */
  enterDeltas_function?: (ctx: Deltas_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.deltas_function`.
   * @param ctx the parse tree
   */
  exitDeltas_function?: (ctx: Deltas_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.dev_function`.
   * @param ctx the parse tree
   */
  enterDev_function?: (ctx: Dev_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.dev_function`.
   * @param ctx the parse tree
   */
  exitDev_function?: (ctx: Dev_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.distinct_function`.
   * @param ctx the parse tree
   */
  enterDistinct_function?: (ctx: Distinct_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.distinct_function`.
   * @param ctx the parse tree
   */
  exitDistinct_function?: (ctx: Distinct_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.div_function`.
   * @param ctx the parse tree
   */
  enterDiv_function?: (ctx: Div_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.div_function`.
   * @param ctx the parse tree
   */
  exitDiv_function?: (ctx: Div_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.drop_function`.
   * @param ctx the parse tree
   */
  enterDrop_function?: (ctx: Drop_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.drop_function`.
   * @param ctx the parse tree
   */
  exitDrop_function?: (ctx: Drop_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.each_function`.
   * @param ctx the parse tree
   */
  enterEach_function?: (ctx: Each_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.each_function`.
   * @param ctx the parse tree
   */
  exitEach_function?: (ctx: Each_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.enlist_function`.
   * @param ctx the parse tree
   */
  enterEnlist_function?: (ctx: Enlist_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.enlist_function`.
   * @param ctx the parse tree
   */
  exitEnlist_function?: (ctx: Enlist_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.eval_function`.
   * @param ctx the parse tree
   */
  enterEval_function?: (ctx: Eval_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.eval_function`.
   * @param ctx the parse tree
   */
  exitEval_function?: (ctx: Eval_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.except_function`.
   * @param ctx the parse tree
   */
  enterExcept_function?: (ctx: Except_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.except_function`.
   * @param ctx the parse tree
   */
  exitExcept_function?: (ctx: Except_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.exec_function`.
   * @param ctx the parse tree
   */
  enterExec_function?: (ctx: Exec_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.exec_function`.
   * @param ctx the parse tree
   */
  exitExec_function?: (ctx: Exec_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.exp_function`.
   * @param ctx the parse tree
   */
  enterExp_function?: (ctx: Exp_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.exp_function`.
   * @param ctx the parse tree
   */
  exitExp_function?: (ctx: Exp_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.fby_function`.
   * @param ctx the parse tree
   */
  enterFby_function?: (ctx: Fby_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.fby_function`.
   * @param ctx the parse tree
   */
  exitFby_function?: (ctx: Fby_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.fill_function`.
   * @param ctx the parse tree
   */
  enterFill_function?: (ctx: Fill_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.fill_function`.
   * @param ctx the parse tree
   */
  exitFill_function?: (ctx: Fill_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.first_function`.
   * @param ctx the parse tree
   */
  enterFirst_function?: (ctx: First_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.first_function`.
   * @param ctx the parse tree
   */
  exitFirst_function?: (ctx: First_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.flip_function`.
   * @param ctx the parse tree
   */
  enterFlip_function?: (ctx: Flip_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.flip_function`.
   * @param ctx the parse tree
   */
  exitFlip_function?: (ctx: Flip_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.floor_function`.
   * @param ctx the parse tree
   */
  enterFloor_function?: (ctx: Floor_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.floor_function`.
   * @param ctx the parse tree
   */
  exitFloor_function?: (ctx: Floor_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.get_function`.
   * @param ctx the parse tree
   */
  enterGet_function?: (ctx: Get_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.get_function`.
   * @param ctx the parse tree
   */
  exitGet_function?: (ctx: Get_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.group_function`.
   * @param ctx the parse tree
   */
  enterGroup_function?: (ctx: Group_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.group_function`.
   * @param ctx the parse tree
   */
  exitGroup_function?: (ctx: Group_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.gtime_function`.
   * @param ctx the parse tree
   */
  enterGtime_function?: (ctx: Gtime_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.gtime_function`.
   * @param ctx the parse tree
   */
  exitGtime_function?: (ctx: Gtime_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.hclose_function`.
   * @param ctx the parse tree
   */
  enterHclose_function?: (ctx: Hclose_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.hclose_function`.
   * @param ctx the parse tree
   */
  exitHclose_function?: (ctx: Hclose_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.hcount_function`.
   * @param ctx the parse tree
   */
  enterHcount_function?: (ctx: Hcount_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.hcount_function`.
   * @param ctx the parse tree
   */
  exitHcount_function?: (ctx: Hcount_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.hdel_function`.
   * @param ctx the parse tree
   */
  enterHdel_function?: (ctx: Hdel_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.hdel_function`.
   * @param ctx the parse tree
   */
  exitHdel_function?: (ctx: Hdel_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.hopen_function`.
   * @param ctx the parse tree
   */
  enterHopen_function?: (ctx: Hopen_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.hopen_function`.
   * @param ctx the parse tree
   */
  exitHopen_function?: (ctx: Hopen_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.hsym_function`.
   * @param ctx the parse tree
   */
  enterHsym_function?: (ctx: Hsym_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.hsym_function`.
   * @param ctx the parse tree
   */
  exitHsym_function?: (ctx: Hsym_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.iasc_function`.
   * @param ctx the parse tree
   */
  enterIasc_function?: (ctx: Iasc_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.iasc_function`.
   * @param ctx the parse tree
   */
  exitIasc_function?: (ctx: Iasc_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.idesc_function`.
   * @param ctx the parse tree
   */
  enterIdesc_function?: (ctx: Idesc_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.idesc_function`.
   * @param ctx the parse tree
   */
  exitIdesc_function?: (ctx: Idesc_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.ij_function`.
   * @param ctx the parse tree
   */
  enterIj_function?: (ctx: Ij_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.ij_function`.
   * @param ctx the parse tree
   */
  exitIj_function?: (ctx: Ij_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.in_function`.
   * @param ctx the parse tree
   */
  enterIn_function?: (ctx: In_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.in_function`.
   * @param ctx the parse tree
   */
  exitIn_function?: (ctx: In_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.insert_function`.
   * @param ctx the parse tree
   */
  enterInsert_function?: (ctx: Insert_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.insert_function`.
   * @param ctx the parse tree
   */
  exitInsert_function?: (ctx: Insert_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.inter_function`.
   * @param ctx the parse tree
   */
  enterInter_function?: (ctx: Inter_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.inter_function`.
   * @param ctx the parse tree
   */
  exitInter_function?: (ctx: Inter_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.inv_function`.
   * @param ctx the parse tree
   */
  enterInv_function?: (ctx: Inv_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.inv_function`.
   * @param ctx the parse tree
   */
  exitInv_function?: (ctx: Inv_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.keys_function`.
   * @param ctx the parse tree
   */
  enterKeys_function?: (ctx: Keys_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.keys_function`.
   * @param ctx the parse tree
   */
  exitKeys_function?: (ctx: Keys_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.last_function`.
   * @param ctx the parse tree
   */
  enterLast_function?: (ctx: Last_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.last_function`.
   * @param ctx the parse tree
   */
  exitLast_function?: (ctx: Last_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.like_function`.
   * @param ctx the parse tree
   */
  enterLike_function?: (ctx: Like_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.like_function`.
   * @param ctx the parse tree
   */
  exitLike_function?: (ctx: Like_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.list_function`.
   * @param ctx the parse tree
   */
  enterList_function?: (ctx: List_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.list_function`.
   * @param ctx the parse tree
   */
  exitList_function?: (ctx: List_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.lj_function`.
   * @param ctx the parse tree
   */
  enterLj_function?: (ctx: Lj_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.lj_function`.
   * @param ctx the parse tree
   */
  exitLj_function?: (ctx: Lj_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.load_function`.
   * @param ctx the parse tree
   */
  enterLoad_function?: (ctx: Load_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.load_function`.
   * @param ctx the parse tree
   */
  exitLoad_function?: (ctx: Load_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.log_function`.
   * @param ctx the parse tree
   */
  enterLog_function?: (ctx: Log_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.log_function`.
   * @param ctx the parse tree
   */
  exitLog_function?: (ctx: Log_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.lower_function`.
   * @param ctx the parse tree
   */
  enterLower_function?: (ctx: Lower_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.lower_function`.
   * @param ctx the parse tree
   */
  exitLower_function?: (ctx: Lower_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.lsq_function`.
   * @param ctx the parse tree
   */
  enterLsq_function?: (ctx: Lsq_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.lsq_function`.
   * @param ctx the parse tree
   */
  exitLsq_function?: (ctx: Lsq_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.ltime_function`.
   * @param ctx the parse tree
   */
  enterLtime_function?: (ctx: Ltime_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.ltime_function`.
   * @param ctx the parse tree
   */
  exitLtime_function?: (ctx: Ltime_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.ltrim_function`.
   * @param ctx the parse tree
   */
  enterLtrim_function?: (ctx: Ltrim_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.ltrim_function`.
   * @param ctx the parse tree
   */
  exitLtrim_function?: (ctx: Ltrim_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.mavg_function`.
   * @param ctx the parse tree
   */
  enterMavg_function?: (ctx: Mavg_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.mavg_function`.
   * @param ctx the parse tree
   */
  exitMavg_function?: (ctx: Mavg_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.max_function`.
   * @param ctx the parse tree
   */
  enterMax_function?: (ctx: Max_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.max_function`.
   * @param ctx the parse tree
   */
  exitMax_function?: (ctx: Max_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.maxs_function`.
   * @param ctx the parse tree
   */
  enterMaxs_function?: (ctx: Maxs_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.maxs_function`.
   * @param ctx the parse tree
   */
  exitMaxs_function?: (ctx: Maxs_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.mcount_function`.
   * @param ctx the parse tree
   */
  enterMcount_function?: (ctx: Mcount_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.mcount_function`.
   * @param ctx the parse tree
   */
  exitMcount_function?: (ctx: Mcount_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.md5_function`.
   * @param ctx the parse tree
   */
  enterMd5_function?: (ctx: Md5_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.md5_function`.
   * @param ctx the parse tree
   */
  exitMd5_function?: (ctx: Md5_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.mdev_function`.
   * @param ctx the parse tree
   */
  enterMdev_function?: (ctx: Mdev_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.mdev_function`.
   * @param ctx the parse tree
   */
  exitMdev_function?: (ctx: Mdev_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.med_function`.
   * @param ctx the parse tree
   */
  enterMed_function?: (ctx: Med_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.med_function`.
   * @param ctx the parse tree
   */
  exitMed_function?: (ctx: Med_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.meta_function`.
   * @param ctx the parse tree
   */
  enterMeta_function?: (ctx: Meta_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.meta_function`.
   * @param ctx the parse tree
   */
  exitMeta_function?: (ctx: Meta_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.min_function`.
   * @param ctx the parse tree
   */
  enterMin_function?: (ctx: Min_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.min_function`.
   * @param ctx the parse tree
   */
  exitMin_function?: (ctx: Min_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.mins_function`.
   * @param ctx the parse tree
   */
  enterMins_function?: (ctx: Mins_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.mins_function`.
   * @param ctx the parse tree
   */
  exitMins_function?: (ctx: Mins_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.mmax_function`.
   * @param ctx the parse tree
   */
  enterMmax_function?: (ctx: Mmax_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.mmax_function`.
   * @param ctx the parse tree
   */
  exitMmax_function?: (ctx: Mmax_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.mmin_function`.
   * @param ctx the parse tree
   */
  enterMmin_function?: (ctx: Mmin_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.mmin_function`.
   * @param ctx the parse tree
   */
  exitMmin_function?: (ctx: Mmin_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.mmu_function`.
   * @param ctx the parse tree
   */
  enterMmu_function?: (ctx: Mmu_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.mmu_function`.
   * @param ctx the parse tree
   */
  exitMmu_function?: (ctx: Mmu_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.mod_function`.
   * @param ctx the parse tree
   */
  enterMod_function?: (ctx: Mod_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.mod_function`.
   * @param ctx the parse tree
   */
  exitMod_function?: (ctx: Mod_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.msum_function`.
   * @param ctx the parse tree
   */
  enterMsum_function?: (ctx: Msum_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.msum_function`.
   * @param ctx the parse tree
   */
  exitMsum_function?: (ctx: Msum_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.neg_function`.
   * @param ctx the parse tree
   */
  enterNeg_function?: (ctx: Neg_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.neg_function`.
   * @param ctx the parse tree
   */
  exitNeg_function?: (ctx: Neg_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.next_function`.
   * @param ctx the parse tree
   */
  enterNext_function?: (ctx: Next_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.next_function`.
   * @param ctx the parse tree
   */
  exitNext_function?: (ctx: Next_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.not_function`.
   * @param ctx the parse tree
   */
  enterNot_function?: (ctx: Not_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.not_function`.
   * @param ctx the parse tree
   */
  exitNot_function?: (ctx: Not_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.null_function`.
   * @param ctx the parse tree
   */
  enterNull_function?: (ctx: Null_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.null_function`.
   * @param ctx the parse tree
   */
  exitNull_function?: (ctx: Null_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.or_function`.
   * @param ctx the parse tree
   */
  enterOr_function?: (ctx: Or_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.or_function`.
   * @param ctx the parse tree
   */
  exitOr_function?: (ctx: Or_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.over_function`.
   * @param ctx the parse tree
   */
  enterOver_function?: (ctx: Over_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.over_function`.
   * @param ctx the parse tree
   */
  exitOver_function?: (ctx: Over_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.parse_function`.
   * @param ctx the parse tree
   */
  enterParse_function?: (ctx: Parse_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.parse_function`.
   * @param ctx the parse tree
   */
  exitParse_function?: (ctx: Parse_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.peach_function`.
   * @param ctx the parse tree
   */
  enterPeach_function?: (ctx: Peach_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.peach_function`.
   * @param ctx the parse tree
   */
  exitPeach_function?: (ctx: Peach_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.pj_function`.
   * @param ctx the parse tree
   */
  enterPj_function?: (ctx: Pj_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.pj_function`.
   * @param ctx the parse tree
   */
  exitPj_function?: (ctx: Pj_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.plist_function`.
   * @param ctx the parse tree
   */
  enterPlist_function?: (ctx: Plist_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.plist_function`.
   * @param ctx the parse tree
   */
  exitPlist_function?: (ctx: Plist_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.prd_function`.
   * @param ctx the parse tree
   */
  enterPrd_function?: (ctx: Prd_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.prd_function`.
   * @param ctx the parse tree
   */
  exitPrd_function?: (ctx: Prd_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.prev_function`.
   * @param ctx the parse tree
   */
  enterPrev_function?: (ctx: Prev_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.prev_function`.
   * @param ctx the parse tree
   */
  exitPrev_function?: (ctx: Prev_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.prior_function`.
   * @param ctx the parse tree
   */
  enterPrior_function?: (ctx: Prior_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.prior_function`.
   * @param ctx the parse tree
   */
  exitPrior_function?: (ctx: Prior_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.rand_function`.
   * @param ctx the parse tree
   */
  enterRand_function?: (ctx: Rand_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.rand_function`.
   * @param ctx the parse tree
   */
  exitRand_function?: (ctx: Rand_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.rank_function`.
   * @param ctx the parse tree
   */
  enterRank_function?: (ctx: Rank_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.rank_function`.
   * @param ctx the parse tree
   */
  exitRank_function?: (ctx: Rank_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.ratios_function`.
   * @param ctx the parse tree
   */
  enterRatios_function?: (ctx: Ratios_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.ratios_function`.
   * @param ctx the parse tree
   */
  exitRatios_function?: (ctx: Ratios_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.raze_function`.
   * @param ctx the parse tree
   */
  enterRaze_function?: (ctx: Raze_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.raze_function`.
   * @param ctx the parse tree
   */
  exitRaze_function?: (ctx: Raze_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.read0_function`.
   * @param ctx the parse tree
   */
  enterRead0_function?: (ctx: Read0_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.read0_function`.
   * @param ctx the parse tree
   */
  exitRead0_function?: (ctx: Read0_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.read1_function`.
   * @param ctx the parse tree
   */
  enterRead1_function?: (ctx: Read1_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.read1_function`.
   * @param ctx the parse tree
   */
  exitRead1_function?: (ctx: Read1_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.reciprocal_function`.
   * @param ctx the parse tree
   */
  enterReciprocal_function?: (ctx: Reciprocal_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.reciprocal_function`.
   * @param ctx the parse tree
   */
  exitReciprocal_function?: (ctx: Reciprocal_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.reverse_function`.
   * @param ctx the parse tree
   */
  enterReverse_function?: (ctx: Reverse_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.reverse_function`.
   * @param ctx the parse tree
   */
  exitReverse_function?: (ctx: Reverse_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.rload_function`.
   * @param ctx the parse tree
   */
  enterRload_function?: (ctx: Rload_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.rload_function`.
   * @param ctx the parse tree
   */
  exitRload_function?: (ctx: Rload_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.rotate_function`.
   * @param ctx the parse tree
   */
  enterRotate_function?: (ctx: Rotate_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.rotate_function`.
   * @param ctx the parse tree
   */
  exitRotate_function?: (ctx: Rotate_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.rsave_function`.
   * @param ctx the parse tree
   */
  enterRsave_function?: (ctx: Rsave_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.rsave_function`.
   * @param ctx the parse tree
   */
  exitRsave_function?: (ctx: Rsave_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.rtrim_function`.
   * @param ctx the parse tree
   */
  enterRtrim_function?: (ctx: Rtrim_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.rtrim_function`.
   * @param ctx the parse tree
   */
  exitRtrim_function?: (ctx: Rtrim_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.save_function`.
   * @param ctx the parse tree
   */
  enterSave_function?: (ctx: Save_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.save_function`.
   * @param ctx the parse tree
   */
  exitSave_function?: (ctx: Save_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.scan_function`.
   * @param ctx the parse tree
   */
  enterScan_function?: (ctx: Scan_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.scan_function`.
   * @param ctx the parse tree
   */
  exitScan_function?: (ctx: Scan_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.select_function`.
   * @param ctx the parse tree
   */
  enterSelect_function?: (ctx: Select_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.select_function`.
   * @param ctx the parse tree
   */
  exitSelect_function?: (ctx: Select_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.set_function`.
   * @param ctx the parse tree
   */
  enterSet_function?: (ctx: Set_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.set_function`.
   * @param ctx the parse tree
   */
  exitSet_function?: (ctx: Set_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.show_function`.
   * @param ctx the parse tree
   */
  enterShow_function?: (ctx: Show_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.show_function`.
   * @param ctx the parse tree
   */
  exitShow_function?: (ctx: Show_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.signum_function`.
   * @param ctx the parse tree
   */
  enterSignum_function?: (ctx: Signum_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.signum_function`.
   * @param ctx the parse tree
   */
  exitSignum_function?: (ctx: Signum_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.sin_function`.
   * @param ctx the parse tree
   */
  enterSin_function?: (ctx: Sin_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.sin_function`.
   * @param ctx the parse tree
   */
  exitSin_function?: (ctx: Sin_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.sqrt_function`.
   * @param ctx the parse tree
   */
  enterSqrt_function?: (ctx: Sqrt_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.sqrt_function`.
   * @param ctx the parse tree
   */
  exitSqrt_function?: (ctx: Sqrt_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.ssr_function`.
   * @param ctx the parse tree
   */
  enterSsr_function?: (ctx: Ssr_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.ssr_function`.
   * @param ctx the parse tree
   */
  exitSsr_function?: (ctx: Ssr_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.string_function`.
   * @param ctx the parse tree
   */
  enterString_function?: (ctx: String_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.string_function`.
   * @param ctx the parse tree
   */
  exitString_function?: (ctx: String_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.sublist_function`.
   * @param ctx the parse tree
   */
  enterSublist_function?: (ctx: Sublist_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.sublist_function`.
   * @param ctx the parse tree
   */
  exitSublist_function?: (ctx: Sublist_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.sum_function`.
   * @param ctx the parse tree
   */
  enterSum_function?: (ctx: Sum_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.sum_function`.
   * @param ctx the parse tree
   */
  exitSum_function?: (ctx: Sum_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.sums_function`.
   * @param ctx the parse tree
   */
  enterSums_function?: (ctx: Sums_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.sums_function`.
   * @param ctx the parse tree
   */
  exitSums_function?: (ctx: Sums_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.sv_function`.
   * @param ctx the parse tree
   */
  enterSv_function?: (ctx: Sv_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.sv_function`.
   * @param ctx the parse tree
   */
  exitSv_function?: (ctx: Sv_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.system_function`.
   * @param ctx the parse tree
   */
  enterSystem_function?: (ctx: System_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.system_function`.
   * @param ctx the parse tree
   */
  exitSystem_function?: (ctx: System_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.tables_function`.
   * @param ctx the parse tree
   */
  enterTables_function?: (ctx: Tables_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.tables_function`.
   * @param ctx the parse tree
   */
  exitTables_function?: (ctx: Tables_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.tan_function`.
   * @param ctx the parse tree
   */
  enterTan_function?: (ctx: Tan_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.tan_function`.
   * @param ctx the parse tree
   */
  exitTan_function?: (ctx: Tan_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.til_function`.
   * @param ctx the parse tree
   */
  enterTil_function?: (ctx: Til_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.til_function`.
   * @param ctx the parse tree
   */
  exitTil_function?: (ctx: Til_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.trim_function`.
   * @param ctx the parse tree
   */
  enterTrim_function?: (ctx: Trim_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.trim_function`.
   * @param ctx the parse tree
   */
  exitTrim_function?: (ctx: Trim_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.type_function`.
   * @param ctx the parse tree
   */
  enterType_function?: (ctx: Type_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.type_function`.
   * @param ctx the parse tree
   */
  exitType_function?: (ctx: Type_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.uj_function`.
   * @param ctx the parse tree
   */
  enterUj_function?: (ctx: Uj_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.uj_function`.
   * @param ctx the parse tree
   */
  exitUj_function?: (ctx: Uj_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.ungroup_function`.
   * @param ctx the parse tree
   */
  enterUngroup_function?: (ctx: Ungroup_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.ungroup_function`.
   * @param ctx the parse tree
   */
  exitUngroup_function?: (ctx: Ungroup_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.union_function`.
   * @param ctx the parse tree
   */
  enterUnion_function?: (ctx: Union_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.union_function`.
   * @param ctx the parse tree
   */
  exitUnion_function?: (ctx: Union_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.update_function`.
   * @param ctx the parse tree
   */
  enterUpdate_function?: (ctx: Update_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.update_function`.
   * @param ctx the parse tree
   */
  exitUpdate_function?: (ctx: Update_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.upper_function`.
   * @param ctx the parse tree
   */
  enterUpper_function?: (ctx: Upper_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.upper_function`.
   * @param ctx the parse tree
   */
  exitUpper_function?: (ctx: Upper_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.upsert_function`.
   * @param ctx the parse tree
   */
  enterUpsert_function?: (ctx: Upsert_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.upsert_function`.
   * @param ctx the parse tree
   */
  exitUpsert_function?: (ctx: Upsert_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.value_function`.
   * @param ctx the parse tree
   */
  enterValue_function?: (ctx: Value_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.value_function`.
   * @param ctx the parse tree
   */
  exitValue_function?: (ctx: Value_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.var_function`.
   * @param ctx the parse tree
   */
  enterVar_function?: (ctx: Var_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.var_function`.
   * @param ctx the parse tree
   */
  exitVar_function?: (ctx: Var_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.view_function`.
   * @param ctx the parse tree
   */
  enterView_function?: (ctx: View_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.view_function`.
   * @param ctx the parse tree
   */
  exitView_function?: (ctx: View_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.vs_function`.
   * @param ctx the parse tree
   */
  enterVs_function?: (ctx: Vs_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.vs_function`.
   * @param ctx the parse tree
   */
  exitVs_function?: (ctx: Vs_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.wavg_function`.
   * @param ctx the parse tree
   */
  enterWavg_function?: (ctx: Wavg_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.wavg_function`.
   * @param ctx the parse tree
   */
  exitWavg_function?: (ctx: Wavg_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.where_function`.
   * @param ctx the parse tree
   */
  enterWhere_function?: (ctx: Where_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.where_function`.
   * @param ctx the parse tree
   */
  exitWhere_function?: (ctx: Where_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.within_function`.
   * @param ctx the parse tree
   */
  enterWithin_function?: (ctx: Within_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.within_function`.
   * @param ctx the parse tree
   */
  exitWithin_function?: (ctx: Within_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.wj1_function`.
   * @param ctx the parse tree
   */
  enterWj1_function?: (ctx: Wj1_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.wj1_function`.
   * @param ctx the parse tree
   */
  exitWj1_function?: (ctx: Wj1_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.wj2_function`.
   * @param ctx the parse tree
   */
  enterWj2_function?: (ctx: Wj2_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.wj2_function`.
   * @param ctx the parse tree
   */
  exitWj2_function?: (ctx: Wj2_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.ww_function`.
   * @param ctx the parse tree
   */
  enterWw_function?: (ctx: Ww_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.ww_function`.
   * @param ctx the parse tree
   */
  exitWw_function?: (ctx: Ww_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xasc_function`.
   * @param ctx the parse tree
   */
  enterXasc_function?: (ctx: Xasc_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xasc_function`.
   * @param ctx the parse tree
   */
  exitXasc_function?: (ctx: Xasc_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xbar_function`.
   * @param ctx the parse tree
   */
  enterXbar_function?: (ctx: Xbar_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xbar_function`.
   * @param ctx the parse tree
   */
  exitXbar_function?: (ctx: Xbar_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xcols_function`.
   * @param ctx the parse tree
   */
  enterXcols_function?: (ctx: Xcols_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xcols_function`.
   * @param ctx the parse tree
   */
  exitXcols_function?: (ctx: Xcols_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xdesc_function`.
   * @param ctx the parse tree
   */
  enterXdesc_function?: (ctx: Xdesc_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xdesc_function`.
   * @param ctx the parse tree
   */
  exitXdesc_function?: (ctx: Xdesc_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xexp_function`.
   * @param ctx the parse tree
   */
  enterXexp_function?: (ctx: Xexp_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xexp_function`.
   * @param ctx the parse tree
   */
  exitXexp_function?: (ctx: Xexp_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xgroup_function`.
   * @param ctx the parse tree
   */
  enterXgroup_function?: (ctx: Xgroup_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xgroup_function`.
   * @param ctx the parse tree
   */
  exitXgroup_function?: (ctx: Xgroup_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xkey_function`.
   * @param ctx the parse tree
   */
  enterXkey_function?: (ctx: Xkey_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xkey_function`.
   * @param ctx the parse tree
   */
  exitXkey_function?: (ctx: Xkey_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xlog_function`.
   * @param ctx the parse tree
   */
  enterXlog_function?: (ctx: Xlog_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xlog_function`.
   * @param ctx the parse tree
   */
  exitXlog_function?: (ctx: Xlog_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xprev_function`.
   * @param ctx the parse tree
   */
  enterXprev_function?: (ctx: Xprev_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xprev_function`.
   * @param ctx the parse tree
   */
  exitXprev_function?: (ctx: Xprev_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xrank_function`.
   * @param ctx the parse tree
   */
  enterXrank_function?: (ctx: Xrank_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xrank_function`.
   * @param ctx the parse tree
   */
  exitXrank_function?: (ctx: Xrank_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xranked_function`.
   * @param ctx the parse tree
   */
  enterXranked_function?: (ctx: Xranked_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xranked_function`.
   * @param ctx the parse tree
   */
  exitXranked_function?: (ctx: Xranked_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xrecs_function`.
   * @param ctx the parse tree
   */
  enterXrecs_function?: (ctx: Xrecs_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xrecs_function`.
   * @param ctx the parse tree
   */
  exitXrecs_function?: (ctx: Xrecs_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xrows_function`.
   * @param ctx the parse tree
   */
  enterXrows_function?: (ctx: Xrows_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xrows_function`.
   * @param ctx the parse tree
   */
  exitXrows_function?: (ctx: Xrows_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xss_function`.
   * @param ctx the parse tree
   */
  enterXss_function?: (ctx: Xss_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xss_function`.
   * @param ctx the parse tree
   */
  exitXss_function?: (ctx: Xss_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.xtype_function`.
   * @param ctx the parse tree
   */
  enterXtype_function?: (ctx: Xtype_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.xtype_function`.
   * @param ctx the parse tree
   */
  exitXtype_function?: (ctx: Xtype_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.yield_function`.
   * @param ctx the parse tree
   */
  enterYield_function?: (ctx: Yield_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.yield_function`.
   * @param ctx the parse tree
   */
  exitYield_function?: (ctx: Yield_functionContext) => void;
  /**
   * Enter a parse tree produced by `qParser.zip_function`.
   * @param ctx the parse tree
   */
  enterZip_function?: (ctx: Zip_functionContext) => void;
  /**
   * Exit a parse tree produced by `qParser.zip_function`.
   * @param ctx the parse tree
   */
  exitZip_function?: (ctx: Zip_functionContext) => void;
}
