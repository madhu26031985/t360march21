import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, FileText, Youtube, BookOpen, Trash2, CreditCard as Edit3, Calendar, Info, X } from 'lucide-react-native';

interface Resource {
  id: string;
  title: string;
  description: string;
  resource_type: 'youtube' | 'magazine' | 'evaluation_form' | 'other_pdf';
  url: string | null;
  file_data: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

export default function MemberResourcesManagement() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [resources, setResources] = useState<Resource[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const resourceTypes = [
    {
      value: 'youtube',
      label: 'YouTube Video',
      icon: <Youtube size={16} color="#ffffff" />,
      iconLarge: <Youtube size={24} color="#ffffff" />,
      color: '#ff0000'
    },
    {
      value: 'magazine',
      label: 'Magazine/Article',
      icon: <BookOpen size={16} color="#ffffff" />,
      iconLarge: <BookOpen size={24} color="#ffffff" />,
      color: '#10b981'
    },
    {
      value: 'evaluation_form',
      label: 'Evaluation Form',
      icon: <FileText size={16} color="#ffffff" />,
      iconLarge: <FileText size={24} color="#ffffff" />,
      color: '#f59e0b'
    },
    {
      value: 'other_pdf',
      label: 'Other PDF',
      icon: <FileText size={16} color="#ffffff" />,
      iconLarge: <FileText size={24} color="#ffffff" />,
      color: '#8b5cf6'
    },
  ];

  useEffect(() => {
    loadResources();
    loadClubInfo();
  }, []);

  const loadResources = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('club_id', user.currentClubId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading resources:', error);
        Alert.alert('Error', 'Failed to load resources');
        return;
      }

      setResources(data || []);
    } catch (error) {
      console.error('Error loading resources:', error);
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

  const handleNavigateToAddResource = (type: 'youtube' | 'magazine' | 'evaluation_form' | 'other_pdf') => {
    switch (type) {
      case 'youtube':
        router.push('/admin/add-youtube-resource');
        break;
      case 'magazine':
        router.push('/admin/add-magazine-resource');
        break;
      case 'evaluation_form':
        router.push('/admin/add-evaluation-resource');
        break;
      case 'other_pdf':
        router.push('/admin/add-other-pdf-resource');
        break;
    }
  };

  const handleEditResource = (resource: Resource) => {
    router.push(`/admin/edit-resource?id=${resource.id}`);
  };

  const handleDeleteResource = (resource: Resource) => {
    setResourceToDelete(resource);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!resourceToDelete) return;

    try {
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', resourceToDelete.id);

      if (error) {
        console.error('Error deleting resource:', error);
        Alert.alert('Error', 'Failed to delete resource');
        return;
      }

      setResources(prev => prev.filter(r => r.id !== resourceToDelete.id));
      setShowDeleteModal(false);
      setResourceToDelete(null);
      Alert.alert('Success', 'Resource deleted successfully');
    } catch (error) {
      console.error('Error deleting resource:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setResourceToDelete(null);
  };

  const getResourceTypeIcon = (type: string) => {
    const resourceType = resourceTypes.find(rt => rt.value === type);
    return resourceType?.icon || <FileText size={16} color="#ffffff" />;
  };

  const getResourceTypeColor = (type: string) => {
    const resourceType = resourceTypes.find(rt => rt.value === type);
    return resourceType?.color || '#6b7280';
  };

  const getResourceTypeLabel = (type: string) => {
    const resourceType = resourceTypes.find(rt => rt.value === type);
    return resourceType?.label || type;
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

  const ResourceCard = ({ resource }: { resource: Resource }) => (
    <View style={[styles.resourceCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.resourceHeader}>
        <View style={styles.resourceInfo}>
          <View style={styles.resourceTitleRow}>
            <View style={[styles.resourceTypeIcon, { backgroundColor: getResourceTypeColor(resource.resource_type) }]}>
              {getResourceTypeIcon(resource.resource_type)}
            </View>
            <Text style={[styles.resourceTitle, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {resource.title}
            </Text>
          </View>
          <Text style={[styles.resourceDescription, { color: theme.colors.textSecondary }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {resource.description}
          </Text>
          <View style={styles.resourceMeta}>
            <View style={[styles.typeTag, { backgroundColor: getResourceTypeColor(resource.resource_type) + '20' }]}>
              <Text style={[styles.typeText, { color: getResourceTypeColor(resource.resource_type) }]} maxFontSizeMultiplier={1.3}>
                {getResourceTypeLabel(resource.resource_type)}
              </Text>
            </View>
            <View style={styles.resourceDate}>
              <Calendar size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.resourceDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {new Date(resource.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.resourceActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#f0f9ff' }]}
            onPress={() => handleEditResource(resource)}
            activeOpacity={0.7}
          >
            <Edit3 size={14} color="#0ea5e9" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#fef2f2' }]}
            onPress={() => handleDeleteResource(resource)}
            activeOpacity={0.7}
          >
            <Trash2 size={14} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading resources...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Member Resources</Text>
        <TouchableOpacity style={styles.infoButton} onPress={() => setShowInfoModal(true)}>
          <Info size={24} color="#0a66c2" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Add Resource Cards */}
        <View style={styles.addResourceSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Add New Resource</Text>
          <View style={styles.resourceTypeGrid}>
            {resourceTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.resourceTypeCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => handleNavigateToAddResource(type.value as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.resourceTypeCardIcon, { backgroundColor: type.color }]}>
                  {type.iconLarge}
                </View>
                <Text style={[styles.resourceTypeCardLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Resources Count */}
        <View style={styles.resourcesHeader}>
          <Text style={[styles.resourcesCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {resources.length} resources available
          </Text>
        </View>

        {/* Resources List */}
        <View style={styles.resourcesList}>
          {resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </View>

        {/* Empty State */}
        {resources.length === 0 && (
          <View style={styles.emptyState}>
            <BookOpen size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No resources added yet
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Use the cards above to add your first resource
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.deleteModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Delete Resource</Text>
            <Text style={[styles.deleteModalMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Are you sure you want to delete "{resourceToDelete?.title}"? This action cannot be undone.
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

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.infoModalOverlay}>
          <View style={[styles.infoModal, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.infoModalHeader}>
              <Text style={[styles.infoModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Empower Your Club, One Resource at a Time
              </Text>
              <TouchableOpacity
                style={styles.infoModalCloseButton}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infoModalContent} showsVerticalScrollIndicator={false}>
              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Every great club grows when its members are inspired, informed, and supported.
                As an ExCom leader, you have the power to light that path.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                This space is your digital library — a place where you can share knowledge, guidance, and tools that help members become confident speakers and leaders.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                With just a few clicks, you can add:
              </Text>

              <View style={styles.infoModalList}>
                <Text style={[styles.infoModalListItem, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  📹 YouTube Videos – for quick learning and motivation
                </Text>
                <Text style={[styles.infoModalListItem, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  📖 Magazines / Articles – to spark new ideas
                </Text>
                <Text style={[styles.infoModalListItem, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  📝 Evaluation Forms – to improve every speech
                </Text>
                <Text style={[styles.infoModalListItem, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  📄 Other PDFs – handbooks, checklists, or templates
                </Text>
              </View>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Once added, members can find these under:{'\n'}
                <Text style={styles.infoModalBold} maxFontSizeMultiplier={1.3}>Club → Club Resources</Text>
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                So go ahead — share something valuable today.{'\n'}
                Your one resource might be the reason someone grows tomorrow. 💙
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.infoModalButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.infoModalButtonText} maxFontSizeMultiplier={1.3}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  infoButton: {
    padding: 8,
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
  addResourceSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  resourceTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  resourceTypeCard: {
    width: '48%',
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
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
  resourceTypeCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resourceTypeCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
  resourcesHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  resourcesCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  resourcesList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  resourceCard: {
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
  resourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  resourceInfo: {
    flex: 1,
    marginRight: 12,
  },
  resourceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resourceTypeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  resourceDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  resourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resourceDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourceDateText: {
    fontSize: 11,
    marginLeft: 4,
  },
  resourceActions: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  resourceModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 16,
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
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
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
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 80,
  },
  resourceTypeGrid: {
    gap: 8,
  },
  resourceTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
  },
  resourceTypeIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  resourceTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
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
  infoModal: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 24,
    paddingBottom: 16,
  },
  infoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
    lineHeight: 28,
  },
  infoModalCloseButton: {
    padding: 4,
  },
  infoModalContent: {
    paddingHorizontal: 24,
    maxHeight: 450,
  },
  infoModalText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  infoModalBold: {
    fontWeight: '700',
  },
  infoModalList: {
    marginBottom: 16,
  },
  infoModalListItem: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 8,
  },
  infoModalButton: {
    margin: 24,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  infoModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});