import {
  CreatePaymentSessionRequest,
  CreatePaymentSessionResponse,
  PaymentConfigResponse,
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

  public async submitPaymentSession(paymentSessionId: string, data: SubmitPaymentSessionRequest): Promise<SubmitPaymentSessionResponse> {
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
