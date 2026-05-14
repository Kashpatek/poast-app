# DesignStudio · Office Host

Self-hosted Docker stack that powers DesignStudio's real-file output and
in-app document editing. Lives separately from the Vercel deployment.

## What's in it

- **ONLYOFFICE Document Server** (Community Edition, AGPL) — provides the
  web editor for DOCX / XLSX / PPTX / PDF. Mounted into the DesignStudio
  canvas via iframe.
- **`libreoffice-headless`** — tiny Express service that wraps
  `libreoffice --headless --convert-to <format>`. Used by
  `/api/design-studio/generate-file` for HTML→PDF/DOCX/PPTX conversions.
- **Caddy** — reverse proxy that fronts both services on one host with
  automatic Let's Encrypt certs.

## Deploy

1. Spin up a Docker host. Hetzner CX21 (2 vCPU / 4 GB) is plenty.
   Fly.io / Railway / DigitalOcean droplets all work too.
2. Point a subdomain (e.g. `office.poast.app`) at the host.
3. Edit `Caddyfile` — replace `office.poast.app` with your hostname.
4. Generate a long random secret for ONLYOFFICE JWT:
   ```bash
   openssl rand -base64 48
   ```
5. Create `.env` next to `docker-compose.yml`:
   ```env
   ONLYOFFICE_JWT_SECRET=...the random string above...
   ```
6. Bring it up:
   ```bash
   docker compose up -d
   ```
   First pull is ~2 GB.

## Wire it up to POAST

Set these env vars in the Vercel project for `poast-app`:

```
OFFICE_HOST_URL=https://office.poast.app
ONLYOFFICE_JWT_SECRET=...same value as on the Docker host...
```

Redeploy. The DesignStudio canvas Export and Edit buttons will start
working — `isOfficeConfigured()` in `src/lib/office-client.ts` detects
the env and unlocks the flow.

## Health checks

- `https://office.poast.app/health` → returns `ok` from Caddy.
- `https://office.poast.app/onlyoffice/healthcheck` → ONLYOFFICE liveness.
- `POST https://office.poast.app/convert` with body
  `{ "html": "<html>...</html>", "to": "pdf" }` returns a PDF buffer.

## Costs

- Hetzner CX21: ~€5/mo
- Fly.io 2× 2 GB VM: ~$15/mo
- Bandwidth: negligible — payloads are small documents
