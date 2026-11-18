/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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

export interface TopLevelStatement {
  startLine: number;
  startChar: number;
  endLine: number;
  text: string;
  namespace: string;
}

export interface LambdaPath {
  name: string;
  path: number[];
  startLine: number;
  rootLine: number;
  rootColumn?: number;
}

export interface LambdaTarget {
  name: string;
  path: number[];
  line: number;
  column: number;
  rootLine: number;
  rootColumn?: number;
}

export interface LambdaSpan {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface StatementSeparator {
  line: number;
  column: number;
}

export interface LineIdentifier {
  name: string;
  canon: string;
}

export interface FileParams {
  path: string;
}

export interface LineParams extends FileParams {
  line: number;
}

export interface LambdaPathParams extends LineParams {
  anonymous?: boolean;
  column?: number;
}

export interface ColumnParams extends LineParams {
  column: number;
}

export interface LineRangeParams extends FileParams {
  startLine: number;
  endLine: number;
}

export interface StructureRequests {
  "kdb.qls.topLevelStatements": [FileParams, TopLevelStatement[]];
  "kdb.qls.lambdaPath": [LambdaPathParams, LambdaPath | null];
  "kdb.qls.statementLambdas": [ColumnParams, LambdaTarget[]];
  "kdb.qls.rootLambdas": [LineRangeParams, LambdaSpan[]];
  "kdb.qls.statementSeparators": [LineParams, StatementSeparator[]];
  "kdb.qls.identifiersOnLines": [LineRangeParams, LineIdentifier[]];
}
