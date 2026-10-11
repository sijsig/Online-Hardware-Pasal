import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/customer/checkout-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

type Address = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  district: string | null;
  province: string | null;
  is_default: boolean;
};

export default async function CheckoutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fcheckout");

  const { data, error } = await supabase
    .from("addresses")
    .select("id, label, recipient_name, phone, address_line, city, district, province, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) console.error("Could not load saved addresses:", error.message);
  return <CheckoutForm initialAddresses={(data ?? []) as Address[]} />;
}
