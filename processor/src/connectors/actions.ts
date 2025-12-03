import { log } from '@lib/logger';
import { paymentSDK } from '@app/payment-sdk';

export async function createPaymentCustomTypes(): Promise<void> {
  log.info('Creating payment custom types if not existing...');

  try {
    const interfaceInteractionType =
      await paymentSDK.ctCustomTypeService.createOrUpdatePredefinedInterfaceInteractionType();
    log.info('Created (if not existing) interface interaction custom type', {
      typeId: interfaceInteractionType.id,
      typeKey: interfaceInteractionType.key,
    });
    const paymentMethodsTypes = await paymentSDK.ctCustomTypeService.createOrUpdatePredefinedPaymentMethodTypes();
    paymentMethodsTypes.forEach((type) => {
      log.info('Created (if not existing) payment method custom type', { typeId: type.id, typeKey: type.key });
    });
  } catch (error) {
    log.error('Error creating payment custom types', { error });
  }
}
