import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarDays,
  ChevronRight,
  Home,
  Info,
  Landmark,
  ListChecks,
  Mic2,
  Settings,
  Shield,
  UserCog,
  UserCheck,
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
};

type TrainingRowProps = {
  title: string;
  description: string;
  descriptionEmphasized?: boolean;
  icon: React.ReactNode;
  hideBottomBorder?: boolean;
  onPress?: () => void;
};

function TrainingRow({
  title,
  description,
  descriptionEmphasized,
  icon,
  hideBottomBorder,
  onPress,
}: TrainingRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, hideBottomBorder && styles.rowNoBorder]}
      activeOpacity={0.7}
      onPress={onPress ?? (() => {})}
    >
      <View style={styles.rowLeft}>
        <View style={styles.iconTile}>{icon}</View>
        <View style={styles.textWrap}>
          <Text style={styles.rowTitle} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          <Text
            style={descriptionEmphasized ? styles.rowDescEmphasis : styles.rowDesc}
            maxFontSizeMultiplier={1.25}
          >
            {description}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={N.textTertiary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

export default function T360TrainingScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace('/(tabs)/settings')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={N.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
          T360 training
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.group}>
        <TrainingRow
          icon={<Building2 size={18} color="#2563EB" strokeWidth={1.8} />}
          title="Create a Club"
          description="Follow this quick guide to set up your club in T360, manage roles, and get your members onboard."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-excomm-create-club')}
        />
        <TrainingRow
          icon={<UserPlus size={18} color="#16A34A" strokeWidth={1.8} />}
          title="Invite New Club Members"
          description="Knowledge base: who can invite, roles, sending invites, and what invitees do next."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-excomm-invite-members')}
        />
        <TrainingRow
          icon={<UserCog size={18} color="#0369A1" strokeWidth={1.8} />}
          title="Manage Club Members"
          description="Knowledge base: roles, removals, accurate records, and FAQs for ExCom."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-excomm-manage-club-members')}
        />
        <TrainingRow
          icon={<Calendar size={18} color="#0EA5E9" strokeWidth={1.8} />}
          title="Create & Manage Meeting"
          description="Knowledge base: create, edit, modes, statuses, open limit, visibility, roles, and FAQs for ExCom."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-excomm-manage-meetings')}
        />
        <TrainingRow
          icon={<UserCheck size={18} color="#15803D" strokeWidth={1.8} />}
          title="Book a Role"
          description="Knowledge base: Open, Mine, and Taken sections; how to book; after booking; FAQs."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-book-a-role')}
        />
        <TrainingRow
          icon={<Mic2 size={18} color="#7C2D12" strokeWidth={1.8} />}
          title="Toastmaster of the Day Role"
          description="Knowledge base: book from Home or Book a Role, withdraw, Toastmaster Corner, Theme of the Day, FAQs."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-toastmaster-of-the-day')}
        />
        <TrainingRow
          icon={<ListChecks size={18} color="#D97706" strokeWidth={1.8} />}
          title="Agenda creation"
          description="Create, customize, manage, and share meeting agendas with ease."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-excomm-agenda-creation')}
        />
        <TrainingRow
          icon={<Vote size={18} color="#7C3AED" strokeWidth={1.8} />}
          title="Voting operations"
          description="Fair, structured, anonymous voting from poll creation to results."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-excomm-voting-operations')}
        />
        <TrainingRow
          icon={<Home size={18} color="#0D9488" strokeWidth={1.8} />}
          title="Getting Started with Home Tab"
          description="Everything you need to participate, prepare, and track your Toastmasters journey in one place."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-home-tab')}
        />
        <TrainingRow
          icon={<Landmark size={18} color="#CA8A04" strokeWidth={1.8} />}
          title="Explore Your Club"
          description="Explore your club, stay connected, and track club activities and performance"
          descriptionEmphasized
          onPress={() => router.push('/t360-training-explore-club')}
        />
        <TrainingRow
          icon={<CalendarDays size={18} color="#0369A1" strokeWidth={1.8} />}
          title="Meeting Tab Overview"
          description="Manage upcoming meetings, access meeting history, and stay updated on club sessions."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-meeting-tab')}
        />
        <TrainingRow
          icon={<Info size={18} color="#0F172A" strokeWidth={1.8} />}
          title="Club Info"
          description="Admin Panel — maintain official club details for members, guests, and the Club Tab."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-club-info-admin')}
        />
        <TrainingRow
          icon={<Users size={18} color="#5B21B6" strokeWidth={1.8} />}
          title="Club ExComm"
          description="Manage Executive Committee roles, assignments, and terms for your club."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-club-excomm')}
        />
        <TrainingRow
          icon={<Shield size={18} color="#7F1D1D" strokeWidth={1.8} />}
          title="Admin Overview"
          description="Manage club operations, members, meetings, and settings from one central place."
          descriptionEmphasized
          onPress={() => router.push('/t360-training-admin-overview')}
        />
        <TrainingRow
          icon={<Settings size={18} color="#57534E" strokeWidth={1.8} />}
          title="Settings Tab Overview"
          description="Manage your profile, preferences, support options, and account settings in one place."
          descriptionEmphasized
          hideBottomBorder
          onPress={() => router.push('/t360-training-settings-tab')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: N.page,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: N.text,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  group: {
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: N.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowNoBorder: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(55, 53, 47, 0.06)',
  },
  textWrap: {
    flex: 1,
  },
  rowTitle: {
    color: N.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowDesc: {
    color: N.textSecondary,
    fontSize: 13,
  },
  rowDescEmphasis: {
    color: 'rgba(55, 53, 47, 0.78)',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
