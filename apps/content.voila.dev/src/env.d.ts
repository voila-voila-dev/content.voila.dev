/// <reference types="astro/client" />

type Env = {
  ASSETS: Fetcher;
};

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
