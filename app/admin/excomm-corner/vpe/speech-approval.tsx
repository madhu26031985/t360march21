import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, CheckCircle, XCircle, Clock, Calendar, User, FileText } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type ApprovalStatus = 'open' | 'approved' | 'denied';

interface SpeechApprovalRequest {
  id: string;
  meeting_id: string;
  speaker_id: string;
  speaker_name: string;
  speech_title: string;
  pathway_name: string;
  level: number;
  project_name: string;
  project_number: string;
  evaluation_form: string;
  evaluator_id: string;
  evaluator_name: string;
  vpe_approved: boolean | null;
  vpe_approval_requested_at: string;
  vpe_approval_request_id: string | null;
  vpe_approved_at: string | null;
  vpe_approved_by: string | null;
  vpe_approval_decision_id: string | null;
  is_locked: boolean;
  locked_at: string | null;
  meeting_number: string;
  meeting_date: string;
}

export default function SpeechApproval() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ApprovalStatus>('open');
  const [requests, setRequests] = useState<SpeechApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRequests = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_evaluation_pathway')
        .select(`
          id,
          meeting_id,
          user_id,
          speech_title,
          pathway_name,
          level,
          project_name,
          project_number,
          evaluation_form,
          assigned_evaluator_id,
          vpe_approval_requested,
          vpe_approval_request_id,
          vpe_approved,
          vpe_approved_at,
          vpe_approved_by,
          vpe_approval_decision_id,
          is_locked,
          locked_at,
          speaker:app_user_profiles!user_id(full_name),
          evaluator:app_user_profiles!assigned_evaluator_id(full_name),
          meeting:app_club_meeting!meeting_id(meeting_number, meeting_date)
        `)
        .eq('club_id', user.currentClubId)
        .eq('vpe_approval_requested', true)
        .order('vpe_approval_requested_at', { ascending: false });

      if (error) {
        console.error('Error loading approval requests:', error);
        return;
      }

      const formattedRequests: SpeechApprovalRequest[] = (data || []).map((item: any) => ({
        id: item.id,
        meeting_id: item.meeting_id,
        speaker_id: item.user_id,
        speaker_name: item.speaker?.full_name || 'Unknown',
        speech_title: item.speech_title || '',
        pathway_name: item.pathway_name || '',
        level: item.level || 0,
        project_name: item.project_name || '',
        project_number: item.project_number || '',
        evaluation_form: item.evaluation_form || '',
        evaluator_id: item.assigned_evaluator_id || '',
        evaluator_name: item.evaluator?.full_name || 'Not assigned',
        vpe_approved: item.vpe_approved,
        vpe_approval_requested_at: item.vpe_approval_requested_at,
        vpe_approval_request_id: item.vpe_approval_request_id,
        vpe_approved_at: item.vpe_approved_at,
        vpe_approved_by: item.vpe_approved_by,
        vpe_approval_decision_id: item.vpe_approval_decision_id,
        is_locked: item.is_locked,
        locked_at: item.locked_at,
        meeting_number: item.meeting?.meeting_number || '',
        meeting_date: item.meeting?.meeting_date || '',
      }));

      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [user?.currentClubId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const handleApprove = async (requestId: string) => {
    Alert.alert(
      'Approve Speech',
      'Are you sure you want to approve this speech?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('app_evaluation_pathway')
                .update({
                  vpe_approved: true,
                  vpe_approved_at: new Date().toISOString(),
                  vpe_approved_by: user?.id,
                  updated_at: new Date().toISOString(),
                  updated_by: user?.id
                })
                .eq('id', requestId);

              if (error) throw error;

              Alert.alert('Success', 'Speech approved successfully');
              loadRequests();
            } catch (error) {
              console.error('Error approving speech:', error);
              Alert.alert('Error', 'Failed to approve speech');
            }
          }
        }
      ]
    );
  };

  const handleDeny = async (requestId: string) => {
    Alert.alert(
      'Deny Speech',
      'Are you sure you want to deny this speech?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('app_evaluation_pathway')
                .update({
                  vpe_approved: false,
                  vpe_approved_at: new Date().toISOString(),
                  vpe_approved_by: user?.id,
                  updated_at: new Date().toISOString(),
                  updated_by: user?.id
                })
                .eq('id', requestId);

              if (error) throw error;

              Alert.alert('Success', 'Speech denied');
              loadRequests();
            } catch (error) {
              console.error('Error denying speech:', error);
              Alert.alert('Error', 'Failed to deny speech');
            }
          }
        }
      ]
    );
  };

  const filteredRequests = requests.filter(request => {
    if (activeTab === 'open') return request.vpe_approved === null;
    if (activeTab === 'approved') return request.vpe_approved === true;
    if (activeTab === 'denied') return request.vpe_approved === false;
    return false;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speech Approval</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'open' && styles.activeTab,
            { borderBottomColor: activeTab === 'open' ? '#3b82f6' : 'transparent' }
          ]}
          onPress={() => setActiveTab('open')}
        >
          <Clock size={18} color={activeTab === 'open' ? '#3b82f6' : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'open' ? '#3b82f6' : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Open Request
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'approved' && styles.activeTab,
            { borderBottomColor: activeTab === 'approved' ? '#10b981' : 'transparent' }
          ]}
          onPress={() => setActiveTab('approved')}
        >
          <CheckCircle size={18} color={activeTab === 'approved' ? '#10b981' : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'approved' ? '#10b981' : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Approved
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'denied' && styles.activeTab,
            { borderBottomColor: activeTab === 'denied' ? '#ef4444' : 'transparent' }
          ]}
          onPress={() => setActiveTab('denied')}
        >
          <XCircle size={18} color={activeTab === 'denied' ? '#ef4444' : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'denied' ? '#ef4444' : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Denied
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              No {activeTab === 'open' ? 'pending' : activeTab} requests
            </Text>
          </View>
        ) : (
          <View style={styles.requestsList}>
            {filteredRequests.map((request) => (
              <View
                key={request.id}
                style={[styles.requestCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.meetingInfo}>
                    <Calendar size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.meetingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Meeting #{request.meeting_number} - {formatDate(request.meeting_date)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.infoRow}>
                    <User size={16} color={theme.colors.textSecondary} />
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Speaker</Text>
                      <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{request.speaker_name}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <FileText size={16} color={theme.colors.textSecondary} />
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Speech Title</Text>
                      <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{request.speech_title}</Text>
                    </View>
                  </View>

                  <View style={styles.pathwaySection}>
                    <View style={styles.pathwayRow}>
                      <View style={styles.pathwayItem}>
                        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Pathway</Text>
                        <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{request.pathway_name}</Text>
                      </View>
                      <View style={styles.pathwayItem}>
                        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Level</Text>
                        <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Level {request.level}</Text>
                      </View>
                    </View>

                    <View style={styles.pathwayRow}>
                      <View style={styles.pathwayItem}>
                        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Project</Text>
                        <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{request.project_name}</Text>
                      </View>
                      <View style={styles.pathwayItem}>
                        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Project #</Text>
                        <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{request.project_number}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <FileText size={16} color={theme.colors.textSecondary} />
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Evaluation Form</Text>
                      <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{request.evaluation_form}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <User size={16} color={theme.colors.textSecondary} />
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Evaluator</Text>
                      <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{request.evaluator_name}</Text>
                    </View>
                  </View>
                </View>

                {activeTab === 'open' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApprove(request.id)}
                    >
                      <CheckCircle size={18} color="#ffffff" />
                      <Text style={styles.actionButtonText} maxFontSizeMultiplier={1.3}>Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.denyButton]}
                      onPress={() => handleDeny(request.id)}
                    >
                      <XCircle size={18} color="#ffffff" />
                      <Text style={styles.actionButtonText} maxFontSizeMultiplier={1.3}>Deny</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {activeTab !== 'open' && request.vpe_approved_at && (
                  <View style={styles.statusFooter}>
                    <Text style={[styles.statusText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {activeTab === 'approved' ? 'Approved' : 'Denied'} on {formatDate(request.vpe_approved_at)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
  },
  requestsList: {
    padding: 16,
    gap: 16,
  },
  requestCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meetingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoTextContainer: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  pathwaySection: {
    gap: 12,
  },
  pathwayRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pathwayItem: {
    flex: 1,
    gap: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  denyButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  statusFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
