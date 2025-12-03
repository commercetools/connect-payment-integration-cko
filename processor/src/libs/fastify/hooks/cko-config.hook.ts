import { FastifyRequest } from 'fastify';
import { Cart, CommercetoolsCartService, CommercetoolsOrderService, Order } from '@commercetools/connect-payments-sdk';
import { getConfig } from '@app/config/config';
import { log } from '@lib/logger';
import { CkoWebhookEvent } from '@app/clients/types/webhook.type';
import { getCartIdFromContext, updateRequestContext } from '../context/context';

/**
 * Fastify hook for multi-channel Checkout.com configuration resolution
 *
 * This hook determines which Checkout.com channel configuration to use for the current request
 * based on the cart/order context. It supports:
 *
 * 1. **Checkout flow**: Uses session cart to determine channel
 * 2. **Payment Intent operations**: Retrieves cart/order from payment ID
 * 3. **Fallback**: Uses default configuration if no specific channel is found
 *
 * The resolved channel key is stored in the request context and used by all
 * configuration getter functions (getPublicKey, getSecretKey, etc.)
 */
export class CkoConfigHook {
  private cartService: CommercetoolsCartService;
  private orderService: CommercetoolsOrderService;

  /**
   * Initialize the configuration hook
   *
   * @param opts.cartService - Service for cart operations
   * @param opts.orderService - Service for order operations
   */
  constructor(opts: { cartService: CommercetoolsCartService; orderService: CommercetoolsOrderService }) {
    this.cartService = opts.cartService;
    this.orderService = opts.orderService;
  }

  /**
   * Create Fastify preHandler hook for channel configuration resolution
   *
   * Flow:
   * 1. Skip resolution if single-channel mode (performance optimization)
   * 2. Retrieve cart/order from request context
   * 3. Extract channel key using configured JSONata path
   * 4. Store in request context for downstream use
   *
   * @returns Fastify hook function
   */
  public setConfigKey() {
    return async (request: FastifyRequest) => {
      let ckoConfigKey: string | undefined;

      // Skip channel resolution if only default config exists
      if (getConfig().hasMultiChannelConfig()) {
        const cartOrOrder = await this.getCartOrOrderFromRequest(request);

        if (cartOrOrder) {
          try {
            ckoConfigKey = await getConfig().getChannelKey(cartOrOrder);
          } catch (error) {
            log.warn('Failed to extract channel key from cart/order, using default configuration', { error });
          }
        }
      }

      // Store resolved channel key in request context
      // undefined = use default configuration
      console.log('Setting CKO config key in request context:', ckoConfigKey || 'default');
      updateRequestContext({ ckoConfigKey });
    };
  }

  /**
   * Retrieve cart or order based on request type
   *
   * Request types:
   * - **Payment Intent operations** (`/operations/payment-intents/:id`):
   *   Uses payment ID from URL to lookup cart/order
   *
   * - **Checkout flow** (other endpoints):
   *   Uses cart ID from session context
   *
   * @param request - Fastify request object
   * @returns Cart or Order if found, undefined otherwise
   */
  private async getCartOrOrderFromRequest(request: FastifyRequest): Promise<Cart | Order | undefined> {
    if (this.isPaymentIntentRequest(request)) {
      const paymentId = this.getPaymentIdFromPaymentIntentRequest(request);
      return await this.getCartOrOrderByPaymentId(paymentId);
    } else if (this.isNotificationRequest(request)) {
      const paymentId = this.getPaymentIdFromNotificationRequest(request);
      return await this.getCartOrOrderByPaymentId(paymentId);
    } else {
      return await this.getCartBySessionContext();
    }
  }

  /**
   * Retrieve cart or order by payment ID from URL params
   *
   * Lookup order:
   * 1. Try to find active cart with payment
   * 2. Fallback to completed order with payment
   *
   * @param request - Fastify request with payment ID in params
   * @returns Cart or Order if found, undefined otherwise
   */
  private async getCartOrOrderByPaymentId(paymentId: string | undefined): Promise<Cart | Order | undefined> {
    if (!paymentId) {
      log.debug('No payment ID found in request params');
      return undefined;
    }

    // Try cart first (active checkouts)
    try {
      const cart = await this.cartService.getCartByPaymentId({ paymentId });
      log.debug('Found cart by payment ID', { cartId: cart.id, paymentId });
      return cart;
    } catch (error) {
      log.debug('Cart not found, trying order lookup', { paymentId, error });
    }

    // Fallback to order (completed checkouts)
    try {
      const order = await this.orderService.getOrderByPaymentId({ paymentId });
      log.debug('Found order by payment ID', { orderId: order.id, paymentId });
      return order;
    } catch (error) {
      log.warn('Neither cart nor order found for payment ID', { paymentId, error });
      return undefined;
    }
  }

  /**
   * Retrieve cart from session context
   *
   * Used for checkout flow requests where cart ID is stored in session.
   *
   * @returns Cart if found, undefined otherwise
   */
  private async getCartBySessionContext(): Promise<Cart | undefined> {
    const cartId = getCartIdFromContext();

    if (!cartId) {
      return undefined;
    }

    try {
      const cart = await this.cartService.getCart({ id: cartId });
      return cart;
    } catch (error) {
      log.warn('Failed to retrieve cart from session context', { error });
      return undefined;
    }
  }

  /**
   * Check if request is a Payment Intent operation
   *
   * Payment Intent endpoints use payment ID in URL instead of session cart.
   *
   * @param request - Fastify request
   * @returns true if request targets payment intent operations
   */
  private isPaymentIntentRequest(request: FastifyRequest): boolean {
    return request.url.startsWith('/operations/payment-intents');
  }

  /**
   * Check if request is a Notification operation
   * @param request - Fastify request
   * @returns true if request targets notification operations
   */
  private isNotificationRequest(request: FastifyRequest): boolean {
    return request.url.startsWith('/notifications');
  }

  /**
   * Extract payment ID from URL path parameters
   *
   * @param request - Fastify request
   * @returns Payment ID if present, undefined otherwise
   */
  private getPaymentIdFromPaymentIntentRequest(request: FastifyRequest): string | undefined {
    const params = request.params as { id?: string };
    const id = params?.id;

    return typeof id === 'string' && id.length > 0 ? id : undefined;
  }

  /**
   * Extract payment ID from notification request
   *
   * @param request - Fastify request
   * @returns Payment ID if present, undefined otherwise
   */
  private getPaymentIdFromNotificationRequest(request: FastifyRequest): string | undefined {
    const event = request.body as CkoWebhookEvent;
    return event.data.metadata?.payment_id || event.data.reference || undefined;
  }
}
