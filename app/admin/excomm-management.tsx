import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Crown, User, ChevronDown, Calendar, Save, Building2, Shield, Eye, UserCheck } from 'lucide-react-native';
import { Search, X } from 'lucide-react-native';
import { Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

interface ExCommRole {
  key: string;
  title: string;
  description: string;
  member_id: string | null;
  term_start: string | null;
  term_end: string | null;
}

interface ClubProfile {
  president_id: string | null;
  president_term_start: string | null;
  president_term_end: string | null;
  vpe_id: string | null;
  vpe_term_start: string | null;
  vpe_term_end: string | null;
  vpm_id: string | null;
  vpm_term_start: string | null;
  vpm_term_end: string | null;
  vppr_id: string | null;
  vppr_term_start: string | null;
  vppr_term_end: string | null;
  secretary_id: string | null;
  secretary_term_start: string | null;
  secretary_term_end: string | null;
  treasurer_id: string | null;
  treasurer_term_start: string | null;
  treasurer_term_end: string | null;
  saa_id: string | null;
  saa_term_start: string | null;
  saa_term_end: string | null;
}

export default function ExCommManagement() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [excommRoles, setExcommRoles] = useState<ExCommRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showTermModal, setShowTermModal] = useState(false);
  const [termType, setTermType] = useState<'start' | 'end'>('start');
  const [tempDate, setTempDate] = useState(new Date());
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<ClubMember[]>([]);

  const excommRoleDefinitions = [
    {
      key: 'president',
      title: 'President',
      description: 'Chief executive officer of the club'
    },
    {
      key: 'vpe',
      title: 'VP Education',
      description: 'Oversees educational programs and member development'
    },
    {
      key: 'vpm',
      title: 'VP Membership',
      description: 'Manages membership growth and retention'
    },
    {
      key: 'vppr',
      title: 'VP Public Relations',
      description: 'Handles club marketing and public relations'
    },
    {
      key: 'secretary',
      title: 'Secretary',
      description: 'Maintains club records and correspondence'
    },
    {
      key: 'treasurer',
      title: 'Treasurer',
      description: 'Manages club finances and dues'
    },
    {
      key: 'saa',
      title: 'Sergeant at Arms',
      description: 'Maintains order and manages club property'
    },
    {
      key: 'ipp',
      title: 'Immediate Past President',
      description: 'Former president providing guidance and continuity'
    },
    {
      key: 'area_director',
      title: 'Area Director',
      description: 'Oversees clubs within a specific area'
    },
    {
      key: 'division_director',
      title: 'Division Director', 
      description: 'Manages multiple areas within a division'
    },
    {
      key: 'district_director',
      title: 'District Director',
      description: 'Leads the entire district organization'
    },
    {
      key: 'program_quality_director',
      title: 'Program Quality Director',
      description: 'Ensures quality of educational programs district-wide'
    },
    {
      key: 'club_growth_director',
      title: 'Club Growth Director',
      description: 'Focuses on club growth and new club development'
    },
    {
      key: 'immediate_past_district_director',
      title: 'Immediate Past District Director',
      description: 'Former district director providing continuity and guidance'
    }
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [clubMembers, memberSearchQuery]);

  const loadData = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadClubInfo(),
        loadClubMembers(),
        loadExcommRoles()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, club_number')
        .eq('id', user.currentClubId)
        .single();

      if (error) {
        console.error('Error loading club info:', error);
        return;
      }

      setClubInfo(data);
    } catch (error) {
      console.error('Error loading club info:', error);
    }
  };

  const loadClubMembers = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          app_user_profiles (
            id,
            full_name,
            email
          ),
          role
        `)
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);

      if (error) {
        console.error('Error loading club members:', error);
        return;
      }

      const members = (data || []).map(item => ({
        id: (item as any).app_user_profiles.id,
        full_name: (item as any).app_user_profiles.full_name,
        email: (item as any).app_user_profiles.email,
        avatar_url: null,
        role: (item as any).role,
      }));

      setClubMembers(members);
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

  const loadExcommRoles = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('club_profiles')
        .select(`
          president_id, president_term_start, president_term_end,
          ipp_id, ipp_term_start, ipp_term_end,
          vpe_id, vpe_term_start, vpe_term_end,
          vpm_id, vpm_term_start, vpm_term_end,
          vppr_id, vppr_term_start, vppr_term_end,
          secretary_id, secretary_term_start, secretary_term_end,
          treasurer_id, treasurer_term_start, treasurer_term_end,
          saa_id, saa_term_start, saa_term_end,
          area_director_id, area_director_term_start, area_director_term_end,
          division_director_id, division_director_term_start, division_director_term_end,
          district_director_id, district_director_term_start, district_director_term_end,
          program_quality_director_id, program_quality_director_term_start, program_quality_director_term_end,
          club_growth_director_id, club_growth_director_term_start, club_growth_director_term_end,
          immediate_past_district_director_id, immediate_past_district_director_term_start, immediate_past_district_director_term_end
        `)
        .eq('club_id', user.currentClubId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading excomm roles:', error);
        return;
      }

      const clubProfile = (data as any) || {};
      
      const roles = excommRoleDefinitions.map(role => ({
        key: role.key,
        title: role.title,
        description: role.description,
        member_id: clubProfile[`${role.key}_id` as keyof ClubProfile] || null,
        term_start: clubProfile[`${role.key}_term_start` as keyof ClubProfile] || null,
        term_end: clubProfile[`${role.key}_term_end` as keyof ClubProfile] || null,
      }));

      setExcommRoles(roles);
    } catch (error) {
      console.error('Error loading excomm roles:', error);
    }
  };

  const filterMembers = () => {
    if (!memberSearchQuery.trim()) {
      setFilteredMembers(clubMembers);
    } else {
      const query = memberSearchQuery.toLowerCase().trim();
      setFilteredMembers(
        clubMembers.filter(member => 
          member.full_name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query)
        )
      );
    }
  };

  const updateRole = (roleKey: string, field: string, value: string | null) => {
    setExcommRoles(prev => prev.map(role => 
      role.key === roleKey ? { ...role, [field]: value } : role
    ));
  };

  const handleMemberSelect = (roleKey: string, memberId: string | null) => {
    updateRole(roleKey, 'member_id', memberId);
    setShowMemberModal(false);
    setSelectedRole(null);
    setMemberSearchQuery('');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return 'Select member';
    const member = clubMembers.find(m => m.id === memberId);
    return member?.full_name || 'Unknown member';
  };

  const getMemberAvatar = (memberId: string | null) => {
    if (!memberId) return null;
    const member = clubMembers.find(m => m.id === memberId);
    return member?.avatar_url || null;
  };

  const handleSave = async () => {
    if (!user?.currentClubId) {
      Alert.alert('Error', 'No club selected');
      return;
    }

    setIsSaving(true);

    try {
      // Prepare update data for club_profiles
      const updateData: Partial<ClubProfile> = {};
      
      excommRoles.forEach(role => {
        updateData[`${role.key}_id` as keyof ClubProfile] = role.member_id as any;
        updateData[`${role.key}_term_start` as keyof ClubProfile] = role.term_start as any;
        updateData[`${role.key}_term_end` as keyof ClubProfile] = role.term_end as any;
      });

      // Check if club profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('club_profiles')
        .select('id')
        .eq('club_id', user.currentClubId)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        // Create new club profile
        const { error: createError } = await supabase
          .from('club_profiles')
          .insert({
            club_id: user.currentClubId,
            ...updateData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any);

        if (createError) {
          console.error('Error creating club profile:', createError);
          Alert.alert('Error', 'Failed to save ExComm assignments');
          return;
        }
      } else if (checkError) {
        console.error('Error checking club profile:', checkError);
        Alert.alert('Error', 'Database error occurred');
        return;
      } else {
        // Update existing club profile
        const { error: updateError } = await supabase
          .from('club_profiles')
          .update({
            ...updateData,
            updated_at: new Date().toISOString()
          } as any)
          .eq('club_id', user.currentClubId);

        if (updateError) {
          console.error('Error updating club profile:', updateError);
          Alert.alert('Error', 'Failed to save ExComm assignments');
          return;
        }
      }

      Alert.alert('Success', 'ExComm assignments saved successfully!');
    } catch (error) {
      console.error('Error saving excomm roles:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={12} color="#ffffff" />;
      case 'visiting_tm': return <UserCheck size={12} color="#ffffff" />;
      case 'club_leader': return <Shield size={12} color="#ffffff" />;
      case 'guest': return <Eye size={12} color="#ffffff" />;
      case 'member': return <User size={12} color="#ffffff" />;
      default: return <User size={12} color="#ffffff" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return '#8b5cf6';
      case 'visiting_tm': return '#10b981';
      case 'club_leader': return '#f59e0b';
      case 'guest': return '#6b7280';
      case 'member': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const formatRole = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return 'ExComm';
      case 'visiting_tm': return 'Visiting TM';
      case 'club_leader': return 'Club Leader';
      case 'guest': return 'Guest';
      case 'member': return 'Member';
      default: return role;
    }
  };

  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const ExCommRoleCard = ({ role }: { role: ExCommRole }) => {
    const assignedMember = clubMembers.find(m => m.id === role.member_id);
    const isExpanded = expandedRole === role.key;

    return (
      <View style={[styles.roleCard, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.roleHeader}
          onPress={() => setExpandedRole(isExpanded ? null : role.key)}
          activeOpacity={0.7}
        >
          <View style={[styles.roleIcon, { backgroundColor: '#8b5cf6' + '20' }]}>
            <Crown size={20} color="#8b5cf6" />
          </View>
          <View style={styles.roleInfo}>
            <Text style={[styles.roleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{role.title}</Text>
            <Text style={[styles.roleDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {assignedMember ? assignedMember.full_name : 'No assignment'}
            </Text>
          </View>
          <ChevronDown
            size={20}
            color={theme.colors.textSecondary}
            style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {isExpanded && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            {/* Member Assignment */}
            <View style={styles.assignmentSection}>
              <Text style={[styles.sectionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Assigned Member</Text>
              <TouchableOpacity
                style={[styles.memberSelector, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => {
                  setSelectedRole(role.key);
                  setShowMemberModal(true);
                }}
              >
                <View style={styles.memberSelectorContent}>
                  {assignedMember ? (
                    <>
                      <View style={styles.memberAvatar}>
                        {assignedMember.avatar_url ? (
                          <Image source={{ uri: assignedMember.avatar_url }} style={styles.memberAvatarImage} />
                        ) : (
                          <User size={16} color="#ffffff" />
                        )}
                      </View>
                      <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {assignedMember.full_name}
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={[styles.memberAvatar, { backgroundColor: theme.colors.textSecondary }]}>
                        <User size={16} color="#ffffff" />
                      </View>
                      <Text style={[styles.memberName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Select member
                      </Text>
                    </>
                  )}
                </View>
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Term Dates */}
            <View style={styles.termSection}>
              <View style={styles.termRow}>
                <View style={styles.termField}>
                  <Text style={[styles.termLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Term Start</Text>
                  <TouchableOpacity
                    style={[styles.dateSelector, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                    onPress={() => {
                      setSelectedRole(role.key);
                      setTermType('start');
                      setTempDate(role.term_start ? new Date(role.term_start) : new Date());
                      setShowTermModal(true);
                    }}
                  >
                    <Calendar size={14} color={theme.colors.textSecondary} />
                    <Text style={[styles.dateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {formatDate(role.term_start)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.termField}>
                  <Text style={[styles.termLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Term End</Text>
                  <TouchableOpacity
                    style={[styles.dateSelector, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                    onPress={() => {
                      setSelectedRole(role.key);
                      setTermType('end');
                      setTempDate(role.term_end ? new Date(role.term_end) : new Date());
                      setShowTermModal(true);
                    }}
                  >
                    <Calendar size={14} color={theme.colors.textSecondary} />
                    <Text style={[styles.dateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {formatDate(role.term_end)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading ExComm data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>ExComm Management</Text>
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Save size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.clubHeader}>
              <View style={styles.clubInfo}>
                <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {clubInfo.name}
                </Text>
                <View style={styles.clubMeta}>
                  {clubInfo.club_number && (
                    <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Club #{clubInfo.club_number}
                    </Text>
                  )}
                  {user?.clubRole && (
                    <View style={[styles.roleTag, { backgroundColor: getRoleColor(user.clubRole) }]}>
                      {getRoleIcon(user.clubRole)}
                      <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>{formatRole(user.clubRole)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ExComm Roles Section */}
        <View style={styles.rolesSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Executive Committee Roles
          </Text>
          
          {excommRoles.map((role) => (
            <ExCommRoleCard key={role.key} role={role} />
          ))}
        </View>
      </ScrollView>

      {/* Member Selection Modal */}
      <Modal
        visible={showMemberModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMemberModal(false)}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerMemberModal, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border, borderTopLeftRadius: 20, borderTopRightRadius: 20 }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Member</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowMemberModal(false);
                  setMemberSearchQuery('');
                }}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Box */}
            <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Search size={16} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search members by name or email..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={memberSearchQuery}
                  onChangeText={setMemberSearchQuery}
                  autoCapitalize="none"
                />
              </View>
              <Text style={[styles.searchResultsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''} found
              </Text>
            </View>

            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              {/* None Option */}
              <TouchableOpacity
                style={[styles.memberOption, { backgroundColor: theme.colors.surface }]}
                onPress={() => handleMemberSelect(selectedRole!, null)}
              >
                <View style={[styles.memberOptionAvatar, { backgroundColor: theme.colors.textSecondary }]}>
                  <User size={20} color="#ffffff" />
                </View>
                <Text style={[styles.memberOptionName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No assignment
                </Text>
              </TouchableOpacity>

              {filteredMembers.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.memberOption, { backgroundColor: theme.colors.surface }]}
                  onPress={() => handleMemberSelect(selectedRole!, member.id)}
                >
                  <View style={styles.memberOptionAvatar}>
                    {member.avatar_url ? (
                      <Image source={{ uri: member.avatar_url }} style={styles.memberOptionAvatarImage} />
                    ) : (
                      <User size={20} color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.memberOptionInfo}>
                    <Text style={[styles.memberOptionName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                    <Text style={[styles.memberOptionEmail, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {member.email}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Term Date Modal - Web Only */}
      {Platform.OS === 'web' && (
        <Modal
          visible={showTermModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTermModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowTermModal(false)}
          >
            <TouchableOpacity
              style={[styles.termModal, { backgroundColor: theme.colors.surface }]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.datePickerContainer}>
                <input
                  type="date"
                  value={tempDate.toISOString().split('T')[0]}
                  onChange={(e: any) => {
                    const newDate = new Date(e.target.value);
                    if (!isNaN(newDate.getTime())) {
                      const formattedDate = newDate.toISOString().split('T')[0];
                      updateRole(selectedRole!, `term_${termType}`, formattedDate);
                      setShowTermModal(false);
                      setSelectedRole(null);
                    }
                  }}
                  style={{
                    fontSize: 16,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    width: '100%',
                    maxWidth: 250,
                  }}
                  autoFocus
                />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Native Date Picker - iOS/Android Only */}
      {Platform.OS !== 'web' && showTermModal && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            if (event.type === 'set' && selectedDate) {
              const formattedDate = selectedDate.toISOString().split('T')[0];
              updateRole(selectedRole!, `term_${termType}`, formattedDate);
            }
            setShowTermModal(false);
            setSelectedRole(null);
          }}
          textColor={theme.colors.text}
          themeVariant={theme.isDark ? 'dark' : 'light'}
        />
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
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
  saveButton: {
    padding: 10,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubNumber: {
    fontSize: 13,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  rolesSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  roleCard: {
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  assignmentSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  memberSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  memberSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
  },
  termSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  termRow: {
    flexDirection: 'row',
    gap: 12,
  },
  termField: {
    flex: 1,
  },
  termLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dateText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centerMemberModal: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    minHeight: '60%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  searchResultsText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  membersList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  memberOptionAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberOptionInfo: {
    flex: 1,
  },
  memberOptionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberOptionEmail: {
    fontSize: 13,
  },
  termModal: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  datePickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});