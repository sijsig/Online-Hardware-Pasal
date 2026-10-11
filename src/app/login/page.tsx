import type { Metadata } from "next";
import { SignInForm } from "@/components/customer/sign-in-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

function safeNextPath(path: string | undefined) {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")
    ? path
    : "/account";
}

export default async function LoginPage({
  searchParams,
}: {
    searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const initialError = error === "auth_callback"
    ? "This sign-in link could not be verified. Request a fresh link, then open the newest email on this device within 5 minutes."
    : "";
  const nextPath = safeNextPath(next);
  return <SignInForm key={`${error ?? "login"}:${nextPath}`} nextPath={nextPath} initialError={initialError} />;
}
