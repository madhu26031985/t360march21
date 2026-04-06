import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import {
  ArrowLeft,
  Plus,
  Book,
  FileText,
  ExternalLink,
  Trash2,
  CreditCard as Edit3,
  Save,
  X,
  Calendar,
  Info,
  Home,
  Users,
  Settings,
  Shield,
} from 'lucide-react-native';
import AddSpeechModal from '@/components/AddSpeechModal';
import EditSpeechModal from '@/components/EditSpeechModal';
import React from 'react';

const FOOTER_NAV_ICON_SIZE = 15;

export type SpeechRepositoryProps = {
  /** When true, used inside My growth — no back header or tab footer. */
  embedded?: boolean;
};

interface Speech {
  id: string;
  title: string;
  document_type: 'google_doc';
  created_at: string;
  updated_at: string;
}

export default function SpeechRepository({ embedded = false }: SpeechRepositoryProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSpeech, setSelectedSpeech] = useState<Speech | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [speechToDelete, setSpeechToDelete] = useState<Speech | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [speechToOpen, setSpeechToOpen] = useState<Speech | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const infoIconPulse = useRef(new Animated.Value(1)).current;

  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  useEffect(() => {
    loadSpeeches();
  }, []);

  useEffect(() => {
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    let pulseAnimation: Animated.CompositeAnimation | null = null;

    if (!isLoading && speeches.length === 0) {
      infoIconPulse.setValue(1);
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(infoIconPulse, {
            toValue: 1.14,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(infoIconPulse, {
            toValue: 1,
            duration: 520,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      stopTimer = setTimeout(() => {
        pulseAnimation?.stop();
        Animated.timing(infoIconPulse, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }, 5000);
    }

    return () => {
      if (stopTimer) clearTimeout(stopTimer);
      pulseAnimation?.stop();
      infoIconPulse.setValue(1);
    };
  }, [isLoading, speeches.length, infoIconPulse]);

  const loadSpeeches = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('speeches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error loading speeches:', error);
        Alert.alert('Error', 'Failed to load speeches');
        return;
      }

      setSpeeches(data || []);
    } catch (error) {
      console.error('Error loading speeches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSpeech = () => {
    if (speeches.length >= 5) {
      Alert.alert('Limit Reached', 'You can store a maximum of 5 speeches. Please delete an existing speech to add a new one.');
      return;
    }
    setShowAddModal(true);
  };

  const handleEditSpeech = (speech: Speech) => {
    console.log('Starting edit for speech:', speech.title);
    try {
      setSelectedSpeech(speech);
      setShowEditModal(true);
      console.log('Edit modal should now be visible');
    } catch (error) {
      console.error('Error setting up edit modal:', error);
      Alert.alert('Error', 'Failed to open edit dialog');
    }
  };

  const handleDeleteSpeech = async (speechId: string, title: string) => {
    const speech = speeches.find(s => s.id === speechId);
    if (speech) {
      setSpeechToDelete(speech);
      setShowDeleteModal(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!speechToDelete) return;

    try {
      console.log('Deleting speech:', speechToDelete.title);
      
      const { error } = await supabase
        .from('speeches')
        .delete()
        .eq('id', speechToDelete.id);

      if (error) {
        console.error('Error deleting speech:', error);
        Alert.alert('Error', 'Failed to delete speech');
        return;
      }

      setSpeeches(prev => prev.filter(s => s.id !== speechToDelete.id));
      setShowDeleteModal(false);
      setSpeechToDelete(null);
      Alert.alert('Success', 'Speech deleted successfully');
    } catch (error) {
      console.error('Error deleting speech:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setSpeechToDelete(null);
  };

  const handleSaveSpeech = async (speechData: any) => {
    if (!user) return;

    try {
      const saveData = {
        user_id: user.id,
        title: speechData.title.trim(),
        document_type: speechData.document_type,
        document_url: speechData.document_url.trim(),
      };

      if (selectedSpeech) {
        const { error } = await supabase
          .from('speeches')
          .update({
            ...saveData,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', selectedSpeech.id);

        if (error) {
          console.error('Error updating speech:', error);
          Alert.alert('Error', 'Failed to update speech');
          return;
        }

        Alert.alert('Success', 'Speech updated successfully');
        setShowEditModal(false);
        setSelectedSpeech(null);
      } else {
        const { error } = await supabase
          .from('speeches')
          .insert(saveData as any);

        if (error) {
          console.error('Error creating speech:', error);
          Alert.alert('Error', 'Failed to create speech');
          return;
        }

        Alert.alert('Success', 'Speech added successfully');
        setShowAddModal(false);
      }

      loadSpeeches();
    } catch (error) {
      console.error('Error saving speech:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case 'google_doc': return <FileText size={16} color="#4285f4" />;
      default: return <FileText size={16} color="#6b7280" />;
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'google_doc': return 'Google Doc';
      default: return type;
    }
  };

  const handleOpenDocument = (speech: Speech) => {
    console.log('Open button pressed for speech:', speech.title);
    setSpeechToOpen(speech);
    setShowOpenModal(true);
  };

  const handleConfirmOpen = () => {
    if (!speechToOpen) return;

    try {
      if (speechToOpen.document_url) {
        // Try to open with WebBrowser first, fallback to Linking
        if (WebBrowser && WebBrowser.openBrowserAsync) {
          WebBrowser.openBrowserAsync(speechToOpen.document_url);
        } else {
          Linking.openURL(speechToOpen.document_url);
        }
      } else {
        Alert.alert('Error', 'No document URL available');
      }
    } catch (error) {
      console.error('Error opening document:', error);
      // Fallback to Linking if WebBrowser fails
      try {
        Linking.openURL(speechToOpen.document_url || '');
      } catch (linkingError) {
        Alert.alert('Error', 'Failed to open document');
      }
    } finally {
      setShowOpenModal(false);
      setSpeechToOpen(null);
    }
  };

  const handleCancelOpen = () => {
    setShowOpenModal(false);
    setSpeechToOpen(null);
  };

  const SpeechCard = ({ speech }: { speech: Speech }) => {
    return (
      <View
        style={[
          styles.speechCard,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.speechHeader}>
          <View style={styles.speechInfo}>
            <Text style={[styles.speechTitle, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {speech.title}
            </Text>
            <View style={styles.speechMeta}>
              <View style={styles.documentType}>
                {getDocumentTypeIcon(speech.document_type)}
                <Text style={[styles.documentTypeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {getDocumentTypeLabel(speech.document_type)}
                </Text>
              </View>
              <View style={styles.speechDate}>
                <Calendar size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.speechDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {new Date(speech.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.speechActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: 'transparent', borderColor: '#bfdbfe' }]}
              onPress={() => handleOpenDocument(speech)}
              activeOpacity={0.7}
            >
              <ExternalLink size={16} color="#3b82f6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: 'transparent', borderColor: '#bfdbfe' }]}
              onPress={() => handleEditSpeech(speech)}
              activeOpacity={0.7}
            >
              <Edit3 size={16} color="#3b82f6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: 'transparent', borderColor: '#fecaca' }]}
              onPress={() => handleDeleteSpeech(speech.id, speech.title)}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const Root = embedded ? View : SafeAreaView;

  if (isLoading) {
    return (
      <Root style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading speeches...</Text>
        </View>
      </Root>
    );
  }

  return (
    <Root style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      {!embedded ? (
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>My Speech Repository</Text>
        <Animated.View style={[styles.infoButtonPulseWrap, { transform: [{ scale: infoIconPulse }] }]}>
          <TouchableOpacity
            style={[styles.infoButton, { backgroundColor: '#E8EEF5', borderColor: '#D4DEE9' }]}
            onPress={() => setShowInfoModal(true)}
            activeOpacity={0.8}
          >
            <Info size={18} color="#6E839F" />
          </TouchableOpacity>
        </Animated.View>
      </View>
      ) : (
        <View style={[styles.embeddedSpeechesToolbar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={{ flex: 1 }} />
          <Animated.View style={[styles.infoButtonPulseWrap, { transform: [{ scale: infoIconPulse }] }]}>
            <TouchableOpacity
              style={[styles.infoButton, { backgroundColor: '#E8EEF5', borderColor: '#D4DEE9' }]}
              onPress={() => setShowInfoModal(true)}
              activeOpacity={0.8}
            >
              <Info size={18} color="#6E839F" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.speechCount}>
            <Text style={[styles.countText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              {speeches.length}/5 speeches stored
            </Text>
          </View>
        </View>

        {/* Speeches List */}
        <View style={styles.speechesList}>
          {speeches.map((speech) => (
            <SpeechCard key={speech.id} speech={speech} />
          ))}

          {speeches.length > 0 && speeches.length < 5 && (
            <View style={styles.addSpeechButtonContainer}>
              <TouchableOpacity
                style={styles.addSpeechButton}
                onPress={handleAddSpeech}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#ffffff" />
                <Text style={styles.addSpeechButtonText} maxFontSizeMultiplier={1.3}>
                  Add Speech
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Empty State */}
        {speeches.length === 0 && (
          <View style={styles.emptyState}>
            <TouchableOpacity
              style={styles.addSpeechButton}
              onPress={handleAddSpeech}
              activeOpacity={0.7}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.addSpeechButtonText} maxFontSizeMultiplier={1.3}>
                Add Speech
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ minHeight: embedded ? Math.max(insets.bottom, 10) + 24 : Math.max(insets.bottom, 10) + 80 }} />
      </ScrollView>

      {!embedded ? (
      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.footerNavigationContent}
        >
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Home size={FOOTER_NAV_ICON_SIZE} color="#0a66c2" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Users size={FOOTER_NAV_ICON_SIZE} color="#d97706" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Club
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/meetings')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Calendar size={FOOTER_NAV_ICON_SIZE} color="#0ea5e9" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Meeting
            </Text>
          </TouchableOpacity>

          {user?.clubRole === 'excomm' ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/admin')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Shield size={FOOTER_NAV_ICON_SIZE} color={EXCOMM_UI.adminTabIcon} />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Admin
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Settings size={FOOTER_NAV_ICON_SIZE} color="#6b7280" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Settings
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      ) : null}

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.infoModalOverlay}>
          <View style={[styles.infoModalContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.infoModalHeader}>
              <Text style={[styles.infoModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                My Speech Repository
              </Text>
              <TouchableOpacity
                style={styles.infoModalCloseButton}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.infoModalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Stop searching everywhere for your speeches. Everything is now in one place.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Capture ideas, write drafts, and store your final scripts-all neatly organized and always accessible on your mobile.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, marginBottom: 0 }]} maxFontSizeMultiplier={1.3}>
                Your personal speech library, ready whenever you are.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.infoModalButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.infoModalButtonText} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      {/* Open Confirmation Modal */}
      <Modal
        visible={showOpenModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelOpen}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.deleteModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Open Document</Text>
            <Text style={[styles.deleteModalMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Do you want to open "{speechToOpen?.title}"?
            </Text>
            
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={handleCancelOpen}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.deleteModalButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleConfirmOpen}
              >
                <Text style={[styles.deleteButtonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>Yes, Open</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.deleteModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Delete Speech</Text>
            <Text style={[styles.deleteModalMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Are you sure you want to delete "{speechToDelete?.title}"? This action cannot be undone.
            </Text>
            
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={handleCancelDelete}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteButton]}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.deleteButtonText} maxFontSizeMultiplier={1.3}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Speech Modal */}
      <AddSpeechModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveSpeech}
      />

      {/* Edit Speech Modal */}
      <EditSpeechModal
        visible={showEditModal}
        speech={selectedSpeech}
        onClose={() => {
          setShowEditModal(false);
          setSelectedSpeech(null);
        }}
        onSave={handleSaveSpeech}
      />
      </KeyboardAvoidingView>
    </Root>
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
  embeddedSpeechesToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#93A7BF',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  infoButtonPulseWrap: {
    borderRadius: 18,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 0,
    flexGrow: 1,
  },
  navSpacer: {
    flex: 1,
    minHeight: 24,
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 0,
    padding: 16,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  speechCount: {
    alignSelf: 'flex-start',
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
  },
  speechesList: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 0,
  },
  speechCard: {
    borderRadius: 0,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  speechHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  speechInfo: {
    flex: 1,
    marginRight: 12,
  },
  speechTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  speechMeta: {
    gap: 8,
  },
  documentType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  documentTypeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  speechDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speechDateText: {
    fontSize: 11,
    marginLeft: 4,
  },
  speechActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 16,
  },
  addSpeechButtonContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  addSpeechButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 0,
    backgroundColor: '#3b82f6',
    width: '100%',
  },
  addSpeechButtonText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
    color: '#ffffff',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: {
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    minWidth: 300,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  infoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  infoModalCloseButton: {
    padding: 4,
  },
  infoModalContent: {
    padding: 20,
    maxHeight: 500,
  },
  infoModalText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  infoModalButton: {
    margin: 20,
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  navigationSection: {
    marginTop: 24,
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  footerNavItem: {
    alignItems: 'center',
    minWidth: 62,
    paddingVertical: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
});