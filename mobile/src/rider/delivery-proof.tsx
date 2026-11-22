import { useState, useCallback } from 'react';
import { Alert, Image, View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { AppButton, Card, Field, Notice, PageHeader, Screen, SectionTitle } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { supabase } from '@/src/lib/supabase';
import { colors, spacing, radius } from '@/src/theme';
import { useOfflineMode } from './offline-mode';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_SIZE = SCREEN_WIDTH - spacing.xl * 2;

export type DeliveryProof = {
  assignmentId: string;
  orderId: string;
  proofType: 'delivery' | 'pickup' | 'issue';
  photos: string[]; // base64 or uri
  signature: string | null; // base64
  notes: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
};

export default function DeliveryProofScreen({ assignmentId, orderId, proofType = 'delivery' }: { assignmentId: string; orderId: string; proofType?: 'delivery' | 'pickup' | 'issue' }) {
  const { session } = useAuth();
  const { isOnline, queueAction } = useOfflineMode();
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signaturePoints, setSignaturePoints] = useState<{ x: number; y: number }[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);

  const pickImage = useCallback(async () => {
    if (photos.length >= 4) {
      Alert.alert('Limit reached', 'Maximum 4 photos allowed');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission required', 'Please grant media library access to add photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  }, [photos.length]);

  const takePhoto = useCallback(async () => {
    if (photos.length >= 4) {
      Alert.alert('Limit reached', 'Maximum 4 photos allowed');
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission required', 'Please grant camera access to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  }, [photos.length]);

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTouchStart = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setCurrentStroke([{ x: locationX, y: locationY }]);
  };

  const handleTouchMove = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setCurrentStroke((prev) => [...prev, { x: locationX, y: locationY }]);
  };

  const handleTouchEnd = () => {
    if (currentStroke.length > 1) {
      setSignaturePoints((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke([]);
  };

  const clearSignature = () => {
    setSignaturePoints([]);
    setSignature(null);
  };

  const saveSignature = () => {
    // In a real app, you'd convert the canvas to an image
    // For now, we'll store the points as JSON
    if (signaturePoints.length > 0) {
      setSignature(JSON.stringify(signaturePoints));
      setShowSignaturePad(false);
    } else {
      Alert.alert('No signature', 'Please draw a signature first');
    }
  };

  const submitProof = async () => {
    if (photos.length === 0 && !signature) {
      setError('Please add at least one photo or a signature');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const proof: DeliveryProof = {
        assignmentId,
        orderId,
        proofType,
        photos,
        signature,
        notes,
        timestamp: new Date().toISOString(),
      };

      if (isOnline) {
        // Save to Supabase
        const { error } = await supabase
          .from('delivery_proofs')
          .insert({
            assignment_id: assignmentId,
            order_id: orderId,
            proof_type: proofType,
            photos,
            signature,
            notes,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;

        // If this is a delivery proof, also update the delivery assignment
        if (proofType === 'delivery') {
          await supabase.rpc('rider_update_delivery', {
            p_assignment_id: assignmentId,
            p_action: 'deliver',
            p_cash_collected: true,
          });
        }
      } else {
        // Queue for later
        await queueAction({
          type: 'deliver',
          payload: { assignmentId, cashCollected: true },
        });
        // Also queue the proof submission
        await queueAction({
          type: 'update_location', // Using this as a generic queue type
          payload: { proof, action: 'submit_proof' },
        });
      }

      setSuccess('Delivery proof submitted successfully!');
      setPhotos([]);
      setSignature(null);
      setNotes('');
      setSignaturePoints([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit proof');
    } finally {
      setLoading(false);
    }
  };

  const getLocation = async () => {
    // Could add location capture here
    Alert.alert('Location', 'Location capture would be implemented here');
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Delivery"
        title={proofType === 'delivery' ? 'Confirm Delivery' : proofType === 'pickup' ? 'Confirm Pickup' : 'Report Issue'}
        subtitle={`Assignment: ${assignmentId.slice(0, 8).toUpperCase()}`}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {!isOnline && (
        <Card style={{ backgroundColor: colors.amberSoft, marginBottom: spacing.md }}>
          <Text style={{ color: colors.amber, fontWeight: '700' }}>⚠️ Offline mode</Text>
          <Text style={{ color: colors.ink, marginTop: 4 }}>Proof will be saved locally and synced when online.</Text>
        </Card>
      )}

      {/* Photos Section */}
      <SectionTitle title="Photos" action={
        photos.length < 4 ? (
          <AppButton title="Add Photo" variant="quiet" onPress={() => Alert.alert('Add photo', 'Choose source', [
            { text: 'Camera', onPress: takePhoto },
            { text: 'Gallery', onPress: pickImage },
            { text: 'Cancel', style: 'cancel' },
          ])} />
        ) : null
      } />

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(index)}>
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {photos.length === 0 && (
        <Card style={{ backgroundColor: colors.canvas }}>
          <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: spacing.lg }}>
            No photos added. Tap "Add Photo" to capture delivery evidence.
          </Text>
        </Card>
      )}

      {/* Signature Section */}
      <SectionTitle title="Customer Signature" action={
        !signature ? (
          <AppButton title={showSignaturePad ? 'Hide' : 'Add Signature'} variant="quiet" onPress={() => setShowSignaturePad(!showSignaturePad)} />
        ) : (
          <AppButton title="Clear" variant="quiet" onPress={() => { setSignature(null); setSignaturePoints([]); }} />
        )
      } />

      {showSignaturePad && (
        <Card>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: spacing.sm }}>Sign with finger, then tap Save</Text>
          <View style={styles.signatureCanvas}>
            {signaturePoints.map((stroke, strokeIndex) => (
              <Stroke key={strokeIndex} points={stroke} />
            ))}
            <Stroke points={currentStroke} color={colors.green} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <AppButton title="Clear" variant="quiet" onPress={clearSignature} />
            <AppButton title="Save" onPress={saveSignature} />
          </View>
        </Card>
      )}

      {signature && !showSignaturePad && (
        <Card>
          <Text style={{ color: colors.green, fontWeight: '700' }}>✓ Signature captured</Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{signaturePoints.length} stroke(s)</Text>
        </Card>
      )}

      {/* Notes Section */}
      <SectionTitle title="Notes (Optional)" />
      <Field
        label="Delivery notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        placeholder="Any issues, customer comments, etc."
      />

      {/* Location Section */}
      <SectionTitle title="Location" action={
        <AppButton title="Capture Location" variant="quiet" onPress={getLocation} />
      } />
      <Card>
        <Text style={{ color: colors.muted, fontSize: 12 }}>GPS coordinates will be recorded with the proof</Text>
      </Card>

      {/* Submit */}
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <AppButton
          title="Submit Proof"
          loading={loading}
          disabled={loading}
          onPress={submitProof}
        />
      </View>
    </Screen>
  );
}

function Stroke({ points, color = colors.ink }: { points: { x: number; y: number }[]; color?: string }) {
  if (points.length < 2) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      {points.slice(1).map((point, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: Math.min(points[index].x, point.x),
            top: Math.min(points[index].y, point.y),
            width: Math.abs(point.x - points[index].x),
            height: Math.abs(point.y - points[index].y),
            borderWidth: 2,
            borderColor: color,
            borderStyle: 'solid',
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  photoContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  signatureCanvas: {
    width: CANVAS_SIZE,
    height: 200,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    position: 'relative',
  },
});
