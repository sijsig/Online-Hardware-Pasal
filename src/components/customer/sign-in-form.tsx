"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function SignInForm({ nextPath, initialError = "" }: { nextPath: string; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setErrorMessage("");
    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", nextPath);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo.toString(), shouldCreateUser: true },
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      console.error("Could not send sign-in link:", error);
      setErrorMessage("We could not send the sign-in link. Check the email address and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand" href="/"><span className="brand-mark">H</span><span className="brand-name">hardware<span>pasal</span></span></Link>
        {sent ? (
          <div className="auth-confirmation" role="status">
            <span className="empty-symbol" aria-hidden="true">✓</span>
            <h1>Check your email</h1>
            <p>We sent a secure sign-in link to <strong>{email.trim()}</strong>. Open it on this device to continue.</p>
            <button type="button" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <>
            <p className="section-kicker">Welcome to Hardware Online Pasal</p>
            <h1>Sign in or create an account</h1>
            <p className="auth-intro">Enter your email and we’ll send you a secure link. No password to remember.</p>
            <form className="auth-form" onSubmit={submit}>
              <label htmlFor="sign-in-email">Email address</label>
              <input id="sign-in-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
              <button type="submit" disabled={sending}>{sending ? "Sending link…" : "Email me a sign-in link"}</button>
            </form>
            <p className="auth-footnote">By continuing, you agree to use your account for your own orders and addresses.</p>
          </>
        )}
      </section>
      <Link className="auth-back" href="/">← Back to marketplace</Link>
    </main>
  );
}
