# Connector systemd units

This directory contains a templated systemd unit for the standalone source connectors.

## Files
- `tracking-connector@.service`
- `adsbx.env.example`
- `fr24.env.example`
- `radarbox.env.example`

## Install

```bash
sudo mkdir -p /opt/tracking-2026 /etc/tracking/connectors /var/log/tracking-connectors
sudo rsync -a . /opt/tracking-2026/
cd /opt/tracking-2026
connectors/bootstrap_venv.sh
sudo cp infra/systemd/tracking-connector@.service /etc/systemd/system/
sudo cp infra/systemd/adsbx.env.example /etc/tracking/connectors/adsbx.env
sudo cp infra/systemd/fr24.env.example /etc/tracking/connectors/fr24.env
sudo cp infra/systemd/radarbox.env.example /etc/tracking/connectors/radarbox.env
sudo systemctl daemon-reload
```

## Enable and start

```bash
sudo systemctl enable --now tracking-connector@adsbx
sudo systemctl enable --now tracking-connector@fr24
sudo systemctl enable --now tracking-connector@radarbox
```

## Logs

```bash
journalctl -u tracking-connector@adsbx -f
journalctl -u tracking-connector@fr24 -f
journalctl -u tracking-connector@radarbox -f
```
