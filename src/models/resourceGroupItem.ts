import { ResourceGroup } from "@azure/arm-resources/esm/models";

export interface ResourceGroupItem {
  label: string;
  description?: string;
  resourceGroup?: ResourceGroup;
}
