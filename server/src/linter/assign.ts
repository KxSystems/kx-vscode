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

export function assignReservedWord({ script }: QAst): Entity[] {
  console.log(script);
  return [];
}

export function invalidAssign({ script }: QAst): Entity[] {
  console.log(script);
  return [];
}

export function declaredAfterUse({ script }: QAst): Entity[] {
  console.log(script);
  return [];
}

export function unusedParam({ script }: QAst): Entity[] {
  console.log(script);
  return [];
}

export function unusedVar({ script }: QAst): Entity[] {
  console.log(script);
  return [];
}
