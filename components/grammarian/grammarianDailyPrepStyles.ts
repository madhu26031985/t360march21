import { StyleSheet } from 'react-native';

/** Shared layout for Word / Idiom / Quote prep screens (split from Grammarian prep space). */
export const grammarianDailyPrepStyles = StyleSheet.create({
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
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  preMeetingContainer: {
    marginHorizontal: 16,
    marginTop: 4,
  },
  formContainer: {
    gap: 8,
  },
  accessDeniedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  accessDeniedBannerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  fieldCard: {
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  charCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 40,
  },
  fieldInputMultiline: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 68,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveDraftButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveDraftButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  lastSaved: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
