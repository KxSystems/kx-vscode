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

import { Token } from "../parser";
import * as checks from "./checks";

const enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export interface LinterRule {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  check?: (tokens: Token[]) => Token[];
}

const AssignReservedWord: LinterRule = {
  code: "ASSIGN_RESERVED_WORD",
  message: "Assignment to a reserved word",
  severity: DiagnosticSeverity.Error,
};

const CondEvenArgs: LinterRule = {
  code: "COND_EVENARGS",
  message: "Conditional $ should not be used with an even number of arguments",
  severity: DiagnosticSeverity.Error,
};

const DeclaredAfterUse: LinterRule = {
  code: "DECLARED_AFTER_USE",
  message: "The variable was declared after being used",
  severity: DiagnosticSeverity.Error,
  check: checks.declaredAfterUse,
};

const GlobalPeach: LinterRule = {
  code: "GLOBAL_PEACH",
  message: "Modifying globals inside a peach statement is not allowed",
  severity: DiagnosticSeverity.Error,
};

const InvalidAdverb: LinterRule = {
  code: "INVALID_ADVERB",
  message: "A binary adverb cannot be applied to a unary function",
  severity: DiagnosticSeverity.Error,
};

const InvalidAssign: LinterRule = {
  code: "INVALID_ASSIGN",
  message: "Attempt to assign to a string, symbol, or number",
  severity: DiagnosticSeverity.Error,
};

const InvalidEscape: LinterRule = {
  code: "INVALID_ESCAPE",
  message:
    'Invalid Escape Sequence: Valid escape sequences are: \\n,\\r,\\t,\\\\,\\/,\\" and three digit octal sequences \\377 or smaller',
  severity: DiagnosticSeverity.Error,
  check: checks.invalidEscape,
};

const InvalidQuke: LinterRule = {
  code: "INVALID_QUKE",
  message: "A quke file was improperly formatted",
  severity: DiagnosticSeverity.Error,
};

const OverwriteArtifact: LinterRule = {
  code: "OVERWRITE_ARTIFACT",
  message: "Variable assignment overwrites namespace or artifact",
  severity: DiagnosticSeverity.Error,
};

const StatementInExpr: LinterRule = {
  code: "STATEMENT_IN_EXPR",
  message:
    "If, while, or do statement used in expression, possible missing semicolon",
  severity: DiagnosticSeverity.Error,
};

const ReservedName: LinterRule = {
  code: "RESERVED_NAME",
  message: "File has reserved name",
  severity: DiagnosticSeverity.Error,
};

const TooManyConstants: LinterRule = {
  code: "TOO_MANY_CONSTANTS",
  message: "Too many constants in a function",
  severity: DiagnosticSeverity.Error,
};

const TooManyGlobals: LinterRule = {
  code: "TOO_MANY_GLOBALS",
  message: "Too many globals in a function",
  severity: DiagnosticSeverity.Error,
};

const UnindentedCode: LinterRule = {
  code: "UNINDENTED_CODE",
  message: "Any multiline expression must be indented after the first line",
  severity: DiagnosticSeverity.Error,
};

const TooManyLocals: LinterRule = {
  code: "TOO_MANY_LOCALS",
  message: "Too many locals in a function",
  severity: DiagnosticSeverity.Error,
};

const TooManyArguments: LinterRule = {
  code: "TOO_MANY_ARGUMENTS",
  message: "Too many arguments in a function",
  severity: DiagnosticSeverity.Error,
};

const BackwardCompatibility: LinterRule = {
  code: "BACKWARD_COMPATIBILITY",
  message:
    "This function has backward compatibility issues with kdb versions less than 3.6",
  severity: DiagnosticSeverity.Warning,
};

const CastTypeNumerical: LinterRule = {
  code: "CAST_TYPE_NUMERICAL",
  message:
    "Casting using a short to indicate cast type is unnecessarily unclear. Another form is advised",
  severity: DiagnosticSeverity.Warning,
};

const ConditionallyDeclared: LinterRule = {
  code: "CONDITIONALLY_DECLARED",
  message:
    "This variable may be undefined at this point, as it was only declared conditionally",
  severity: DiagnosticSeverity.Warning,
};

const DebugFunction: LinterRule = {
  code: "DEBUG_FUNCTION",
  message: "eval, or value when run on a string literal",
  severity: DiagnosticSeverity.Warning,
};

const DeprecatedDatetime: LinterRule = {
  code: "DEPRECATED_DATETIME",
  message: "Datetime has been deprecated",
  severity: DiagnosticSeverity.Warning,
  check: checks.deprecatedDatetime,
};

