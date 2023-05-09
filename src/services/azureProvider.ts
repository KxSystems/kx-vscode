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
