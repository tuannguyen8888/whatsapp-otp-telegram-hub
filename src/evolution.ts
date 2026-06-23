type FetchLike = typeof fetch;

type EvolutionClientOptions = {
  baseUrl: string;
  apiKey: string;
  webhookUrl: string;
  webhookSecret: string;
  fetch?: FetchLike;
};

type QrResult = {
  qrBase64?: string;
  pairingCode?: string;
};

export class EvolutionClient {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: EvolutionClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async createInstance(instanceName: string): Promise<QrResult> {
    const body = {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook: {
        url: this.options.webhookUrl,
        byEvents: false,
        base64: false,
        headers: {
          "x-hub-secret": this.options.webhookSecret
        },
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"]
      }
    };

    const json = await this.request("/instance/create", "POST", body);
    return extractQr(json);
  }

  async connectInstance(instanceName: string): Promise<QrResult> {
    const json = await this.request(`/instance/connect/${encodeURIComponent(instanceName)}`, "GET");
    return extractQr(json);
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await this.request(`/instance/delete/${encodeURIComponent(instanceName)}`, "DELETE");
  }

  private async request(path: string, method: string, body?: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        apikey: this.options.apiKey
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Evolution API ${method} ${path} failed with ${response.status}`);
    }

    return response.json();
  }
}

function extractQr(json: unknown): QrResult {
  const value = json as Record<string, unknown>;
  const qrcode = value.qrcode as Record<string, unknown> | undefined;
  const base64 = value.base64 ?? qrcode?.base64 ?? value.qrBase64;
  const pairingCode = value.pairingCode ?? qrcode?.pairingCode;

  return {
    qrBase64: typeof base64 === "string" ? base64 : undefined,
    pairingCode: typeof pairingCode === "string" ? pairingCode : undefined
  };
}
