import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { WhatsAppInstance } from "./types.js";

export class InstanceStore {
  constructor(private readonly path: string) {}

  async list(): Promise<WhatsAppInstance[]> {
    return this.readAll();
  }

  async get(alias: string): Promise<WhatsAppInstance | undefined> {
    const instances = await this.readAll();
    return instances.find((instance) => instance.alias === alias);
  }

  async upsert(instance: WhatsAppInstance): Promise<void> {
    const instances = await this.readAll();
    const index = instances.findIndex((current) => current.alias === instance.alias);
    if (index === -1) {
      instances.push(instance);
    } else {
      instances[index] = instance;
    }
    await this.writeAll(instances);
  }

  async delete(alias: string): Promise<void> {
    const instances = await this.readAll();
    await this.writeAll(instances.filter((instance) => instance.alias !== alias));
  }

  private async readAll(): Promise<WhatsAppInstance[]> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as WhatsAppInstance[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async writeAll(instances: WhatsAppInstance[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(instances, null, 2)}\n`);
  }
}
