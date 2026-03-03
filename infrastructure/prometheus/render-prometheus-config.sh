#!/bin/sh
set -eu

input_path="${1:-/etc/prometheus/prometheus.yml}"
output_path="${2:-/tmp/prometheus.yml}"

gateway_target="${SERVICE_GATEWAY_METRICS_TARGET:-host.docker.internal:8080}"
auth_target="${SERVICE_AUTH_METRICS_TARGET:-host.docker.internal:8081}"
ingestion_target="${SERVICE_INGESTION_METRICS_TARGET:-host.docker.internal:8082}"
broadcaster_target="${SERVICE_BROADCASTER_METRICS_TARGET:-host.docker.internal:8083}"
storage_target="${SERVICE_STORAGE_METRICS_TARGET:-host.docker.internal:8084}"
processing_target="${SERVICE_PROCESSING_METRICS_TARGET:-host.docker.internal:8085}"
query_target="${SERVICE_QUERY_METRICS_TARGET:-host.docker.internal:8086}"

sed \
-e "s|host.docker.internal:8080|${gateway_target}|g" \
-e "s|host.docker.internal:8081|${auth_target}|g" \
-e "s|host.docker.internal:8082|${ingestion_target}|g" \
-e "s|host.docker.internal:8083|${broadcaster_target}|g" \
-e "s|host.docker.internal:8084|${storage_target}|g" \
-e "s|host.docker.internal:8085|${processing_target}|g" \
-e "s|host.docker.internal:8086|${query_target}|g" \
"${input_path}" > "${output_path}"