import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/customer/sign-out-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();
  if (error) console.error("Could not load customer profile:", error.message);

  return (
    <main className="simple-page">
      <header className="product-page-header">
        <Link className="brand" href="/"><span className="brand-mark">H</span><span className="brand-name">hardware<span>pasal</span></span></Link>
        <SignOutButton />
      </header>
      <section className="account-content">
        <p className="section-kicker">Your account</p>
        <h1>{profile?.full_name || "Welcome"}</h1>
        <p className="account-email">Signed in as {user.email || "your account"}</p>
        <div className="account-card">
          <div className="account-avatar" aria-hidden="true">{(profile?.full_name || user.email || "H").slice(0, 1).toUpperCase()}</div>
          <div><small>Profile</small><strong>{profile?.full_name || "Name not added yet"}</strong><span>{profile?.phone || "Phone number not added"}</span></div>
        </div>
        <div className="account-actions">
          <Link href="/cart"><span aria-hidden="true">▢</span><div><strong>Your cart</strong><small>Review items before checkout</small></div><b>→</b></Link>
          <Link href="/"><span aria-hidden="true">⌕</span><div><strong>Find hardware</strong><small>Search nearby shops</small></div><b>→</b></Link>
        </div>
        <p className="account-note">We only use your account information to manage your marketplace experience and orders.</p>
      </section>
    </main>
  );
}
