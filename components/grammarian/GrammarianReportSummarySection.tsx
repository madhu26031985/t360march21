import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { BookOpen, Lightbulb, MessageSquare } from 'lucide-react-native';
import { GrammarianConsolidatedReportInner } from '@/components/grammarian/GrammarianConsolidatedReportInner';

export type SummarySubTab = 'word' | 'idiom' | 'quote';

export type SummaryMainTab = 'lexicon' | 'reports';

type Props = {
  theme: any;
  styles: Record<string, any>;
  summaryMainTab: SummaryMainTab;
  setSummaryMainTab: (t: SummaryMainTab) => void;
  reportsVisibleToMembers: boolean;
  summarySubTab: SummarySubTab;
  setSummarySubTab: (t: SummarySubTab) => void;
  wordOfTheDay: {
    word: string;
    part_of_speech?: string;
    meaning: string;
    usage: string;
    is_published: boolean;
  };
  idiomOfTheDay: {
    idiom: string;
    meaning?: string | null;
    usage?: string | null;
    is_published?: boolean;
  } | null;
  quoteOfTheDay: {
    quote: string;
    meaning?: string | null;
    usage?: string | null;
    is_published?: boolean;
  } | null;
  assignedGrammarian: { full_name: string; avatar_url: string | null } | null;
  clubName: string | null;
  meetingId: string;
  hasPublishedLiveObservations: boolean;
  /** True if any Good usage or Opportunity row exists (even when not individually published). */
  hasAnyLiveMeetingNotes: boolean;
};

const LEXICON_TABS: { key: SummarySubTab; label: string }[] = [
  { key: 'word', label: 'WORD OF THE DAY' },
  { key: 'idiom', label: 'IDIOM OF THE DAY' },
  { key: 'quote', label: 'QUOTE OF THE DAY' },
];

