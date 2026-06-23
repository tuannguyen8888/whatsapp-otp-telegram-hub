import { describe, expect, it, vi } from "vitest";
import { EvolutionClient } from "../src/evolution.js";

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("EvolutionClient", () => {
  it("creates an instance with webhook and QR enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ qrcode: { base64: "data:image/png;base64,abc" } }));
    const client = new EvolutionClient({
      baseUrl: "http://evolution:8080",
      apiKey: "key",
      webhookUrl: "https://hub.example.com/webhook/evolution",
      webhookSecret: "secret",
      fetch: fetchMock
    });

    const result = await client.createInstance("sim_openai_01");

    expect(result.qrBase64).toBe("data:image/png;base64,abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://evolution:8080/instance/create",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("requests a fresh QR", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ base64: "data:image/png;base64,qr" }));
    const client = new EvolutionClient({
      baseUrl: "http://evolution:8080",
      apiKey: "key",
      webhookUrl: "https://hub.example.com/webhook/evolution",
      webhookSecret: "secret",
      fetch: fetchMock
    });

    await expect(client.connectInstance("sim_openai_01")).resolves.toEqual({ qrBase64: "data:image/png;base64,qr" });
  });
});
