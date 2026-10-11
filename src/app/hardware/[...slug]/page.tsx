import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryBrowser } from "@/components/customer/category-browser";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
};

async function getCategoryPath(slugs: string[]): Promise<Category[] | null> {
  if (slugs.length === 0) return null;

  const supabase = await createClient();
  const { data: leaf, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, sort_order, is_active")
    .eq("slug", slugs.at(-1)!)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !leaf) return null;

  const path: Category[] = [leaf as Category];
  let parentId = (leaf as Category).parent_id;
  while (parentId && path.length < 6) {
    const { data: parent, error: parentError } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, sort_order, is_active")
      .eq("id", parentId)
      .eq("is_active", true)
      .maybeSingle();
    if (parentError || !parent) return null;
    path.unshift(parent as Category);
    parentId = (parent as Category).parent_id;
  }

  return path.map((category) => category.slug).join("/") === slugs.join("/") ? path : null;
}

async function getCategory(slugs: string[]) {
  const path = await getCategoryPath(slugs);
  if (!path) return null;

  const supabase = await createClient();
  const category = path.at(-1)!;
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, sort_order, is_active")
    .eq("parent_id", category.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) console.error("Could not load category children:", error.message);
  return { path, category, children: (data ?? []) as Category[] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCategory(slug);
  if (!result) return { title: "Hardware category" };

  const description = `Shop ${result.category.name.toLowerCase()} from independent hardware stores near you.`;
  return {
    title: result.category.name,
    description,
    alternates: { canonical: `/hardware/${slug.join("/")}` },
    openGraph: { title: result.category.name, description, type: "website" },
  };
}

export default async function HardwareCategoryPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const result = await getCategory(slug);
  if (!result) notFound();

  return <CategoryBrowser path={result.path} category={result.category} subcategories={result.children} />;
}
