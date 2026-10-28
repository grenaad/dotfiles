type Environment = "dev" | "prod";

type Input = { environment?: Environment; force_refresh?: boolean };

type ToolContext = { signal: AbortSignal };

type ToolInfo = {
  name: string;
  description: string;
  input: Record<string, unknown>;
  options?: { namespace?: string; codemode?: boolean };
  execute: (input: Input, context: ToolContext) => Promise<{ content: string }>;
};

type ToolEditor = { add(tool: ToolInfo): void };

type Context = {
  tool: { transform(fn: (editor: ToolEditor) => void): Promise<unknown> };
};

type Claims = {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  iat?: number;
  scope?: string;
};

type CacheEntry = { token: string; claims: Claims; exp: number };

const ENVIRONMENTS: Record<
  Environment,
  { domain: string; emailVar: string; passwordVar: string }
> = {
  dev: {
    domain: "focaldata.dev",
    emailVar: "FD_APP_DEV_EMAIL",
    passwordVar: "FD_APP_DEV_PASSWORD",
  },
  prod: {
    domain: "focaldata.com",
    emailVar: "FD_APP_PROD_EMAIL",
    passwordVar: "FD_APP_PROD_PASSWORD",
  },
};

const REFRESH_MARGIN_SECONDS = 5 * 60;

const cache = new Map<string, CacheEntry>();

function decodeClaims(token: string): Claims | undefined {
  const part = token.split(".")[1];
  if (!part) return undefined;
  try {
    const json = Buffer.from(part, "base64url").toString("utf8");
    const value = JSON.parse(json);
    return value && typeof value === "object" ? (value as Claims) : undefined;
  } catch {
    return undefined;
  }
}

function iso(seconds: number | undefined): string | undefined {
  return typeof seconds === "number"
    ? new Date(seconds * 1000).toISOString()
    : undefined;
}

async function login(
  env: Environment,
  email: string,
  password: string,
  signal: AbortSignal,
) {
  const { domain, emailVar, passwordVar } = ENVIRONMENTS[env];
  const response = await fetch(
    `https://rest.${domain}/v1/dashboard/api/v1.0/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Referer: `https://dashboard.${domain}/`,
      },
      body: JSON.stringify({ emailAddress: email, password }),
      signal,
    },
  );
  const text = await response.text();
  let body: { message?: unknown; accessToken?: unknown } | undefined;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  if (!response.ok) {
    const detail = typeof body?.message === "string" ? body.message : text;
    throw new Error(
      `fd ${env} login failed (HTTP ${response.status}, credentials from ${emailVar}/${passwordVar}): ` +
        `${detail.replaceAll(password, "<redacted>").slice(0, 300).replace(/\.$/, "")}. ` +
        "Note: dev and prod are separate Auth0 tenants; credentials are not interchangeable.",
    );
  }
  if (typeof body?.accessToken !== "string" || !body.accessToken) {
    throw new Error(
      `fd ${env} login returned HTTP ${response.status} without an accessToken.`,
    );
  }
  return body.accessToken;
}

export default {
  id: "fd-auth",
  setup: async (ctx: Context) => {
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "fd_jwt",
        description: [
          "Get an fd JWT access token for the dev (focaldata.dev) or prod (focaldata.com) dashboard/REST/GraphQL APIs.",
          "Use it whenever you need to call rest.focaldata.{dev|com} or graphql.focaldata.{dev|com} as the configured app user, e.g. with curl.",
          "Returns the raw token (send as `Authorization: Bearer <access_token>`) plus decoded expiry, issuer, audience, subject and scope.",
          "Tokens are cached in memory until 5 minutes before expiry; set force_refresh to log in again.",
          "Dev and prod tokens are not interchangeable.",
        ].join(" "),
        input: {
          type: "object",
          properties: {
            environment: {
              type: "string",
              enum: ["dev", "prod"],
              default: "dev",
              description:
                "dev = focaldata.dev, prod = focaldata.com. Defaults to dev.",
            },
            force_refresh: {
              type: "boolean",
              default: false,
              description: "Bypass the in-memory token cache and log in again.",
            },
          },
          additionalProperties: false,
        },
        options: { codemode: false },
        execute: async (input, context) => {
          const env: Environment = input?.environment ?? "dev";
          if (!Object.hasOwn(ENVIRONMENTS, env))
            throw new Error(
              `Unknown environment "${env}"; use "dev" or "prod".`,
            );
          const { domain, emailVar, passwordVar } = ENVIRONMENTS[env];

          const email = process.env[emailVar];
          const password = process.env[passwordVar];
          const missing = [
            ...(email ? [] : [emailVar]),
            ...(password ? [] : [passwordVar]),
          ];
          if (!email || !password) {
            throw new Error(
              `Missing environment variable(s) for fd ${env}: ${missing.join(", ")}. ` +
                "The OpenCode background service must have them in its environment " +
                "(export them, then run `opencode service restart`).",
            );
          }

          const key = `${env}:${email}`;
          const now = Math.floor(Date.now() / 1000);
          let entry = input?.force_refresh ? undefined : cache.get(key);
          if (entry && entry.exp - REFRESH_MARGIN_SECONDS <= now)
            entry = undefined;
          const cached = entry !== undefined;

          if (!entry) {
            const token = await login(env, email, password, context.signal);
            const claims = decodeClaims(token) ?? {};
            entry = { token, claims, exp: claims.exp ?? 0 };
            if (typeof claims.exp === "number") cache.set(key, entry);
            else cache.delete(key);
          }

          const { claims } = entry;
          const result = {
            environment: env,
            email,
            access_token: entry.token,
            expires_at: iso(claims.exp),
            expires_in_seconds:
              typeof claims.exp === "number" ? claims.exp - now : undefined,
            issued_at: iso(claims.iat),
            issuer: claims.iss,
            audience: claims.aud,
            subject: claims.sub,
            scope: claims.scope,
            cached,
            usage: {
              header: "Authorization: Bearer <access_token>",
              rest: `https://rest.${domain}`,
              graphql: `https://graphql.${domain}`,
              note: "Dev and prod are separate Auth0 tenants; tokens are not interchangeable.",
            },
          };
          return { content: JSON.stringify(result, null, 2) };
        },
      });
    });
  },
};
