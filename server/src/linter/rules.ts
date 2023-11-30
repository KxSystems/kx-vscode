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

import { Entity, QAst } from "../parser";
import {
  assignReservedWord,
  declaredAfterUse,
  invalidAssign,
  unusedParam,
  unusedVar,
} from "./assign";
import {
  lineLength,
  tooManyConstants,
  tooManyGlobals,
  tooManyLocals,
} from "./limit";
import { deprecatedDatetime, emptyIf } from "./other";

export enum RuleSeverity {
  ERROR = "ERROR",
  WARNING = "WARNING",
  INFO = "INFO",
}

export interface LinterRule {
  name: string;
  message: string;
  severity: RuleSeverity;
  check: (ast: QAst) => Entity[];
}

const check = () => [];

const AssignReservedWordRule: LinterRule = {
  name: "ASSIGN_RESERVED_WORD",
  message: "Assignment to a reserved word",
  severity: RuleSeverity.ERROR,
  check: assignReservedWord,
};

const CondEvenArgsRule: LinterRule = {
  name: "COND_EVENARGS",
  message: "Conditional $ should not be used with an even number of arguments",
  severity: RuleSeverity.ERROR,
  check,
};

const DeclaredAfterUserRule: LinterRule = {
  name: "DECLARED_AFTER_USE",
  message: "The variable was declared after being used",
  severity: RuleSeverity.ERROR,
  check: declaredAfterUse,
};

const GlobalPeachRule: LinterRule = {
  name: "GLOBAL_PEACH",
  message: "Modifying globals inside a peach statement is not allowed",
  severity: RuleSeverity.ERROR,
  check,
};

const InvalidAdverbRule: LinterRule = {
  name: "INVALID_ADVERB",
  message: "A binary adverb cannot be applied to a unary function",
  severity: RuleSeverity.ERROR,
  check,
};

const InvalidAssignRule: LinterRule = {
  name: "INVALID_ASSIGN",
  message: "Attempt to assign to a string, symbol, or number",
  severity: RuleSeverity.ERROR,
  check: invalidAssign,
};

const InvalidEscapeRule: LinterRule = {
  name: "INVALID_ESCAPE",
  message:
    "Invalid Escape Sequence: Valid escape sequences are: \\n,\\r,\\t,/,,/ and three digit octal sequences \\377 or smaller",
  severity: RuleSeverity.ERROR,
  check,
};

const InvalidQukeRule: LinterRule = {
  name: "INVALID_QUKE",
  message: "A quke file was improperly formatted",
  severity: RuleSeverity.ERROR,
  check,
};

const OverwriteArtifactRule: LinterRule = {
  name: "OVERWRITE_ARTIFACT",
  message: "Variable assignment overwrites namespace or artifact",
  severity: RuleSeverity.ERROR,
  check,
};

const StatementInExprRule: LinterRule = {
  name: "STATEMENT_IN_EXPR",
  message:
    "If, while, or do statement used in expression, possible missing semicolon",
  severity: RuleSeverity.ERROR,
  check,
};

const ReservedNameRule: LinterRule = {
  name: "RESERVED_NAME",
  message: "File has reserved name",
  severity: RuleSeverity.ERROR,
  check,
};

const TooManyConstantsRule: LinterRule = {
  name: "TOO_MANY_CONSTANTS",
  message: "Too many constants in a function",
  severity: RuleSeverity.ERROR,
  check: tooManyConstants,
};

const TooManyGlobalsRule: LinterRule = {
  name: "TOO_MANY_GLOBALS",
  message: "Too many globals in a function",
  severity: RuleSeverity.ERROR,
  check: tooManyGlobals,
};

const UnindentedCodeRule: LinterRule = {
  name: "UNINDENTED_CODE",
  message: "Any multiline expression must be indented after the first line",
  severity: RuleSeverity.ERROR,
  check,
};

const TooManyLocalsRule: LinterRule = {
  name: "TOO_MANY_LOCALS",
  message: "Too many locals in a function",
  severity: RuleSeverity.ERROR,
  check: tooManyLocals,
};

const BackwardCompatibilityRule: LinterRule = {
  name: "BACKWARD_COMPATIBILITY",
  message:
    "This function has backward compatibility issues with kdb versions less than 3.6",
  severity: RuleSeverity.WARNING,
  check,
};

const CastTypeNumericalRule: LinterRule = {
  name: "CAST_TYPE_NUMERICAL",
  message:
    "Casting using a short to indicate cast type is unnecessarily unclear. Another form is advised",
  severity: RuleSeverity.WARNING,
  check,
};

const ConditionallyDeclaredRule: LinterRule = {
  name: "CONDITIONALLY_DECLARED",
  message:
    "This variable may be undefined at this point, as it was only declared conditionally",
  severity: RuleSeverity.WARNING,
  check,
};

const DebugFunctionRule: LinterRule = {
  name: "DEBUG_FUNCTION",
  message: "eval, or value when run on a string literal",
  severity: RuleSeverity.WARNING,
  check,
};

