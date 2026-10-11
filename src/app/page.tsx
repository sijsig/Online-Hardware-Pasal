import { HomeDiscovery } from "@/components/customer/home-discovery";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Category = {
  id: string;
  name: string;
  slug: string;
};

async function getCategories(): Promise<Category[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug")
      .is("parent_id", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(10);

    if (error) {
      console.error("Could not load marketplace categories:", error.message);
      return [];
    }

    return data ?? [];
  } catch (error) {
    console.error("Supabase is not ready for category reads:", error);
    return [];
  }
}

export default async function HomePage() {
  const categories = await getCategories();

  return <HomeDiscovery categories={categories} />;
}
