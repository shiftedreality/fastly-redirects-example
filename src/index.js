/// <reference types="@fastly/js-compute" />
import { KVStore } from "fastly:kv-store";

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const req = event.request;
  const url = new URL(req.url);
  const path = url.pathname;

  let store;
  try {
    store = new KVStore("redirects_store");
  } catch (err) {
    return new Response("KV Store unavailable", { status: 500 });
  }

  const entry = await store.get(path);

  if (entry !== null) {
    const destination = await entry.text();
    return new Response(null, {
      status: 301,
      headers: {
        "Location": destination,
        "Cache-Control": "public, max-age=3600",
        "X-Redirect-By": "Fastly-KV",
      },
    });
  }

  return new Response("No redirect found", { status: 404 });
}
