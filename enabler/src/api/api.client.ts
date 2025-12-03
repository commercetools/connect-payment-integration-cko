import {
  CreatePaymentSessionRequest,
  CreatePaymentSessionResponse,
  PaymentConfigResponse,
  PayWithStoredMethodRequest,
  PayWithStoredMethodResponse,
  StoredPaymentMethodsResponse,
  SubmitPaymentSessionRequest,
  SubmitPaymentSessionResponse,
} from "./api.type";

export class PaymentApi {
  private host: string;
  private sessionId: string;

  constructor(opts: { processorUrl: string; sessionId: string }) {
    this.host = opts.processorUrl;
    this.sessionId = opts.sessionId;
  }

  public async getPaymentConfig(): Promise<PaymentConfigResponse> {
    const res = await fetch(`${this.host}/operations/config`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
    });
    if (!res.ok) throw new Error(`Failed to get client config (${res.status})`);
    return res.json();
  }

  public async getStoredPaymentMethods(): Promise<StoredPaymentMethodsResponse> {
    const res = await fetch(`${this.host}/stored-payment-methods`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
    });
    if (!res.ok) throw new Error(`Failed to get stored payment methods (${res.status})`);
    return res.json();
  }

  public async payWithStoredMethod(id: string, data: PayWithStoredMethodRequest): Promise<PayWithStoredMethodResponse> {
    const res = await fetch(`${this.host}/stored-payment-methods/${id}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(`Failed to pay with stored payment method (${res.status})`);

    return res.json();
  }

  public async deleteStoredPaymentMethod(id: string): Promise<void> {
    const res = await fetch(`${this.host}/stored-payment-methods/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
    });

    if (!res.ok) throw new Error(`Failed to delete stored payment method (${res.status})`);
  }

  public async createPaymentSession(data: CreatePaymentSessionRequest): Promise<CreatePaymentSessionResponse> {
    console.log("Creating payment session with data:", this.host, data);
    const res = await fetch(`${this.host}/payment-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(`Failed to create the cko payment session (${res.status})`);
    return res.json();
  }

  public async submitPaymentSession(
    paymentSessionId: string,
    data: SubmitPaymentSessionRequest
  ): Promise<SubmitPaymentSessionResponse> {
    const res = await fetch(this.host + "/payment-sessions/" + paymentSessionId, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(`Failed to submit the cko payment session (${res.status})`);

    return res.json();
  }
}
