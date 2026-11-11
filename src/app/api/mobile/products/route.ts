import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface VendorProduct {
  id: string;
  vendor_id: string;
  vendor_sku: string;
  price: string | number;
  stock_quantity: number;
  is_active: boolean;
  vendors?: {
    id: string;
    name: string;
    slug: string;
    address_line: string;
    city: string;
    location: any;
    delivery_radius_meters: number;
    base_delivery_fee: number;
    estimated_delivery_minutes: number;
    status: string;
  }[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string;
  brand: string | null;
  model: string | null;
  unit: string;
  is_active: boolean;
  vendor_products?: VendorProduct[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const radius = searchParams.get("radius") || "10000";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sort = searchParams.get("sort") || "relevance";
    
    let query = supabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        description,
        category_id,
        brand,
        model,
        unit,
        is_active,
        vendor_products!inner (
          id,
          vendor_id,
          vendor_sku,
          price,
          stock_quantity,
          is_active,
          vendors!inner (
            id,
            name,
            slug,
            address_line,
            city,
            location,
            delivery_radius_meters,
            base_delivery_fee,
            estimated_delivery_minutes,
            status
          )
        )
      `)
      .eq("is_active", true)
      .eq("vendor_products.is_active", true)
      .eq("vendor_products.vendors.status", "active");
    
    if (category) {
      query = query.eq("category_id", category);
    }
    
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }
    
    const { data: products, error } = await query
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    const transformedProducts = (products as Product[] || []).map(product => {
      const vendorProducts = product.vendor_products || [];
      const vendors = vendorProducts
        .filter(vp => vp.vendors && vp.vendors.length > 0)
        .map(vp => {
          const vendor = vp.vendors![0];
          return {
            id: vendor.id,
            name: vendor.name,
            slug: vendor.slug,
            address: vendor.address_line,
            city: vendor.city,
            price: parseFloat(vp.price as string),
            stock: vp.stock_quantity,
            deliveryFee: vendor.base_delivery_fee,
            estimatedDelivery: vendor.estimated_delivery_minutes,
          };
        });
      
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        brand: product.brand,
        model: product.model,
        unit: product.unit,
        vendors,
        minPrice: vendors.length > 0
          ? Math.min(...vendors.map(v => v.price))
          : null,
        inStock: vendors.some(v => v.stock > 0),
      };
    });
    
    if (sort === "price_asc") {
      transformedProducts.sort((a, b) => (a.minPrice || 0) - (b.minPrice || 0));
    } else if (sort === "price_desc") {
      transformedProducts.sort((a, b) => (b.minPrice || 0) - (a.minPrice || 0));
    }
    
    return NextResponse.json({
      success: true,
      data: transformedProducts,
      pagination: {
        limit,
        offset,
        hasMore: transformedProducts.length === limit,
      },
    });
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
