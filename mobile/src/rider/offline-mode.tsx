import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { NetInfo, NetInfoState } from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/auth/auth-provider';

export type QueuedAction = {
  id: string;
  type: 'accept_assignment' | 'decline_assignment' | 'pickup' | 'deliver' | 'update_location';
  payload: Record<string, unknown>;
  timestamp: string;
  retries: number;
};

type OfflineContextType = {
  isOnline: boolean;
  queuedActions: QueuedAction[];
  queueAction: (action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>) => Promise<void>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextType | null>(null);

const QUEUE_STORAGE_KEY = '@offline_action_queue';

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);
  const [loading, setLoading] = useState(true);

  // Load queued actions from AsyncStorage on mount
  useEffect(() => {
    loadQueue();
  }, []);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online && queuedActions.length > 0) {
        processQueue();
      }
    });
    return () => unsubscribe();
  }, [queuedActions.length]);

  const loadQueue = async () => {
    try {
      const { getItem } = await import('@react-native-async-storage/async-storage');
      const stored = await getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        setQueuedActions(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load offline queue:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveQueue = async (queue: QueuedAction[]) => {
    try {
      const { setItem } = await import('@react-native-async-storage/async-storage');
      await setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to save offline queue:', e);
    }
  };

  const queueAction = async (action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>) => {
    const newAction: QueuedAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      retries: 0,
    };
    const updated = [...queuedActions, newAction];
    setQueuedActions(updated);
    await saveQueue(updated);
  };

  const processQueue = async () => {
    if (!session?.user.id || queuedActions.length === 0) return;

    const updated = [...queuedActions];
    let hasChanges = false;

    for (let i = 0; i < updated.length; i++) {
      const action = updated[i];
      if (action.retries >= 3) continue; // Max retries reached

      try {
        let success = false;
        
        switch (action.type) {
          case 'accept_assignment':
            const { error: acceptError } = await supabase.rpc('rider_accept_assignment', {
              p_assignment_id: action.payload.assignmentId,
            });
            success = !acceptError;
            break;
            
          case 'decline_assignment':
            const { error: declineError } = await supabase.rpc('rider_decline_assignment', {
              p_assignment_id: action.payload.assignmentId,
            });
            success = !declineError;
            break;
            
          case 'pickup':
            const { error: pickupError } = await supabase.rpc('rider_update_delivery', {
              p_assignment_id: action.payload.assignmentId,
              p_action: 'pickup',
              p_cash_collected: false,
            });
            success = !pickupError;
            break;
            
          case 'deliver':
            const { error: deliverError } = await supabase.rpc('rider_update_delivery', {
              p_assignment_id: action.payload.assignmentId,
              p_action: 'deliver',
              p_cash_collected: action.payload.cashCollected ?? true,
            });
            success = !deliverError;
            break;
            
          case 'update_location':
            const { error: locationError } = await supabase.rpc('rider_update_location', {
              p_latitude: action.payload.latitude,
              p_longitude: action.payload.longitude,
              p_accuracy_meters: action.payload.accuracy,
            });
            success = !locationError;
            break;
        }

        if (success) {
          // Remove successful action from queue
          updated.splice(i, 1);
          i--;
          hasChanges = true;
        } else {
          // Increment retry count
          updated[i] = { ...action, retries: action.retries + 1 };
          hasChanges = true;
        }
      } catch (e) {
        // Increment retry count on error
        updated[i] = { ...action, retries: action.retries + 1 };
        hasChanges = true;
      }
    }

    if (hasChanges) {
      setQueuedActions(updated);
      await saveQueue(updated);
    }
  };

  const clearQueue = async () => {
    setQueuedActions([]);
    await saveQueue([]);
  };

  const value = useMemo<OfflineContextType>(
    () => ({
      isOnline,
      queuedActions,
      queueAction,
      processQueue,
      clearQueue,
    }),
    [isOnline, queuedActions, queueAction, processQueue, clearQueue]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOfflineMode() {
  const context = useContext(OfflineContext);
  if (!context) throw new Error('useOfflineMode must be used within OfflineProvider');
  return context;
}

// Hook for offline-aware actions
export function useOfflineAction<T extends (...args: unknown[]) => Promise<void>>(
  action: T,
  offlineType: QueuedAction['type'],
  getPayload: (...args: Parameters<T>) => QueuedAction['payload']
) {
  const { isOnline, queueAction } = useOfflineMode();
  
  return async (...args: Parameters<T>) => {
    if (isOnline) {
      await action(...args);
    } else {
      await queueAction({
        type: offlineType,
        payload: getPayload(...args),
      });
      Alert.alert('Offline', 'Action queued. Will sync when online.');
    }
  };
}
