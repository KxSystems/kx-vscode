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

import { ResourceManagementClient } from "@azure/arm-resources";
import { SubscriptionClient } from "@azure/arm-subscriptions";
import { window } from "vscode";
import { ext } from "../extensionVariables";
import { SubscriptionItem } from "../models/subscriptionItem";
import { validateResourceGroupName } from "../validators/azureValidator";

export async function showSubscriptions() {
  await ext.azureAccount.waitForFilters();
  const subscriptionItems: SubscriptionItem[] = ext.azureAccount.filters
    .filter((element) => {
      return (
        element != undefined &&
        element.subscription != undefined &&
        element.subscription.subscriptionId
      );
    })
    .map((element) => {
      return {
        label: element.subscription.displayName || "",
        description: element.subscription.subscriptionId || "",
        session: element.session,
        subscription: element.subscription,
      };
    });
  return subscriptionItems;
}

export async function showLocations(subscriptionItem: SubscriptionItem) {
  const subscriptionClient = new SubscriptionClient(
    subscriptionItem.session.credentials2
  );
  const locations = await subscriptionClient.subscriptions.listLocations(
    subscriptionItem.subscription.subscriptionId!
  );
  locations.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return locations.map((location) => ({
    label: location.displayName || "",
    description: location.name || "",
  }));
}

export async function showResourceGroups(subscriptionItem: SubscriptionItem) {
  const { session, subscription } = subscriptionItem;
  const resources = new ResourceManagementClient(
    session.credentials2,
    subscription.subscriptionId!
  );

  const resourceGroups = await listAll(
    resources.resourceGroups,
    resources.resourceGroups.list()
  );
  resourceGroups.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return resourceGroups.map((resourceGroup) => ({
    label: resourceGroup.name || "",
    description: resourceGroup.location,
    resourceGroup,
  }));
}

export async function createResourceGroup(subscriptionItem: SubscriptionItem) {
  const { session, subscription } = subscriptionItem;
  const resources = new ResourceManagementClient(
    session.credentials2,
    subscription.subscriptionId!
  );

  const resourceGroupName = await window.showInputBox({
    ignoreFocusOut: true,
    placeHolder: "Resource group name",
    prompt: "Provide a resource group name",
    validateInput: (name) =>
      validateResourceGroupName(name, resources.resourceGroups),
  });

  const locations = await showLocations(subscriptionItem);
  const locationItem = await window.showQuickPick(locations, {
    title: "Pick a location",
  });
}

export interface PartialList<T> extends Array<T> {
  nextLink?: string;
}

async function listAll<T>(
  client: { listNext(nextPageLink: string): Promise<PartialList<T>> },
  first: Promise<PartialList<T>>
): Promise<T[]> {
  const all: T[] = [];
  for (
    let list = await first;
    list.length || list.nextLink;
    list = list.nextLink ? await client.listNext(list.nextLink) : []
  ) {
    all.push(...list);
  }
  return all;
}
