import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Vendor {
  id: string;
  base_delivery_fee: number;
}

interface VendorProduct {
  vendor_id: string;
  vendors?: Vendor[];
}

interface CartItem {
  id: string;
  product_id: string;
  vendor_product_id: string;
  quantity: number;
  unit_price: number;
  vendor_products?: VendorProduct[];
}

interface Cart {
  id: string;
  cart_items: CartItem[];
}

interface OrderItemInput {
  productId: string;
  vendorProductId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    
    let query = supabase
      .from("orders")
      .select(`
        id, status, subtotal, delivery_fee, discount, tax, total,
        payment_method, payment_status, customer_lat, customer_lng,
        created_at, updated_at,
        shops:vendor_id (id, name, slug, phone, address_line, city),
        order_items (
          id, quantity, unit_price, total_price,
          products (id, name, brand, model, unit, images)
        ),
        delivery_assignments (
          id, rider_id, status, assigned_at, picked_up_at, delivered_at,
          riders (id, name, phone, vehicle_type, vehicle_number)
        )
      `)
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (status) {
      query = query.eq("status", status);
    }
    
    const { data: orders, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      data: orders || [],
      pagination: { limit, offset, hasMore: (orders || []).length === limit },
    });
  } catch (error) {
    console.error("Orders GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
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
    const { items, address_id, payment_method } = body;
    
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Cart is empty" },
        { status: 400 }
      );
    }
    
    if (!address_id) {
      return NextResponse.json(
        { success: false, error: "Delivery address required" },
        { status: 400 }
      );
    }
    
    // Get user's cart
    const { data: cart } = await supabase
      .from("carts")
      .select(`
        id,
        cart_items!inner (
          id, product_id, vendor_product_id, quantity, unit_price,
          vendor_products!inner (vendor_id, vendors (id, base_delivery_fee))
        )
      `)
      .eq("user_id", user.id)
      .single();
    
    if (!cart || (cart.cart_items as CartItem[]).length === 0) {
      return NextResponse.json(
        { success: false, error: "Cart is empty" },
        { status: 400 }
      );
    }
    
    // Validate address belongs to user
    const { data: address } = await supabase
      .from("customer_addresses")
      .select("id, address_line, city, district, province, location")
      .eq("id", address_id)
      .eq("user_id", user.id)
      .single();
    
    if (!address) {
      return NextResponse.json(
        { success: false, error: "Invalid address" },
        { status: 400 }
      );
    }
    
    // Group items by vendor
    const vendorMap = new Map<string, {
      vendorId: string;
      deliveryFee: number;
      items: OrderItemInput[];
      subtotal: number;
    }>();
    
    (cart.cart_items as CartItem[]).forEach((item: CartItem) => {
      const vpArr = item.vendor_products;
      const vp = vpArr && vpArr.length > 0 ? vpArr[0] : null;
      const vendorArr = vp?.vendors;
      if (vp && vendorArr && vendorArr.length > 0) {
        const vendor = vendorArr[0];
        const vendorId = vp.vendor_id;
        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            vendorId,
            deliveryFee: vendor.base_delivery_fee,
            items: [],
            subtotal: 0,
          });
        }
        const v = vendorMap.get(vendorId)!;
        v.items.push({
          productId: item.product_id,
          vendorProductId: item.vendor_product_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.unit_price * item.quantity,
        });
        v.subtotal += item.unit_price * item.quantity;
      }
    });
    
    // Create separate order for each vendor
    const orders = [];
    for (const [vendorId, vendorData] of vendorMap) {
      const tax = vendorData.subtotal * 0.13;
      const total = vendorData.subtotal + vendorData.deliveryFee + tax;
      
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          shop_id: vendorId,
          address_id,
          status: "pending",
          subtotal: vendorData.subtotal,
          delivery_fee: vendorData.deliveryFee,
          discount: 0,
          tax,
          total,
          payment_method: payment_method || "cod",
          payment_status: payment_method === "cod" ? "pending" : "completed",
          customer_lat: address.location ? 
            JSON.parse(address.location).coordinates[1] : null,
          customer_lng: address.location ? 
            JSON.parse(address.location).coordinates[0] : null,
        })
        .select("id")
        .single();
      
      if (orderError) throw orderError;
      
      // Create order items
      const orderItems = vendorData.items.map((item: OrderItemInput) => ({
        order_id: order.id,
        product_id: item.productId,
        vendor_product_id: item.vendorProductId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
      }));
      
      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);
      
      if (itemsError) throw itemsError;
      
      // Create initial status history
      await supabase
        .from("order_status_history")
        .insert({
          order_id: order.id,
          status: "pending",
          note: "Order placed",
        });
      
      orders.push({ id: order.id, vendor_id: vendorId, total });
    }
    
    // Clear cart
    await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cart.id);
    
    return NextResponse.json({
      success: true,
      data: { orders },
    });
  } catch (error) {
    console.error("Orders POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create order" },
      { status: 500 }
    );
  }
}
