import bcrypt from "bcryptjs";

const COST = 12;

// A real bcrypt hash (generated once, lazily) that is compared against when the user does not
// exist, so response time does not reveal which emails are registered.
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= bcrypt.hash("not-a-real-password", COST);
  return dummyHash;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? (await getDummyHash())).catch(() => false);
  return Boolean(hash) && ok;
}

export function passwordProblems(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 200) return "Password is too long.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Use upper- and lower-case letters and at least one number.";
  }
  return null;
}
