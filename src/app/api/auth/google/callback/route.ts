import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  googleOAuthClient,
} from "@/lib/google-auth";
import { prisma } from "@/lib/prisma";

function loginError(request: NextRequest, error: string) {
  const response = NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(error)}`, request.url),
  );
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  response.cookies.delete(GOOGLE_OAUTH_VERIFIER_COOKIE);
  return response;
}

function validState(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state") || "";
  const expectedState =
    request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value || "";
  const codeVerifier =
    request.cookies.get(GOOGLE_OAUTH_VERIFIER_COOKIE)?.value || "";
  if (
    !code ||
    !state ||
    !expectedState ||
    !codeVerifier ||
    !validState(state, expectedState)
  ) {
    return loginError(request, "google_invalid_state");
  }

  try {
    const client = googleOAuthClient(request.nextUrl.origin);
    const { tokens } = await client.getToken({ code, codeVerifier });
    if (!tokens.id_token) return loginError(request, "google_failed");
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();
    const email = profile?.email?.trim().toLowerCase();
    if (!profile?.sub || !email || !profile.email_verified) {
      return loginError(request, "google_unverified");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { organization: { enabled: true } },
          include: { organization: true },
          take: 1,
        },
      },
    });
    const membership = user?.memberships[0];
    if (!user?.enabled || !membership) {
      return loginError(request, "google_not_invited");
    }
    if (user.googleSubject && user.googleSubject !== profile.sub) {
      return loginError(request, "google_account_mismatch");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleSubject: profile.sub,
        ...(profile.name ? { name: profile.name } : {}),
      },
    });
    await createSession({
      userId: user.id,
      organizationId: membership.organizationId,
      name: profile.name || user.name,
      email: user.email,
      systemRole: user.systemRole,
      organizationRole: membership.role,
    });
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    response.cookies.delete(GOOGLE_OAUTH_VERIFIER_COOKIE);
    return response;
  } catch {
    return loginError(request, "google_failed");
  }
}
