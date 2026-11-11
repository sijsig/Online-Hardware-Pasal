import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppButton, Card, EmptyState, Field, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { getCategories, getFriendlyError, money, type Category } from '@/src/marketplace';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme';

type Vendor = { id: string; name: string; status: string; commission_rate: number | null };
type CatalogProduct = { id: string; name: string; unit: string; brand: string | null };
type InventoryItem = { id: string; product_id: string; price: number; stock_quantity: number; vendor_sku: string | null; is_active: boolean; approval_status?: string; products: { name: string; unit: string } | null };
type ShopOrder = { id: string; status: string; total: number; created_at: string };
type Commission = { id: string; order_id: string; subtotal_snapshot: number; rate_snapshot: number; commission_amount: number; vendor_payout: number; status: string; created_at: string };

export default function VendorScreen() {
  const { session, profile } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null); const [catalog, setCatalog] = useState<CatalogProduct[]>([]); const [inventory, setInventory] = useState<InventoryItem[]>([]); const [orders, setOrders] = useState<ShopOrder[]>([]); const [commissions, setCommissions] = useState<Commission[]>([]);
  const [productId, setProductId] = useState(''); const [price, setPrice] = useState(''); const [stock, setStock] = useState(''); const [sku, setSku] = useState('');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null); const [editPrice, setEditPrice] = useState(''); const [editStock, setEditStock] = useState(''); const [editSku, setEditSku] = useState(''); const [editActive, setEditActive] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]); const [listingMode, setListingMode] = useState<'catalog' | 'new'>('catalog'); const [newName, setNewName] = useState(''); const [brand, setBrand] = useState(''); const [model, setModel] = useState(''); const [unit, setUnit] = useState('each'); const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    if (!session) { setBusy(false); return; }
    setBusy(true);
    try {
      let { data: shop, error: shopError } = await supabase.from('vendors').select('id,name,status,commission_rate').eq('owner_id', session.user.id).maybeSingle();
      if (shopError) throw shopError;
      if (!shop) {
        const { data: membership, error: membershipError } = await supabase.from('vendor_staff').select('vendor_id').eq('user_id', session.user.id).eq('is_active', true).limit(1).maybeSingle();
        if (membershipError) throw membershipError;
        if (membership) { const result = await supabase.from('vendors').select('id,name,status,commission_rate').eq('id', membership.vendor_id).maybeSingle(); shop = result.data; shopError = result.error; if (shopError) throw shopError; }
      }
      setVendor(shop as Vendor | null);
      if (shop?.id) {
        const [itemsResult, orderResult, catalogResult, categoryResult] = await Promise.all([
          supabase.from('vendor_products').select('id,product_id,price,stock_quantity,vendor_sku,is_active,approval_status,products(name,unit)').eq('vendor_id', shop.id).order('created_at', { ascending: false }).limit(100),
          supabase.from('orders').select('id,status,total,created_at').eq('vendor_id', shop.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('products').select('id,name,unit,brand').eq('is_active', true).order('name').limit(200),
          getCategories(),
        ]);
        if (itemsResult.error) throw itemsResult.error; if (orderResult.error) throw orderResult.error; if (catalogResult.error) throw catalogResult.error;
        setInventory((itemsResult.data ?? []) as unknown as InventoryItem[]); setOrders((orderResult.data ?? []) as ShopOrder[]); setCatalog((catalogResult.data ?? []) as CatalogProduct[]); setCategories(categoryResult);
        if (profile?.role === 'vendor_owner') {
          const { data, error: commissionsError } = await supabase.from('commissions').select('id,order_id,subtotal_snapshot,rate_snapshot,commission_amount,vendor_payout,status,created_at').eq('vendor_id', shop.id).order('created_at', { ascending: false }).limit(20);
          if (commissionsError) throw commissionsError;
          setCommissions((data ?? []) as Commission[]);
        } else setCommissions([]);
      }
    } catch (e) { setError(getFriendlyError(e)); }
    finally { setBusy(false); }
  }, [session, profile?.role]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    if (!vendor) return;
    const channel = supabase.channel(`mobile-vendor-orders-${vendor.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendor.id}` }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [vendor, load]);

  async function submitProduct() {
    if (!vendor || listingMode === 'catalog' && !productId || listingMode === 'new' && (!newName.trim() || !categoryId)) { setError(listingMode === 'catalog' ? 'Choose a product from the catalog.' : 'Enter a product name and choose its category.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const { error: rpcError } = await supabase.rpc('submit_vendor_product', { p_vendor_id: vendor.id, p_product_id: listingMode === 'catalog' ? productId : null, p_product_name: listingMode === 'new' ? newName.trim() : null, p_category_id: listingMode === 'new' ? categoryId : null, p_brand: listingMode === 'new' ? brand || null : null, p_model: listingMode === 'new' ? model || null : null, p_unit: listingMode === 'new' ? unit : 'each', p_price: Number(price), p_stock_quantity: Number(stock), p_vendor_sku: sku || null });
      if (rpcError) throw rpcError;
      setSuccess('Product submitted for admin review. It will appear in customer search after approval.'); setProductId(''); setPrice(''); setStock(''); setSku(''); setNewName(''); setBrand(''); setModel(''); await load();
    } catch (e) { setError(getFriendlyError(e)); }
    finally { setSaving(false); }
  }
  async function changeOrder(orderId: string, next: 'confirmed' | 'rejected' | 'preparing' | 'ready_for_pickup') {
    setError('');
    const { error: rpcError } = await supabase.rpc('vendor_update_order_status', { p_order_id: orderId, p_next_status: next, p_note: null });
    if (rpcError) setError(getFriendlyError(rpcError)); else await load();
  }
  function beginEdit(item: InventoryItem) {
    setEditingItem(item); setEditPrice(String(item.price)); setEditStock(String(item.stock_quantity)); setEditSku(item.vendor_sku ?? ''); setEditActive(item.is_active);
    setError(''); setSuccess('');
  }
  async function saveInventory() {
    if (!vendor || !editingItem) return;
    const nextPrice = Number(editPrice); const nextStock = Number(editStock);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0 || !Number.isInteger(nextStock) || nextStock < 0) { setError('Enter a valid price and a whole-number stock quantity of zero or more.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const { error: rpcError } = await supabase.rpc('vendor_upsert_inventory', { p_vendor_id: vendor.id, p_product_id: editingItem.product_id, p_price: nextPrice, p_stock_quantity: nextStock, p_is_active: editActive, p_vendor_sku: editSku.trim() || null });
      if (rpcError) throw rpcError;
      setEditingItem(null); setSuccess('Price, stock, and availability updated.'); await load();
    } catch (e) { setError(getFriendlyError(e)); }
    finally { setSaving(false); }
  }

  if (!session) return <Screen><PageHeader title="Shop dashboard" subtitle="Sign in with your approved vendor account." /><AppButton title="Sign in" onPress={() => router.push('/login')} /></Screen>;
  if (busy) return <Screen><ActivityIndicator color={colors.green} /></Screen>;
  if (!vendor) return <Screen><PageHeader eyebrow="For local shops" title="Vendor workspace" subtitle="This account is not linked to a shop yet." /><Notice>Vendor registration and shop approval are managed through the marketplace onboarding workflow.</Notice><AppButton title="Back to marketplace" variant="quiet" onPress={() => router.back()} /></Screen>;
  return <Screen><PageHeader eyebrow={vendor.status === 'active' ? 'Shop is live' : 'Shop review'} title={vendor.name} subtitle={`Status: ${vendor.status}`} />
    {error ? <Notice tone="error">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
    {vendor.status !== 'active' ? <Notice>Your shop must be approved by an administrator before it can sell or submit products.</Notice> : <>
      <Card><Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Add a catalog product</Text><Text style={{ color: colors.muted, fontSize: 12 }}>New listings go to admin approval. Vendor price and stock remain yours to manage.</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}><AppButton title="Existing catalog item" variant={listingMode === 'catalog' ? 'secondary' : 'quiet'} onPress={() => setListingMode('catalog')} /><AppButton title="Request new item" variant={listingMode === 'new' ? 'secondary' : 'quiet'} onPress={() => setListingMode('new')} /></View>
        {listingMode === 'catalog' ? <><Text style={{ color: colors.ink, fontWeight: '800' }}>Select a product</Text>{catalog.slice(0, 80).map((item) => <Text key={item.id} onPress={() => setProductId(item.id)} style={{ paddingVertical: 8, color: productId === item.id ? colors.green : colors.ink, fontWeight: productId === item.id ? '900' : '500' }}>{productId === item.id ? '✓ ' : '○ '}{item.name} {item.brand ? `· ${item.brand}` : ''}</Text>)}</> : <>
          <Field label="Product name" value={newName} onChangeText={setNewName} placeholder="e.g. 25mm PVC elbow" />
          <Text style={{ color: colors.ink, fontWeight: '800' }}>Category</Text>{categories.filter((category) => category.parent_id === null).map((category) => <Text key={category.id} onPress={() => setCategoryId(category.id)} style={{ color: categoryId === category.id ? colors.green : colors.muted, paddingVertical: 5, fontWeight: '700' }}>{categoryId === category.id ? '✓ ' : '○ '}{category.name}</Text>)}
          <Field label="Brand (optional)" value={brand} onChangeText={setBrand} placeholder="Brand" /><Field label="Model (optional)" value={model} onChangeText={setModel} placeholder="Model or size" /><Field label="Unit" value={unit} onChangeText={setUnit} placeholder="each, box, metre..." />
        </>}
        <Field label="Price (NPR)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="7500" /><Field label="Opening stock" value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="4" /><Field label="Shop SKU (optional)" value={sku} onChangeText={setSku} placeholder="Your internal code" />
        {vendor.commission_rate == null ? <Notice>Commission rate is not set yet. Ask marketplace admin to confirm your shop terms.</Notice> : <Notice>At {Math.round(Number(vendor.commission_rate) * 100)}% commission: a {money(Number(price) || 0)} sale returns about {money((Number(price) || 0) * (1 - Number(vendor.commission_rate)))} to your shop, with {money((Number(price) || 0) * Number(vendor.commission_rate))} platform commission.</Notice>}
        <AppButton title="Submit for admin approval" loading={saving} disabled={listingMode === 'catalog' ? !productId || !price || !stock : !newName.trim() || !categoryId || !price || !stock} onPress={() => void submitProduct()} />
      </Card>
      <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>Inventory · {inventory.length}</Text>
      {editingItem ? <Card><Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900' }}>Edit {editingItem.products?.name ?? 'listing'}</Text><Field label="Price (NPR)" value={editPrice} onChangeText={setEditPrice} keyboardType="decimal-pad" /><Field label="Stock quantity" value={editStock} onChangeText={setEditStock} keyboardType="number-pad" /><Field label="Shop SKU (optional)" value={editSku} onChangeText={setEditSku} /><Text style={{ color: colors.muted, fontSize: 12 }}>Reducing stock below units reserved for open orders will be blocked.</Text><View style={{ flexDirection: 'row', gap: 8 }}><AppButton title={editActive ? 'Available · tap to pause' : 'Paused · tap to enable'} variant={editActive ? 'secondary' : 'quiet'} onPress={() => setEditActive(!editActive)} /><AppButton title="Cancel" variant="quiet" onPress={() => setEditingItem(null)} /></View><AppButton title="Save inventory" loading={saving} onPress={() => void saveInventory()} /></Card> : null}
      {inventory.length ? inventory.map((item) => <Card key={item.id}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontWeight: '800', flex: 1 }}>{item.products?.name ?? 'Catalog item'}</Text><Text style={{ color: colors.green, fontWeight: '900' }}>{money(item.price)}</Text></View><Text style={{ color: colors.muted, fontSize: 12 }}>{item.stock_quantity} units · {item.approval_status ?? 'approved'} · {item.is_active ? 'available' : 'paused'}</Text>{item.approval_status === 'approved' ? <AppButton title="Edit price & stock" variant="quiet" onPress={() => beginEdit(item)} /> : <Text style={{ color: colors.muted, fontSize: 12 }}>This listing can be edited after admin approval.</Text>}</Card>) : <Text style={{ color: colors.muted }}>No product listings yet.</Text>}
      <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>Recent orders · {orders.length}</Text>
      {orders.length ? orders.map((order) => <Card key={order.id}><Text style={{ color: colors.ink, fontWeight: '800' }}>{money(order.total)} · {order.status.replaceAll('_', ' ')}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{order.id.slice(0, 8).toUpperCase()}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{order.status === 'pending' ? <><AppButton title="Accept" onPress={() => void changeOrder(order.id, 'confirmed')} /><AppButton title="Reject" variant="danger" onPress={() => void changeOrder(order.id, 'rejected')} /></> : null}{order.status === 'confirmed' ? <AppButton title="Start preparing" onPress={() => void changeOrder(order.id, 'preparing')} /> : null}{order.status === 'preparing' ? <AppButton title="Ready for pickup" onPress={() => void changeOrder(order.id, 'ready_for_pickup')} /> : null}</View></Card>) : <Text style={{ color: colors.muted }}>Orders from customers will appear here.</Text>}
      {profile?.role === 'vendor_owner' ? <><Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>Commission & payouts</Text><Text style={{ color: colors.muted, fontSize: 12 }}>The rate and amounts below are saved with each order, so historical figures do not change if your shop rate changes.</Text>{commissions.length ? commissions.map((entry) => <Card key={entry.id}><Text style={{ color: colors.ink, fontWeight: '900' }}>Order {entry.order_id.slice(0, 8).toUpperCase()} · {entry.status}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{money(entry.subtotal_snapshot)} sales · {Number(entry.rate_snapshot * 100).toFixed(2)}% commission</Text><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted }}>Platform fee</Text><Text style={{ color: colors.ink }}>{money(entry.commission_amount)}</Text></View><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontWeight: '800' }}>Shop payout</Text><Text style={{ color: colors.green, fontWeight: '900' }}>{money(entry.vendor_payout)}</Text></View><Text style={{ color: colors.muted, fontSize: 10 }}>{new Date(entry.created_at).toLocaleDateString()}</Text></Card>) : <Text style={{ color: colors.muted }}>Commission records appear here as orders are placed.</Text>}</> : null}
    </>}
  </Screen>;
}
