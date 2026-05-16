import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Calendar,
  ClipboardList,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  History,
  Home,
  Info,
  Landmark,
  ListChecks,
  MessageCircle,
  MessageSquare,
  Mic,
  Mic2,
  Settings,
  Share2,
  Sparkles,
  TrendingUp,
  Shield,
  UserCog,
  UserCheck,
  User,
  UserPlus,
  Users,
  Vote,
} from 'lucide-react-native';
import { goBackOrReplace } from '@/lib/trainingBackNavigation';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
  textTertiary: 'rgba(55, 53, 47, 0.45)',
  accent: '#2383E2',
  accentSoft: 'rgba(35, 131, 226, 0.1)',
  iconMuted: 'rgba(55, 53, 47, 0.45)',
  iconTile: 'rgba(55, 53, 47, 0.06)',
};

type TrainingRowProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBackgroundColor?: string;
  hideBottomBorder?: boolean;
  onPress?: () => void;
};

function TrainingRow({
  title,
  description,
  icon,
  iconBackgroundColor,
  hideBottomBorder,
  onPress,
}: TrainingRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, !hideBottomBorder && styles.rowBorder]}
      activeOpacity={0.65}
      onPress={onPress ?? (() => {})}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconTile, { backgroundColor: iconBackgroundColor ?? N.iconTile }]}>{icon}</View>
        <View style={styles.textWrap}>
          <Text style={styles.rowTitle} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          <Text style={styles.rowDesc} maxFontSizeMultiplier={1.25}>
            {description}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={N.textTertiary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

function SectionLabel({ children, count }: { children: string; count?: number }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.2}>
        {children}
      </Text>
      {count != null ? (
        <View style={styles.sectionCountPill}>
          <Text style={styles.sectionCountText} maxFontSizeMultiplier={1.1}>
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TrainingSection({
  label,
  count,
  subtitle,
  children,
}: {
  label: string;
  count: number;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionBlock}>
      <SectionLabel count={count}>{label}</SectionLabel>
      {subtitle ? (
        <Text style={styles.sectionSubtitle} maxFontSizeMultiplier={1.2}>
          {subtitle}
        </Text>
      ) : null}
      <View style={styles.notionGroup}>{children}</View>
    </View>
  );
}

const EXCOMM_COUNT = 6;
const CLUB_OPS_COUNT = 3;
const MEMBER_COUNT = 16;

export default function T360TrainingScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => goBackOrReplace('/(tabs)/settings')}
            activeOpacity={0.65}
          >
            <ArrowLeft size={20} color={N.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <BookOpen size={13} color={N.accent} strokeWidth={2} />
            <Text style={styles.heroBadgeText} maxFontSizeMultiplier={1.15}>
              Knowledge base
            </Text>
          </View>
          <Text style={styles.heroTitle} maxFontSizeMultiplier={1.35}>
            T360 training
          </Text>
          <Text style={styles.heroSubtitle} maxFontSizeMultiplier={1.3}>
            Step-by-step guides for ExComm leadership and everyday club participation — open any topic to learn how
            features work in the app.
          </Text>
        </View>

        <View style={[styles.insetDivider, { backgroundColor: N.border }]} />

        <TrainingSection label="For ExComm Users" count={EXCOMM_COUNT} subtitle="Start Here">
          <TrainingRow
            icon={<Building2 size={17} color="#2563EB" strokeWidth={2} />}
            iconBackgroundColor="#EFF6FF"
            title="Create a Club"
            description="Set up your club in T360, manage roles, and get members onboard."
            onPress={() => router.push('/t360-training-excomm-create-club')}
          />
          <TrainingRow
            icon={<UserPlus size={17} color="#16A34A" strokeWidth={2} />}
            iconBackgroundColor="#F0FDF4"
            title="Invite New Club Members"
            description="Who can invite, roles, sending invites, and what invitees do next."
            onPress={() => router.push('/t360-training-excomm-invite-members')}
          />
          <TrainingRow
            icon={<UserCog size={17} color="#0369A1" strokeWidth={2} />}
            iconBackgroundColor="#ECFEFF"
            title="Manage Club Members"
            description="Roles, removals, accurate records, and FAQs for ExCom."
            onPress={() => router.push('/t360-training-excomm-manage-club-members')}
          />
          <TrainingRow
            icon={<Calendar size={17} color="#0EA5E9" strokeWidth={2} />}
            iconBackgroundColor="#F0F9FF"
            title="Create & Manage Meeting"
            description="Create, edit, modes, statuses, open limit, visibility, and roles."
            onPress={() => router.push('/t360-training-excomm-manage-meetings')}
          />
          <TrainingRow
            icon={<ListChecks size={17} color="#D97706" strokeWidth={2} />}
            iconBackgroundColor="#FFFBEB"
            title="Agenda Creator"
            description="Visibility, layouts, auto fill, sharing, live updates, and FAQs."
            onPress={() => router.push('/t360-training-excomm-agenda-creation')}
          />
          <TrainingRow
            icon={<Vote size={17} color="#7C3AED" strokeWidth={2} />}
            iconBackgroundColor="#F5F3FF"
            title="Voting operations"
            description="Fair, structured, anonymous voting from poll creation to results."
            hideBottomBorder
            onPress={() => router.push('/t360-training-excomm-voting-operations')}
          />
        </TrainingSection>

        <TrainingSection label="Club Operations" count={CLUB_OPS_COUNT}>
          <TrainingRow
            icon={<Info size={17} color="#334155" strokeWidth={2} />}
            iconBackgroundColor="#F8FAFC"
            title="Club Info"
            description="Maintain official club details for members, guests, and the Club Tab."
            onPress={() => router.push('/t360-training-club-info-admin')}
          />
          <TrainingRow
            icon={<Users size={17} color="#5B21B6" strokeWidth={2} />}
            iconBackgroundColor="#F5F3FF"
            title="Club ExComm"
            description="Executive Committee roles, assignments, and terms."
            onPress={() => router.push('/t360-training-club-excomm')}
          />
          <TrainingRow
            icon={<Share2 size={17} color="#C026D3" strokeWidth={2} />}
            iconBackgroundColor="#FDF4FF"
            title="Club Social Media"
            description="EXCOMM updates in Admin Panel, platforms, My Clubs visibility, auto-save."
            hideBottomBorder
            onPress={() => router.push('/t360-training-club-social-media')}
          />
        </TrainingSection>

        <TrainingSection label="For All Other Users" count={MEMBER_COUNT}>
          <TrainingRow
            icon={<History size={17} color="#0284C7" strokeWidth={2} />}
            iconBackgroundColor="#F0F9FF"
            title="Meeting History"
            description="Completed meetings, agendas, role records, and historical club data."
            onPress={() => router.push('/t360-training-meeting-history')}
          />
          <TrainingRow
            icon={<UserCheck size={17} color="#15803D" strokeWidth={2} />}
            iconBackgroundColor="#F0FDF4"
            title="Book a Role"
            description="Open, Mine, and Taken sections; how to book; after booking; FAQs."
            onPress={() => router.push('/t360-training-book-a-role')}
          />
          <TrainingRow
            icon={<Mic2 size={17} color="#9A3412" strokeWidth={2} />}
            iconBackgroundColor="#FFF7ED"
            title="Toastmaster of the Day Role"
            description="Book from Home or Book a Role, Toastmaster Corner, Theme of the Day."
            onPress={() => router.push('/t360-training-toastmaster-of-the-day')}
          />
          <TrainingRow
            icon={<GraduationCap size={17} color="#2563EB" strokeWidth={2} />}
            iconBackgroundColor="#EFF6FF"
            title="Educational Speaker Role"
            description="Educational Corner, speech title, permissions, and FAQs."
            onPress={() => router.push('/t360-training-educational-speaker-role')}
          />
          <TrainingRow
            icon={<Sparkles size={17} color="#B45309" strokeWidth={2} />}
            iconBackgroundColor="#FFFBEB"
            title="Keynote Speaker Role"
            description="Meetings tab, Book a Role, Keynote Title, responsibilities."
            onPress={() => router.push('/t360-training-keynote-speaker-role')}
          />
          <TrainingRow
            icon={<ClipboardList size={17} color="#1D4ED8" strokeWidth={2} />}
            iconBackgroundColor="#EFF6FF"
            title="General Evaluator Role"
            description="GE Corner vs GE Summary, Eye toggle, publish workflow."
            onPress={() => router.push('/t360-training-general-evaluator-role')}
          />
          <TrainingRow
            icon={<Mic size={17} color="#2563EB" strokeWidth={2} />}
            iconBackgroundColor="#EFF6FF"
            title="Prepared Speaker Role"
            description="Book a Role or Prepared Speeches, speech details, evaluation form."
            onPress={() => router.push('/t360-training-prepared-speaker-role')}
          />
          <TrainingRow
            icon={<MessageCircle size={17} color="#0D9488" strokeWidth={2} />}
            iconBackgroundColor="#F0FDFA"
            title="Table Topics Speaker Role"
            description="Table Topic Corner or Book a Role, benefits, and best practices."
            onPress={() => router.push('/t360-training-table-topics-speaker-role')}
          />
          <TrainingRow
            icon={<MessageSquare size={17} color="#0F766E" strokeWidth={2} />}
            iconBackgroundColor="#ECFDF5"
            title="Table Topic Master"
            description="Table Topic Corner & Summary, question repository, digital workflow."
            onPress={() => router.push('/t360-training-table-topic-master')}
          />
          <TrainingRow
            icon={<User size={17} color="#BE185D" strokeWidth={2} />}
            iconBackgroundColor="#FDF2F8"
            title="My Profile"
            description="Photo, contact info, About section, social links, and why it matters."
            onPress={() => router.push('/t360-training-my-profile')}
          />
          <TrainingRow
            icon={<TrendingUp size={17} color="#2563EB" strokeWidth={2} />}
            iconBackgroundColor="#EFF6FF"
            title="My Growth"
            description="Attendance, awards, role insights across four tracks, growth intelligence."
            onPress={() => router.push('/t360-training-my-growth')}
          />
          <TrainingRow
            icon={<Home size={17} color="#0D9488" strokeWidth={2} />}
            iconBackgroundColor="#F0FDFA"
            title="Getting Started with Home Tab"
            description="Participate, prepare, and track your Toastmasters journey in one place."
            onPress={() => router.push('/t360-training-home-tab')}
          />
          <TrainingRow
            icon={<Landmark size={17} color="#CA8A04" strokeWidth={2} />}
            iconBackgroundColor="#FEFCE8"
            title="Explore Your Club"
            description="Stay connected and track club activities and performance."
            onPress={() => router.push('/t360-training-explore-club')}
          />
          <TrainingRow
            icon={<CalendarDays size={17} color="#0369A1" strokeWidth={2} />}
            iconBackgroundColor="#ECFEFF"
            title="Meeting Tab Overview"
            description="Upcoming meetings, meeting history, and club sessions."
            onPress={() => router.push('/t360-training-meeting-tab')}
          />
          <TrainingRow
            icon={<Shield size={17} color="#B91C1C" strokeWidth={2} />}
            iconBackgroundColor="#FEF2F2"
            title="Admin Overview"
            description="Club operations, members, meetings, and settings in one place."
            onPress={() => router.push('/t360-training-admin-overview')}
          />
          <TrainingRow
            icon={<Settings size={17} color="#57534E" strokeWidth={2} />}
            iconBackgroundColor="#F5F5F4"
            title="Settings Tab Overview"
            description="Profile, preferences, support options, and account settings."
            hideBottomBorder
            onPress={() => router.push('/t360-training-settings-tab')}
          />
        </TrainingSection>

        <Text style={styles.footerNote} maxFontSizeMultiplier={1.2}>
          Tap any guide to open the full knowledge base article.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: N.page,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    ...Platform.select({
      web: { cursor: 'pointer' as const },
      default: {},
    }),
  },
  hero: {
    marginBottom: 4,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: N.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    marginBottom: 14,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: N.accent,
    letterSpacing: 0.06,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: N.text,
    letterSpacing: -0.6,
    lineHeight: 38,
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: N.textSecondary,
    maxWidth: 520,
  },
  insetDivider: {
    height: 1,
    marginVertical: 22,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: N.textSecondary,
    letterSpacing: 0.04,
    textTransform: 'uppercase',
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: N.text,
    letterSpacing: -0.2,
    marginTop: -2,
    marginBottom: 10,
  },
  sectionCountPill: {
    backgroundColor: N.iconTile,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: N.border,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: N.textTertiary,
  },
  notionGroup: {
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 4,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(15, 15, 15, 0.04)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
      },
      default: {},
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: N.surface,
    minHeight: 64,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: N.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: N.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
    marginBottom: 2,
  },
  rowDesc: {
    color: N.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  footerNote: {
    fontSize: 12,
    color: N.textTertiary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
});
