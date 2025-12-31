/**
 * Encryption/Decryption utilities for sensitive connector data
 * Uses AES-256-GCM for secure encryption of OAuth tokens and API keys
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment
 * Falls back to a default key for development (NOT secure for production)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;

  if (!key) {
    console.warn(
      '[Encryption] No ENCRYPTION_KEY or JWT_SECRET found. Using insecure default key. Set ENCRYPTION_KEY in production!'
    );
    // Generate a consistent 32-byte key for development
    return crypto.pbkdf2Sync(
      'default-insecure-key-for-development',
      'omniflow-connector-salt',
      100000,
      KEY_LENGTH,
      'sha256'
    );
  }

  // Derive a 32-byte key from the provided key using PBKDF2
  const salt = Buffer.from('omniflow-connector-salt'); // Static salt for consistency
  return crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a string value
 * @param plaintext The string to encrypt
 * @returns Encrypted string in format: iv:authTag:encrypted
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('[Encryption] Failed to encrypt:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt an encrypted string
 * @param encryptedText Encrypted string in format: iv:authTag:encrypted
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[Encryption] Failed to decrypt:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * Encrypt an object's sensitive fields
 * @param obj Object with sensitive fields
 * @param fieldsToEncrypt Array of field names to encrypt
 * @returns New object with encrypted fields
 */
export function encryptObject<T extends Record<string, any>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted = { ...obj };

  for (const field of fieldsToEncrypt) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encrypt(encrypted[field] as string) as any;
    }
  }

  return encrypted;
}

/**
 * Decrypt an object's encrypted fields
 * @param obj Object with encrypted fields
 * @param fieldsToDecrypt Array of field names to decrypt
 * @returns New object with decrypted fields
 */
export function decryptObject<T extends Record<string, any>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted = { ...obj };

  for (const field of fieldsToDecrypt) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      try {
        decrypted[field] = decrypt(decrypted[field] as string) as any;
      } catch (error) {
        console.error(
          `[Encryption] Failed to decrypt field ${String(field)}:`,
          error
        );
        // Keep encrypted value if decryption fails
      }
    }
  }

  return decrypted;
}

/**
 * Encrypt environment variables object
 * @param envVars Object with environment variables
 * @returns Object with encrypted values
 */
export function encryptEnvVars(
  envVars: Record<string, string>
): Record<string, string> {
  const encrypted: Record<string, string> = {};

  for (const [key, value] of Object.entries(envVars)) {
    encrypted[key] = encrypt(value);
  }

  return encrypted;
}

/**
 * Decrypt environment variables object
 * @param encryptedEnvVars Object with encrypted environment variables
 * @returns Object with decrypted values
 */
export function decryptEnvVars(
  encryptedEnvVars: Record<string, string>
): Record<string, string> {
  const decrypted: Record<string, string> = {};

  for (const [key, value] of Object.entries(encryptedEnvVars)) {
    try {
      decrypted[key] = decrypt(value);
    } catch (error) {
      console.error(`[Encryption] Failed to decrypt env var ${key}:`, error);
      decrypted[key] = value; // Keep encrypted value if decryption fails
    }
  }

  return decrypted;
}
