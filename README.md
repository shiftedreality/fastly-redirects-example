# Fastly Redirect Handler

> ⚠️ **Disclaimer:** This project is provided **for example and demonstration purposes only**. It is not officially supported, comes with no warranty, and is not intended for production use as-is. Review, test, and harden it for your own requirements before relying on it. Use at your own risk.

A [Fastly Compute](https://www.fastly.com/documentation/guides/compute/) application that serves **301 redirects** at the edge, backed by a Fastly **KV Store**. Each incoming request path is looked up in the KV Store; if a matching key exists, the request is redirected to the stored destination URL.

- Match found → `301 Moved Permanently` with a `Location` header (cached for 1 hour)
- No match → `404 Not Found` (`No redirect found`)

The redirect logic lives in [`src/index.js`](src/index.js).

## Prerequisites

- A [Fastly account](https://www.fastly.com/signup/) and an [API token](https://www.fastly.com/documentation/reference/api/#authentication) with access to create services and KV Stores
- [Node.js](https://nodejs.org/) 18 or newer
- The [Fastly CLI](https://www.fastly.com/documentation/reference/tools/cli/) installed and authenticated:

  ```shell
  # macOS
  brew install fastly/tap/fastly

  # then log in (stores your API token)
  fastly profile create
  ```

## 1. Get the code and install dependencies

```shell
git clone <this-repo> fastly-redirects
cd fastly-redirects
npm install
```

## 2. Point the app at your own service

The included [`fastly.toml`](fastly.toml) contains a `service_id` from the original deployment. **Remove it** so that the CLI creates a brand-new service under *your* account on first deploy:

```toml
# fastly.toml — delete or blank out this line
service_id = "..."
```

Also update `name`, `description`, and the `origin_0` backend address to point at the site you're redirecting to/from.

## 3. Run it locally

```shell
npm run start
```

This builds `src/index.js` to WebAssembly and serves it locally (default http://127.0.0.1:7676) using Fastly's Viceroy runtime. Local redirects are read from `local-redirects.json` via the `[local_server.kv_stores]` section of `fastly.toml`.

Create your local redirect data by copying the example file (`local-redirects.json` is gitignored, so it stays out of version control):

```shell
cp local-redirects.example.json local-redirects.json
```

Test it:

```shell
# 301 → the configured destination
curl -i http://127.0.0.1:7676/old-page/

# unknown path → 404
curl -i http://127.0.0.1:7676/some-other-path
```

Add more local redirects by editing `local-redirects.json` (restart the server to pick up changes):

```json
{
  "/old-page/": "https://example.com/new-page/",
  "/promo/":    "https://example.com/campaign/"
}
```

## 4. Deploy to Fastly

```shell
npm run deploy
```

The first time, the CLI prompts you to **create a new service**. Accept, and it will build, package, upload, and activate the app. When it finishes, Fastly assigns an auto-generated hostname like `https://<random-name>.edgecompute.app` — that's your live endpoint.

## 5. Create the production KV Store and add redirects

The local `local-redirects.json` file (copied from `local-redirects.example.json`) is **only for local development**. In production, redirects live in a real KV Store that you populate with the CLI.

```shell
# Create the store (name must match the one used in src/index.js: "redirects_store")
fastly kv-store create --name=redirects_store

# Link the store to your service so the app can read it.
# Grab the Store ID from the create command output, then:
fastly resource-link create \
  --service-id=<YOUR_SERVICE_ID> \
  --version=latest \
  --resource-id=<STORE_ID> \
  --autoclone
fastly service-version activate --service-id=<YOUR_SERVICE_ID> --version=latest

# Add a redirect: key = request path, value = destination URL
fastly kv-store-entry create \
  --store-id=<STORE_ID> \
  --key="/old-page/" \
  --value="https://example.com/new-page/"
```

Verify against your live endpoint:

```shell
curl -i https://<your-service>.edgecompute.app/old-page/
```

You should see `HTTP/2 301`, a `location:` header, and `x-redirect-by: Fastly-KV`.

## How lookups work

Keys are matched **exactly** on the URL path. `/old-page/` and `/old-page` are different keys — add both if you want trailing-slash-insensitive behavior. Query strings are ignored (only the path is used for lookup).

## Custom domain (optional)

To serve redirects from your own hostname instead of the `.edgecompute.app` default, add a domain to the service, point DNS (a CNAME to Fastly) at it, and configure TLS. See Fastly's [custom domain guide](https://www.fastly.com/documentation/guides/full-site-delivery/domains/).

## Project layout

| File | Purpose |
|------|---------|
| [`src/index.js`](src/index.js) | Edge redirect logic |
| [`fastly.toml`](fastly.toml) | Service manifest (backends, KV store binding, local dev config) |
| [`local-redirects.example.json`](local-redirects.example.json) | Template for local redirect data — copy to `local-redirects.json` (gitignored) |
| [`package.json`](package.json) | Dependencies and `build` / `start` / `deploy` scripts |
