#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

OUTPUT_DIR="${1:-}"
shift || true

if [[ -z "$OUTPUT_DIR" || "$#" -eq 0 ]]; then
  echo "usage: $0 <output-dir> <run-dir> [<run-dir> ...]" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
manifest_file="${OUTPUT_DIR}/manifest.tsv"
printf 'phase\tsourceId\tbatchSize\trequestRate\tduration\tpreAllocatedVus\tmaxVus\ttargetMsgPerSec\tsummaryFile\tlogFile\n' > "$manifest_file"

for run_dir in "$@"; do
  if [[ ! -f "${run_dir}/manifest.tsv" ]]; then
    echo "missing manifest in ${run_dir}" >&2
    exit 1
  fi

  while IFS=$'\t' read -r phase source_id batch_size request_rate duration pre_vus max_vus target_msg_per_sec summary_file log_file; do
    [[ "$phase" == "phase" ]] && continue

    summary_name="$(basename "$summary_file")"
    log_name="$(basename "$log_file")"
    cp "${run_dir}/${summary_name}" "${OUTPUT_DIR}/${summary_name}"
    cp "${run_dir}/${log_name}" "${OUTPUT_DIR}/${log_name}"

    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$phase" "$source_id" "$batch_size" "$request_rate" "$duration" "$pre_vus" "$max_vus" "$target_msg_per_sec" \
      "${OUTPUT_DIR}/${summary_name}" "${OUTPUT_DIR}/${log_name}" >> "$manifest_file"
  done < "${run_dir}/manifest.tsv"

  find "$run_dir" -maxdepth 1 -name '*-prometheus.ndjson' -exec cp {} "$OUTPUT_DIR" \;
done

echo "bundle assembled at ${OUTPUT_DIR}"
