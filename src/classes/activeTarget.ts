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

import { ext } from "../extensionVariables";

/**
 * The single execution target that an unassigned file runs on — either the
 * REPL or a specific connection. It is determined by which KX target terminal
 * (a REPL terminal or a connection output console) was last focused. See
 * {@link ../classes/activeTargetTracker}.
 */
export type ActiveTarget =
  | { kind: "repl" }
  | { kind: "connection"; connLabel: string };

let activeTarget: ActiveTarget | undefined;

/**
 * The current active target, or undefined when none has been focused yet (or a
 * connection target whose console has since been disposed).
 */
export function getActiveTarget(): ActiveTarget | undefined {
  if (
    activeTarget?.kind === "connection" &&
    !ext.connectionConsoles.has(activeTarget.connLabel)
  ) {
    activeTarget = undefined;
  }
  return activeTarget;
}

export function setActiveTarget(target: ActiveTarget | undefined): void {
  activeTarget = target;
}
