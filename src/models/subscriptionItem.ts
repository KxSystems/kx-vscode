import { SubscriptionModels } from '@azure/arm-subscriptions';
import { AzureSession } from '../azure-account.api';

export interface SubscriptionItem {
  label: string;
  description: string;
  session: AzureSession;
  subscription: SubscriptionModels.Subscription;
}
