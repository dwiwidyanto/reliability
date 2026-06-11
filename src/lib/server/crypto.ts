import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Hashes a password using PBKDF2/scrypt.
 * Returns salt and hash separated by a colon.
 */
export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored salt:hash string.
 */
export function verifyPassword(password: string, stored: string): boolean {
	const parts = stored.split(':');
	if (parts.length !== 2) return false;
	const [salt, hash] = parts;
	const testHash = scryptSync(password, salt, 64).toString('hex');
	return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
}