export function GrammarianReportSummarySection({
  theme,
  styles: g,
  summaryMainTab,
  setSummaryMainTab,
  reportsVisibleToMembers,
  summarySubTab,
  setSummarySubTab,
  wordOfTheDay,
  idiomOfTheDay,
  quoteOfTheDay,
  assignedGrammarian,
  clubName,
  meetingId,
  hasPublishedLiveObservations,
  hasAnyLiveMeetingNotes,
}: Props) {
  const hasWord = wordOfTheDay.word.trim().length > 0;
  const hasIdiom = !!(idiomOfTheDay?.idiom?.trim());
  const hasQuote = !!(quoteOfTheDay?.quote?.trim());

  const hasLexiconText = hasWord || hasIdiom || hasQuote;

  const hasReportsTabContent =
    hasLexiconText ||
    hasAnyLiveMeetingNotes ||
    hasPublishedLiveObservations ||
    wordOfTheDay.is_published ||
    !!idiomOfTheDay?.is_published ||
    !!quoteOfTheDay?.is_published;

  return (
    <View style={local.summaryRoot}>
      <View
        style={[
          local.mainTabRow,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            local.mainTab,
            summaryMainTab === 'lexicon' && local.mainTabActive,
            summaryMainTab === 'lexicon' && { borderBottomColor: theme.colors.primary },
          ]}
          onPress={() => setSummaryMainTab('lexicon')}
        >
          <Text
            style={[
              local.mainTabText,
              { color: theme.colors.textSecondary },
              summaryMainTab === 'lexicon' && local.mainTabTextActive,
              summaryMainTab === 'lexicon' && { color: theme.colors.primary },
            ]}
            maxFontSizeMultiplier={1.3}
          >
            Lexicon
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            local.mainTab,
            summaryMainTab === 'reports' && local.mainTabActive,
            summaryMainTab === 'reports' && { borderBottomColor: theme.colors.primary },
          ]}
          onPress={() => {
            if (reportsVisibleToMembers) setSummaryMainTab('reports');
          }}
          activeOpacity={reportsVisibleToMembers ? 0.85 : 1}
        >
          <Text
            style={[
              local.mainTabText,
              { color: theme.colors.textSecondary },
              summaryMainTab === 'reports' && local.mainTabTextActive,
              summaryMainTab === 'reports' && { color: theme.colors.primary },
              !reportsVisibleToMembers && { opacity: 0.45 },
            ]}
            maxFontSizeMultiplier={1.3}
          >
            Reports
          </Text>
        </TouchableOpacity>
      </View>

      {summaryMainTab === 'lexicon' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[local.subTabScroll, { borderBottomColor: theme.colors.border }]}
          >
            {LEXICON_TABS.map((tab) => {
              const active = summarySubTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setSummarySubTab(tab.key)}
                  style={[
                    local.subTabPill,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                    active && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '12' },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      local.subTabPillText,
                      { color: theme.colors.textSecondary },
                      active && { color: theme.colors.primary, fontWeight: '700' },
                    ]}
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={local.panel}>
        {summarySubTab === 'word' && (
          <>
            {hasWord ? (
              <View style={g.slideWrapper}>
                <View style={g.slideContainer}>
                  <View style={g.wordOfTheDayContainer}>
                    <View style={g.wordOfTheDayHeader}>
                      <View style={g.wordOfTheDayHeaderContent}>
                        <Text style={[g.wordOfTheDayHeaderTitle, { textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>
                          Word of the Day
                        </Text>
                      </View>
                    </View>
                    <View style={[g.wordOfTheDayContent, { backgroundColor: '#FFF9F0' }]}>
                      <View>
                        <View style={g.wordOfTheDayWordContainer}>
                          <Text style={[g.wordOfTheDayWord, { fontSize: 27 }]} maxFontSizeMultiplier={1.3}>
                            {wordOfTheDay.word}
                          </Text>
                          {wordOfTheDay.part_of_speech ? (
                            <View style={g.wordOfTheDayPartOfSpeechBadge}>
                              <Text style={g.wordOfTheDayPartOfSpeech} maxFontSizeMultiplier={1.3}>
                                {wordOfTheDay.part_of_speech.toLowerCase()}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {wordOfTheDay.meaning ? (
                          <View style={g.wordOfTheDaySection}>
                            <Text style={g.wordOfTheDaySectionLabel} maxFontSizeMultiplier={1.3}>
                              MEANING:
                            </Text>
                            <Text style={[g.wordOfTheDayText, { color: '#2C2C2C' }]} maxFontSizeMultiplier={1.3}>
                              {wordOfTheDay.meaning}
                            </Text>
                          </View>
                        ) : null}
                        {wordOfTheDay.usage ? (
                          <View style={g.wordOfTheDaySection}>
                            <Text style={g.wordOfTheDaySectionLabel} maxFontSizeMultiplier={1.3}>
                              USAGE:
                            </Text>
                            <Text style={[g.wordOfTheDayUsageText, { color: '#1A1A1A' }]} maxFontSizeMultiplier={1.3}>
                              {wordOfTheDay.usage}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={g.wordOfTheDayFooterSection}>
                        <View style={g.wordOfTheDayDivider} />
                        {assignedGrammarian ? (
                          <View style={g.wordOfTheDayFooter}>
                            <View style={g.wordOfTheDayAvatarContainer}>
                              {assignedGrammarian.avatar_url ? (
                                <Image source={{ uri: assignedGrammarian.avatar_url }} style={g.wordOfTheDayAvatar} />
                              ) : (
                                <View style={[g.wordOfTheDayAvatarPlaceholder, { backgroundColor: '#800000' }]}>
                                  <Text style={g.wordOfTheDayAvatarText} maxFontSizeMultiplier={1.3}>
                                    {assignedGrammarian.full_name.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View style={g.wordOfTheDayPublisherInfo}>
                              <Text style={[g.wordOfTheDayPublisherName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                {assignedGrammarian.full_name}
                              </Text>
                              {clubName ? (
                                <Text style={[g.wordOfTheDayClubNameFull, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                  {clubName}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={[local.empty, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <BookOpen size={36} color={theme.colors.textSecondary} />
                <Text style={[local.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Word of the Day yet
                </Text>
                <Text style={[local.emptyBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.25}>
                  When the Grammarian adds and publishes a word, it will appear here.
                </Text>
              </View>
            )}
          </>
        )}

        {summarySubTab === 'idiom' && (
          <>
            {hasIdiom ? (
              <View style={g.slideWrapper}>
                <View style={g.slideContainer}>
                  <View style={g.wordOfTheDayContainer}>
                    <View style={[g.wordOfTheDayHeader, { backgroundColor: '#1E40AF' }]}>
                      <View style={g.wordOfTheDayHeaderContent}>
                        <Text style={[g.wordOfTheDayHeaderTitle, { textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>
                          Idiom of the Day
                        </Text>
                      </View>
                    </View>
                    <View style={[g.wordOfTheDayContent, { backgroundColor: '#EFF6FF' }]}>
                      <View>
                        <View style={g.wordOfTheDayWordContainer}>
                          <Text style={[g.wordOfTheDayWord, { fontSize: 27 }]} maxFontSizeMultiplier={1.3}>
                            {idiomOfTheDay!.idiom}
                          </Text>
                          <View style={g.wordOfTheDayPartOfSpeechBadge}>
                            <Text style={g.wordOfTheDayPartOfSpeech} maxFontSizeMultiplier={1.3}>
                              idiom
                            </Text>
                          </View>
                        </View>
                        {idiomOfTheDay!.meaning ? (
                          <View style={g.wordOfTheDaySection}>
                            <Text style={g.wordOfTheDaySectionLabel} maxFontSizeMultiplier={1.3}>
                              MEANING:
                            </Text>
                            <Text style={[g.wordOfTheDayText, { color: '#2C2C2C' }]} maxFontSizeMultiplier={1.3}>
                              {idiomOfTheDay!.meaning}
                            </Text>
                          </View>
                        ) : null}
                        {idiomOfTheDay!.usage ? (
                          <View style={g.wordOfTheDaySection}>
                            <Text style={g.wordOfTheDaySectionLabel} maxFontSizeMultiplier={1.3}>
                              USAGE:
                            </Text>
                            <Text style={[g.wordOfTheDayUsageText, { color: '#1A1A1A' }]} maxFontSizeMultiplier={1.3}>
                              {idiomOfTheDay!.usage}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={g.wordOfTheDayFooterSection}>
                        <View style={g.wordOfTheDayDivider} />
                        {assignedGrammarian ? (
                          <View style={g.wordOfTheDayFooter}>
                            <View style={g.wordOfTheDayAvatarContainer}>
                              {assignedGrammarian.avatar_url ? (
                                <Image source={{ uri: assignedGrammarian.avatar_url }} style={g.wordOfTheDayAvatar} />
                              ) : (
                                <View style={[g.wordOfTheDayAvatarPlaceholder, { backgroundColor: '#1E40AF' }]}>
                                  <Text style={g.wordOfTheDayAvatarText} maxFontSizeMultiplier={1.3}>
                                    {assignedGrammarian.full_name.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View style={g.wordOfTheDayPublisherInfo}>
                              <Text style={[g.wordOfTheDayPublisherName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                {assignedGrammarian.full_name}
                              </Text>
                              {clubName ? (
                                <Text style={[g.wordOfTheDayClubNameFull, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                  {clubName}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={[local.empty, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Lightbulb size={36} color={theme.colors.textSecondary} />
                <Text style={[local.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Idiom of the Day yet
                </Text>
                <Text style={[local.emptyBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.25}>
                  When the Grammarian adds and publishes an idiom, it will appear here.
                </Text>
              </View>
            )}
          </>
        )}

        {summarySubTab === 'quote' && (
          <>
            {hasQuote ? (
              <View style={g.slideWrapper}>
                <View style={g.slideContainer}>
                  <View style={g.wordOfTheDayContainer}>
                    <View style={[g.wordOfTheDayHeader, { backgroundColor: '#059669' }]}>
                      <View style={g.wordOfTheDayHeaderContent}>
                        <Text style={[g.wordOfTheDayHeaderTitle, { textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>
                          Quote of the Day
                        </Text>
                      </View>
                    </View>
                    <View style={[g.wordOfTheDayContent, { backgroundColor: '#ECFDF5' }]}>
                      <View>
                        <View style={g.wordOfTheDayWordContainer}>
                          <Text style={[g.wordOfTheDayWord, { fontSize: 24 }]} maxFontSizeMultiplier={1.3}>
                            {quoteOfTheDay!.quote}
                          </Text>
                          <View style={g.wordOfTheDayPartOfSpeechBadge}>
                            <Text style={g.wordOfTheDayPartOfSpeech} maxFontSizeMultiplier={1.3}>
                              quote
                            </Text>
                          </View>
                        </View>
                        {quoteOfTheDay!.meaning ? (
                          <View style={g.wordOfTheDaySection}>
                            <Text style={g.wordOfTheDaySectionLabel} maxFontSizeMultiplier={1.3}>
                              MEANING:
                            </Text>
                            <Text style={[g.wordOfTheDayText, { color: '#2C2C2C' }]} maxFontSizeMultiplier={1.3}>
                              {quoteOfTheDay!.meaning}
                            </Text>
                          </View>
                        ) : null}
                        {quoteOfTheDay!.usage ? (
                          <View style={g.wordOfTheDaySection}>
                            <Text style={g.wordOfTheDaySectionLabel} maxFontSizeMultiplier={1.3}>
                              USAGE:
                            </Text>
                            <Text style={[g.wordOfTheDayUsageText, { color: '#1A1A1A' }]} maxFontSizeMultiplier={1.3}>
                              {quoteOfTheDay!.usage}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={g.wordOfTheDayFooterSection}>
                        <View style={g.wordOfTheDayDivider} />
                        {assignedGrammarian ? (
                          <View style={g.wordOfTheDayFooter}>
                            <View style={g.wordOfTheDayAvatarContainer}>
                              {assignedGrammarian.avatar_url ? (
                                <Image source={{ uri: assignedGrammarian.avatar_url }} style={g.wordOfTheDayAvatar} />
                              ) : (
                                <View style={[g.wordOfTheDayAvatarPlaceholder, { backgroundColor: '#059669' }]}>
                                  <Text style={g.wordOfTheDayAvatarText} maxFontSizeMultiplier={1.3}>
                                    {assignedGrammarian.full_name.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View style={g.wordOfTheDayPublisherInfo}>
                              <Text style={[g.wordOfTheDayPublisherName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                {assignedGrammarian.full_name}
                              </Text>
                              {clubName ? (
                                <Text style={[g.wordOfTheDayClubNameFull, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                  {clubName}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={[local.empty, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MessageSquare size={36} color={theme.colors.textSecondary} />
                <Text style={[local.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Quote of the Day yet
                </Text>
                <Text style={[local.emptyBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.25}>
                  When the Grammarian adds and publishes a quote, it will appear here.
                </Text>
              </View>
            )}
          </>
        )}
          </View>
        </>
      ) : (
        <View
          style={[
            local.panel,
            {
              backgroundColor:
                theme.mode === 'light' ? '#FBFBFA' : theme.colors.background,
            },
          ]}
        >
          {!reportsVisibleToMembers ? (
            <View style={g.summaryRedirectContainer}>
              <View style={g.summaryRedirectContent}>
                <View style={[g.summaryIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <BookOpen size={32} color={theme.colors.primary} />
                </View>
                <Text style={[g.summaryRedirectTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Report is yet to be published..
                </Text>
                <Text style={[g.summaryRedirectDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  The Grammarian or VPE can turn on &quot;Show report to member&quot; under Grammarian Corner → Live meeting when the report is ready.
                </Text>
              </View>
            </View>
          ) : hasReportsTabContent ? (
            <GrammarianConsolidatedReportInner variant="embedded" meetingId={meetingId} />
          ) : (
            <View style={g.summaryRedirectContainer}>
              <View style={g.summaryRedirectContent}>
                <View style={[g.summaryIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <BookOpen size={32} color={theme.colors.primary} />
                </View>
                <Text style={[g.summaryRedirectTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Summary Coming Soon
                </Text>
                <Text style={[g.summaryRedirectDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  When the Grammarian adds Word, Idiom, Quote, or live Good usage / Opportunity, the report will appear here.
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  summaryRoot: {
    width: '100%',
    paddingBottom: 8,
  },
  mainTabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mainTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mainTabActive: {
    borderBottomWidth: 2,
  },
  mainTabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  mainTabTextActive: {
    fontWeight: '700',
  },
  subTabScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 4,
  },
  subTabPillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  panel: {
    paddingTop: 12,
  },
  empty: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
