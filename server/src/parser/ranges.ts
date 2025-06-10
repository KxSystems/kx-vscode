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

import { createToken } from "chevrotain";

export const CommentBegin = createToken({
  name: "CommentBegin",
  pattern: /(?<!.)\/[ \t]*(?!.)/,
  push_mode: "comment_mode",
});

export const CommentEnd = createToken({
  name: "CommentEnd",
  pattern: /(?<!.)\\[ \t]*(?!.)/,
  pop_mode: true,
});

export const ExitCommentBegin = createToken({
  name: "ExitCommentBegin",
  pattern: /(?<!.)\\[ \t]*(?!.)/,
  push_mode: "exit_comment_mode",
});

export const StringBegin = createToken({
  name: "StringBegin",
  pattern: /"/,
  push_mode: "string_mode",
});

export const StringEnd = createToken({
  name: "StringEnd",
  pattern: /"/,
  pop_mode: true,
});

export const TestBegin = createToken({
  name: "TestBegin",
  pattern: /(?<!.)[ \t]*(x?feature)\b(.*)/i,
  push_mode: "test_mode",
});
