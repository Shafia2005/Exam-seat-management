import { randomInt } from 'crypto'
import { compare, hash } from 'bcryptjs'

const BCRYPT_ROUNDS = 12

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_ROUNDS)
}

export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return compare(plain, passwordHash)
}

let dummyHash: Promise<string> | null = null

/**
 * Spends the same time as a real password check. Used when no account matches,
 * so response timing doesn't reveal which identifiers exist.
 */
export async function burnPasswordCheck(plain: string): Promise<false> {
  dummyHash ??= hash('timing-equalizer-not-a-real-password', BCRYPT_ROUNDS)
  await compare(plain, await dummyHash)
  return false
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** Random password without look-alike characters (0/O, 1/l/I), for accounts created by an admin. */
export function generateTemporaryPassword(length = 12): string {
  let out = ''
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]
  return out
}
