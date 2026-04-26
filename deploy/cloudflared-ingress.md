# Cloudflare tunnel ingress rule for genome.tyflix.net

The tunnel runs on `infra` (192.168.1.94) as the systemd `cloudflared.service`
unit (token inlined in the unit file — there is no `cert.pem` to chase per
`reference_tyflix_hosts.md`).

To add the route, on `infra`:

```bash
# 1. Edit the tunnel config
sudo nano /etc/cloudflared/config.yml
```

Add this rule **above** the catch-all:

```yaml
ingress:
  # ... existing rules ...

  - hostname: genome.tyflix.net
    service: http://192.168.1.92:3032
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s

  # the trailing 404 catch-all stays last
  - service: http_status:404
```

```bash
# 2. Validate, restart
sudo cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate
sudo systemctl restart cloudflared

# 3. Add the DNS record (CNAME genome → 4d648384-08a0-45fd-9eaf-48826d7ecf16.cfargotunnel.com)
# Either via the Cloudflare dashboard or via API. The deploy script does it via API
# using CF_API_TOKEN + CF_ZONE_ID from ~/homelab/.env.
```

The deploy script (`deploy/bootstrap.sh`) handles all of this idempotently.
