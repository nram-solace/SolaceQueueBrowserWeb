/**
 * Encryption utilities for session files using Web Crypto API
 * Uses AES-GCM for authenticated encryption
 */

/**
 * Derive a cryptographic key from a password using PBKDF2
 * @param {string} password - The password to derive key from
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>} The derived key
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt session data with a password
 * @param {string} plaintext - The data to encrypt (JSON string)
 * @param {string} password - The encryption password
 * @returns {Promise<string>} Encrypted data as base64-encoded string with metadata
 */
export async function encryptSessionData(plaintext, password) {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits for GCM

  // Derive key from password
  const key = await deriveKey(password, salt);

  // Encrypt the data
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  // Combine salt, IV, and encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt session data with a password
 * @param {string} encryptedData - Base64-encoded encrypted data with metadata
 * @param {string} password - The decryption password
 * @returns {Promise<string>} Decrypted plaintext (JSON string)
 */
export async function decryptSessionData(encryptedData, password) {
  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);

    // Derive key from password
    const key = await deriveKey(password, salt);

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encrypted
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    throw new Error('Decryption failed. Incorrect password or corrupted file.');
  }
}

/**
 * Check if a string is encrypted (has encryption metadata structure)
 * @param {string} data - Data to check
 * @returns {boolean} True if data appears to be encrypted
 */
export function isEncrypted(data) {
  try {
    // Try to parse as JSON first (unencrypted)
    JSON.parse(data);
    return false;
  } catch {
    // If not valid JSON, check if it's base64 and has minimum length for encrypted data
    // Encrypted data should have salt (16) + IV (12) + some encrypted content
    try {
      const decoded = atob(data);
      return decoded.length >= 32; // At least salt + IV + some data
    } catch {
      return false;
    }
  }
}