const DeprecatedFunction: LinterRule = {
  code: "DEPRECATED_FUNCTION",
  message: "This file uses a deprecated function",
  severity: DiagnosticSeverity.Warning,
};

const EmptyIf: LinterRule = {
  code: "EMPTY_IF",
  message: "If statement lacks code to execute",
  severity: DiagnosticSeverity.Warning,
};

const FixedSeed: LinterRule = {
  code: "FIXED_SEED",
  message:
    "Inputting a positive number into ?0Ng will result in the same sequence every run",
  severity: DiagnosticSeverity.Warning,
};

const FunctionStart: LinterRule = {
  code: "FUNCTION_START",
  message: "Function artifact must start with a function",
  severity: DiagnosticSeverity.Warning,
};

const InsufficientIndent: LinterRule = {
  code: "INSUFFICIENT_INDENT",
  message:
    "Indentation must be equal to or greater than the second line of the function body, and the second line must have an indentation greater than the first line",
  severity: DiagnosticSeverity.Warning,
};

const Internal: LinterRule = {
  code: "INTERNAL",
  message: "Reference to an internal api of another module",
  severity: DiagnosticSeverity.Warning,
};

const InvalidFunction: LinterRule = {
  code: "INVALID_FUNCTION",
  message:
    "Function artifacts must be lambda definitions, rather than projections, immediately invoked functions, or functions in expressions",
  severity: DiagnosticSeverity.Warning,
};

const MalformedSuppression: LinterRule = {
  code: "MALFORMED_SUPPRESSION",
  message: "Malformed @qlintsuppress tag",
  severity: DiagnosticSeverity.Warning,
};

const MissingDependency: LinterRule = {
  code: "MISSING_DEPENDENCY",
  message:
    "Any reference to another namespace should be listed in the dependency list",
  severity: DiagnosticSeverity.Warning,
};

const NameCollision: LinterRule = {
  code: "NAME_COLLISION",
  message: "Executing statement in editor could overwrite global variable",
  severity: DiagnosticSeverity.Warning,
};

const NeedExplicitReturn: LinterRule = {
  code: "NEED_EXPLICIT_RETURN",
  message: "Explicit return needed. Otherwise will return generic null",
  severity: DiagnosticSeverity.Warning,
};

const PossibleReturn: LinterRule = {
  code: "POSSIBLE_RETURN",
  message: "Assignment statement looks like return",
  severity: DiagnosticSeverity.Warning,
};

const UndeclaredVar: LinterRule = {
  code: "UNDECLARED_VAR",
  message: "Undeclared variable in function will be treated as global",
  severity: DiagnosticSeverity.Warning,
};

const UnusedInternal: LinterRule = {
  code: "UNUSED_INTERNAL",
  message:
    "This function is marked as internal (is part of a sub-namespace i) but was never used within the namespace",
  severity: DiagnosticSeverity.Warning,
};

const UnusedParam: LinterRule = {
  code: "UNUSED_PARAM",
  message: "This param was declared then never used",
  severity: DiagnosticSeverity.Warning,
  check: checks.unusedParam,
};

const UnusedVar: LinterRule = {
  code: "UNUSED_VAR",
  message: "This local variable was declared then never used",
  severity: DiagnosticSeverity.Warning,
  check: checks.unusedVar,
};

const RandomGuids: LinterRule = {
  code: "RANDOM_GUIDS",
  message:
    "Multiple calls to ?0ng in quick succession, with negative numbers, can produce the same output",
  severity: DiagnosticSeverity.Warning,
};

const UnreachableCode: LinterRule = {
  code: "UNREACHABLE_CODE",
  message: "A preceding return prevents this statement from being reached",
  severity: DiagnosticSeverity.Warning,
};

const UnexpectedCondNewline: LinterRule = {
  code: "UNEXPECTED_COND_NEWLINE",
  message: "Condition should begin on same line as loop or if statement",
  severity: DiagnosticSeverity.Warning,
};

const UnparenthesizedJoin: LinterRule = {
  code: "UNPARENTHESIZED_JOIN",
  message:
    "A potential join in this QSQL statement will be interpreted as separate statements unless wrapped in parentheses",
  severity: DiagnosticSeverity.Warning,
};

const VarQError: LinterRule = {
  code: "VAR_Q_ERROR",
  message:
    "Variable name the same as q error message. This can cause ambiguous error messages",
  severity: DiagnosticSeverity.Warning,
};

const MissingSemicolon: LinterRule = {
  code: "MISSING_SEMICOLON",
  message:
    "An apply statement spans multiple lines with the same indentation and an assignment on the second line, potentially indicating a missing semi-colon	",
  severity: DiagnosticSeverity.Warning,
};

