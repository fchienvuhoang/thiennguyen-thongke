import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "thienphap_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");

export type Session = {
  userId: string;
  organizationId: string;
  name: string;
  systemRole: "SUPER_ADMIN" | "USER";
  organizationRole: "ADMIN" | "MEMBER";
};

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}