const DeprecatedDatetimeRule: LinterRule = {
  name: "DEPRECATED_DATETIME",
  message: "Datetime has been deprecated",
  severity: RuleSeverity.WARNING,
  check: deprecatedDatetime,
};

const DeprecatedFunctionRule: LinterRule = {
  name: "DEPRECATED_FUNCTION",
  message: "This file uses a deprecated function",
  severity: RuleSeverity.WARNING,
  check,
};

const EmptyIfRule: LinterRule = {
  name: "EMPTY_IF",
  message: "If statement lacks code to execute",
  severity: RuleSeverity.WARNING,
  check: emptyIf,
};

const FixedSeedRule: LinterRule = {
  name: "FIXED_SEED",
  message:
    "Inputting a positive number into ?0Ng will result in the same sequence every run",
  severity: RuleSeverity.WARNING,
  check,
};

const FunctionStartRule: LinterRule = {
  name: "FUNCTION_START",
  message: "Function artifact must start with a function",
  severity: RuleSeverity.WARNING,
  check,
};

const InsufficientIndentRule: LinterRule = {
  name: "INSUFFICIENT_INDENT",
  message:
    "Indentation must be equal to or greater than the second line of the function body, and the second line must have an indentation greater than the first line",
  severity: RuleSeverity.WARNING,
  check,
};

const InternalRule: LinterRule = {
  name: "INTERNAL",
  message: "Reference to an internal api of another module",
  severity: RuleSeverity.WARNING,
  check,
};

const InvalidFunctionRule: LinterRule = {
  name: "INVALID_FUNCTION",
  message:
    "Function artifacts must be lambda definitions, rather than projections, immediately invoked functions, or functions in expressions",
  severity: RuleSeverity.WARNING,
  check,
};

const MalformedSuppressionRule: LinterRule = {
  name: "MALFORMED_SUPPRESSION",
  message: "Malformed @qlintsuppress tag",
  severity: RuleSeverity.WARNING,
  check,
};

const MissingDependencyRule: LinterRule = {
  name: "MISSING_DEPENDENCY",
  message:
    "Any reference to another namespace should be listed in the dependency list",
  severity: RuleSeverity.WARNING,
  check,
};

const NameCollisionRule: LinterRule = {
  name: "NAME_COLLISION",
  message: "Executing statement in editor could overwrite global variable",
  severity: RuleSeverity.WARNING,
  check,
};

const NeedExplicitReturnRule: LinterRule = {
  name: "NEED_EXPLICIT_RETURN",
  message: "Explicit return needed. Otherwise will return generic null",
  severity: RuleSeverity.WARNING,
  check,
};

const PossibleReturnRule: LinterRule = {
  name: "POSSIBLE_RETURN",
  message: "Assignment statement looks like return",
  severity: RuleSeverity.WARNING,
  check,
};

const UndeclaredVarRule: LinterRule = {
  name: "UNDECLARED_VAR",
  message: "Undeclared variable in function will be treated as global",
  severity: RuleSeverity.WARNING,
  check,
};

const UnusedInternalRule: LinterRule = {
  name: "UNUSED_INTERNAL",
  message:
    "This function is marked as internal (is part of a sub-namespace i) but was never used within the namespace",
  severity: RuleSeverity.WARNING,
  check,
};

const UnusedParamRule: LinterRule = {
  name: "UNUSED_PARAM",
  message: "This param was declared then never used",
  severity: RuleSeverity.WARNING,
  check: unusedParam,
};

const UnusedVarRule: LinterRule = {
  name: "UNUSED_VAR",
  message: "This variable was declared then never used",
  severity: RuleSeverity.WARNING,
  check: unusedVar,
};

const RandomGuidsRule: LinterRule = {
  name: "RANDOM_GUIDS",
  message:
    "Multiple calls to ?0ng in quick succession, with negative numbers, can produce the same output",
  severity: RuleSeverity.WARNING,
  check,
};

const UnreachableCodeRule: LinterRule = {
  name: "UNREACHABLE_CODE",
  message: "A preceding return prevents this statement from being reached",
  severity: RuleSeverity.WARNING,
  check,
};

const UnexpectedCondNewline: LinterRule = {
  name: "UNEXPECTED_COND_NEWLINE",
  message: "Condition should begin on same line as loop or if statement",
  severity: RuleSeverity.WARNING,
  check,
};

const UnparenthesizedJoinRule: LinterRule = {
  name: "UNPARENTHESIZED_JOIN",
  message:
    "A potential join in this QSQL statement will be interpreted as separate statements unless wrapped in parentheses",
  severity: RuleSeverity.WARNING,
  check,
};

const VarQErrorRule: LinterRule = {
  name: "VAR_Q_ERROR",
  message:
    "Variable name the same as q error message. This can cause ambiguous error messages",
  severity: RuleSeverity.WARNING,
  check,
};

const MissingSemicolonRule: LinterRule = {
  name: "MISSING_SEMICOLON",
  message:
    "An apply statement spans multiple lines with the same indentation and an assignment on the second line, potentially indicating a missing semi-colon	",
  severity: RuleSeverity.WARNING,
  check,
};

