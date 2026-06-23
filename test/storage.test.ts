import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { InstanceStore } from "../src/storage.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("InstanceStore", () => {
  it("saves and lists instances", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "wa-hub-"));
    const store = new InstanceStore(join(tempDir, "instances.json"));

    await store.upsert({
      alias: "sim_openai_01",
      instanceName: "sim_openai_01",
      status: "pending_qr",
      createdAt: "2026-06-23T00:00:00.000Z",
      updatedAt: "2026-06-23T00:00:00.000Z"
    });

    expect(await store.list()).toHaveLength(1);
    expect(await store.get("sim_openai_01")).toMatchObject({ status: "pending_qr" });
  });

  it("deletes an instance", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "wa-hub-"));
    const path = join(tempDir, "instances.json");
    const store = new InstanceStore(path);

    await store.upsert({
      alias: "sim_openai_01",
      instanceName: "sim_openai_01",
      status: "connected",
      createdAt: "2026-06-23T00:00:00.000Z",
      updatedAt: "2026-06-23T00:00:00.000Z"
    });
    await store.delete("sim_openai_01");

    expect(await store.list()).toEqual([]);
    expect(await readFile(path, "utf8")).toBe("[]\n");
  });
});
