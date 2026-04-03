import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { ArrowLeft, Plus, Book, Calendar, Clock, MapPin, Upload, Save, X, Trash2, ExternalLink, Building2, Crown, User, Shield, Eye, UserCheck, Search, Filter, ChevronDown } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, KeyboardAvoidingView } from 'react-native';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_status: string;
}

interface MeetingMinutes {
  id: string;
  meeting_id: string;
  title: string;
  document_type: 'google_doc' | 'pdf_url' | 'pdf_file' | 'website_url';
  document_url: string | null;
  pdf_data: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface MinutesForm {
  title: string;
  document_type: 'pdf_url' | 'pdf_file' | 'website_url';
  document_url: string;
  pdf_data: string | null;
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

export default function MinutesManagement() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMinutes, setIsLoadingMinutes] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'pending' | 'available'>('pending');
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [meetingMinutes, setMeetingMinutes] = useState<{ [meetingId: string]: MeetingMinutes }>({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [existingMinutes, setExistingMinutes] = useState<MeetingMinutes | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'last_30' | 'last_90' | 'custom'>('last_30');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  const [minutesForm, setMinutesForm] = useState<MinutesForm>({
    title: '',
    document_type: 'pdf_url',
    document_url: '',
    pdf_data: null,
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setIsLoadingMinutes(true);
      
      await Promise.all([
        loadMeetings(),
        loadClubInfo(),
        loadMeetingMinutes()
      ]);
      
      setIsLoadingMinutes(false);
      setIsLoading(false);
    };
    
    loadData();
  }, []);

  useEffect(() => {
    // Only filter when minutes are loaded
    if (!isLoadingMinutes) {
      filterMeetings();
    }
  }, [meetings, selectedTab, searchQuery, dateFilter, customStartDate, customEndDate, meetingMinutes, isLoadingMinutes]);

  const loadMeetings = async () => {
    if (!user?.currentClubId) {
      return;
    }

    try {
      console.log('Loading meetings for club:', user.currentClubId);
      
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('club_id', user.currentClubId)
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error loading meetings:', error);
        Alert.alert('Error', `Failed to load meetings: ${error.message}`);
        return;
      }

      setMeetings(data || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading meetings');
    }
  };

  const loadMeetingMinutes = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('meeting_minutes')
        .select('*')
        .eq('club_id', user.currentClubId);

      if (error) {
        console.error('Error loading meeting minutes:', error);
        return;
      }

      // Create a map of meeting_id to minutes
      const minutesMap: { [meetingId: string]: MeetingMinutes } = {};
      (data || []).forEach(minutes => {
        minutesMap[minutes.meeting_id] = minutes;
      });
      
      setMeetingMinutes(minutesMap);
    } catch (error) {
      console.error('Error loading meeting minutes:', error);
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

  const filterMeetings = () => {
    console.log('Filtering meetings:', {
      totalMeetings: meetings.length,
      minutesLoaded: Object.keys(meetingMinutes).length,
      selectedTab,
      searchQuery: searchQuery.trim()
    });
    
    let filtered = meetings;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(meeting => 
        meeting.meeting_title?.toLowerCase().includes(query) ||
        (meeting.meeting_number && meeting.meeting_number.toLowerCase().includes(query))
      );
    }
    
    // Apply date filter
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    
    switch (dateFilter) {
      case 'last_30':
        filtered = filtered.filter(meeting => new Date(meeting.meeting_date) >= thirtyDaysAgo);
        break;
      case 'last_90':
        filtered = filtered.filter(meeting => new Date(meeting.meeting_date) >= ninetyDaysAgo);
        break;
      case 'custom':
        const startDate = new Date(customStartDate);
        const endDate = new Date(customEndDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(meeting => {
          const meetingDate = new Date(meeting.meeting_date);
          return meetingDate >= startDate && meetingDate <= endDate;
        });
        break;
      case 'all':
      default:
        // No date filtering
        break;
    }
    
    // Apply minutes status filter
    if (selectedTab === 'pending') {
      // Show meetings without minutes (pending minutes upload)
      const pendingMeetings = filtered.filter(m => !meetingMinutes[m.id]);
      console.log('Pending meetings:', pendingMeetings.length);
      setFilteredMeetings(pendingMeetings);
    } else {
      // Show meetings with minutes (minutes available)
      const availableMeetings = filtered.filter(m => meetingMinutes[m.id]);
      console.log('Available meetings:', availableMeetings.length);
      setFilteredMeetings(availableMeetings);
    }
  };

  const handleUploadMinutes = async (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    
    // Check if minutes already exist
    try {
      const { data, error } = await supabase
        .from('meeting_minutes')
        .select('*')
        .eq('meeting_id', meeting.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking existing minutes:', error);
      }

      if (data) {
        setExistingMinutes(data);
        setMinutesForm({
          title: data.title,
          document_type: data.document_type as any,
          document_url: data.document_url || '',
          pdf_data: data.pdf_data,
        });
      } else {
        setExistingMinutes(null);
        setMinutesForm({
          title: `Meeting Minutes - ${new Date(meeting.meeting_date).toLocaleDateString()}`,
          document_type: 'pdf_url',
          document_url: '',
          pdf_data: null,
        });
      }
    } catch (error) {
      console.error('Error loading existing minutes:', error);
    }
    
    setShowUploadModal(true);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onload = () => {
          const base64Data = reader.result as string;
          setMinutesForm(prev => ({
            ...prev,
            pdf_data: base64Data,
            document_url: asset.name || 'minutes.pdf'
          }));
        };
        
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const validateForm = (): boolean => {
    if (!minutesForm.title.trim()) {
      Alert.alert('Error', 'Please enter a minutes title');
      return false;
    }

    if (minutesForm.document_type === 'pdf_url' || minutesForm.document_type === 'website_url') {
      if (!minutesForm.document_url.trim()) {
        Alert.alert('Error', 'Please enter a document URL');
        return false;
      }
      
      try {
        new URL(minutesForm.document_url.trim());
      } catch {
        Alert.alert('Error', 'Please enter a valid URL');
        return false;
      }
    }

    if (minutesForm.document_type === 'pdf_file' && !minutesForm.pdf_data) {
      Alert.alert('Error', 'Please select a PDF file to upload');
      return false;
    }

    return true;
  };

  const handleSaveMinutes = async () => {
    if (!validateForm() || !selectedMeeting || !user?.currentClubId) return;

    setIsSaving(true);
    
    try {
      const saveData = {
        meeting_id: selectedMeeting.id,
        created_by: user.id,
        club_id: user.currentClubId,
        title: minutesForm.title.trim(),
        document_type: minutesForm.document_type,
        document_url: (minutesForm.document_type === 'pdf_url' || minutesForm.document_type === 'website_url') 
          ? minutesForm.document_url.trim() 
          : null,
        pdf_data: minutesForm.document_type === 'pdf_file' ? minutesForm.pdf_data : null,
      };

      if (existingMinutes) {
        // Update existing minutes
        const { error } = await supabase
          .from('meeting_minutes')
          .update({
            ...saveData,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existingMinutes.id);

        if (error) {
          console.error('Error updating minutes:', error);
          Alert.alert('Error', 'Failed to update minutes');
          return;
        }

        Alert.alert('Success', 'Meeting minutes updated successfully');
      } else {
        // Create new minutes
        const { error } = await supabase
          .from('meeting_minutes')
          .insert(saveData as any);

        if (error) {
          console.error('Error creating minutes:', error);
          Alert.alert('Error', 'Failed to upload minutes');
          return;
        }

        Alert.alert('Success', 'Meeting minutes uploaded successfully');
      }

      setShowUploadModal(false);
      setSelectedMeeting(null);
      setExistingMinutes(null);
      
      // Reload minutes to update the filtering
      loadMeetingMinutes();
    } catch (error) {
      console.error('Error saving minutes:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setShowUploadModal(false);
    setSelectedMeeting(null);
    setExistingMinutes(null);
    setMinutesForm({
      title: '',
      document_type: 'pdf_url',
      document_url: '',
      pdf_data: null,
    });
  };

  const updateFormField = (field: keyof MinutesForm, value: any) => {
    setMinutesForm(prev => ({ ...prev, [field]: value }));
  };

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case 'last_30': return 'Last 30 days';
      case 'last_90': return 'Last 90 days';
      case 'custom': return `${customStartDate.toLocaleDateString()} - ${customEndDate.toLocaleDateString()}`;
      case 'all': return 'All time';
      default: return 'Last 30 days';
    }
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setCustomStartDate(selectedDate);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setCustomEndDate(selectedDate);
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
      case 'excomm': return EXCOMM_UI.solidBg;
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

  const MeetingCard = ({ meeting, hasMinutes }: { meeting: Meeting; hasMinutes: boolean }) => (
    <View style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.meetingHeader}>
        <View style={styles.meetingInfo}>
          <Text style={[styles.meetingTitle, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {meeting.meeting_title}
          </Text>
          <View style={styles.meetingMeta}>
            <View style={styles.meetingDate}>
              <Calendar size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.meetingDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {new Date(meeting.meeting_date).toLocaleDateString()}
              </Text>
            </View>
            {meeting.meeting_number && (
              <View style={styles.meetingNumber}>
                <Text style={[styles.meetingNumberText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  #{meeting.meeting_number}
                </Text>
              </View>
            )}
            <View style={[
              styles.statusTag,
              { backgroundColor: hasMinutes ? '#10b981' + '20' : '#f59e0b' + '20' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: hasMinutes ? '#10b981' : '#f59e0b' }
              ]} maxFontSizeMultiplier={1.3}>
                {hasMinutes ? 'Available' : 'Pending'}
              </Text>
            </View>
          </View>
          
          {meeting.meeting_start_time && (
            <View style={styles.meetingTime}>
              <Clock size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.meetingTimeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {meeting.meeting_start_time}
                {meeting.meeting_end_time && ` - ${meeting.meeting_end_time}`}
              </Text>
            </View>
          )}
          
          <View style={styles.meetingMode}>
            <MapPin size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.meetingModeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {meeting.meeting_mode === 'in_person' ? 'In Person' : 
               meeting.meeting_mode === 'online' ? 'Online' : 'Hybrid'}
            </Text>
          </View>
        </View>
        
        <View style={styles.meetingActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: hasMinutes ? '#f0fdf4' : '#fef3c7' }]}
            onPress={() => handleUploadMinutes(meeting)}
            activeOpacity={0.7}
          >
            <Upload size={14} color={hasMinutes ? '#10b981' : '#f59e0b'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading meetings...</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Minutes Management</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.clubHeader}>
              <View style={[styles.clubIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Building2 size={20} color={theme.colors.primary} />
              </View>
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

        {/* Search and Filter Section */}
        <View style={styles.searchFilterSection}>
          {/* Search Box */}
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Search size={16} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Meeting number"
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Date Filter */}
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => setShowDateFilter(true)}
          >
            <Filter size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.filterButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {getDateFilterLabel()}
            </Text>
            <ChevronDown size={14} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === 'pending' ? '#f59e0b' : theme.colors.surface,
                borderColor: selectedTab === 'pending' ? '#f59e0b' : theme.colors.border,
              }
            ]}
            onPress={() => setSelectedTab('pending')}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'pending' ? '#ffffff' : theme.colors.text }
            ]} maxFontSizeMultiplier={1.3}>
              Minutes Pending
            </Text>
            <View style={[
              styles.tabCount,
              { backgroundColor: selectedTab === 'pending' ? 'rgba(255, 255, 255, 0.2)' : '#f59e0b' + '20' }
            ]}>
              <Text style={[
                styles.tabCountText,
                { color: selectedTab === 'pending' ? '#ffffff' : '#f59e0b' }
              ]} maxFontSizeMultiplier={1.3}>
                {isLoadingMinutes ? '...' : meetings.filter(m => !meetingMinutes[m.id]).length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === 'available' ? '#10b981' : theme.colors.surface,
                borderColor: selectedTab === 'available' ? '#10b981' : theme.colors.border,
              }
            ]}
            onPress={() => setSelectedTab('available')}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'available' ? '#ffffff' : theme.colors.text }
            ]} maxFontSizeMultiplier={1.3}>
              Minutes Available
            </Text>
            <View style={[
              styles.tabCount,
              { backgroundColor: selectedTab === 'available' ? 'rgba(255, 255, 255, 0.2)' : '#10b981' + '20' }
            ]}>
              <Text style={[
                styles.tabCountText,
                { color: selectedTab === 'available' ? '#ffffff' : '#10b981' }
              ]} maxFontSizeMultiplier={1.3}>
                {isLoadingMinutes ? '...' : meetings.filter(m => meetingMinutes[m.id]).length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Meetings List */}
        <View style={styles.meetingsSection}>
          {isLoadingMinutes ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading minutes data...</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {selectedTab === 'pending' ? 'Meetings Pending Minutes' : 'Meetings with Minutes Available'} ({filteredMeetings.length})
              </Text>
              
              {filteredMeetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} hasMinutes={!!meetingMinutes[meeting.id]} />
              ))}

              {filteredMeetings.length === 0 && (
                <View style={styles.emptyState}>
                  <Calendar size={48} color={theme.colors.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    No meetings {selectedTab === 'pending' ? 'pending minutes upload' : 'with minutes available'}
                  </Text>
                  <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {selectedTab === 'pending' 
                      ? 'Meetings without minutes will appear here'
                      : 'Meetings with uploaded minutes will appear here'
                    }
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Upload Minutes Modal */}
      <Modal
        visible={showUploadModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerUploadModal, { backgroundColor: theme.colors.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {existingMinutes ? 'Update Meeting Minutes' : 'Upload Meeting Minutes'}
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Meeting Info */}
              {selectedMeeting && (
                <View style={[styles.meetingInfoCard, { backgroundColor: '#e0f2fe' }]}>
                  <Text style={[styles.meetingInfoTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {selectedMeeting.meeting_title}
                  </Text>
                  <Text style={[styles.meetingInfoDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {new Date(selectedMeeting.meeting_date).toLocaleDateString()}
                  </Text>
                </View>
              )}

              {/* Minutes Title */}
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Minutes Title *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g., Meeting Minutes - January 15, 2024"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={minutesForm.title}
                  onChangeText={(text) => updateFormField('title', text)}
                />
              </View>

              {/* Document Type Selection */}
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Document Type *</Text>
                
                <TouchableOpacity
                  style={[
                    styles.documentTypeOption,
                    {
                      backgroundColor: minutesForm.document_type === 'pdf_url' ? '#fef2f2' : theme.colors.surface,
                      borderColor: minutesForm.document_type === 'pdf_url' ? '#ef4444' : theme.colors.border,
                    }
                  ]}
                  onPress={() => updateFormField('document_type', 'pdf_url')}
                >
                  <View style={[styles.radioButton, { borderColor: minutesForm.document_type === 'pdf_url' ? '#ef4444' : theme.colors.border }]}>
                    {minutesForm.document_type === 'pdf_url' && (
                      <View style={[styles.radioButtonInner, { backgroundColor: '#ef4444' }]} />
                    )}
                  </View>
                  <Book size={16} color="#ef4444" />
                  <Text style={[styles.documentTypeLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    PDF URL
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.documentTypeOption,
                    {
                      backgroundColor: minutesForm.document_type === 'pdf_file' ? '#f0fdf4' : theme.colors.surface,
                      borderColor: minutesForm.document_type === 'pdf_file' ? '#10b981' : theme.colors.border,
                    }
                  ]}
                  onPress={() => updateFormField('document_type', 'pdf_file')}
                >
                  <View style={[styles.radioButton, { borderColor: minutesForm.document_type === 'pdf_file' ? '#10b981' : theme.colors.border }]}>
                    {minutesForm.document_type === 'pdf_file' && (
                      <View style={[styles.radioButtonInner, { backgroundColor: '#10b981' }]} />
                    )}
                  </View>
                  <Upload size={16} color="#10b981" />
                  <Text style={[styles.documentTypeLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Upload PDF File
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.documentTypeOption,
                    {
                      backgroundColor: minutesForm.document_type === 'website_url' ? '#f3e8ff' : theme.colors.surface,
                      borderColor: minutesForm.document_type === 'website_url' ? '#8b5cf6' : theme.colors.border,
                    }
                  ]}
                  onPress={() => updateFormField('document_type', 'website_url')}
                >
                  <View style={[styles.radioButton, { borderColor: minutesForm.document_type === 'website_url' ? '#8b5cf6' : theme.colors.border }]}>
                    {minutesForm.document_type === 'website_url' && (
                      <View style={[styles.radioButtonInner, { backgroundColor: '#8b5cf6' }]} />
                    )}
                  </View>
                  <ExternalLink size={16} color="#8b5cf6" />
                  <Text style={[styles.documentTypeLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Website Link
                  </Text>
                </TouchableOpacity>
              </View>

              {/* URL Input for PDF URL and Website Link */}
              {(minutesForm.document_type === 'pdf_url' || minutesForm.document_type === 'website_url') && (
                <View style={styles.formField}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {minutesForm.document_type === 'pdf_url' ? 'PDF URL *' : 'Website Link *'}
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="https://example.com/minutes.pdf"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={minutesForm.document_url}
                    onChangeText={(text) => updateFormField('document_url', text)}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {/* PDF File Upload */}
              {minutesForm.document_type === 'pdf_file' && (
                <View style={styles.formField}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>PDF File *</Text>
                  <TouchableOpacity
                    style={[styles.filePickerButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={handlePickDocument}
                  >
                    <Upload size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.filePickerText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {minutesForm.pdf_data ? 'PDF Selected' : 'Select PDF File'}
                    </Text>
                  </TouchableOpacity>
                  {minutesForm.pdf_data && (
                    <Text style={[styles.fileSelectedText, { color: theme.colors.success }]} maxFontSizeMultiplier={1.3}>
                      ✓ PDF file selected
                    </Text>
                  )}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                  onPress={handleCloseModal}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.uploadButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSaveMinutes}
                  disabled={isSaving}
                >
                  <Upload size={16} color="#ffffff" />
                  <Text style={styles.uploadButtonText} maxFontSizeMultiplier={1.3}>
                    {isSaving ? 'Uploading...' : (existingMinutes ? 'Update Minutes' : 'Upload Minutes')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilter}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDateFilter(false)}
      >
        <TouchableOpacity 
          style={styles.dateFilterOverlay}
          onPress={() => setShowDateFilter(false)}
        >
          <View style={[styles.dateFilterModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.dateFilterTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Filter by Date</Text>
            
            <TouchableOpacity
              style={[
                styles.dateFilterOption,
                dateFilter === 'all' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => {
                setDateFilter('all');
                setShowDateFilter(false);
              }}
            >
              <Text style={[
                styles.dateFilterOptionText,
                { color: dateFilter === 'all' ? theme.colors.primary : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                All Time
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateFilterOption,
                dateFilter === 'last_30' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => {
                setDateFilter('last_30');
                setShowDateFilter(false);
              }}
            >
              <Text style={[
                styles.dateFilterOptionText,
                { color: dateFilter === 'last_30' ? theme.colors.primary : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Last 30 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateFilterOption,
                dateFilter === 'last_90' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => {
                setDateFilter('last_90');
                setShowDateFilter(false);
              }}
            >
              <Text style={[
                styles.dateFilterOptionText,
                { color: dateFilter === 'last_90' ? theme.colors.primary : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Last 90 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateFilterOption,
                dateFilter === 'custom' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => setDateFilter('custom')}
            >
              <Text style={[
                styles.dateFilterOptionText,
                { color: dateFilter === 'custom' ? theme.colors.primary : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Custom Range
              </Text>
            </TouchableOpacity>

            {dateFilter === 'custom' && (
              <View style={styles.customDateRange}>
                <View style={styles.dateRangeRow}>
                  <View style={styles.dateRangeField}>
                    <Text style={[styles.dateRangeLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>From</Text>
                    <TouchableOpacity
                      style={[styles.dateRangeButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                      onPress={() => setShowStartDatePicker(true)}
                    >
                      <Calendar size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.dateRangeButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {customStartDate.toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dateRangeField}>
                    <Text style={[styles.dateRangeLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>To</Text>
                    <TouchableOpacity
                      style={[styles.dateRangeButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                      onPress={() => setShowEndDatePicker(true)}
                    >
                      <Calendar size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.dateRangeButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {customEndDate.toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.applyDateRangeButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => setShowDateFilter(false)}
                >
                  <Text style={styles.applyDateRangeButtonText} maxFontSizeMultiplier={1.3}>Apply Date Range</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={customStartDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartDateChange}
          maximumDate={customEndDate}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={customEndDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndDateChange}
          minimumDate={customStartDate}
          maximumDate={new Date()}
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIcon: {
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
  searchFilterSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 6,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  tabCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  meetingsSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  meetingCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  meetingInfo: {
    flex: 1,
    marginRight: 12,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  meetingDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingDateText: {
    fontSize: 12,
    marginLeft: 4,
  },
  meetingNumber: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingNumberText: {
    fontSize: 12,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  meetingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingTimeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  meetingMode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingModeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  meetingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centerUploadModal: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  meetingInfoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  meetingInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  meetingInfoDate: {
    fontSize: 14,
  },
  formField: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  documentTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  documentTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  filePickerText: {
    fontSize: 14,
    marginLeft: 8,
  },
  fileSelectedText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 20,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 14,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  dateFilterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFilterModal: {
    borderRadius: 16,
    padding: 20,
    margin: 20,
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  dateFilterTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  dateFilterOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  dateFilterOptionText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  customDateRange: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateRangeField: {
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dateRangeButtonText: {
    fontSize: 12,
    marginLeft: 6,
  },
  applyDateRangeButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyDateRangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});