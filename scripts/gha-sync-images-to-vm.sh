#!/usr/bin/env bash
# Pull images on the GitHub Actions runner (reliable path to GHCR), then stream
# them to the VM over SSH. Avoids flaky VM -> ghcr.io registry pulls.
set -euo pipefail

REGISTRY="${REGISTRY:?REGISTRY is required}"
IMAGE_OWNER="${IMAGE_OWNER:?IMAGE_OWNER is required}"
IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG is required}"
VM_HOST="${VM_HOST:?VM_HOST is required}"
VM_USERNAME="${VM_USERNAME:?VM_USERNAME is required}"
VM_SECRET="${VM_SECRET:?VM_SECRET is required}"

SSH_OPTS=(
  -o StrictHostKeyChecking=no
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=120
)

APP_IMAGES=(backend frontend electionguard-api electionguard-worker)

for name in "${APP_IMAGES[@]}"; do
  ref="${REGISTRY}/${IMAGE_OWNER}/amarvote-${name}:${IMAGE_TAG}"
  echo "Pulling ${ref} on runner..."
  docker pull "${ref}"

  attempt=1
  max_attempts=3
  until docker save "${ref}" | gzip -1 | sshpass -p "${VM_SECRET}" ssh "${SSH_OPTS[@]}" \
    "${VM_USERNAME}@${VM_HOST}" 'gunzip | docker load'; do
    if [ "${attempt}" -ge "${max_attempts}" ]; then
      echo "Error: failed to stream ${ref} to VM after ${max_attempts} attempts"
      exit 1
    fi
    attempt=$((attempt + 1))
    echo "Retrying stream for ${ref} (attempt ${attempt}/${max_attempts})..."
    sleep 10
  done

  echo "Loaded ${ref} on VM"
done
