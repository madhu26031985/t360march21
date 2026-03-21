import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Linking, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, User, BookOpen, Upload, CheckCircle2, Eye, FileText, Trash2, X, Link as LinkIcon } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

interface EvaluationDetails {
  id: string;
  evaluation_pathway_id: string;
  meeting_id: string;
  speaker_id: string;
  speaker_name: string;
  speaker_avatar: string | null;
  evaluator_id: string;
  evaluator_name: string;
  evaluator_avatar: string | null;
  speech_title: string | null;
  pathway_name: string | null;
  project_name: string | null;
  project_number: string | null;
  level: number | null;
  evaluation_pdf_url: string | null;
  evaluation_status: 'pending' | 'uploaded' | 'completed';
  uploaded_at: string | null;
  evaluator_comments: string | null;
  meeting_date: string;
  meeting_title: string;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string | null;
}

export default function EvaluationUpload() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const evaluationId = typeof params.evaluationId === 'string' ? params.evaluationId : params.evaluationId?.[0];

  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState<EvaluationDetails | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [evaluationFormType, setEvaluationFormType] = useState<'link' | 'pdf'>('pdf');
  const [evaluationFormLink, setEvaluationFormLink] = useState('');

  useEffect(() => {
    if (evaluationId) {
      loadEvaluationDetails();
    }
  }, [evaluationId]);

  const loadEvaluationDetails = async () => {
    if (!evaluationId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('app_prepared_speech_evaluations')
        .select(`
          id,
          evaluation_pathway_id,
          meeting_id,
          speaker_id,
          evaluator_id,
          speech_title,
          pathway_name,
          project_name,
          project_number,
          level,
          evaluation_pdf_url,
          evaluation_status,
          uploaded_at,
          evaluator_comments,
          speaker:app_user_profiles!app_prepared_speech_evaluations_speaker_id_fkey(
            full_name,
            avatar_url
          ),
          evaluator:app_user_profiles!app_prepared_speech_evaluations_evaluator_id_fkey(
            full_name,
            avatar_url
          ),
          meeting:app_club_meeting!app_prepared_speech_evaluations_meeting_id_fkey(
            meeting_title,
            meeting_date,
            meeting_start_time,
            meeting_end_time,
            meeting_mode
          )
        `)
        .eq('id', evaluationId)
        .maybeSingle();

      if (error) {
        console.error('Error loading evaluation:', error);
        Alert.alert('Error', `Failed to load evaluation: ${error.message}`);
        return;
      }

      if (!data) {
        Alert.alert('Error', 'Evaluation not found');
        router.back();
        return;
      }

      const evaluationData: EvaluationDetails = {
        id: data.id,
        evaluation_pathway_id: data.evaluation_pathway_id,
        meeting_id: data.meeting_id,
        speaker_id: data.speaker_id,
        speaker_name: (data.speaker as any)?.full_name || 'Unknown',
        speaker_avatar: (data.speaker as any)?.avatar_url || null,
        evaluator_id: data.evaluator_id,
        evaluator_name: (data.evaluator as any)?.full_name || 'Unknown',
        evaluator_avatar: (data.evaluator as any)?.avatar_url || null,
        speech_title: data.speech_title,
        pathway_name: data.pathway_name,
        project_name: data.project_name,
        project_number: data.project_number,
        level: data.level,
        evaluation_pdf_url: data.evaluation_pdf_url,
        evaluation_status: data.evaluation_status,
        uploaded_at: data.uploaded_at,
        evaluator_comments: data.evaluator_comments,
        meeting_date: (data.meeting as any)?.meeting_date || '',
        meeting_title: (data.meeting as any)?.meeting_title || '',
        meeting_start_time: (data.meeting as any)?.meeting_start_time || null,
        meeting_end_time: (data.meeting as any)?.meeting_end_time || null,
        meeting_mode: (data.meeting as any)?.meeting_mode || null,
      };

      setEvaluation(evaluationData);
      setComments(evaluationData.evaluator_comments || '');
      if (evaluationData.evaluation_pdf_url) {
        // Check if it's a PDF URL or a regular link
        if (evaluationData.evaluation_pdf_url.includes('evaluation-forms') ||
            evaluationData.evaluation_pdf_url.endsWith('.pdf')) {
          setEvaluationFormType('pdf');
          const fileName = evaluationData.evaluation_pdf_url.split('/').pop() || 'evaluation.pdf';
          setUploadedFileName(fileName);
          setUploadedPdfUrl(evaluationData.evaluation_pdf_url);
        } else {
          setEvaluationFormType('link');
          setEvaluationFormLink(evaluationData.evaluation_pdf_url);
        }
      }
    } catch (error) {
      console.error('Error loading evaluation:', error);
      Alert.alert('Error', 'Failed to load evaluation details');
    } finally {
      setLoading(false);
    }
  };

  const handlePickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];

      if (!file.uri) {
        Alert.alert('Error', 'Could not read file');
        return;
      }

      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert('Error', 'File size must be less than 10MB');
        return;
      }

      setIsUploading(true);

      try {
        const timestamp = Date.now();
        const fileName = `evaluation_${evaluationId}_${timestamp}.pdf`;

        if (Platform.OS === 'web') {
          // Web: Fetch the blob directly
          const response = await fetch(file.uri);
          const blob = await response.blob();

          const { error: uploadError } = await supabase.storage
            .from('evaluation-forms')
            .upload(fileName, blob, {
              contentType: 'application/pdf',
              upsert: false,
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            Alert.alert('Upload Error', `Failed to upload PDF: ${uploadError.message}`);
            setIsUploading(false);
            return;
          }
        } else {
          // Native: Use FileSystem
          const fileInfo = await FileSystem.getInfoAsync(file.uri);

          if (!fileInfo.exists) {
            Alert.alert('Error', 'File does not exist');
            setIsUploading(false);
            return;
          }

          const fileData = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const { error: uploadError } = await supabase.storage
            .from('evaluation-forms')
            .upload(fileName, decode(fileData), {
              contentType: 'application/pdf',
              upsert: false,
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            Alert.alert('Upload Error', `Failed to upload PDF: ${uploadError.message}`);
            setIsUploading(false);
            return;
          }
        }

        const { data: publicUrlData } = supabase.storage
          .from('evaluation-forms')
          .getPublicUrl(fileName);

        setUploadedFileName(file.name);
        setUploadedPdfUrl(publicUrlData.publicUrl);

        Alert.alert('Success', 'PDF uploaded successfully!');
        setIsUploading(false);
      } catch (uploadError: any) {
        console.error('Error during upload:', uploadError);
        Alert.alert('Error', `Failed to upload PDF: ${uploadError?.message || 'Unknown error'}`);
        setIsUploading(false);
      }
    } catch (error: any) {
      console.error('Error picking PDF:', error);
      Alert.alert('Error', `Failed to pick PDF file: ${error?.message || 'Unknown error'}`);
      setIsUploading(false);
    }
  };

  const decode = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const saveEvaluation = async (pdfUrl?: string) => {
    if (!evaluation) return;

    // Validate that either link or PDF is provided
    const finalPdfUrl = pdfUrl || uploadedPdfUrl;
    const hasEvaluationForm = (evaluationFormType === 'link' && evaluationFormLink.trim()) ||
                              (evaluationFormType === 'pdf' && finalPdfUrl);

    if (!hasEvaluationForm) {
      Alert.alert('Missing Information', 'Please provide an evaluation form (link or PDF)');
      return;
    }

    setIsSaving(true);

    try {
      const updateData: any = {
        evaluator_comments: comments.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (evaluationFormType === 'link' && evaluationFormLink.trim()) {
        updateData.evaluation_pdf_url = evaluationFormLink.trim();
        updateData.evaluation_status = 'uploaded';
        updateData.uploaded_at = new Date().toISOString();
        updateData.uploaded_by = user?.id;
      } else if (evaluationFormType === 'pdf' && finalPdfUrl) {
        updateData.evaluation_pdf_url = finalPdfUrl;
        updateData.evaluation_status = 'uploaded';
        updateData.uploaded_at = new Date().toISOString();
        updateData.uploaded_by = user?.id;
      }

      const { error } = await supabase
        .from('app_prepared_speech_evaluations')
        .update(updateData)
        .eq('id', evaluation.id);

      if (error) {
        console.error('Error saving evaluation:', error);
        Alert.alert('Error', 'Failed to save evaluation');
        return;
      }

      Alert.alert('Success', 'Evaluation saved successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error saving evaluation:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewPDF = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open PDF');
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      Alert.alert('Error', 'Failed to open PDF');
    }
  };

  const handleRemovePDF = () => {
    if (Platform.OS === 'web') {
      // On web, use confirm dialog
      const confirmed = window.confirm('Are you sure you want to remove this PDF? You can upload a new one.');
      if (confirmed) {
        setUploadedFileName(null);
        setUploadedPdfUrl(null);
      }
    } else {
      // On native, use Alert
      Alert.alert(
        'Remove PDF',
        'Are you sure you want to remove this PDF? You can upload a new one.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              setUploadedFileName(null);
              setUploadedPdfUrl(null);
            },
          },
        ]
      );
    }
  };

  const isUserEvaluator = evaluation?.evaluator_id === user?.id;
  const isUserSpeaker = evaluation?.speaker_id === user?.id;
  const canUpload = isUserEvaluator || isUserSpeaker;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!evaluation) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Evaluation not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Upload Evaluation
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Meeting Card */}
        <View style={[styles.meetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.meetingCardContent}>
            <View style={[styles.meetingDateBox, { backgroundColor: theme.colors.primary + '15' }]}>
              <Text style={[styles.meetingDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {new Date(evaluation.meeting_date).getDate()}
              </Text>
              <Text style={[styles.meetingMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {new Date(evaluation.meeting_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
            </View>
            <View style={styles.meetingDetails}>
              <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {evaluation.meeting_title}
              </Text>
              <Text style={[styles.meetingInfoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Day: {new Date(evaluation.meeting_date).toLocaleDateString('en-US', { weekday: 'long' })}
              </Text>
              {evaluation.meeting_start_time && evaluation.meeting_end_time && (
                <Text style={[styles.meetingInfoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Time: {evaluation.meeting_start_time} - {evaluation.meeting_end_time}
                </Text>
              )}
              {evaluation.meeting_mode && (
                <Text style={[styles.meetingInfoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Mode: {evaluation.meeting_mode === 'in_person' ? 'In Person' :
                         evaluation.meeting_mode === 'online' ? 'Online' : 'Hybrid'}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Evaluator Info */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.profileSection}>
            {evaluation.evaluator_avatar ? (
              <Image source={{ uri: evaluation.evaluator_avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary + '30' }]}>
                <User size={28} color={theme.colors.primary} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={[styles.profileLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Evaluator</Text>
              <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {evaluation.evaluator_name}
                {isUserEvaluator && ' (You)'}
              </Text>
            </View>
          </View>
        </View>

        {/* Speaker Info */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.profileSection}>
            {evaluation.speaker_avatar ? (
              <Image source={{ uri: evaluation.speaker_avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary + '30' }]}>
                <User size={28} color={theme.colors.primary} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={[styles.profileLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Speaker</Text>
              <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {evaluation.speaker_name}
              </Text>
            </View>
          </View>
        </View>

        {/* Speech Information */}
        {(evaluation.speech_title || evaluation.pathway_name || evaluation.project_name) && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <BookOpen size={20} color={theme.colors.primary} />
              <Text style={[styles.cardHeaderText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speech Information</Text>
            </View>
            <View style={styles.cardContent}>
              {evaluation.speech_title && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Title:</Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{evaluation.speech_title}</Text>
                </View>
              )}
              {evaluation.pathway_name && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Pathway:</Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{evaluation.pathway_name}</Text>
                </View>
              )}
              {evaluation.project_name && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Project:</Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{evaluation.project_name}</Text>
                </View>
              )}
              {(evaluation.level || evaluation.project_number) && (
                <View style={styles.badgesRow}>
                  {evaluation.level && (
                    <View style={[styles.badge, { backgroundColor: '#3b82f6' }]}>
                      <Text style={styles.badgeText} maxFontSizeMultiplier={1.3}>L{evaluation.level}</Text>
                    </View>
                  )}
                  {evaluation.project_number && (
                    <View style={[styles.badge, { backgroundColor: '#10b981' }]}>
                      <Text style={styles.badgeText} maxFontSizeMultiplier={1.3}>P{evaluation.project_number}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Evaluation Form Section */}
        {canUpload ? (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <Upload size={20} color={theme.colors.primary} />
              <Text style={[styles.cardHeaderText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Evaluation Form *</Text>
            </View>
            <View style={styles.cardContent}>
              {/* Type Selector */}
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeSelectorButton,
                    evaluationFormType === 'link' && { backgroundColor: theme.colors.primary },
                    { borderColor: theme.colors.border }
                  ]}
                  onPress={() => {
                    setEvaluationFormType('link');
                    setUploadedPdfUrl(null);
                    setUploadedFileName(null);
                  }}
                >
                  <LinkIcon size={16} color={evaluationFormType === 'link' ? '#ffffff' : theme.colors.text} />
                  <Text style={[
                    styles.typeSelectorText,
                    { color: evaluationFormType === 'link' ? '#ffffff' : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    Link
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeSelectorButton,
                    evaluationFormType === 'pdf' && { backgroundColor: theme.colors.primary },
                    { borderColor: theme.colors.border }
                  ]}
                  onPress={() => {
                    setEvaluationFormType('pdf');
                    setEvaluationFormLink('');
                  }}
                >
                  <FileText size={16} color={evaluationFormType === 'pdf' ? '#ffffff' : theme.colors.text} />
                  <Text style={[
                    styles.typeSelectorText,
                    { color: evaluationFormType === 'pdf' ? '#ffffff' : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    PDF
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Link Input */}
              {evaluationFormType === 'link' && (
                <TextInput
                  style={[styles.linkInput, {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text
                  }]}
                  placeholder="Enter evaluation form link"
                  placeholderTextColor="#BEBEBE"
                  value={evaluationFormLink}
                  onChangeText={setEvaluationFormLink}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              )}

              {/* PDF Upload */}
              {evaluationFormType === 'pdf' && (
                <>
                  {isUploading ? (
                    <View style={styles.uploadingState}>
                      <ActivityIndicator size="large" color={theme.colors.primary} />
                      <Text style={[styles.uploadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Uploading PDF...</Text>
                    </View>
                  ) : !uploadedPdfUrl ? (
                    <TouchableOpacity
                      style={[styles.uploadButton, { backgroundColor: theme.colors.primary }]}
                      onPress={handlePickPDF}
                      disabled={isUploading}
                    >
                      <Upload size={20} color="#ffffff" />
                      <Text style={styles.uploadButtonText} maxFontSizeMultiplier={1.3}>Upload PDF</Text>
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <View style={[styles.pdfPreviewCard, {
                        backgroundColor: theme.colors.background,
                        borderColor: '#10b981'
                      }]}>
                        <View style={styles.pdfPreviewIcon}>
                          <FileText size={32} color="#10b981" />
                        </View>
                        <View style={styles.pdfPreviewInfo}>
                          <View style={styles.pdfPreviewHeader}>
                            <CheckCircle2 size={16} color="#10b981" />
                            <Text style={[styles.pdfPreviewTitle, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                              PDF Uploaded
                            </Text>
                          </View>
                          <Text style={[styles.pdfPreviewFileName, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                            {uploadedFileName}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.pdfActionsRow}>
                        <TouchableOpacity
                          style={[styles.pdfActionButton, {
                            backgroundColor: theme.colors.primary,
                            flex: 1
                          }]}
                          onPress={() => handleViewPDF(uploadedPdfUrl)}
                        >
                          <Eye size={18} color="#ffffff" />
                          <Text style={styles.pdfActionButtonText} maxFontSizeMultiplier={1.3}>View PDF</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.pdfActionButton, {
                            backgroundColor: '#ef4444',
                            flex: 1
                          }]}
                          onPress={handleRemovePDF}
                        >
                          <Trash2 size={18} color="#ffffff" />
                          <Text style={styles.pdfActionButtonText} maxFontSizeMultiplier={1.3}>Remove</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.uploadAnotherButton, {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border
                        }]}
                        onPress={handlePickPDF}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <>
                            <Upload size={18} color={theme.colors.primary} />
                            <Text style={[styles.uploadAnotherButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Upload Different PDF
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        ) : evaluation.evaluation_pdf_url ? (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <CheckCircle2 size={20} color="#10b981" />
              <Text style={[styles.cardHeaderText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Evaluation Status</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={[styles.pdfPreviewCard, {
                backgroundColor: theme.colors.background,
                borderColor: '#10b981'
              }]}>
                <View style={styles.pdfPreviewIcon}>
                  <FileText size={32} color="#10b981" />
                </View>
                <View style={styles.pdfPreviewInfo}>
                  <View style={styles.pdfPreviewHeader}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <Text style={[styles.pdfPreviewTitle, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                      PDF Uploaded
                    </Text>
                  </View>
                  <Text style={[styles.pdfPreviewFileName, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                    {evaluation.evaluation_pdf_url.split('/').pop()}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.pdfActionButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => handleViewPDF(evaluation.evaluation_pdf_url!)}
              >
                <Eye size={18} color="#ffffff" />
                <Text style={styles.pdfActionButtonText} maxFontSizeMultiplier={1.3}>View PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.cardContent}>
              <Text style={[styles.pendingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Waiting for evaluation form to be uploaded
              </Text>
            </View>
          </View>
        )}

        {/* Comments Section */}
        {canUpload ? (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardHeaderText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>💬 Comments for the Speaker</Text>
            </View>
            <View style={styles.cardContent}>
              <TextInput
                style={[styles.commentsInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="Add any comments for the speaker..."
                placeholderTextColor={theme.colors.textSecondary}
                value={comments}
                onChangeText={setComments}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {comments.length}/500 characters
              </Text>
            </View>
          </View>
        ) : evaluation.evaluator_comments ? (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardHeaderText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Comments</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.commentsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {evaluation.evaluator_comments}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Save Button */}
        {canUpload && (
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => saveEvaluation()}
            disabled={isSaving || isUploading}
          >
            <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
              {isSaving ? 'Saving...' : 'Save Evaluation'}
            </Text>
          </TouchableOpacity>
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
    gap: 16,
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
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  meetingCard: {
    marginHorizontal: 13,
    marginTop: 13,
    borderRadius: 13,
    padding: 16,
    minHeight: 96,
    borderWidth: 1,
  },
  meetingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  meetingDateBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingDay: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  meetingMonth: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -2,
  },
  meetingDetails: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  meetingInfoText: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 13,
    marginTop: 13,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    paddingBottom: 12,
  },
  cardHeaderText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardContent: {
    padding: 16,
    paddingTop: 0,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  typeSelectorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  typeSelectorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  linkInput: {
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  uploadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  uploadingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pdfPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    gap: 12,
  },
  pdfPreviewIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#10b98120',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfPreviewInfo: {
    flex: 1,
  },
  pdfPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pdfPreviewTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pdfPreviewFileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  pdfActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pdfActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  pdfActionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  uploadAnotherButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  uploadedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  uploadedText: {
    fontSize: 13,
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  pendingText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  commentsInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    fontSize: 14,
  },
  commentsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 13,
    marginTop: 13,
    marginBottom: 32,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
