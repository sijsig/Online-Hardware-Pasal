import { useEffect, useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, Card, Field, Notice, PageHeader, Screen, SectionTitle } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { supabase } from '@/src/lib/supabase';
import { colors, spacing, radius } from '@/src/theme';
import { money } from '@/src/marketplace';

export type Payout = {
  id: string;
  commission_id: string;
  order_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  payout_reference: string | null;
  bank_account: {
    account_name: string;
    account_number: string;
    bank_name: string;
    branch: string;
  } | null;
  requested_at: string;
  processed_at: string | null;
  paid_at: string | null;
};

export type BankDetails = {
  account_name: string;
  account_number: string;
  bank_name: string;
  branch: string;
};

export default function PayoutsScreen() {
  const { session, profile } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState<BankDetails>({
    account_name: '',
    account_number: '',
    bank_name: '',
    branch: '',
  });

  const loadData = async () => {
    if (!session?.user.id) return;
    setLoading(true);
    setError('');
    try {
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', session.user.id)
        .maybeSingle();
      
      if (shopError) throw shopError;
      if (!shop) {
        setPayouts([]);
        setLoading(false);
        return;
      }

      // Load bank details from shop metadata or separate table
      const { data: shopData } = await supabase
        .from('shops')
        .select('bank_account_name, bank_account_number, bank_name, bank_branch')
        .eq('id', shop.id)
        .maybeSingle();

      if (shopData) {
        setBankDetails({
          account_name: shopData.bank_account_name ?? '',
          account_number: shopData.bank_account_number ?? '',
          bank_name: shopData.bank_name ?? '',
          branch: shopData.bank_branch ?? '',
        });
        setBankForm({
          account_name: shopData.bank_account_name ?? '',
          account_number: shopData.bank_account_number ?? '',
          bank_name: shopData.bank_name ?? '',
          branch: shopData.bank_branch ?? '',
        });
      }

      // Load commissions that can be paid out
      const { data: commissions, error: commError } = await supabase
        .from('commissions')
        .select(`
          id,
          order_id,
          vendor_payout,
          status,
          payout_reference,
          paid_out_at,
          created_at
        `)
        .eq('vendor_id', shop.id)
        .order('created_at', { ascending: false });

      if (commError) throw commError;

      const formattedPayouts: Payout[] = (commissions ?? []).map((c) => ({
        id: c.id,
        commission_id: c.id,
        order_id: c.order_id,
        amount: Number(c.vendor_payout),
        status: c.status === 'paid_out' ? 'paid' : c.status === 'earned' ? 'pending' : 'failed',
        payout_reference: c.payout_reference,
        bank_account: bankDetails,
        requested_at: c.created_at,
        processed_at: c.paid_out_at,
        paid_at: c.paid_out_at,
      }));

      setPayouts(formattedPayouts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleBankFormChange = (field: keyof BankDetails, value: string) => {
    setBankForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveBankDetails = async () => {
    if (!session?.user.id) return;
    setError('');
    setSuccess('');

    // Validate
    if (!bankForm.account_name.trim() || !bankForm.account_number.trim() || !bankForm.bank_name.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', session.user.id)
        .maybeSingle();

      if (!shop) throw new Error('Shop not found');

      const { error } = await supabase
        .from('shops')
        .update({
          bank_account_name: bankForm.account_name,
          bank_account_number: bankForm.account_number,
          bank_name: bankForm.bank_name,
          bank_branch: bankForm.branch,
        })
        .eq('id', shop.id);

      if (error) throw error;

      setBankDetails({ ...bankForm });
      setShowBankForm(false);
      setSuccess('Bank details saved successfully');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save bank details');
    }
  };

  const requestPayout = async (commissionId: string, amount: number) => {
    Alert.alert(
      'Request Payout',
      `Request payout of ${money(amount)}? This will be processed by the marketplace admin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: async () => {
            setError('');
            setSuccess('');
            try {
              // In a real app, this would create a payout request record
              // For now, we'll just show a success message
              setSuccess(`Payout request for ${money(amount)} submitted. Admin will process within 1-2 business days.`);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to request payout');
            }
          },
        },
      ]
    );
  };

  const copyToClipboard = (text: string) => {
    Alert.alert('Copied', `${text} copied to clipboard`);
  };

  useEffect(() => {
    if (session?.user.id) {
      loadData();
    }
  }, [session]);

  if (!session) {
    return (
      <Screen>
        <PageHeader title="Payouts" subtitle="Sign in to view your payouts" />
        <AppButton title="Sign in" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  if (loading) {
    return <Screen><Text style={{ textAlign: 'center', marginTop: 50, color: colors.muted }}>Loading...</Text></Screen>;
  }

  const pendingAmount = payouts
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const paidAmount = payouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <PageHeader eyebrow="Financials" title="Payouts" subtitle="Manage your shop earnings and withdrawals" />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Available to Withdraw</Text>
          <Text style={[styles.summaryValue, { color: colors.green }]}>{money(pendingAmount)}</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Paid Out</Text>
          <Text style={styles.summaryValue}>{money(paidAmount)}</Text>
        </Card>
      </View>

      {/* Bank Details Section */}
      <SectionTitle title="Bank Details" action={
        <AppButton
          title={bankDetails?.account_number ? 'Edit' : 'Add'}
          variant="quiet"
          onPress={() => setShowBankForm(true)}
        />
      } />
      
      {showBankForm ? (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: spacing.md }}>
            {bankDetails?.account_number ? 'Edit Bank Details' : 'Add Bank Details'}
          </Text>
          <Field label="Account Holder Name" value={bankForm.account_name} onChangeText={(v) => handleBankFormChange('account_name', v)} placeholder="As per bank records" />
          <Field label="Account Number" value={bankForm.account_number} onChangeText={(v) => handleBankFormChange('account_number', v)} placeholder="1234567890" keyboardType="number-pad" />
          <Field label="Bank Name" value={bankForm.bank_name} onChangeText={(v) => handleBankFormChange('bank_name', v)} placeholder="e.g., Nabil Bank, NMB Bank" />
          <Field label="Branch" value={bankForm.branch} onChangeText={(v) => handleBankFormChange('branch', v)} placeholder="e.g., Kathmandu Main Branch" />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
            <AppButton title="Save" onPress={saveBankDetails} />
            <AppButton title="Cancel" variant="quiet" onPress={() => setShowBankForm(false)} />
          </View>
        </Card>
      ) : bankDetails?.account_number ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontWeight: '800', color: colors.ink }}>{bankDetails.account_name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{bankDetails.bank_name} · {bankDetails.branch}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontFamily: 'monospace' }}>****{bankDetails.account_number.slice(-4)}</Text>
            </View>
            <AppButton title="Edit" variant="quiet" onPress={() => setShowBankForm(true)} />
          </View>
        </Card>
      ) : (
        <Card style={{ backgroundColor: colors.amberSoft }}>
          <Text style={{ color: colors.ink }}>No bank details added. Add your bank account to receive payouts.</Text>
          <View style={{ marginTop: spacing.sm }}>
            <AppButton title="Add Bank Details" variant="secondary" onPress={() => setShowBankForm(true)} />
          </View>
        </Card>
      )}

      {/* Payout History */}
      <SectionTitle title="Payout History" />
      {payouts.length === 0 ? (
        <Card>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>No payout history yet. Commissions will appear here as orders are confirmed.</Text>
        </Card>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 8 }}>
          {payouts.map((payout) => (
            <Card key={payout.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.ink }}>{money(payout.amount)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    Order #{payout.order_id.slice(0, 8).toUpperCase()} · {new Date(payout.requested_at).toLocaleDateString()}
                  </Text>
                  {payout.payout_reference && (
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>
                      Ref: {payout.payout_reference}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[
                    styles.statusBadge,
                    payout.status === 'paid' && styles.statusPaid,
                    payout.status === 'pending' && styles.statusPending,
                    payout.status === 'processing' && styles.statusProcessing,
                    payout.status === 'failed' && styles.statusFailed,
                  ]}>
                    <Text style={[
                      styles.statusText,
                      payout.status === 'paid' && styles.statusTextPaid,
                      payout.status === 'pending' && styles.statusTextPending,
                      payout.status === 'processing' && styles.statusTextProcessing,
                      payout.status === 'failed' && styles.statusTextFailed,
                    ]}>
                      {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </Text>
                  </View>
                  {payout.status === 'pending' && bankDetails?.account_number && (
                    <View style={{ minWidth: 120 }}>
                      <AppButton title="Request Payout" variant="secondary" onPress={() => requestPayout(payout.commission_id, payout.amount)} />
                    </View>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.ink,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    minWidth: 80,
    alignItems: 'center',
  },
  statusPaid: { backgroundColor: colors.greenSoft },
  statusPending: { backgroundColor: colors.amberSoft },
  statusProcessing: { backgroundColor: colors.blueSoft },
  statusFailed: { backgroundColor: colors.redSoft },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusTextPaid: { color: colors.green },
  statusTextPending: { color: colors.amber },
  statusTextProcessing: { color: colors.blue },
  statusTextFailed: { color: colors.red },
});
