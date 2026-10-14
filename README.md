# straitsystems.com

Static site for Strait Systems: `index.html`, `legal.html`, self-hosted fonts in `fonts/`. No build step.

## Service map
The hero map reads `/status/status.json`. On the server, `ops/strait-status.sh` (systemd unit `ops/strait-status.service`)
requests each product's site in turn, one every 5 s, and writes `/srv/strait-status/status.json`.
That directory is mounted read-only into the container at `/usr/share/nginx/html/status`.
Data older than 90 s shows as "Status unavailable".

Add a product: one entry in `PRODUCTS` in `index.html`, one line in `PRODUCTS` in `ops/strait-status.sh`.

## Deploy
Push to `main`, then on the server run `/root/strait-redeploy.sh` (keeps the previous container stopped as a rollback).
`ops/` and this README are not copied into the image.
