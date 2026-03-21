import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckSquare, Square, Users, Save, Search, CheckCheck, XSquare, User } from 'lucide-react-native';

interface ClubMember {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  isSelected: boolean;
}

export default function AhCounterManageMembers() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [members, setMembers] = useState<ClubMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (meetingId && user?.currentClubId) {
      loadMembers();
    }
  }, [meetingId, user?.currentClubId]);

  const loadMembers = async () => {
    if (!meetingId || !user?.currentClubId) return;

    setIsLoading(true);
    try {
      // Load all club members
      const { data: relationships, error: relError } = await supabase
        .from('app_club_user_relationship')
        .select('user_id')
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);

      if (relError) {
        console.error('Error loading club members:', relError);
        Alert.alert('Error', 'Failed to load club members');
        return;
      }

      const userIds = relationships?.map(r => r.user_id) || [];

      if (userIds.length === 0) {
        setMembers([]);
        return;
      }

      // Get user details
      const { data: profiles, error: profError } = await supabase
        .from('app_user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds)
        .order('full_name');

      if (profError) {
        console.error('Error loading profiles:', profError);
        Alert.alert('Error', 'Failed to load member details');
        return;
      }

      // Load already tracked members for this meeting
      const { data: tracked, error: trackError } = await supabase
        .from('ah_counter_tracked_members')
        .select('user_id')
        .eq('meeting_id', meetingId)
        .eq('club_id', user.currentClubId);

      if (trackError) {
        console.error('Error loading tracked members:', trackError);
      }

      const trackedUserIds = new Set(tracked?.map(t => t.user_id) || []);
      const hasExistingTracked = tracked && tracked.length > 0;

      const clubMembers = (profiles || []).map(profile => ({
        user_id: profile.id,
        full_name: profile.full_name || 'Unknown',
        avatar_url: profile.avatar_url,
        // If there are existing tracked members, use that; otherwise select all by default
        isSelected: hasExistingTracked ? trackedUserIds.has(profile.id) : true,
      }));

      setMembers(clubMembers);
    } catch (error) {
      console.error('Error loading members:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMember = (userId: string) => {
    setMembers(prev => prev.map(member => {
      if (member.user_id === userId) {
        return { ...member, isSelected: !member.isSelected };
      }
      return member;
    }));
  };

  const toggleAll = () => {
    const allSelected = members.every(m => m.isSelected);
    setMembers(prev => prev.map(member => ({
      ...member,
      isSelected: !allSelected,
    })));
  };

  const handleSave = async () => {
    if (!meetingId || !user?.currentClubId) return;

    setIsSaving(true);
    try {
      // Delete all existing tracked members for this meeting
      const { error: deleteError } = await supabase
        .from('ah_counter_tracked_members')
        .delete()
        .eq('meeting_id', meetingId)
        .eq('club_id', user.currentClubId);

      if (deleteError) {
        throw deleteError;
      }

      // Insert selected members
      const selectedMembers = members.filter(m => m.isSelected);

      if (selectedMembers.length > 0) {
        const { error: insertError } = await supabase
          .from('ah_counter_tracked_members')
          .insert(
            selectedMembers.map(m => ({
              meeting_id: meetingId,
              club_id: user.currentClubId,
              user_id: m.user_id,
              created_by: user.id,
            }))
          );

        if (insertError) {
          throw insertError;
        }
      }

      Alert.alert(
        'Success',
        'Member selection saved successfully',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving members:', error);
      Alert.alert('Error', 'Failed to save member selection');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = members.filter(m => m.isSelected).length;

  // Filter members based on search query
  const filteredMembers = members.filter(member => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return member.full_name.toLowerCase().includes(query);
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Select Members to Track
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {selectedCount} of {members.length} selected
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading members...
          </Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
              <Users size={20} color={theme.colors.primary} />
              <Text style={[styles.infoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Select members to track for Ah Counter. Only selected members will appear in the Ah Counter Audit.
              </Text>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search members..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                maxFontSizeMultiplier={1.3}
              />
            </View>

            <TouchableOpacity
              style={[styles.toggleAllButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={toggleAll}
              activeOpacity={0.7}
            >
              {members.every(m => m.isSelected) ? (
                <>
                  <XSquare size={20} color={theme.colors.error} />
                  <Text style={[styles.toggleAllText, { color: theme.colors.error }]} maxFontSizeMultiplier={1.3}>
                    Unselect All
                  </Text>
                </>
              ) : (
                <>
                  <CheckCheck size={20} color={theme.colors.primary} />
                  <Text style={[styles.toggleAllText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                    Select All
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.membersList}>
              {filteredMembers.map((member) => {
                return (
                  <TouchableOpacity
                    key={member.user_id}
                    style={[
                      styles.memberCard,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                      member.isSelected && { borderColor: theme.colors.primary, borderWidth: 2 }
                    ]}
                    onPress={() => toggleMember(member.user_id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.checkbox}>
                      {member.isSelected ? (
                        <CheckSquare size={24} color={theme.colors.primary} />
                      ) : (
                        <Square size={24} color={theme.colors.textSecondary} />
                      )}
                    </View>
                    <View style={styles.avatarContainer}>
                      {member.avatar_url ? (
                        <Image
                          source={{ uri: member.avatar_url }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.border }]}>
                          <User size={24} color={theme.colors.textSecondary} />
                        </View>
                      )}
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {member.full_name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Save size={20} color="#ffffff" />
                  <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
                    Save Selection
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  toggleAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  toggleAllText: {
    fontSize: 16,
    fontWeight: '600',
  },
  membersList: {
    gap: 12,
    paddingBottom: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
  },
  avatarContainer: {
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
