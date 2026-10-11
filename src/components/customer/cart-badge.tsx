"use client";

import Link from "next/link";
import { useCart } from "@/components/customer/cart-provider";

export function CartBadge() {
  const { count } = useCart();
  return <Link className="cart-button" href="/cart"><span aria-hidden="true">▢</span> Cart <b>{count}</b></Link>;
}
