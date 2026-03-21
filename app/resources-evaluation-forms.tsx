import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, FileText, Search, ExternalLink, Calendar } from 'lucide-react-native';

interface Resource {
  id: string;
  title: string;
  description: string;
  resource_type: string;
  url: string | null;
  pathway_name: string | null;
  project_name: string | null;
  project_number: number | null;
  level_number: number | null;
  created_at: string;
}

export default function ResourcesEvaluationForms() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [resources, setResources] = useState<Resource[]>([]);
  const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadResources();
  }, []);

  useEffect(() => {
    filterResources();
  }, [resources, searchQuery]);

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
        .eq('resource_type', 'evaluation_form')
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

  const filterResources = () => {
    let filtered = resources;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (resource) =>
          resource.title?.toLowerCase().includes(query) ||
          resource.description?.toLowerCase().includes(query) ||
          resource.pathway_name?.toLowerCase().includes(query) ||
          resource.project_name?.toLowerCase().includes(query)
      );
    }

    setFilteredResources(filtered);
  };

  const handleOpenResource = async (resource: Resource) => {
    try {
      if (resource.url) {
        if (WebBrowser && WebBrowser.openBrowserAsync) {
          await WebBrowser.openBrowserAsync(resource.url);
        } else {
          await Linking.openURL(resource.url);
        }
      } else {
        Alert.alert('Error', 'No resource URL available');
      }
    } catch (error) {
      console.error('Error opening resource:', error);
      Alert.alert('Error', 'Failed to open resource');
    }
  };

  const ResourceCard = ({ resource }: { resource: Resource }) => (
    <TouchableOpacity
      style={[styles.resourceCard, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleOpenResource(resource)}
      activeOpacity={0.7}
    >
      <View style={styles.resourceHeader}>
        <View style={styles.resourceInfo}>
          <View style={styles.resourceTitleRow}>
            <View style={[styles.resourceTypeIcon, { backgroundColor: '#f59e0b' }]}>
              <FileText size={16} color="#ffffff" />
            </View>
            <Text
              style={[styles.resourceTitle, { color: theme.colors.text }]}
              numberOfLines={2}
              maxFontSizeMultiplier={1.3}
            >
              {resource.title}
            </Text>
          </View>
          <Text
            style={[styles.resourceDescription, { color: theme.colors.textSecondary }]}
            numberOfLines={2}
            maxFontSizeMultiplier={1.3}
          >
            {resource.description}
          </Text>
          {(resource.pathway_name || resource.project_name) && (
            <View style={styles.pathwayInfo}>
              {resource.pathway_name && (
                <View style={[styles.pathwayTag, { backgroundColor: '#f59e0b20' }]}>
                  <Text style={[styles.pathwayText, { color: '#f59e0b' }]} maxFontSizeMultiplier={1.3}>
                    {resource.pathway_name}
                  </Text>
                </View>
              )}
              {resource.project_name && (
                <View style={[styles.pathwayTag, { backgroundColor: '#10b98120' }]}>
                  <Text style={[styles.pathwayText, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                    {resource.project_name}
                  </Text>
                </View>
              )}
            </View>
          )}
          <View style={styles.resourceMeta}>
            <View style={styles.resourceDate}>
              <Calendar size={12} color={theme.colors.textSecondary} />
              <Text
                style={[styles.resourceDateText, { color: theme.colors.textSecondary }]}
                maxFontSizeMultiplier={1.3}
              >
                {new Date(resource.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.openIndicator}>
          <ExternalLink size={16} color="#f59e0b" />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Loading forms...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Evaluation Forms
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Box */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Search size={18} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search forms..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Results Count */}
        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {filteredResources.length} {filteredResources.length === 1 ? 'form' : 'forms'} found
          </Text>
        </View>

        {/* Resources List */}
        <View style={styles.resourcesList}>
          {filteredResources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </View>

        {/* Empty State */}
        {filteredResources.length === 0 && (
          <View style={styles.emptyState}>
            <FileText size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {searchQuery ? 'No forms found' : 'No evaluation forms available'}
            </Text>
            <Text
              style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}
              maxFontSizeMultiplier={1.3}
            >
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Your Executive Committee will add evaluation forms here'}
            </Text>
          </View>
        )}
      </ScrollView>
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
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 15,
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
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
    marginBottom: 8,
  },
  pathwayInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  pathwayTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pathwayText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourceDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourceDateText: {
    fontSize: 11,
    marginLeft: 4,
  },
  openIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef3c7',
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
});
