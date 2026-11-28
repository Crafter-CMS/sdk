import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Token storage for the example: ONE LOCAL JSON FILE.
 *
 * This is only good enough to run the example on your machine. In production use a database, encrypt refresh tokens
 * and webhook secrets at rest (for example with a KMS key), and never log them. The file is written with mode 0600
 * and replaced atomically, but it is still plain text on disk.
 *
 * Shape:
 * {
 *   "installations": {
 *     "<websiteId>": {
 *       "store": { "id", "name", "url" },
 *       "scope": "read_store read_orders",
 *       "accessToken", "accessTokenExpiresAt",
 *       "refreshToken", "refreshTokenExpiresAt",
 *       "installedAt"
 *     }
 *   },
 *   "webhookEndpoints": { "<websiteId>": { "id", "secret", "livemode" } },
 *   "deliveries": { "<X-Crafter-Delivery>": <received at, ms> }
 * }
 */

/** Delivery ids are kept this long for de-duplication (Crafter retries an app endpoint for about 12 hours). */
const DELIVERY_RETENTION_MS = 48 * 60 * 60 * 1000;

export class TokenStore {
  constructor(file) {
    this.file = file;
    this.data = { installations: {}, webhookEndpoints: {}, deliveries: {} };
    this.writing = Promise.resolve();
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'));
      this.data = {
        installations: parsed.installations ?? {},
        webhookEndpoints: parsed.webhookEndpoints ?? {},
        deliveries: parsed.deliveries ?? {},
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  /** Serialized, atomic write: a crash never leaves a half-written file. */
  save() {
    this.writing = this.writing.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
      await rename(tmp, this.file);
    });
    return this.writing;
  }

  listInstallations() {
    return Object.entries(this.data.installations).map(([websiteId, item]) => ({ websiteId, ...item }));
  }

  getInstallation(websiteId) {
    return this.data.installations[websiteId] ?? null;
  }

  async saveTokens(websiteId, tokenResponse, nowMs = Date.now()) {
    const previous = this.data.installations[websiteId];
    this.data.installations[websiteId] = {
      store: tokenResponse.store ?? previous?.store ?? { id: websiteId, name: websiteId, url: null },
      scope: tokenResponse.scope,
      accessToken: tokenResponse.access_token,
      accessTokenExpiresAt: nowMs + tokenResponse.expires_in * 1000,
      refreshToken: tokenResponse.refresh_token,
      refreshTokenExpiresAt: nowMs + tokenResponse.refresh_token_expires_in * 1000,
      installedAt: previous?.installedAt ?? new Date(nowMs).toISOString(),
    };
    await this.save();
  }

  /** Forget every token of a store (uninstall, revoked grant). */
  async deleteInstallation(websiteId) {
    if (!this.data.installations[websiteId]) return false;
    delete this.data.installations[websiteId];
    await this.save();
    return true;
  }

  getWebhookEndpoint(websiteId) {
    return this.data.webhookEndpoints[websiteId] ?? null;
  }

  async saveWebhookEndpoint(websiteId, endpoint) {
    this.data.webhookEndpoints[websiteId] = endpoint;
    await this.save();
  }

  async deleteWebhookEndpoint(websiteId) {
    delete this.data.webhookEndpoints[websiteId];
    await this.save();
  }

  hasDelivery(id) {
    return Object.hasOwn(this.data.deliveries, id);
  }

  async rememberDelivery(id, nowMs = Date.now()) {
    for (const [key, at] of Object.entries(this.data.deliveries))
      if (nowMs - at > DELIVERY_RETENTION_MS) delete this.data.deliveries[key];
    this.data.deliveries[id] = nowMs;
    await this.save();
  }
}
