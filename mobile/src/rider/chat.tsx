import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert, View, Text, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, TextInput, Image } from 'react-native';
import { AppButton, Card, Field, Notice, PageHeader, Screen, SectionTitle } from '@/src/components/ui';
import { useAuth } from '@/src/auth/auth-provider';
import { supabase } from '@/src/lib/supabase';
import { colors, spacing, radius } from '@/src/theme';
import { useOfflineMode } from './offline-mode';

type ChatMessage = {
  id: string;
  assignment_id: string;
  sender_id: string;
  sender_role: 'rider' | 'customer' | 'vendor';
  sender_name: string;
  message: string;
  message_type: 'text' | 'image' | 'location' | 'system';
  metadata: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

type Conversation = {
  assignment_id: string;
  order_id: string;
  shop_name: string;
  customer_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  other_party_role: 'customer' | 'vendor';
};

export default function ChatScreen({ assignmentId, orderId, otherPartyRole, otherPartyName }: { 
  assignmentId?: string; 
  orderId?: string; 
  otherPartyRole?: 'customer' | 'vendor'; 
  otherPartyName?: string; 
}) {
  const { session } = useAuth();
  const { isOnline, queueAction } = useOfflineMode();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const keyboardVisible = useRef(false);

  useEffect(() => {
    if (session?.user.id) {
      loadConversations();
      if (assignmentId) {
        loadMessages(assignmentId);
      }
    }
  }, [session, assignmentId]);

  const loadConversations = async () => {
    if (!session?.user.id) return;
    try {
      const { data, error: convError } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('rider_id', session.user.id)
        .order('last_message_time', { ascending: false });
      
      if (convError) throw convError;
      setConversations((data ?? []) as Conversation[]);
    } catch (e) {
      console.warn('Failed to load conversations:', e);
    }
  };

  const loadMessages = async (assignmentId: string) => {
    setLoading(true);
    try {
      const { data, error: msgError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true });
      
      if (msgError) throw msgError;
      setMessages((data ?? []) as ChatMessage[]);
      
      // Mark as read
      await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('assignment_id', assignmentId)
        .neq('sender_id', session?.user.id)
        .is('read_at', null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation || !session?.user.id) return;

    const message = newMessage.trim();
    setNewMessage('');
    setSending(true);
    setError('');

    try {
      const newMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        assignment_id: activeConversation.assignment_id,
        sender_id: session.user.id,
        sender_role: 'rider',
        sender_name: 'You',
        message,
        message_type: 'text',
        metadata: {},
        created_at: new Date().toISOString(),
        read_at: null,
      };

      // Optimistic update
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();

      if (isOnline) {
        const { error } = await supabase
          .from('chat_messages')
          .insert({
            assignment_id: activeConversation.assignment_id,
            sender_id: session.user.id,
            sender_role: 'rider',
            sender_name: 'Rider',
            message,
            message_type: 'text',
            metadata: {},
          });

        if (error) throw error;

        // Update conversation last message
        await supabase
          .from('chat_conversations')
          .update({
            last_message: message,
            last_message_time: new Date().toISOString(),
            unread_count: 0,
          })
          .eq('assignment_id', activeConversation.assignment_id);
      } else {
        // Queue for later
        await queueAction({
          type: 'update_location', // Generic queue type
          payload: { message, assignmentId: activeConversation.assignment_id, action: 'send_message' },
        });
        Alert.alert('Offline', 'Message queued. Will send when online.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== `temp-${Date.now()}`));
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const selectConversation = (conversation: Conversation) => {
    setActiveConversation(conversation);
    loadMessages(conversation.assignment_id);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!session) {
    return (
      <Screen>
        <PageHeader title="Chat" subtitle="Sign in to message customers and vendors" />
        <AppButton title="Sign in" onPress={() => {}} />
      </Screen>
    );
  }

  // If we have an active conversation, show the chat view
  if (activeConversation) {
    return (
      <Screen>
        <PageHeader
          eyebrow="Chat"
          title={activeConversation.shop_name || activeConversation.customer_name}
          subtitle={`${activeConversation.unread_count > 0 ? `${activeConversation.unread_count} unread · ` : ''}${formatTime(activeConversation.last_message_time)}`}
        />

        {!isOnline && (
          <Notice tone="info" style={{ marginBottom: spacing.sm }}>
            ⚠️ Offline - messages will sync when online
          </Notice>
        )}

        {error ? <Notice tone="error">{error}</Notice> : null}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} isOwn={item.sender_id === session.user.id} />
          )}
          onContentSizeChange={scrollToBottom}
          contentContainerStyle={{ paddingBottom: 100 }}
          inverted={false}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputContainer}
          keyboardVerticalOffset={0}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              onSubmitEditing={sendMessage}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                sending || !newMessage.trim() ? styles.sendButtonDisabled : {},
              ]}
              onPress={sendMessage}
              disabled={sending || !newMessage.trim()}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // Show conversations list
  return (
    <Screen>
      <PageHeader
        eyebrow="Messages"
        title="Chat"
        subtitle="Conversations with customers and vendors"
      />

      {!isOnline && (
        <Notice tone="info" style={{ marginBottom: spacing.sm }}>
          ⚠️ Offline - messages will sync when online
        </Notice>
      )}

      {conversations.length === 0 ? (
        <Card>
          <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl }}>
            No conversations yet. Start a delivery to chat with customers and vendors.
          </Text>
        </Card>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.assignment_id}
          renderItem={({ item }) => (
            <ConversationItem
              conversation={item}
              onPress={() => selectConversation(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </Screen>
  );
}

function ConversationItem({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  const isCustomer = conversation.other_party_role === 'customer';
  
  return (
    <TouchableOpacity style={styles.conversationItem} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{isCustomer ? '👤' : '🏪'}</Text>
      </View>
      <View style={styles.conversationContent} flex={1}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName}>
            {isCustomer ? conversation.customer_name : conversation.shop_name}
          </Text>
          <Text style={styles.conversationTime}>{formatTime(conversation.last_message_time)}</Text>
        </View>
        <View style={styles.conversationPreview}>
          <Text style={styles.conversationPreviewText} numberOfLines={1}>
            {conversation.last_message}
          </Text>
          {conversation.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{conversation.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  return (
    <View style={[styles.messageContainer, isOwn ? styles.messageOwn : styles.messageOther]}>
      {!isOwn && (
        <View style={styles.senderName}>
          <Text style={styles.senderNameText}>{message.sender_name}</Text>
        </View>
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {message.message_type === 'image' && message.metadata.image_uri ? (
          <Image source={{ uri: message.metadata.image_uri as string }} style={styles.messageImage} />
        ) : (
          <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : styles.messageTextOther]}>
            {message.message}
          </Text>
        )}
        <Text style={[styles.messageTime, isOwn ? styles.messageTimeOwn : styles.messageTimeOther]}>
          {formatTime(message.created_at)}
          {isOwn && message.read_at && ' ✓✓'}
        </Text>
      </View>
    </View>
  );
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.canvas,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    maxHeight: 100,
    paddingVertical: spacing.xs,
  },
  sendButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.green,
    borderRadius: radius.full,
  },
  sendButtonDisabled: {
    backgroundColor: colors.line,
  },
  sendButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.greenSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  conversationContent: {
    flex: 1,
    minWidth: 0,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  conversationTime: {
    fontSize: 11,
    color: colors.muted,
  },
  conversationPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationPreviewText: {
    fontSize: 13,
    color: colors.muted,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: colors.green,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  separator: {
    height: 1,
    backgroundColor: colors.line,
    marginLeft: 68,
  },
  messageContainer: {
    flexDirection: 'column',
    maxWidth: '85%',
    marginVertical: 4,
  },
  messageOwn: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    marginBottom: 2,
    marginLeft: 4,
  },
  senderNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  bubbleOwn: {
    backgroundColor: colors.green,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextOwn: { color: colors.white },
  messageTextOther: { color: colors.ink },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  messageTimeOwn: { color: 'rgba(255,255,255,0.7)' },
  messageTimeOther: { color: colors.muted },
});