const MalformedRule: LinterRule = {
  name: "MALFORMED_RULE",
  message: "Malformed @qlintrule tag",
  severity: RuleSeverity.WARNING,
  check,
};

const TodoRule: LinterRule = {
  name: "TODO",
  message: "Todo qDoc tag present",
  severity: RuleSeverity.WARNING,
  check,
};

const LineLengthRule: LinterRule = {
  name: "LINE_LENGTH",
  message: "Maximum line length exceeded",
  severity: RuleSeverity.WARNING,
  check: lineLength,
};

const DefaultQdocRule: LinterRule = {
  name: "DEFAULT_QDOC",
  message: "The file has the default documentation",
  severity: RuleSeverity.INFO,
  check,
};

const InvalidKindRule: LinterRule = {
  name: "INVALID_KIND",
  message: "Invalid qdoc kind in tag",
  severity: RuleSeverity.INFO,
  check,
};

const InvalidTypedefRule: LinterRule = {
  name: "INVALID_TYPEDEF",
  message: "Invalid typedef tag",
  severity: RuleSeverity.INFO,
  check,
};

const InvalidTagRule: LinterRule = {
  name: "INVALID_TAG",
  message: "Tag not recognized as valid qDoc tag",
  severity: RuleSeverity.INFO,
  check,
};

const MissingOverviewRule: LinterRule = {
  name: "MISSING_OVERVIEW",
  message: "Missing @fileOverview tag with associated description",
  severity: RuleSeverity.INFO,
  check,
};

const MissingReturnsRule: LinterRule = {
  name: "MISSING_RETURNS",
  message: "Missing @returns tag",
  severity: RuleSeverity.INFO,
  check,
};

const MissingTypeRule: LinterRule = {
  name: "MISSING_TYPE",
  message: "Missing type in returns or param tag",
  severity: RuleSeverity.INFO,
  check,
};

const MultipleReturnsRule: LinterRule = {
  name: "MULTIPLE_RETURNS",
  message: "Multiple @returns tags",
  severity: RuleSeverity.INFO,
  check,
};

const OurOfOrderParamRule: LinterRule = {
  name: "OUT_OF_ORDER_PARAM",
  message: "Parameters out of order",
  severity: RuleSeverity.INFO,
  check,
};

const ParamNotInCodeRule: LinterRule = {
  name: "PARAM_NOT_IN_CODE",
  message: "This param is not in the function",
  severity: RuleSeverity.INFO,
  check,
};

const QdocTypeRule: LinterRule = {
  name: "QDOC_TYPE",
  message: "Invalid type in tag",
  severity: RuleSeverity.INFO,
  check,
};

const RedundantQlobalAssignRule: LinterRule = {
  name: "REDUNDANT_GLOBAL_ASSIGN",
  message:
    "Using the global amend operator on a fully qualified name is redundant",
  severity: RuleSeverity.INFO,
  check,
};

const UndocumentedParamRule: LinterRule = {
  name: "UNDOCUMENTED_PARAM",
  message: "Undocumented parameter",
  severity: RuleSeverity.INFO,
  check,
};

const UnusedDependencyRule: LinterRule = {
  name: "UNUSED_DEPENDENCY",
  message: "Unused dependencies",
  severity: RuleSeverity.INFO,
  check,
};

export const Rules: LinterRule[] = [
  AssignReservedWordRule,
  CondEvenArgsRule,
  DeclaredAfterUserRule,
  GlobalPeachRule,
  InvalidAdverbRule,
  InvalidAssignRule,
  InvalidEscapeRule,
  InvalidQukeRule,
  OverwriteArtifactRule,
  StatementInExprRule,
  ReservedNameRule,
  TooManyConstantsRule,
  TooManyGlobalsRule,
  TooManyLocalsRule,
  UnindentedCodeRule,
  BackwardCompatibilityRule,
  CastTypeNumericalRule,
  ConditionallyDeclaredRule,
  DebugFunctionRule,
  DeprecatedDatetimeRule,
  DeprecatedFunctionRule,
  EmptyIfRule,
  FixedSeedRule,
  FunctionStartRule,
  InsufficientIndentRule,
  InternalRule,
  InvalidFunctionRule,
  MalformedSuppressionRule,
  MissingDependencyRule,
  NameCollisionRule,
  NeedExplicitReturnRule,
  PossibleReturnRule,
  UndeclaredVarRule,
  UnusedInternalRule,
  UnusedParamRule,
  UnusedVarRule,
  RandomGuidsRule,
  UnreachableCodeRule,
  UnexpectedCondNewline,
  UnparenthesizedJoinRule,
  VarQErrorRule,
  MissingSemicolonRule,
  MalformedRule,
  TodoRule,
  LineLengthRule,
  DefaultQdocRule,
  InvalidKindRule,
  InvalidTypedefRule,
  InvalidTagRule,
  MissingOverviewRule,
  MissingReturnsRule,
  MissingTypeRule,
  MultipleReturnsRule,
  OurOfOrderParamRule,
  ParamNotInCodeRule,
  QdocTypeRule,
  RedundantQlobalAssignRule,
  UndocumentedParamRule,
  UnusedDependencyRule,
];
