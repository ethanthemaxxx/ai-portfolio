/**
 * Shopify Admin GraphQL client (plan.md D9).
 *
 * ⚠️ NEVER EXECUTED AGAINST A REAL STORE. The transport is injected; every test
 * passes a stub. No credentials exist in this project.
 *
 * ⚠️ Before any real run, re-check `apiVersion` and both mutation shapes against
 * current Shopify docs. They were written from knowledge, not verified against a
 * live schema, because this environment has no network.
 */

export interface ShopifyConfig {
  /** e.g. `cerro-alto.myshopify.com` */
  shop: string;
  accessToken: string;
  apiVersion?: string;
}

export interface TransportRequest {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}

export type Transport = (
  url: string,
  init: TransportRequest,
) => Promise<{ status: number; json: unknown }>;

export class ShopifyError extends Error {}

export const DEFAULT_API_VERSION = '2026-07';

const PRODUCT_UPDATE = `mutation productUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id handle }
    userErrors { field message }
  }
}`;

const FILE_UPDATE = `mutation fileUpdate($files: [FileUpdateInput!]!) {
  fileUpdate(files: $files) {
    files { id alt }
    userErrors { field message }
  }
}`;

interface GraphQLResponse {
  data?: Record<string, { userErrors?: Array<{ field: string[] | null; message: string }> }>;
  errors?: Array<{ message: string }>;
}

export class ShopifyClient {
  // Explicit fields rather than constructor parameter properties: this project
  // runs TypeScript through Node's type stripping, which only erases types.
  readonly #config: ShopifyConfig;
  readonly #transport: Transport;
  readonly #endpoint: string;

  constructor(config: ShopifyConfig, transport: Transport) {
    if (!config.shop) throw new ShopifyError('shop domain is required');
    if (!config.accessToken) throw new ShopifyError('access token is required');
    this.#config = config;
    this.#transport = transport;
    this.#endpoint = `https://${config.shop}/admin/api/${config.apiVersion ?? DEFAULT_API_VERSION}/graphql.json`;
  }

  private async call(query: string, variables: Record<string, unknown>, root: string): Promise<void> {
    const response = await this.#transport(this.#endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The token comes from the config object handed to this instance, never
        // from a global or an ambient environment read.
        'X-Shopify-Access-Token': this.#config.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status !== 200) {
      throw new ShopifyError(`Shopify returned HTTP ${response.status}`);
    }
    const payload = response.json as GraphQLResponse;
    if (payload.errors && payload.errors.length > 0) {
      throw new ShopifyError(`GraphQL errors: ${payload.errors.map((e) => e.message).join('; ')}`);
    }
    const userErrors = payload.data?.[root]?.userErrors ?? [];
    if (userErrors.length > 0) {
      throw new ShopifyError(
        `${root} userErrors: ${userErrors.map((e) => `${(e.field ?? []).join('.')}: ${e.message}`).join('; ')}`,
      );
    }
  }

  /** Push description + SEO for one product. */
  async productUpdate(input: {
    id: string;
    descriptionHtml: string;
    seo: { title: string; description: string };
  }): Promise<void> {
    await this.call(PRODUCT_UPDATE, { input }, 'productUpdate');
  }

  /** Push alt text for one image. */
  async fileUpdate(files: Array<{ id: string; alt: string }>): Promise<void> {
    await this.call(FILE_UPDATE, { files }, 'fileUpdate');
  }
}
