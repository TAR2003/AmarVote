import { saveAs } from 'file-saver';
import { electionApi } from './electionApi';

/**
 * Convert binary-transport artifacts (base64 msgpack) to human-readable JSON via the EG API.
 */
export async function decodeArtifactForDownload(payload) {
  const result = await electionApi.decodeArtifactToJson(payload);
  if (!result?.success) {
    throw new Error(result?.error || 'Failed to decode artifact');
  }
  return result.decoded;
}

/**
 * Decode artifact payload and trigger a JSON file download.
 */
export async function downloadJsonArtifact(filename, payload) {
  const decoded = await decodeArtifactForDownload(payload);
  const blob = new Blob([JSON.stringify(decoded, null, 2)], { type: 'application/json' });
  saveAs(blob, filename);
}
