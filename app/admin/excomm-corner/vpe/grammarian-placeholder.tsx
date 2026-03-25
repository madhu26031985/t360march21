import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Calendar,
  Save,
  AlertCircle,
  UserX,
  Building2,
  ChevronRight,
  Hash,
  X,
  BookOpen,
  Quote,
  Lightbulb,
} from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Meeting {
  id: string;
  meeting_date: string;
  meeting_number: number;
  meeting_status: string;
}

interface WordOfTheDay {
  id: string;
  word: string;
  part_of_speech: string | null;
  meaning: string | null;
  usage: string | null;
  is_published: boolean;
}

interface QuoteOfTheDay {
  id: string;
  quote: string;
  meaning: string | null;
  usage: string | null;
  is_published: boolean;
}

interface IdiomOfTheDay {
  id: string;
  idiom: string;
  meaning: string | null;
  usage: string | null;
  is_published: boolean;
}

interface AssignedUser {
  id: string;
  full_name: string;
}

export default function GrammarianPlaceholder() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isVPE, setIsVPE] = useState(false);
  const [assignedUser, setAssignedUser] = useState<AssignedUser | null>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(false);

  const [wordData, setWordData] = useState<WordOfTheDay | null>(null);
  const [word, setWord] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [wordMeaning, setWordMeaning] = useState('');
  const [wordUsage, setWordUsage] = useState('');

  const [quoteData, setQuoteData] = useState<QuoteOfTheDay | null>(null);
  const [quote, setQuote] = useState('');
  const [quoteMeaning, setQuoteMeaning] = useState('');
  const [quoteUsage, setQuoteUsage] = useState('');

  const [idiomData, setIdiomData] = useState<IdiomOfTheDay | null>(null);
  const [idiom, setIdiom] = useState('');
  const [idiomMeaning, setIdiomMeaning] = useState('');
  const [idiomUsage, setIdiomUsage] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id || !user?.currentClubId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await checkVPEStatus();
        await fetchMeetings();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user?.currentClubId, user?.id]);

  const checkVPEStatus = async () => {
    if (!user?.id || !user?.currentClubId) return;
    try {
      const { data: clubProfile, error } = await supabase
        .from('club_profiles')
        .select('vpe_id')
        .eq('club_id', user.currentClubId)
        .maybeSingle();
      if (error) throw error;
      setIsVPE(clubProfile?.vpe_id === user.id);
    } catch (error) {
      console.error('Error checking VPE status:', error);
      setIsVPE(false);
    }
  };

  const fetchMeetings = async () => {
    if (!user?.currentClubId) return;
    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('id, meeting_date, meeting_number, meeting_status')
        .eq('club_id', user.currentClubId)
        .order('meeting_date', { ascending: false });
      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    }
  };

  const resetForm = () => {
    setWordData(null);
    setWord('');
    setPartOfSpeech('');
    setWordMeaning('');
    setWordUsage('');
    setQuoteData(null);
    setQuote('');
    setQuoteMeaning('');
    setQuoteUsage('');
    setIdiomData(null);
    setIdiom('');
    setIdiomMeaning('');
    setIdiomUsage('');
  };

  const handleMeetingSelect = async (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setLoadingMeeting(true);
    setAssignedUser(null);
    resetForm();

    try {
      const { data: grammarianRoleData, error: roleError } = await supabase
        .from('app_meeting_roles_management')
        .select('assigned_user_id, app_user_profiles(id, full_name)')
        .eq('meeting_id', meeting.id)
        .ilike('role_name', '%grammarian%')
        .eq('booking_status', 'booked')
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') throw roleError;

      if (grammarianRoleData?.assigned_user_id) {
        const profile = grammarianRoleData.app_user_profiles as any;
        setAssignedUser({
          id: grammarianRoleData.assigned_user_id,
          full_name: profile?.full_name || 'Unknown',
        });
      }

      const [wordRes, quoteRes, idiomRes] = await Promise.all([
        supabase
          .from('grammarian_word_of_the_day')
          .select('*')
          .eq('meeting_id', meeting.id)
          .maybeSingle(),
        supabase
          .from('grammarian_quote_of_the_day')
          .select('*')
          .eq('meeting_id', meeting.id)
          .maybeSingle(),
        supabase
          .from('grammarian_idiom_of_the_day')
          .select('*')
          .eq('meeting_id', meeting.id)
          .maybeSingle(),
      ]);

      if (wordRes.data) {
        setWordData(wordRes.data);
        setWord(wordRes.data.word || '');
        setPartOfSpeech(wordRes.data.part_of_speech || '');
        setWordMeaning((wordRes.data.meaning || '').slice(0, 150));
        setWordUsage((wordRes.data.usage || '').slice(0, 150));
      }
      if (quoteRes.data) {
        setQuoteData(quoteRes.data);
        setQuote(quoteRes.data.quote || '');
        setQuoteMeaning(quoteRes.data.meaning || '');
        setQuoteUsage(quoteRes.data.usage || '');
      }
      if (idiomRes.data) {
        setIdiomData(idiomRes.data);
        setIdiom(idiomRes.data.idiom || '');
        setIdiomMeaning((idiomRes.data.meaning || '').slice(0, 150));
        setIdiomUsage((idiomRes.data.usage || '').slice(0, 150));
      }
    } catch (error) {
      console.error('Error loading meeting data:', error);
    } finally {
      setLoadingMeeting(false);
    }
  };

  const getGrammarianUserId = async (meetingId: string) => {
    const { data } = await supabase
      .from('app_meeting_roles_management')
      .select('assigned_user_id')
      .eq('meeting_id', meetingId)
      .ilike('role_name', '%grammarian%')
      .eq('booking_status', 'booked')
      .maybeSingle();
    return data?.assigned_user_id || user!.id;
  };

  const handleSave = async () => {
    if (!selectedMeeting || !user?.id || !user?.currentClubId) return;

    if (!word.trim() && !quote.trim() && !idiom.trim()) {
      Alert.alert('Error', 'Please fill in at least one section (Word, Quote, or Idiom)');
      return;
    }

    try {
      setSaving(true);
      const grammarianUserId = await getGrammarianUserId(selectedMeeting.id);

      if (word.trim()) {
        if (wordData) {
          await supabase
            .from('grammarian_word_of_the_day')
            .update({
              word: word.trim(),
              part_of_speech: partOfSpeech.trim() || null,
              meaning: wordMeaning.trim() || null,
              usage: wordUsage.trim() || null,
              is_published: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', wordData.id);
        } else {
          const { data: inserted } = await supabase
            .from('grammarian_word_of_the_day')
            .insert({
              meeting_id: selectedMeeting.id,
              club_id: user.currentClubId,
              grammarian_user_id: grammarianUserId,
              word: word.trim(),
              part_of_speech: partOfSpeech.trim() || null,
              meaning: wordMeaning.trim() || null,
              usage: wordUsage.trim() || null,
              is_published: true,
            })
            .select()
            .single();
          if (inserted) setWordData(inserted);
        }
      }

      if (quote.trim()) {
        if (quoteData) {
          await supabase
            .from('grammarian_quote_of_the_day')
            .update({
              quote: quote.trim(),
              meaning: quoteMeaning.trim() || null,
              usage: quoteUsage.trim() || null,
              is_published: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', quoteData.id);
        } else {
          const { data: inserted } = await supabase
            .from('grammarian_quote_of_the_day')
            .insert({
              meeting_id: selectedMeeting.id,
              club_id: user.currentClubId,
              grammarian_user_id: grammarianUserId,
              quote: quote.trim(),
              meaning: quoteMeaning.trim() || null,
              usage: quoteUsage.trim() || null,
              is_published: true,
            })
            .select()
            .single();
          if (inserted) setQuoteData(inserted);
        }
      }

      if (idiom.trim()) {
        if (idiomData) {
          await supabase
            .from('grammarian_idiom_of_the_day')
            .update({
              idiom: idiom.trim(),
              meaning: idiomMeaning.trim() || null,
              usage: idiomUsage.trim() || null,
              is_published: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', idiomData.id);
        } else {
          const { data: inserted } = await supabase
            .from('grammarian_idiom_of_the_day')
            .insert({
              meeting_id: selectedMeeting.id,
              club_id: user.currentClubId,
              grammarian_user_id: grammarianUserId,
              idiom: idiom.trim(),
              meaning: idiomMeaning.trim() || null,
              usage: idiomUsage.trim() || null,
              is_published: true,
            })
            .select()
            .single();
          if (inserted) setIdiomData(inserted);
        }
      }

      Alert.alert('Success', 'Grammarian data saved successfully');
      await handleMeetingSelect(selectedMeeting);
    } catch (error: any) {
      console.error('Error saving grammarian data:', error);
      Alert.alert('Error', error.message || 'Failed to save grammarian data');
    } finally {
      setSaving(false);
    }
  };

  const handleClearSection = async (section: 'word' | 'quote' | 'idiom') => {
    if (!selectedMeeting) return;
    const titles: Record<string, string> = { word: 'Word of the Day', quote: 'Quote of the Day', idiom: 'Idiom of the Day' };
    Alert.alert(
      `Clear ${titles[section]}`,
      'This will clear all fields for this section. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            if (section === 'word') {
              setWord(''); setPartOfSpeech(''); setWordMeaning(''); setWordUsage('');
              if (wordData) {
                await supabase.from('grammarian_word_of_the_day')
                  .update({ word: '', part_of_speech: null, meaning: null, usage: null, is_published: false, updated_at: new Date().toISOString() })
                  .eq('id', wordData.id);
              }
            } else if (section === 'quote') {
              setQuote(''); setQuoteMeaning(''); setQuoteUsage('');
              if (quoteData) {
                await supabase.from('grammarian_quote_of_the_day')
                  .update({ quote: '', meaning: null, usage: null, is_published: false, updated_at: new Date().toISOString() })
                  .eq('id', quoteData.id);
              }
            } else if (section === 'idiom') {
              setIdiom(''); setIdiomMeaning(''); setIdiomUsage('');
              if (idiomData) {
                await supabase.from('grammarian_idiom_of_the_day')
                  .update({ idiom: '', meaning: null, usage: null, is_published: false, updated_at: new Date().toISOString() })
                  .eq('id', idiomData.id);
              }
            }
            await handleMeetingSelect(selectedMeeting);
          },
        },
      ]
    );
  };

  const currentClub = user?.clubs?.find(club => club.id === user?.currentClubId);
  const clubName = currentClub?.name || 'Unknown Club';

  const renderHeader = (showActions = false) => (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => selectedMeeting ? setSelectedMeeting(null) : router.back()}
      >
        <ArrowLeft size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
        Backdoor - Grammarian
      </Text>
      {showActions ? (
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.actionBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Save size={18} color="#ffffff" />
            <Text style={styles.actionBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isVPE) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {renderHeader()}
        <View style={styles.centerContainer}>
          <AlertCircle size={64} color={theme.colors.error} />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Access Denied</Text>
          <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>
            Only VPE can access this backdoor placeholder entry.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedMeeting) {
    const meetingDate = new Date(selectedMeeting.meeting_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (loadingMeeting) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
          {renderHeader()}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading meeting data...</Text>
          </View>
        </SafeAreaView>
      );
    }

    if (!assignedUser) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
          {renderHeader()}
          <View style={styles.centerContainer}>
            <UserX size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Grammarian is not booked.</Text>
            <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
              No one has been assigned as Grammarian for Meeting #{selectedMeeting.meeting_number}.
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        {renderHeader(true)}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.meetingBadge, { backgroundColor: selectedMeeting.meeting_status === 'open' ? '#10b981' + '15' : theme.colors.border }]}>
              <Calendar size={16} color={selectedMeeting.meeting_status === 'open' ? '#10b981' : theme.colors.textSecondary} />
              <Text style={[styles.meetingBadgeText, { color: selectedMeeting.meeting_status === 'open' ? '#10b981' : theme.colors.textSecondary }]}>
                {selectedMeeting.meeting_status === 'open' ? 'Open Meeting' : 'Closed Meeting'}
              </Text>
            </View>
            <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Meeting #{selectedMeeting.meeting_number}
            </Text>
            <Text style={[styles.meetingDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {meetingDate}
            </Text>
          </View>

          <View style={[styles.assignedUserCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.assignedUserLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Assigned Grammarian
            </Text>
            <Text style={[styles.assignedUserName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {assignedUser.full_name}
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: '#3b82f6' + '10', borderColor: '#3b82f6' + '30' }]}>
            <Text style={[styles.infoText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Backdoor entry for VPE. Fill in sections and tap Save — content is saved and made visible to members immediately.
            </Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: '#3b82f6' + '15' }]}>
                <BookOpen size={20} color="#3b82f6" />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Word of the Day
              </Text>
              {(word || partOfSpeech || wordMeaning || wordUsage) && (
                <TouchableOpacity
                  style={[styles.clearSectionBtn, { borderColor: theme.colors.border }]}
                  onPress={() => handleClearSection('word')}
                >
                  <X size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.clearSectionBtnText, { color: theme.colors.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Word
              </Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="Enter the word of the day"
                placeholderTextColor={theme.colors.textSecondary}
                value={word}
                onChangeText={(t) => t.length <= 50 && setWord(t)}
                maxLength={50}
              />
              <Text style={[styles.charCount, { color: word.length >= 50 ? theme.colors.error : theme.colors.textSecondary }]}>
                {word.length}/50
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Part of Speech
              </Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="e.g., noun, verb, adjective..."
                placeholderTextColor={theme.colors.textSecondary}
                value={partOfSpeech}
                onChangeText={(t) => t.length <= 50 && setPartOfSpeech(t)}
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Meaning
              </Text>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="What does this word mean?"
                placeholderTextColor={theme.colors.textSecondary}
                value={wordMeaning}
                onChangeText={(t) => t.length <= 150 && setWordMeaning(t)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={150}
              />
              <Text style={[styles.charCount, { color: wordMeaning.length >= 150 ? theme.colors.error : theme.colors.textSecondary }]}>
                {wordMeaning.length}/150
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Usage Example
              </Text>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="Show how to use this word in a sentence"
                placeholderTextColor={theme.colors.textSecondary}
                value={wordUsage}
                onChangeText={(t) => t.length <= 150 && setWordUsage(t)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={150}
              />
              <Text style={[styles.charCount, { color: wordUsage.length >= 150 ? theme.colors.error : theme.colors.textSecondary }]}>
                {wordUsage.length}/150
              </Text>
            </View>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: '#f59e0b' + '15' }]}>
                <Quote size={20} color="#f59e0b" />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Quote of the Day
              </Text>
              {(quote || quoteMeaning || quoteUsage) && (
                <TouchableOpacity
                  style={[styles.clearSectionBtn, { borderColor: theme.colors.border }]}
                  onPress={() => handleClearSection('quote')}
                >
                  <X size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.clearSectionBtnText, { color: theme.colors.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Quote
              </Text>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="Enter an inspiring or meaningful quote"
                placeholderTextColor={theme.colors.textSecondary}
                value={quote}
                onChangeText={(t) => t.length <= 400 && setQuote(t)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={400}
              />
              <Text style={[styles.charCount, { color: quote.length >= 400 ? theme.colors.error : theme.colors.textSecondary }]}>
                {quote.length}/400
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Meaning / Context
              </Text>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="What does this quote mean or why was it chosen?"
                placeholderTextColor={theme.colors.textSecondary}
                value={quoteMeaning}
                onChangeText={(t) => t.length <= 400 && setQuoteMeaning(t)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={400}
              />
              <Text style={[styles.charCount, { color: quoteMeaning.length >= 400 ? theme.colors.error : theme.colors.textSecondary }]}>
                {quoteMeaning.length}/400
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                How to Apply
              </Text>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="How can members apply this quote in their speeches or daily life?"
                placeholderTextColor={theme.colors.textSecondary}
                value={quoteUsage}
                onChangeText={(t) => t.length <= 400 && setQuoteUsage(t)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={400}
              />
              <Text style={[styles.charCount, { color: quoteUsage.length >= 400 ? theme.colors.error : theme.colors.textSecondary }]}>
                {quoteUsage.length}/400
              </Text>
            </View>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: '#10b981' + '15' }]}>
                <Lightbulb size={20} color="#10b981" />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Idiom of the Day
              </Text>
              {(idiom || idiomMeaning || idiomUsage) && (
                <TouchableOpacity
                  style={[styles.clearSectionBtn, { borderColor: theme.colors.border }]}
                  onPress={() => handleClearSection('idiom')}
                >
                  <X size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.clearSectionBtnText, { color: theme.colors.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Idiom
              </Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="Enter an idiom or phrase"
                placeholderTextColor={theme.colors.textSecondary}
                value={idiom}
                onChangeText={(t) => t.length <= 200 && setIdiom(t)}
                maxLength={200}
              />
              <Text style={[styles.charCount, { color: idiom.length >= 200 ? theme.colors.error : theme.colors.textSecondary }]}>
                {idiom.length}/200
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Meaning
              </Text>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="What does this idiom mean?"
                placeholderTextColor={theme.colors.textSecondary}
                value={idiomMeaning}
                onChangeText={(t) => t.length <= 150 && setIdiomMeaning(t)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={150}
              />
              <Text style={[styles.charCount, { color: idiomMeaning.length >= 150 ? theme.colors.error : theme.colors.textSecondary }]}>
                {idiomMeaning.length}/150
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Usage Example
              </Text>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="Show how to use this idiom in a sentence"
                placeholderTextColor={theme.colors.textSecondary}
                value={idiomUsage}
                onChangeText={(t) => t.length <= 150 && setIdiomUsage(t)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={150}
              />
              <Text style={[styles.charCount, { color: idiomUsage.length >= 150 ? theme.colors.error : theme.colors.textSecondary }]}>
                {idiomUsage.length}/150
              </Text>
            </View>
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {user?.currentClubId && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}>
            <View style={[styles.clubIconContainer, { backgroundColor: theme.colors.primary }]}>
              <Building2 size={24} color="#FFFFFF" />
            </View>
            <View style={styles.clubInfo}>
              <Text style={[styles.clubLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Current Club
              </Text>
              <Text style={[styles.clubNameText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {clubName}
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.meetingListTitle, { color: theme.colors.text }]}>Select a Meeting</Text>

        {meetings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Meetings Found</Text>
            <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
              No meetings have been created yet for this club.
            </Text>
          </View>
        ) : (
          meetings.map((meeting) => {
            const date = new Date(meeting.meeting_date).toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const isOpen = meeting.meeting_status === 'open';
            return (
              <TouchableOpacity
                key={meeting.id}
                style={[styles.meetingListCard, { backgroundColor: theme.colors.surface }]}
                onPress={() => handleMeetingSelect(meeting)}
                activeOpacity={0.7}
              >
                <View style={[styles.meetingListIconContainer, { backgroundColor: isOpen ? '#10b981' + '15' : theme.colors.border + '50' }]}>
                  <Hash size={20} color={isOpen ? '#10b981' : theme.colors.textSecondary} />
                </View>
                <View style={styles.meetingListInfo}>
                  <View style={styles.meetingListRow}>
                    <Text style={[styles.meetingListNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Meeting #{meeting.meeting_number}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: isOpen ? '#10b981' + '20' : theme.colors.border }]}>
                      <Text style={[styles.statusBadgeText, { color: isOpen ? '#10b981' : theme.colors.textSecondary }]}>
                        {isOpen ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.meetingListDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {date}
                  </Text>
                </View>
                <ChevronRight size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: { width: 40 },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#64748b',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  unpublishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  content: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: { fontSize: 16 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clubIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: { flex: 1 },
  clubLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  clubNameText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  meetingListTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  meetingListCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  meetingListIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  meetingListInfo: { flex: 1 },
  meetingListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  meetingListNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  meetingListDate: { fontSize: 13 },
  meetingCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  meetingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  meetingTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  meetingDate: { fontSize: 14 },
  assignedUserCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  assignedUserLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  assignedUserName: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  publishedBadgeCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  publishedBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  unpublishTapHint: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  miniPublishedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  miniPublishedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  clearSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearSectionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 48,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 88,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  bottomSpacing: { height: 40 },
});
