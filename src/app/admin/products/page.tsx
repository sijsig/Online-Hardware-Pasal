"use client";

import { useEffect, useState } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  bulkApproveProducts, 
  bulkRejectProducts, 
  bulkToggleProductStatus 
} from "@/actions/admin/bulk-products";
import { useBulkActions } from "@/hooks/useBulkActions";
import { 
  BulkActionToolbar, 
  TableHeaderCheckbox, 
  CheckboxColumn 
} from "@/components/admin/bulk-action-toolbar";
import { ExportButton } from "@/components/admin/export-button";

export const metadata: Metadata = { title: "Products - Admin", robots: { index: false, follow: false } };

type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
};

type Product = {
  id: string;
  category_id: string | null;
  vendor_id: string | null;
  name: string;
  slug: string;
  brand: string | null;
  model: string | null;
  unit: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
};

function ProductsTable({ 
  products, 
  vendorNames, 
  categoryNames,
  onToggleStatus,
}: {
  products: Product[];
  vendorNames: Map<string, string>;
  categoryNames: Map<string, string>;
  onToggleStatus: (id: string, isActive: boolean) => void;
}) {
  const {
    selectedIds,
    selectedCount,
    selectAll,
    isIndeterminate,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    executeBulkAction,
    loading,
    configs,
  } = useBulkActions(products, [
    {
      label: "Activate",
      icon: "✅",
      action: async (ids: string[]) => {
        const result = await bulkToggleProductStatus(ids, true);
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} product(s) activated",
      errorMessage: "Failed to activate products",
      confirmMessage: "Activate {count} product(s)?",
      variant: "default",
      available: (items) => items.some(p => !p.is_active),
    },
    {
      label: "Deactivate",
      icon: "⛔",
      action: async (ids: string[]) => {
        const result = await bulkToggleProductStatus(ids, false);
        return { success: result.successCount > 0, error: result.errors.join(", ") || undefined };
      },
      successMessage: "{count} product(s) deactivated",
      errorMessage: "Failed to deactivate products",
      confirmMessage: "Deactivate {count} product(s)? They will be hidden from customers.",
      variant: "destructive",
      available: (items) => items.some(p => p.is_active),
    },
  ]);

  const availableActions = configs
    .map((config, index) => ({ config, index }))
    .filter(({ config }) => config.available?.(products.filter(p => selectedIds.has(p.id))) ?? true)
    .map(({ config, index }) => ({
      label: config.label,
      onClick: () => executeBulkAction(index),
      variant: config.variant,
      icon: config.icon,
      disabled: loading,
      confirmMessage: config.confirmMessage,
    }));

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {products.length === 0 ? (
          <div className="py-12 text-center">
            <span className="text-4xl" aria-hidden="true">🔧</span>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No products found</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center w-12">
                    <TableHeaderCheckbox
                      checked={selectAll}
                      indeterminate={isIndeterminate}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const isSelected = selectedIds.has(product.id);

                  return (
                    <tr 
                      key={product.id} 
                      className={`hover:bg-gray-50 ${isSelected ? "bg-orange-50" : ""}`}
                    >
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(product.id)}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          aria-label={isSelected ? "Deselect" : "Select"}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">
                          {product.brand || "No brand"} · {product.model || "No model"} · {product.unit}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {product.category_id ? categoryNames.get(product.category_id) || "Unknown" : "Uncategorized"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {product.vendor_id ? vendorNames.get(product.vendor_id) || "Catalog" : "Catalog"}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        Rs. {Number(product.price).toLocaleString("en-NP")}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`${product.stock_quantity < 10 ? "text-red-600 font-medium" : "text-gray-900"}`}>
                          {product.stock_quantity}
                        </span>
                        {product.stock_quantity < 10 && <span className="ml-2 text-xs text-red-600">⚠ Low</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onToggleStatus(product.id, !product.is_active)}
                            className={`text-sm font-medium ${product.is_active ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}`}
                          >
                            {product.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <Link href={`/admin/products/${product.id}`} className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BulkActionToolbar
        selectedCount={selectedCount}
        totalCount={products.length}
        selectAll={selectAll}
        isIndeterminate={isIndeterminate}
        onToggleSelectAll={toggleSelectAll}
        onClearSelection={clearSelection}
        onToggleSelect={toggleSelect}
        actions={availableActions}
      />
    </>
  );
}

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const category = searchParams.get("category") || "";
  const shop = searchParams.get("shop") || "";
  const status = searchParams.get("status") || "";
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendorNames, setVendorNames] = useState<Map<string, string>>(new Map());
  const [categoryNames, setCategoryNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Fetch categories
      const { data: categoriesData, error: catError } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order")
        .limit(200);
      if (!catError) {
        setCategories(categoriesData ?? []);
        setCategoryNames(new Map((categoriesData ?? []).map(c => [c.id, c.name])));
      }
      
      // Fetch products
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (category) {
        query = query.eq("category_id", category);
      }
      if (shop) {
        query = query.eq("vendor_id", shop);
      }
      if (status === "active") {
        query = query.eq("is_active", true);
      } else if (status === "inactive") {
        query = query.eq("is_active", false);
      }

      const { data: productsData, error: prodError } = await query.limit(100);
      if (!prodError) {
        const productsArray = (productsData as Product[]) ?? [];
        setProducts(productsArray);
        
        const vendorIds = productsArray
          .map(p => p.vendor_id)
          .filter((id): id is string => id !== null && id !== undefined);
        if (vendorIds.length > 0) {
          const { data: vendors, error: vendorError } = await supabase
            .from("vendors")
            .select("id, name")
            .in("id", vendorIds);
          if (!vendorError && vendors) {
            setVendorNames(new Map(vendors.map(v => [v.id, v.name])));
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [category, shop, status]);

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("category", e.target.value);
    } else {
      params.delete("category");
    }
    router.push(`/admin/products?${params.toString()}`);
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("status", e.target.value);
    } else {
      params.delete("status");
    }
    router.push(`/admin/products?${params.toString()}`);
  }

  async function handleToggleStatus(id: string, isActive: boolean) {
    try {
      await bulkToggleProductStatus([id], isActive);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: isActive } : p));
    } catch (error) {
      console.error("Failed to toggle product status:", error);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 mt-1">Manage product catalog and shop inventories</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto" />
            <p className="mt-2 text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">Manage product catalog and shop inventories</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            <span aria-hidden="true">➕</span>
            Add Product
          </Link>
          <ExportButton
            data={products}
            apiUrl="/api/admin/export/products"
            filename="products"
            label="Export"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
            variant="outline"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <select
          value={category}
          onChange={handleCategoryChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={handleStatusChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <ProductsTable 
        products={products} 
        vendorNames={vendorNames} 
        categoryNames={categoryNames}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  );
}
