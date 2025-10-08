import { log } from '../libs/logger';
import { paymentSDK } from '../payment-sdk';

export async function createPaymentCustomTypes(): Promise<void> {
  log.info('Creating payment custom types if not existing...');

  const interfaceInteractionType = await paymentSDK.ctCustomTypeService.createPredefinedInterfaceInteractionType();
  log.info('Created (if not existing) interface interaction custom type', {
    typeId: interfaceInteractionType.id,
    typeKey: interfaceInteractionType.key,
  });
  const paymentMethodsTypes = await paymentSDK.ctCustomTypeService.createPredefinedPaymentMethodsTypes();
  paymentMethodsTypes.forEach((type) => {
    log.info('Created (if not existing) payment method custom type', { typeId: type.id, typeKey: type.key });
  });
}
