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
    description: string | null;
    phone: string | null;
    address_line: string;
    city: string;
    district: string;
    province: string;
    location: any;
    delivery_radius_meters: number;
    base_delivery_fee: number;
    estimated_delivery_minutes: number;
    commission_rate: number;
    status: string;
    rating: number;
    total_orders: number;
  }[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
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
  specifications: any;
  is_active: boolean;
  categories?: Category[];
  vendor_products?: VendorProduct[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    
    const { data: product, error } = await supabase
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
        specifications,
        is_active,
        categories (
          id,
          name,
          slug
        ),
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
            description,
            phone,
            address_line,
            city,
            district,
            province,
            location,
            delivery_radius_meters,
            base_delivery_fee,
            estimated_delivery_minutes,
            commission_rate,
            status,
            rating,
            total_orders
          )
        )
      `)
      .eq("id", id)
      .eq("is_active", true)
      .eq("vendor_products.is_active", true)
      .eq("vendor_products.vendors.status", "active")
      .single();
    
    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Product not found" },
          { status: 404 }
        );
      }
      throw error;
    }
    
    const productData = product as Product;
    
    // Transform for mobile app
    const vendors = (productData.vendor_products || [])
      .filter(vp => vp.vendors && vp.vendors.length > 0)
      .map(vp => {
        const vendor = vp.vendors![0];
        return {
          id: vendor.id,
          name: vendor.name,
          slug: vendor.slug,
          description: vendor.description,
          phone: vendor.phone,
          address: vendor.address_line,
          city: vendor.city,
          district: vendor.district,
          province: vendor.province,
          location: vendor.location,
          price: parseFloat(vp.price as string),
          stock: vp.stock_quantity,
          sku: vp.vendor_sku,
          deliveryFee: vendor.base_delivery_fee,
          estimatedDelivery: vendor.estimated_delivery_minutes,
          rating: vendor.rating || 0,
          totalOrders: vendor.total_orders || 0,
        };
      });
    
    // Sort vendors by price
    vendors.sort((a, b) => a.price - b.price);
    
    const categoryArr = productData.categories;
    const category = categoryArr && categoryArr.length > 0 ? categoryArr[0] : null;
    
    const transformedProduct = {
      id: productData.id,
      name: productData.name,
      slug: productData.slug,
      description: productData.description,
      category,
      brand: productData.brand,
      model: productData.model,
      unit: productData.unit,
      specifications: productData.specifications,
      vendors,
      minPrice: vendors.length > 0 ? vendors[0].price : null,
      inStock: vendors.some(v => v.stock > 0),
    };
    
    return NextResponse.json({
      success: true,
      data: transformedProduct,
    });
  } catch (error) {
    console.error("Product detail API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
