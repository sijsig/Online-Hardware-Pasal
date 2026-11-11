import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RiderDashboard, RiderApplicationForm, type RiderDelivery } from "@/components/rider/rider-dashboard";
import { SignOutButton } from "@/components/customer/sign-out-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rider workspace", robots: { index: false, follow: false } };

type RiderAccount = { status: "offline" | "available" | "busy" | "suspended"; application_status: "pending" | "approved" | "rejected"; vehicle_type: string | null };

export default async function RiderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Frider");
  const { data: rider, error } = await supabase.from("riders").select("status, application_status, vehicle_type").eq("user_id", user.id).maybeSingle();
  const account = rider as RiderAccount | null;
  let deliveries: RiderDelivery[] = [];
  let deliveryError = false;
  if (account?.application_status === "approved") {
    const result = await supabase.rpc("rider_get_my_deliveries");
    if (result.error) deliveryError = true;
    deliveries = (result.data ?? []) as RiderDelivery[];
  }

  return (
    <main className="rider-page">
      <header className="vendor-header"><Link className="brand" href="/"><span className="brand-mark">H</span><span className="brand-name">hardware<span>pasal</span></span></Link><div className="vendor-header-actions"><Link href="/account">Customer account</Link><SignOutButton /></div></header>
      <section className="rider-content">
        {error ? <p className="vendor-page-error" role="alert">Your rider account could not be loaded. Refresh to try again.</p> : null}
        {!error && !account ? <RiderApplicationForm /> : null}
        {account?.application_status === "pending" ? <section className="rider-state-card"><span aria-hidden="true">◷</span><p className="section-kicker">Rider application</p><h1>Application under review</h1><p>Your {account.vehicle_type || "vehicle"} rider application is with the marketplace team. You can start receiving delivery offers once it is approved.</p></section> : null}
        {account?.application_status === "rejected" ? <section className="rider-state-card"><span aria-hidden="true">↻</span><p className="section-kicker">Rider application</p><h1>Update your application</h1><p>Your application was not approved. You can submit it again with updated vehicle details.</p><RiderApplicationForm /></section> : null}
        {account?.application_status === "approved" ? <RiderDashboard riderId={user.id} status={account.status} deliveries={deliveries} deliveryError={deliveryError} /> : null}
      </section>
    </main>
  );
}
