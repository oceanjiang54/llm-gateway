import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
const COOKIE = "gw_session";

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
}

export async function getSessionUserId(): Promise<string | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().delete(COOKIE);
}