const Malformed: LinterRule = {
  code: "MALFORMED_RULE",
  message: "Malformed @qlintrule tag",
  severity: DiagnosticSeverity.Warning,
};

const Todo: LinterRule = {
  code: "TODO",
  message: "Todo qDoc tag present",
  severity: DiagnosticSeverity.Warning,
};

const LineLength: LinterRule = {
  code: "LINE_LENGTH",
  message: "Maximum line length exceeded",
  severity: DiagnosticSeverity.Warning,
};

const DefaultQdoc: LinterRule = {
  code: "DEFAULT_QDOC",
  message: "The file has the default documentation",
  severity: DiagnosticSeverity.Information,
};

const InvalidKind: LinterRule = {
  code: "INVALID_KIND",
  message: "Invalid qdoc kind in tag",
  severity: DiagnosticSeverity.Information,
};

const InvalidTypedef: LinterRule = {
  code: "INVALID_TYPEDEF",
  message: "Invalid typedef tag",
  severity: DiagnosticSeverity.Information,
};

const InvalidTag: LinterRule = {
  code: "INVALID_TAG",
  message: "Tag not recognized as valid qDoc tag",
  severity: DiagnosticSeverity.Information,
};

const MissingOverview: LinterRule = {
  code: "MISSING_OVERVIEW",
  message: "Missing @fileOverview tag with associated description",
  severity: DiagnosticSeverity.Information,
};

const MissingReturns: LinterRule = {
  code: "MISSING_RETURNS",
  message: "Missing @returns tag",
  severity: DiagnosticSeverity.Information,
};

const MissingType: LinterRule = {
  code: "MISSING_TYPE",
  message: "Missing type in returns or param tag",
  severity: DiagnosticSeverity.Information,
};

const MultipleReturns: LinterRule = {
  code: "MULTIPLE_RETURNS",
  message: "Multiple @returns tags",
  severity: DiagnosticSeverity.Information,
};

const OurOfOrderParam: LinterRule = {
  code: "OUT_OF_ORDER_PARAM",
  message: "Parameters out of order",
  severity: DiagnosticSeverity.Information,
};

const ParamNotInCode: LinterRule = {
  code: "PARAM_NOT_IN_CODE",
  message: "This param is not in the function",
  severity: DiagnosticSeverity.Information,
};

const QdocType: LinterRule = {
  code: "QDOC_TYPE",
  message: "Invalid type in tag",
  severity: DiagnosticSeverity.Information,
};

const RedundantQlobalAssign: LinterRule = {
  code: "REDUNDANT_GLOBAL_ASSIGN",
  message:
    "Using the global amend operator on a fully qualified name is redundant",
  severity: DiagnosticSeverity.Information,
};

const UndocumentedParam: LinterRule = {
  code: "UNDOCUMENTED_PARAM",
  message: "Undocumented parameter",
  severity: DiagnosticSeverity.Information,
};

const UnusedDependency: LinterRule = {
  code: "UNUSED_DEPENDENCY",
  message: "Unused dependencies",
  severity: DiagnosticSeverity.Information,
};

export const Rules: LinterRule[] = [
  AssignReservedWord,
  CondEvenArgs,
  DeclaredAfterUse,
  GlobalPeach,
  InvalidAdverb,
  InvalidAssign,
  InvalidEscape,
  InvalidQuke,
  OverwriteArtifact,
  StatementInExpr,
  ReservedName,
  TooManyConstants,
  TooManyGlobals,
  TooManyLocals,
  TooManyArguments,
  UnindentedCode,
  BackwardCompatibility,
  CastTypeNumerical,
  ConditionallyDeclared,
  DebugFunction,
  DeprecatedDatetime,
  DeprecatedFunction,
  EmptyIf,
  FixedSeed,
  FunctionStart,
  InsufficientIndent,
  Internal,
  InvalidFunction,
  MalformedSuppression,
  MissingDependency,
  NameCollision,
  NeedExplicitReturn,
  PossibleReturn,
  UndeclaredVar,
  UnusedInternal,
  UnusedParam,
  UnusedVar,
  RandomGuids,
  UnreachableCode,
  UnexpectedCondNewline,
  UnparenthesizedJoin,
  VarQError,
  MissingSemicolon,
  Malformed,
  Todo,
  LineLength,
  DefaultQdoc,
  InvalidKind,
  InvalidTypedef,
  InvalidTag,
  MissingOverview,
  MissingReturns,
  MissingType,
  MultipleReturns,
  OurOfOrderParam,
  ParamNotInCode,
  QdocType,
  RedundantQlobalAssign,
  UndocumentedParam,
  UnusedDependency,
];
