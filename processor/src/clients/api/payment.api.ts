import { ApiResources } from '../types/api.type';
import {
  CkoCapturePaymentRequest,
  CkoCapturePaymentResponse,
  CkoGetPaymentResponse,
  CkoPaymentRequest,
  CkoPaymentResponse,
  CkoRefundPaymentRequest,
  CkoRefundPaymentResponse,
  CkoReversePaymentRequest,
  CkoReversePaymentResponse,
  CkoVoidPaymentRequest,
  CkoVoidPaymentResponse,
} from '../types/payment.type';
import { CkoBaseApi } from './base-api';

export class PaymentApi extends CkoBaseApi {
  constructor() {
    super();
  }

  public async createPayment(request: CkoPaymentRequest): Promise<CkoPaymentResponse> {
    const url = this.buildResourceUrl(ApiResources.CREATE_PAYMENT);

    return await this.executeCall<CkoPaymentResponse>({
      method: 'post',
      url,
      data: request,
    });
  }

  public async getPayment(id: string): Promise<CkoGetPaymentResponse> {
    const url = this.buildResourceUrl(ApiResources.GET_PAYMENT, id);

    return await this.executeCall<CkoGetPaymentResponse>({
      method: 'get',
      url,
    });
  }

  public async voidPayment(id: string, request: CkoVoidPaymentRequest): Promise<CkoVoidPaymentResponse> {
    const url = this.buildResourceUrl(ApiResources.VOID_PAYMENTS, id);

    return await this.executeCall<CkoVoidPaymentResponse>({
      method: 'post',
      url,
      data: request,
    });
  }

  public async reversePayment(id: string, request: CkoReversePaymentRequest): Promise<CkoReversePaymentResponse> {
    const url = this.buildResourceUrl(ApiResources.REVERSE_PAYMENTS, id);

    return await this.executeCall<CkoReversePaymentResponse>({
      method: 'post',
      url,
      data: request,
    });
  }

  public async capturePayment(id: string, request: CkoCapturePaymentRequest): Promise<CkoCapturePaymentResponse> {
    const url = this.buildResourceUrl(ApiResources.CAPTURE_PAYMENTS, id);

    return await this.executeCall<CkoCapturePaymentResponse>({
      method: 'post',
      url,
      data: request,
    });
  }

  public async refundPayment(id: string, request: CkoRefundPaymentRequest): Promise<CkoRefundPaymentResponse> {
    const url = this.buildResourceUrl(ApiResources.REFUND_PAYMENTS, id);

    return await this.executeCall<CkoRefundPaymentResponse>({
      method: 'post',
      url,
      data: request,
    });
  }
}
