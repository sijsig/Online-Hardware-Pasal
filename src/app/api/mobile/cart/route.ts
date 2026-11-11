import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Vendor {
  id: string;
  name: string;
  slug: string;
  base_delivery_fee: number;
  estimated_delivery_minutes: number;
}

interface VendorProduct {
  id: string;
  vendor_id: string;
  vendor_sku: string;
  price: string | number;
  stock_quantity: number;
  vendors?: Vendor[];
}

interface CartItem {
  id: string;
  product_id: string;
  vendor_product_id: string;
  quantity: number;
  unit_price: number;
  products?: {
    id: string;
    name: string;
    slug: string;
    brand: string | null;
    model: string | null;
    unit: string;
    images: string[];
  };
  vendor_products?: VendorProduct[];
}

interface Cart {
  id: string;
  user_id: string;
  cart_items: CartItem[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { data: cart, error } = await supabase
      .from("carts")
      .select(`
        id,
        user_id,
        cart_items!inner (
          id,
          product_id,
          vendor_product_id,
          quantity,
          unit_price,
          products (
            id, name, slug, brand, model, unit, images
          ),
          vendor_products (
            id, vendor_id, vendor_sku, price, stock_quantity,
            vendors (id, name, slug, base_delivery_fee, estimated_delivery_minutes)
          )
        )
      `)
      .eq("user_id", user.id)
      .single();
    
    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ success: true, data: { items: [], total: 0 } });
      }
      throw error;
    }
    
    if (!cart) {
      return NextResponse.json({ success: true, data: { items: [], total: 0 } });
    }
    
    const items = cart.cart_items || [];
    const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    
    const vendorMap = new Map();
    items.forEach(item => {
      const vpArr = item.vendor_products;
      const vp = vpArr && vpArr.length > 0 ? vpArr[0] : null;
      const vendorArr = vp?.vendors;
      if (vp && vendorArr && vendorArr.length > 0) {
        const vendor = vendorArr[0];
        const vendorId = vp.vendor_id;
        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            vendor,
            items: [],
            subtotal: 0,
          });
        }
        const v = vendorMap.get(vendorId);
        v.items.push(item);
        v.subtotal += item.unit_price * item.quantity;
      }
    });
    
    let totalDeliveryFee = 0;
    vendorMap.forEach(v => {
      totalDeliveryFee += v.vendor.base_delivery_fee;
    });
    
    const tax = subtotal * 0.13;
    const total = subtotal + totalDeliveryFee + tax;
    
    return NextResponse.json({
      success: true,
      data: {
        id: cart.id,
        items: items.map(item => {
          const vpArr = item.vendor_products;
          const vp = vpArr && vpArr.length > 0 ? vpArr[0] : null;
          const vendorArr = vp?.vendors;
          return {
            id: item.id,
            productId: item.product_id,
            vendorProductId: item.vendor_product_id,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.unit_price * item.quantity,
            product: item.products,
            vendor: vendorArr && vendorArr.length > 0 ? vendorArr[0] : null,
          };
        }),
        subtotal,
        deliveryFee: totalDeliveryFee,
        tax,
        total,
        itemCount: items.length,
      },
    });
  } catch (error) {
    console.error("Cart GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch cart" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { product_id, vendor_product_id, quantity = 1 } = body;
    
    if (!product_id || !vendor_product_id) {
      return NextResponse.json(
        { success: false, error: "Product ID and Vendor Product ID required" },
        { status: 400 }
      );
    }
    
    const { data: vp, error: vpError } = await supabase
      .from("vendor_products")
      .select(`
        id, vendor_id, price, stock_quantity,
        vendors!inner (id, name, base_delivery_fee)
      `)
      .eq("id", vendor_product_id)
      .eq("is_active", true)
      .eq("vendors.status", "active")
      .single();
    
    if (vpError || !vp) {
      return NextResponse.json(
        { success: false, error: "Product not available" },
        { status: 404 }
      );
    }
    
    // vp.vendors is an array, get first element
    const vendorArr = (vp as any).vendors;
    const vendor = vendorArr && vendorArr.length > 0 ? vendorArr[0] : null;
    if (!vendor) {
      return NextResponse.json(
        { success: false, error: "Vendor not found" },
        { status: 404 }
      );
    }
    
    if (vp.stock_quantity < quantity) {
      return NextResponse.json(
        { success: false, error: "Insufficient stock" },
        { status: 400 }
      );
    }
    
    let { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (cartError && cartError.code === "PGRST116") {
      const { data: newCart, error: createError } = await supabase
        .from("carts")
        .insert({ user_id: user.id })
        .select("id")
        .single();
      
      if (createError) throw createError;
      cart = newCart;
    } else if (cartError) {
      throw cartError;
    }
    
    // cart should not be null here, but TypeScript needs the check
    if (!cart) {
      return NextResponse.json(
        { success: false, error: "Failed to create cart" },
        { status: 500 }
      );
    }
    
    const { data: existingItem } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cart.id)
      .eq("vendor_product_id", vendor_product_id)
      .single();
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > vp.stock_quantity) {
        return NextResponse.json(
          { success: false, error: "Insufficient stock" },
          { status: 400 }
        );
      }
      
      const { error: updateError } = await supabase
        .from("cart_items")
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq("id", existingItem.id);
      
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("cart_items")
        .insert({
          cart_id: cart.id,
          product_id,
          vendor_product_id,
          quantity,
          unit_price: parseFloat(vp.price),
        });
      
      if (insertError) throw insertError;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add to cart" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("item_id");
    const clearAll = searchParams.get("clear_all") === "true";
    
    const { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!cart) {
      return NextResponse.json({ success: true });
    }
    
    if (clearAll) {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("cart_id", cart.id);
      
      if (error) throw error;
    } else if (itemId) {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", itemId)
        .eq("cart_id", cart.id);
      
      if (error) throw error;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update cart" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { item_id, quantity } = body;
    
    if (!item_id || typeof quantity !== "number") {
      return NextResponse.json(
        { success: false, error: "Item ID and quantity required" },
        { status: 400 }
      );
    }
    
    if (quantity < 1) {
      return NextResponse.json(
        { success: false, error: "Quantity must be at least 1" },
        { status: 400 }
      );
    }
    
    const { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!cart) {
      return NextResponse.json(
        { success: false, error: "Cart not found" },
        { status: 404 }
      );
    }
    
    const { data: item, error: itemError } = await supabase
      .from("cart_items")
      .select("id, vendor_product_id, vendor_products!inner (stock_quantity)")
      .eq("id", item_id)
      .eq("cart_id", cart.id)
      .single();
    
    if (itemError || !item) {
      return NextResponse.json(
        { success: false, error: "Item not found in cart" },
        { status: 404 }
      );
    }
    
    // vendor_products is an array
    const vpArr = (item as any).vendor_products;
    const stockQuantity = vpArr && vpArr.length > 0 ? vpArr[0].stock_quantity : 0;
    
    if (quantity > stockQuantity) {
      return NextResponse.json(
        { success: false, error: "Insufficient stock" },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq("id", item_id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update cart item" },
      { status: 500 }
    );
  }
}
