import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Users, Archive, Phone, FileText, Clock, Mail, User as UserIcon, AlertCircle, CheckCircle, XCircle, Inbox, Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

type TabType = 'pending' | 'closed';

interface JoinRequest {
  id: string;
  user_id: string;
  club_id: string;
  phone_number: string;
  reason: string;
  status: string;
  created_at: string;
  expires_at: string;
  user: {
    email: string;
    full_name: string;
  };
}

export default function JoinRequestsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [closedRequests, setClosedRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [user?.currentClubId]);

  const loadRequests = async () => {
    if (!user?.currentClubId) {
      console.log('No currentClubId found');
      return;
    }

    console.log('Loading requests for club:', user.currentClubId);
    setIsLoading(true);
    try {
      // First, process expired requests and send notifications
      const { error: rpcError } = await supabase.rpc('process_expired_join_requests');
      if (rpcError) {
        console.error('Error processing expired requests:', rpcError);
      }

      // Load pending requests
      const { data: pendingData, error: pendingError } = await supabase
        .from('club_join_requests')
        .select(`
          *,
          user:app_user_profiles!club_join_requests_user_id_fkey(email, full_name)
        `)
        .eq('club_id', user.currentClubId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (pendingError) {
        console.error('Error loading pending requests:', pendingError);
        Alert.alert('Error', `Failed to load pending requests: ${pendingError.message}`);
        return;
      }

      // Load closed requests (approved, rejected, expired, withdrawn)
      const { data: closedData, error: closedError } = await supabase
        .from('club_join_requests')
        .select(`
          *,
          user:app_user_profiles!club_join_requests_user_id_fkey(email, full_name)
        `)
        .eq('club_id', user.currentClubId)
        .in('status', ['approved', 'rejected', 'expired', 'withdrawn'])
        .order('updated_at', { ascending: false })
        .limit(50);

      if (closedError) {
        console.error('Error loading closed requests:', closedError);
      }

      console.log(`Found ${pendingData?.length || 0} pending and ${closedData?.length || 0} closed requests`);
      setPendingRequests((pendingData as any) || []);
      setClosedRequests((closedData as any) || []);
    } catch (error) {
      console.error('Unexpected error loading requests:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading join requests');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await Clipboard.setStringAsync(email);
      setCopiedEmail(email);
      setTimeout(() => {
        setCopiedEmail(null);
      }, 2000);
    } catch (error) {
      console.error('Error copying email:', error);
      Alert.alert('Error', 'Failed to copy email address');
    }
  };

  const handleMarkAsClosed = (request: JoinRequest) => {
    Alert.alert(
      'Mark as Closed',
      `Are you sure you want to mark ${request.user?.full_name}'s request as closed? This will move it to the Closed tab.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Closed',
          style: 'default',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('club_join_requests')
                .update({
                  status: 'rejected',
                  reviewed_at: new Date().toISOString(),
                  reviewed_by: user?.userId
                })
                .eq('id', request.id);

              if (error) {
                Alert.alert('Error', `Failed to close request: ${error.message}`);
                console.error('Error closing request:', error);
                return;
              }

              Alert.alert('Success', 'Request has been marked as closed');
              loadRequests();
            } catch (error) {
              console.error('Error closing request:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffInHours = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffInHours <= 0) return 'Expired';
    if (diffInHours < 24) return `${diffInHours}h left`;
    const days = Math.ceil(diffInHours / 24);
    return `${days}d left`;
  };

  const getTimeColor = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffInHours = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffInHours <= 24) return '#ef4444';
    if (diffInHours <= 48) return '#f59e0b';
    return theme.colors.textSecondary;
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: 'Approved', color: '#10b981', icon: CheckCircle };
      case 'rejected':
        return { label: 'Closed', color: '#6b7280', icon: XCircle };
      case 'expired':
        return { label: 'Expired', color: '#ef4444', icon: Clock };
      case 'withdrawn':
        return { label: 'Withdrawn', color: '#f59e0b', icon: Archive };
      default:
        return { label: status, color: '#6b7280', icon: Inbox };
    }
  };

  const requests = activeTab === 'pending' ? pendingRequests : closedRequests;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Join Requests</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'pending' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('pending')}
        >
          <Inbox size={20} color={activeTab === 'pending' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'pending' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Pending ({pendingRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'closed' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('closed')}
        >
          <Archive size={20} color={activeTab === 'closed' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'closed' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Closed ({closedRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading && pendingRequests.length === 0 && closedRequests.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading requests...
            </Text>
          </View>
        ) : requests.length > 0 ? (
          <View style={styles.requestsSection}>
            {requests.map((request) => (
              <View key={request.id} style={[styles.requestCard, { backgroundColor: theme.colors.surface }]}>
                {/* User Info */}
                <View style={styles.requestHeader}>
                  <View style={[styles.userIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                    <UserIcon size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {request.user?.full_name || 'Unknown User'}
                    </Text>
                    <View style={styles.emailRow}>
                      <Mail size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {request.user?.email}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.copyButton,
                          copiedEmail === request.user?.email && { backgroundColor: '#10b98115' }
                        ]}
                        onPress={() => handleCopyEmail(request.user?.email)}
                      >
                        {copiedEmail === request.user?.email ? (
                          <Check size={14} color="#10b981" />
                        ) : (
                          <Copy size={14} color={theme.colors.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                    {copiedEmail === request.user?.email && (
                      <Text style={[styles.copiedText, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                        Email address copied
                      </Text>
                    )}
                  </View>
                </View>

                {/* Request Details */}
                <View style={styles.detailsSection}>
                  {/* Phone Number */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconContainer}>
                      <Phone size={16} color={theme.colors.textSecondary} />
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Phone
                      </Text>
                    </View>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {request.phone_number}
                    </Text>
                  </View>

                  {/* Reason */}
                  <View style={[styles.detailRow, styles.reasonRow]}>
                    <View style={styles.detailIconContainer}>
                      <FileText size={16} color={theme.colors.textSecondary} />
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Reason
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.reasonBox, { backgroundColor: theme.colors.background }]}>
                    <Text style={[styles.reasonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {request.reason}
                    </Text>
                  </View>

                  {/* Requested Date & Expires */}
                  <View style={styles.dateRow}>
                    <View style={styles.dateItem}>
                      <Text style={[styles.dateLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Requested
                      </Text>
                      <Text style={[styles.dateValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {new Date(request.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.dateItem}>
                      <Text style={[styles.dateLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Expires
                      </Text>
                      <View style={styles.expiresContainer}>
                        <Clock size={14} color={getTimeColor(request.expires_at)} />
                        <Text style={[styles.dateValue, { color: getTimeColor(request.expires_at) }]} maxFontSizeMultiplier={1.3}>
                          {getTimeRemaining(request.expires_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Status Badge for Closed Tab */}
                {activeTab === 'closed' && (
                  <View style={[styles.statusBadge, { backgroundColor: getStatusInfo(request.status).color + '15' }]}>
                    {(() => {
                      const StatusIcon = getStatusInfo(request.status).icon;
                      return <StatusIcon size={16} color={getStatusInfo(request.status).color} />;
                    })()}
                    <Text style={[styles.statusText, { color: getStatusInfo(request.status).color }]} maxFontSizeMultiplier={1.3}>
                      {getStatusInfo(request.status).label}
                    </Text>
                    {request.reviewed_at && (
                      <Text style={[styles.statusDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {new Date(request.reviewed_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                )}

                {/* Info Box - Only for Pending Tab */}
                {activeTab === 'pending' && (
                  <>
                    <View style={[styles.infoBox, { backgroundColor: '#eff6ff', borderColor: '#3b82f6' }]}>
                      <View style={styles.infoHeader}>
                        <AlertCircle size={20} color="#1e40af" />
                        <Text style={[styles.infoTitle, { color: '#1e40af' }]} maxFontSizeMultiplier={1.3}>
                          Review Required
                        </Text>
                      </View>
                      <Text style={[styles.infoText, { color: '#1e40af' }]} maxFontSizeMultiplier={1.3}>
                        To add this member to your club, copy their details and use "Invite User" from the admin panel.
                      </Text>
                      <Text style={[styles.infoText, { color: '#1e40af' }]} maxFontSizeMultiplier={1.3}>
                        This request will expire in {getTimeRemaining(request.expires_at)}.
                      </Text>
                    </View>

                    {/* Action Button */}
                    <TouchableOpacity
                      style={[styles.closeButton, { borderColor: theme.colors.border }]}
                      onPress={() => handleMarkAsClosed(request)}
                    >
                      <Archive size={18} color="#6b7280" />
                      <Text style={styles.closeButtonText} maxFontSizeMultiplier={1.3}>Mark as Closed</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            {activeTab === 'pending' ? (
              <>
                <Inbox size={64} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Pending Requests
                </Text>
                <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  There are no pending join requests at the moment. When users request to join, their details will appear here for your review.
                </Text>
              </>
            ) : (
              <>
                <Archive size={64} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Closed Requests
                </Text>
                <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Approved, rejected, expired, and withdrawn requests will appear here.
                </Text>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  requestsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  requestCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userEmail: {
    fontSize: 14,
    flex: 1,
  },
  copyButton: {
    padding: 6,
    borderRadius: 6,
  },
  copiedText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  detailsSection: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    gap: 8,
  },
  detailIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    marginLeft: 24,
  },
  reasonRow: {
    marginTop: 4,
  },
  reasonBox: {
    marginLeft: 24,
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  expiresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#f9fafb',
    gap: 6,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  statusDate: {
    fontSize: 13,
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 32,
    borderRadius: 16,
    padding: 48,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
