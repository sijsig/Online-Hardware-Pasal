import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, Card, Field, Notice, PageHeader, Screen, SectionTitle } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme';

const CSV_TEMPLATE = `product_name,category,description,price,compare_at_price,stock_quantity,unit,brand,model,is_active
"Demo Drill Machine","tools","Powerful drill for construction",5500,6000,10,each,"Demo Brand","DM-500",true
"Demo Hammer","hand-tools","Claw hammer 500g",850,1000,20,each,"Demo Brand","H-500",true`;

interface ParsedProduct {
  product_name: string;
  category: string;
  description: string;
  price: number;
  compare_at_price?: number;
  stock_quantity: number;
  unit: string;
  brand?: string;
  model?: string;
  is_active: boolean;
  errors: string[];
}

export default function BulkImportScreen() {
  const { profile } = useAuth();
  const [csvText, setCsvText] = useState(CSV_TEMPLATE);
  const [parsed, setParsed] = useState<ParsedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function parseCSV(text: string): ParsedProduct[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const results: ParsedProduct[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== headers.length) {
        results.push({ errors: [`Row ${i}: Column count mismatch`] } as any);
        continue;
      }
      
      const row: any = {};
      headers.forEach((h, idx) => row[h] = values[idx]?.trim().replace(/^"|"$/g, ''));
      
      const errors: string[] = [];
      if (!row.product_name) errors.push('Product name required');
      if (!row.category) errors.push('Category required');
      if (!row.price || isNaN(Number(row.price))) errors.push('Valid price required');
      if (!row.stock_quantity || isNaN(Number(row.stock_quantity))) errors.push('Valid stock required');
      if (!row.unit) errors.push('Unit required');
      
      results.push({
        product_name: row.product_name,
        category: row.category,
        description: row.description || '',
        price: Number(row.price) || 0,
        compare_at_price: row.compare_at_price ? Number(row.compare_at_price) : undefined,
        stock_quantity: Number(row.stock_quantity) || 0,
        unit: row.unit,
        brand: row.brand,
        model: row.model,
        is_active: row.is_active !== 'false',
        errors,
      });
    }
    return results;
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  function handleTextChange(text: string) {
    setCsvText(text);
    const parsedProducts = parseCSV(text);
    setParsed(parsedProducts);
  }

  async function importProducts() {
    if (!profile?.id) { Alert.alert('Error', 'Vendor profile not found'); return; }
    if (!parsed.length) { Alert.alert('Error', 'No valid products to import'); return; }
    
    const validProducts = parsed.filter(p => p.errors.length === 0);
    if (!validProducts.length) { Alert.alert('Error', 'All products have errors'); return; }
    
    setLoading(true); setError(''); setSuccess('');
    
    try {
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', profile.id)
        .maybeSingle();
      if (shopError) throw shopError;
      if (!shop) throw new Error('No shop found for this vendor');

      const categories = new Set(validProducts.map(p => p.category.toLowerCase()));
      const { data: cats, error: catError } = await supabase
        .from('categories')
        .select('id, slug')
        .in('slug', Array.from(categories));
      if (catError) throw catError;
      const catMap = new Map((cats ?? []).map(c => [c.slug, c.id]));

      let inserted = 0;
      for (const product of validProducts) {
        const categoryId = catMap.get(product.category.toLowerCase());
        const { error } = await supabase.from('products').insert({
          shop_id: shop.id,
          category_id: categoryId,
          name: product.product_name,
          slug: product.product_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: product.description,
          price: product.price,
          compare_at_price: product.compare_at_price,
          stock_quantity: product.stock_quantity,
          unit: product.unit,
          is_active: product.is_active,
        });
        if (error) throw error;
        inserted++;
      }
      
      setSuccess(`Successfully imported ${inserted} products!`);
      setCsvText(CSV_TEMPLATE);
      setParsed([]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return <Screen>
    <PageHeader eyebrow="Vendor tools" title="Bulk Import Products" subtitle="Upload CSV to add multiple products at once" />
    {error ? <Notice tone="error">{error}</Notice> : null}
    {success ? <Notice tone="success">{success}</Notice> : null}

    <SectionTitle title="CSV Template" />
    <Card style={{ padding: 12 }}>
      <Text style={{ fontSize: 11, color: colors.muted, fontFamily: 'monospace' }}>
        product_name,category,description,price,compare_at_price,stock_quantity,unit,brand,model,is_active
        "Demo Drill Machine","tools","Powerful drill for construction",5500,6000,10,each,"Demo Brand","DM-500",true
        "Demo Hammer","hand-tools","Claw hammer 500g",850,1000,20,each,"Demo Brand","H-500",true
      </Text>
    </Card>
    <AppButton title="Download template" variant="quiet" onPress={() => Alert.alert('Copy the template above', 'Paste into Excel/Sheets, fill data, export as CSV')} />

    <SectionTitle title="Paste CSV data" />
    <Field
      label="CSV content"
      value={csvText}
      onChangeText={handleTextChange}
      multiline
      numberOfLines={15}
      placeholder={CSV_TEMPLATE}
      style={{ fontFamily: 'monospace', fontSize: 11 }}
    />

    <SectionTitle title="Preview" />
    <ScrollView contentContainerStyle={{ gap: 8 }}>
      {parsed.map((p, i) => (
        <Card key={i} style={{ padding: 12, backgroundColor: p.errors.length ? colors.redSoft : colors.white, borderColor: p.errors.length ? colors.red : colors.line }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '800', color: colors.ink }}>{p.product_name || `Row ${i+1}`}</Text>
            <Text style={{ fontSize: 11, color: p.errors.length ? colors.red : colors.green, fontWeight: '800' }}>
              {p.errors.length ? 'Has errors' : 'Ready'}
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{p.category} · Rs. {p.price} · {p.stock_quantity} {p.unit}</Text>
          {p.errors.length && (
            <Text style={{ color: colors.red, fontSize: 10, marginTop: 4 }}>
              {p.errors.join(', ')}
            </Text>
          )}
        </Card>
      ))}
    </ScrollView>

    <View style={{ flexDirection: 'row', gap: 8 }}>
      <AppButton title={loading ? 'Importing...' : `Import ${parsed.filter(p => !p.errors.length).length} products`} loading={loading} onPress={importProducts} disabled={loading || !parsed.filter(p => !p.errors.length).length} />
      <AppButton title="Clear" variant="quiet" onPress={() => { setCsvText(CSV_TEMPLATE); setParsed([]); }} />
    </View>
  </Screen>;
}

function handleTextChange(text: string) {
  // This is defined inside the component
}
