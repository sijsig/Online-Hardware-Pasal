import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  current_location: any;
}

interface DeliveryAssignment {
  id: string;
  rider_id: string;
  status: string;
  assigned_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  riders?: Rider[];
}

interface Shop {
  id: string;
  name: string;
  slug: string;
  phone: string;
  address_line: string;
  city: string;
  district: string;
}

interface Product {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  unit: string;
  images: string[];
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  products?: Product[];
}

interface OrderStatusHistory {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface Order {
  id: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: string;
  payment_status: string;
  customer_lat: number | null;
  customer_lng: number | null;
  created_at: string;
  updated_at: string;
  shops?: Shop[];
  order_items?: OrderItem[];
  delivery_assignments?: DeliveryAssignment[];
  order_status_history?: OrderStatusHistory[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    
    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        id, status, subtotal, delivery_fee, discount, tax, total,
        payment_method, payment_status, customer_lat, customer_lng,
        created_at, updated_at,
        shops (id, name, slug, phone, address_line, city, district),
        order_items (
          id, quantity, unit_price, total_price,
          products (id, name, brand, model, unit, images)
        ),
        delivery_assignments (
          id, rider_id, status, assigned_at, picked_up_at, delivered_at,
          riders (id, name, phone, vehicle_type, vehicle_number, current_location)
        ),
        order_status_history (id, status, note, created_at)
      `)
      .eq("id", id)
      .eq("customer_id", user.id)
      .single();
    
    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Order not found" },
          { status: 404 }
        );
      }
      throw error;
    }
    
    const orderData = order as Order;
    
    // Calculate estimated delivery time based on status
    let estimatedDelivery = null;
    if (orderData.delivery_assignments && orderData.delivery_assignments.length > 0) {
      const assignment = orderData.delivery_assignments[0];
      const riderArr = assignment.riders;
      const rider = riderArr && riderArr.length > 0 ? riderArr[0] : null;
      const shopArr = orderData.shops;
      const shop = shopArr && shopArr.length > 0 ? shopArr[0] : null;
      
      if (rider && rider.current_location && shop) {
        // Would calculate actual ETA here
      }
      estimatedDelivery = (assignment as any).estimated_delivery_minutes || 
        (shop as any).estimated_delivery_minutes || 45;
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...orderData,
        estimatedDelivery,
      },
    });
  } catch (error) {
    console.error("Order detail error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    const body = await request.json();
    const { action } = body;
    
    // Verify order belongs to user
    const { data: order } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", id)
      .eq("customer_id", user.id)
      .single();
    
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }
    
    if (action === "cancel") {
      if (!["pending", "confirmed"].includes(order.status)) {
        return NextResponse.json(
          { success: false, error: "Order cannot be cancelled" },
          { status: 400 }
        );
      }
      
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id);
      
      if (error) throw error;
      
      await supabase
        .from("order_status_history")
        .insert({
          order_id: id,
          status: "cancelled",
          note: "Cancelled by customer",
        });
      
      return NextResponse.json({ success: true });
    }
    
    if (action === "confirm_delivery") {
      if (order.status !== "out_for_delivery") {
        return NextResponse.json(
          { success: false, error: "Order not out for delivery" },
          { status: 400 }
        );
      }
      
      const { error } = await supabase
        .from("orders")
        .update({ status: "delivered", updated_at: new Date().toISOString() })
        .eq("id", id);
      
      if (error) throw error;
      
      await supabase
        .from("order_status_history")
        .insert({
          order_id: id,
          status: "delivered",
          note: "Confirmed delivered by customer",
        });
      
      // Update delivery assignment
      await supabase
        .from("delivery_assignments")
        .update({ status: "delivered", delivered_at: new Date().toISOString() })
        .eq("order_id", id);
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Order PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update order" },
      { status: 500 }
    );
  }
}
