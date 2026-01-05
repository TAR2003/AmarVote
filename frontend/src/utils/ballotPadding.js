/**
 * Ballot Padding Utility - Industry Standard PKCS#7 Implementation
 * 
 * Ensures constant-size encrypted ballot transmission to prevent traffic analysis attacks.
 * Uses 18980 bytes (13 × 1460) for optimal TCP packet alignment.
 * 
 * Security Features:
 * - PKCS#7 padding standard (industry best practice)
 * - Fixed 17520-byte payload size
 * - TCP-optimized for stable packet counts
 * - Eliminates size-based vote inference attacks
 * 
 * @module ballotPadding
 */

/**
 * Target size for encrypted ballot transmission
 * 18980 bytes = 13 × 1460 (TCP MSS), ensuring stable packet segmentation
 * Increased from 17520 to provide more padding headroom
 */
export const TARGET_SIZE = 18980;

/**
 * Pad encrypted ballot data to fixed size using PKCS#7 standard
 * 
 * PKCS#7 Padding: The last byte contains the padding length.
 * All padding bytes are set to the same value (the padding length).
 * 
 * Example: If 3 bytes of padding are needed: [data..., 0x03, 0x03, 0x03]
 * 
 * @param {Uint8Array|ArrayBuffer|string} data - Encrypted ballot data
 * @param {number} targetSize - Target size in bytes (default: 17520)
 * @returns {Uint8Array} - Padded data of exactly targetSize bytes
 * @throws {Error} - If data exceeds target size
 */
export function padToFixedSize(data, targetSize = TARGET_SIZE) {
  // Convert input to Uint8Array
  let byteArray;
  
  if (data instanceof Uint8Array) {
    byteArray = data;
  } else if (data instanceof ArrayBuffer) {
    byteArray = new Uint8Array(data);
  } else if (typeof data === 'string') {
    // Convert JSON string to bytes
    const encoder = new TextEncoder();
    byteArray = encoder.encode(data);
  } else {
    throw new Error('Invalid data type. Expected Uint8Array, ArrayBuffer, or string');
  }

  // Validate size - PKCS#7 requires at least 1 byte of padding
  // So actual data must be less than targetSize
  if (byteArray.length >= targetSize) {
    throw new Error(
      `Encrypted ballot size (${byteArray.length} bytes) must be less than target size (${targetSize} bytes) to allow padding. ` +
      `Consider increasing TARGET_SIZE or optimizing ballot structure.`
    );
  }

  // Calculate padding length (will always be >= 1)
  const paddingLength = targetSize - byteArray.length;

  // Create fixed-size buffer
  const padded = new Uint8Array(targetSize);

  // Copy original data
  padded.set(byteArray, 0);

  // Apply PKCS#7 padding: fill remaining bytes with padding length value
  // Note: paddingLength can be 0-255, but 0 is not valid PKCS#7
  for (let i = byteArray.length; i < targetSize; i++) {
    padded[i] = paddingLength;
  }

  // Log for debugging (remove in production if needed)
  console.log(`🔒 [BALLOT PADDING] Original: ${byteArray.length}B → Padded: ${targetSize}B (${paddingLength}B padding)`);

  return padded;
}

/**
 * Remove PKCS#7 padding from received data
 * 
 * @param {Uint8Array} paddedData - Padded data
 * @returns {Uint8Array} - Original data without padding
 * @throws {Error} - If padding is invalid
 */
export function removePadding(paddedData) {
  if (!(paddedData instanceof Uint8Array)) {
    throw new Error('Invalid input type. Expected Uint8Array');
  }

  if (paddedData.length === 0) {
    throw new Error('Cannot remove padding from empty data');
  }

  // Read padding length from last byte
  const paddingLength = paddedData[paddedData.length - 1];

  // Validate padding length
  if (paddingLength > paddedData.length) {
    throw new Error(`Invalid padding: padding length (${paddingLength}) exceeds data size (${paddedData.length})`);
  }

  // Verify PKCS#7 padding integrity
  for (let i = paddedData.length - paddingLength; i < paddedData.length; i++) {
    if (paddedData[i] !== paddingLength) {
      throw new Error('Invalid PKCS#7 padding: inconsistent padding bytes detected');
    }
  }

  // Calculate original data size
  const dataSize = paddedData.length - paddingLength;

  // Extract original data
  return paddedData.slice(0, dataSize);
}

/**
 * Prepare ballot JSON for secure transmission
 * 
 * @param {Object} ballotData - Ballot object to transmit
 * @param {number} targetSize - Target size in bytes
 * @returns {Uint8Array} - Padded binary data ready for transmission
 */
export function prepareBallotForTransmission(ballotData, targetSize = TARGET_SIZE) {
  // Serialize to JSON
  const jsonString = JSON.stringify(ballotData);
  
  // Convert to bytes
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(jsonString);
  
  // Apply padding
  return padToFixedSize(jsonBytes, targetSize);
}

/**
 * Parse received ballot from binary format
 * 
 * @param {Uint8Array} paddedData - Received padded data
 * @returns {Object} - Parsed ballot object
 */
export function parseBallotFromTransmission(paddedData) {
  // Remove padding
  const originalData = removePadding(paddedData);
  
  // Convert bytes to string
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(originalData);
  
  // Parse JSON
  return JSON.parse(jsonString);
}
