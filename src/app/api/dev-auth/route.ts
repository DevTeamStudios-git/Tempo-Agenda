import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tempo_dev_session";
const SESSION_MAX_AGE = 60 * 60 * 8;

function sameSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(timestamp: string) {
  const secret = process.env.TEMPO_DEV_SESSION_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(timestamp).digest("hex");
}

function isValidSession(value: string | undefined) {
  if (!value) return false;
  const [timestamp, signature] = value.split(".");
  if (!timestamp || !signature) return false;

  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > SESSION_MAX_AGE * 1000 || Date.now() - issuedAt < 0) return false;

  const expected = sign(timestamp);
  if (!expected) return false;
  return sameSecret(signature, expected);
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    authenticated: isValidSession(request.cookies.get(COOKIE_NAME)?.value),
  });
}

export async function POST(request: NextRequest) {
  const expectedUsername = process.env.TEMPO_DEV_USERNAME;
  const expectedPassword = process.env.TEMPO_DEV_PASSWORD;
  const secret = process.env.TEMPO_DEV_SESSION_SECRET;

  if (!expectedUsername || !expectedPassword || !secret) {
    return NextResponse.json(
      { error: "Developer mode is not configured on this deployment." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!sameSecret(username, expectedUsername) || !sameSecret(password, expectedPassword)) {
    return NextResponse.json({ error: "Invalid developer credentials." }, { status: 401 });
  }

  const timestamp = String(Date.now());
  const signature = sign(timestamp);
  if (!signature) {
    return NextResponse.json({ error: "Developer mode is not configured." }, { status: 503 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: `${timestamp}.${signature}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
  return response;
}
