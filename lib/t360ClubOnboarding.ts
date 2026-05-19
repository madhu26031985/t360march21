import { supabase } from '@/lib/supabase';
import {
  clubCharterDateProgress,
  clubFaqProgress,
  clubInfoTabProgress,
  clubLocationTabProgress,
  clubMeetingDetailsTabProgress,
  clubMoreDetailsTabProgress,
  clubNameProgress,
  clubNumberProgress,
  clubSocialMediaProgress,
  type ClubProfileSetupFields,
  type FieldProgress,
} from '@/lib/clubInfoSetupCompletion';
import { computeClubUserManagementOnboarding } from '@/lib/clubUserManagementOnboarding';
import { computeExcommClubOnboarding } from '@/lib/excommClubOnboarding';
import {
  computeMeetingManagementOnboarding,
  fetchAllClubMeetingRoles,
  hasPreparedSpeechDetailsCaptured,
  type MeetingManagementOnboardingProgress,
} from '@/lib/meetingManagementOnboarding';
import {
  computeMeetingAgendaOnboarding,
  type MeetingAgendaOnboardingProgress,
} from '@/lib/meetingAgendaOnboarding';
import {
  computeVotingOperationsOnboarding,
  type VotingOperationsOnboardingProgress,
} from '@/lib/votingOperationsOnboarding';
import {
  hasT360AgendaBannerColorChanged,
  hasT360ShareAppUsed,
} from '@/lib/t360OnboardingLocalMarkers';
export type T360OnboardingItem = {
  id: string;
  label: string;
  done: boolean;
  fieldsDone: number;
  fieldsTotal: number;
};

export type T360OnboardingItemGroup = {
  id: string;
  title: string;
  items: T360OnboardingItem[];
};

export type T360OnboardingSection = {
  id: string;
  title: string;
  items: T360OnboardingItem[];
  groups?: T360OnboardingItemGroup[];
};

export function sectionItems(section: T360OnboardingSection): T360OnboardingItem[] {
  if (section.groups?.length) return section.groups.flatMap((group) => group.items);
  return section.items;
}

export function sectionTaskProgress(section: T360OnboardingSection): {
  tasksDone: number;
  tasksTotal: number;
} {
  const items = sectionItems(section);
  const tasksDone = items.filter((i) => i.done).length;
  return { tasksDone, tasksTotal: items.length };
}

export type T360ClubOnboardingProgress = {
  sections: T360OnboardingSection[];
  completedCount: number;
  totalCount: number;
  percent: number;
  isComplete: boolean;
};

function itemFromProgress(id: string, label: string, progress: FieldProgress): T360OnboardingItem {
  const fieldsDone = progress.done;
  const fieldsTotal = progress.total;
  return {
    id,
    label,
    fieldsDone,
    fieldsTotal,
    done: fieldsTotal > 0 && fieldsDone >= fieldsTotal,
  };
}

function buildSections(input: {
  club: { name?: string | null; club_number?: string | null; charter_date?: string | null } | null;
  profile: ClubProfileSetupFields | null;
  faqRows: {
    question?: string | null;
    answer?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }[];
  userManagement: ReturnType<typeof computeClubUserManagementOnboarding>;
  excommManagement: ReturnType<typeof computeExcommClubOnboarding>;
  meetingManagement: MeetingManagementOnboardingProgress;
  meetingAgenda: MeetingAgendaOnboardingProgress;
  votingOperations: VotingOperationsOnboardingProgress;
}): T360OnboardingSection[] {
  return [
    {
      id: 'create_club',
      title: 'Create a club',
      items: [
        itemFromProgress('club_name', 'Club name', clubNameProgress(input.club)),
        itemFromProgress('club_charter_date', 'Club charter date', clubCharterDateProgress(input.club)),
        itemFromProgress('club_number', 'Club number', clubNumberProgress(input.club)),
      ],
    },
    {
      id: 'setting_up',
      title: 'Setting up the club',
      items: [
        itemFromProgress('club_info', 'Club Info', clubInfoTabProgress(input.club, input.profile)),
        itemFromProgress('club_location', 'Club location', clubLocationTabProgress(input.profile)),
        itemFromProgress('club_meeting_details', 'Club meeting details', clubMeetingDetailsTabProgress(input.profile)),
        itemFromProgress('club_more_details', 'Club more details', clubMoreDetailsTabProgress(input.profile)),
        itemFromProgress('club_social', 'Club social media', clubSocialMediaProgress(input.profile)),
        itemFromProgress('club_faq', 'Club FAQ', clubFaqProgress(input.faqRows)),
      ],
    },
    {
      id: 'user_management',
      title: 'Club user management',
      items: [
        itemFromProgress('invites_member', '2 members invited', input.userManagement.invitesMemberRole),
        itemFromProgress('invites_excomm', '1 ExComm invited', input.userManagement.invitesExcommRole),
        itemFromProgress(
          'invites_visiting_tm',
          '1 visiting Toastmaster invited',
          input.userManagement.invitesVisitingTm
        ),
        itemFromProgress('invites_guest', '1 guest invited', input.userManagement.invitesGuest),
        itemFromProgress('joined_member', '2 members joined the club', input.userManagement.joinedMember),
        itemFromProgress('joined_excomm', '1 ExComm joined the club', input.userManagement.joinedExcomm),
        itemFromProgress(
          'joined_visiting_tm',
          '1 visiting Toastmaster joined the club',
          input.userManagement.joinedVisitingTm
        ),
        itemFromProgress('joined_guest', '1 guest joined the club', input.userManagement.joinedGuest),
        itemFromProgress(
          'share_app_settings',
          'Used share app from settings',
          input.userManagement.shareAppFromSettings
        ),
      ],
    },
    {
      id: 'manage_club_excomm',
      title: 'Manage Club ExComm',
      items: [
        itemFromProgress('president_assigned', 'President assigned', input.excommManagement.presidentAssigned),
        itemFromProgress('vpe_assigned', 'VPE assigned', input.excommManagement.vpeAssigned),
        itemFromProgress('vpm_assigned', 'VPM assigned', input.excommManagement.vpmAssigned),
      ],
    },
    buildMeetingManagementSection(input.meetingManagement),
    {
      id: 'meeting_agenda',
      title: 'Meeting Agenda',
      items: [
        itemFromProgress('agenda_created', 'Agenda created', input.meetingAgenda.agendaCreated),
        itemFromProgress('agenda_link_shared', 'Agenda link shared', input.meetingAgenda.agendaLinkShared),
        itemFromProgress(
          'agenda_banner_color',
          'Agenda banner color changed',
          input.meetingAgenda.agendaBannerColorChanged
        ),
      ],
    },
    {
      id: 'voting_operations',
      title: 'Voting Operations',
      items: [
        itemFromProgress('voting_created', 'Voting created', input.votingOperations.votingCreated),
        itemFromProgress('five_users_voted', '5 users voted', input.votingOperations.fiveUsersVoted),
        itemFromProgress(
          'five_questions_filled',
          '5 questions filled',
          input.votingOperations.fiveQuestionsFilled
        ),
        itemFromProgress('voting_closed', 'Voting closed', input.votingOperations.votingClosed),
      ],
    },
  ];
}

function buildMeetingManagementSection(
  mm: MeetingManagementOnboardingProgress
): T360OnboardingSection {
  const group = (
    id: string,
    title: string,
    entries: { itemId: string; label: string; key: keyof MeetingManagementOnboardingProgress }[]
  ): T360OnboardingItemGroup => ({
    id,
    title,
    items: entries.map(({ itemId, label, key }) => itemFromProgress(itemId, label, mm[key])),
  });

  return {
    id: 'meeting_management',
    title: 'Meeting management',
    items: [],
    groups: [
      group('creation_planning', 'Meeting Creation & Planning', [
        { itemId: 'one_meeting_created', label: 'One meeting created', key: 'oneMeetingCreated' },
        {
          itemId: 'two_additional_meetings',
          label: 'Two additional meetings planned',
          key: 'twoAdditionalMeetingsPlanned',
        },
        { itemId: 'edit_meeting_once', label: 'Edit meeting used once', key: 'editMeetingUsedOnce' },
        { itemId: 'excomm_assigned_role', label: 'ExComm assigned a role', key: 'excommAssignedRole' },
        { itemId: 'excomm_reassigned_role', label: 'ExComm reassigned a role', key: 'excommReassignedRole' },
      ]),
      group('role_bookings', 'Role Bookings', [
        {
          itemId: 'five_roles_five_members',
          label: 'At least 5 roles booked by 5 different members',
          key: 'fiveRolesFiveMembers',
        },
        { itemId: 'book_role_five_times', label: 'Book a role feature used 5 times', key: 'bookRoleUsedFiveTimes' },
        { itemId: 'toastmaster_booked', label: 'Toastmaster role booked', key: 'toastmasterBooked' },
        { itemId: 'prepared_speaker_booked', label: 'Prepared Speaker role booked', key: 'preparedSpeakerBooked' },
        { itemId: 'evaluator_booked', label: 'Evaluator role booked', key: 'evaluatorBooked' },
        { itemId: 'general_evaluator_booked', label: 'General Evaluator role booked', key: 'generalEvaluatorBooked' },
        { itemId: 'tt_master_booked', label: 'Table Topics Master role booked', key: 'tableTopicsMasterBooked' },
        { itemId: 'tt_speaker_booked', label: 'Table Topics Speaker role booked', key: 'tableTopicsSpeakerBooked' },
        { itemId: 'timer_booked', label: 'Timer role booked', key: 'timerBooked' },
        { itemId: 'timer_report_captured', label: 'Timer report information captured', key: 'timerReportCaptured' },
        { itemId: 'grammarian_booked', label: 'Grammarian role booked', key: 'grammarianBooked' },
        { itemId: 'grammarian_report_published', label: 'Grammarian report published', key: 'grammarianReportPublished' },
        { itemId: 'ah_counter_booked', label: 'Ah-Counter role booked', key: 'ahCounterBooked' },
        { itemId: 'ah_counter_report_captured', label: 'Ah-Counter report captured', key: 'ahCounterReportCaptured' },
      ]),
      group('content_updates', 'Meeting Content Updates', [
        {
          itemId: 'toastmaster_theme_updated',
          label: 'Toastmaster Corner theme updated',
          key: 'toastmasterCornerThemeUpdated',
        },
        {
          itemId: 'prepared_speech_updated',
          label: 'Prepared speech details updated',
          key: 'preparedSpeechDetailsUpdated',
        },
        { itemId: 'word_of_day_updated', label: 'Word of the Day updated', key: 'wordOfTheDayUpdated' },
        {
          itemId: 'table_topics_updated',
          label: 'Table Topics questions updated',
          key: 'tableTopicsQuestionsUpdated',
        },
      ]),
    ],
  };
}

function summarize(sections: T360OnboardingSection[]): T360ClubOnboardingProgress {
  const items = sections.flatMap((s) => sectionItems(s));
  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  return {
    sections,
    completedCount,
    totalCount,
    percent,
    isComplete: completedCount === totalCount && totalCount > 0,
  };
}

export const EMPTY_T360_CLUB_ONBOARDING: T360ClubOnboardingProgress = summarize(
  buildSections({
    club: null,
    profile: null,
    faqRows: [],
    userManagement: computeClubUserManagementOnboarding([], [], false),
    excommManagement: computeExcommClubOnboarding(null),
    meetingManagement: computeMeetingManagementOnboarding({
      meetings: [],
      roles: [],
      timerReportCount: 0,
      grammarianReportPublished: false,
      ahCounterReportCount: 0,
      toastmasterThemeUpdated: false,
      preparedSpeechDetailsUpdated: false,
      wordOfTheDayUpdated: false,
      tableTopicsQuestionsUpdated: false,
    }),
    meetingAgenda: computeMeetingAgendaOnboarding({
      agendaItemCount: 0,
      meetings: [],
      agendaBannerColorChanged: false,
    }),
    votingOperations: computeVotingOperationsOnboarding({
      pollCount: 0,
      distinctVoterCount: 0,
      distinctQuestionCount: 0,
      pollClosedCount: 0,
    }),
  })
);

/** True when the user may see the club onboarding checklist (creator or ExComm). */
export async function shouldShowT360ClubOnboarding(
  clubId: string,
  userId: string
): Promise<boolean> {
  const { data: club, error } = await supabase
    .from('clubs')
    .select('created_by')
    .eq('id', clubId)
    .maybeSingle();

  if (error || !club) return false;
  if (club.created_by === userId) return true;

  const { data: membership, error: membershipError } = await supabase
    .from('app_club_user_relationship')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError || !membership) return false;
  return membership.role === 'excomm';
}

/**
 * Loads checklist completion from existing club data.
 * Some meeting steps use heuristics when no audit trail exists (role reassignment, agenda copy).
 */
export async function fetchT360ClubOnboardingProgress(
  clubId: string,
  userId: string
): Promise<T360ClubOnboardingProgress> {
  const [
    clubRes,
    faqRes,
    inviteRes,
    membersRes,
    meetingsRes,
    pollsRes,
    shareAppUsed,
    agendaBannerChanged,
  ] = await Promise.all([
    supabase
      .from('clubs')
      .select(
        `
        id,
        name,
        club_number,
        charter_date,
        club_profiles (
          club_mission,
          club_status,
          club_type,
          banner_color,
          country,
          time_zone,
          address,
          city,
          google_location_link,
          region,
          district,
          division,
          area,
          meeting_day,
          meeting_frequency,
          meeting_start_time,
          meeting_end_time,
          meeting_type,
          online_meeting_link,
          vpe_id,
          president_id,
          vpm_id,
          vppr_id,
          secretary_id,
          treasurer_id,
          saa_id,
          ipp_id,
          facebook_url,
          twitter_url,
          linkedin_url,
          instagram_url,
          whatsapp_url,
          youtube_url,
          website_url
        )
      `
      )
      .eq('id', clubId)
      .maybeSingle(),
    supabase.from('club_faq_items').select('id, question, answer, created_at, updated_at').eq('club_id', clubId),
    supabase.from('app_user_invitation').select('id, invitee_role').eq('club_id', clubId),
    supabase.from('app_club_user_relationship').select('id, user_id, role').eq('club_id', clubId),
    supabase
      .from('app_club_meeting')
      .select('id, created_at, updated_at, is_agenda_visible, club_info_banner_color')
      .eq('club_id', clubId),
    supabase.from('polls').select('id, status').eq('club_id', clubId),
    hasT360ShareAppUsed(clubId, userId),
    hasT360AgendaBannerColorChanged(clubId, userId),
  ]);

  const club = clubRes.data;
  const rawProfile = club?.club_profiles;
  const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
  const profileRecord =
    profile && typeof profile === 'object' ? (profile as Record<string, unknown>) : null;
  const profileSetup = profileRecord as ClubProfileSetupFields | null;

  const members = membersRes.data ?? [];
  const meetings = meetingsRes.data ?? [];
  const roles = await fetchAllClubMeetingRoles(clubId);
  const meetingIds = meetings.map((m) => m.id);
  const polls = pollsRes.data ?? [];
  const pollIds = polls.map((p) => p.id);

  const [
    agendaItemsRes,
    pollItemsRes,
    pollVotesRes,
    timerReportRes,
    grammarianWordPublishedRes,
    grammarianIdiomPublishedRes,
    grammarianQuotePublishedRes,
    ahCounterReportRes,
    toastmasterThemesRes,
    tableTopicsRes,
    grammarianWordsRes,
    evaluationPathwayRes,
  ] = await Promise.all([
    meetingIds.length > 0
      ? supabase
          .from('meeting_agenda_items')
          .select('id', { count: 'exact', head: true })
          .in('meeting_id', meetingIds)
      : Promise.resolve({ count: 0 }),
    pollIds.length > 0
      ? supabase.from('poll_items').select('question_id').in('poll_id', pollIds)
      : Promise.resolve({ data: [] as { question_id: string }[] }),
    pollIds.length > 0
      ? supabase.from('simple_poll_votes').select('user_id').in('poll_id', pollIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    supabase
      .from('timer_reports')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId),
    supabase
      .from('grammarian_word_of_the_day')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_published', true),
    supabase
      .from('grammarian_idiom_of_the_day')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_published', true),
    supabase
      .from('grammarian_quote_of_the_day')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_published', true),
    supabase
      .from('ah_counter_reports')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId),
    meetingIds.length > 0
      ? supabase
          .from('toastmaster_meeting_data')
          .select('theme_of_the_day')
          .in('meeting_id', meetingIds)
      : Promise.resolve({ data: [] as { theme_of_the_day: string | null }[] }),
    meetingIds.length > 0
      ? supabase.from('table_topic_master_questions').select('id').in('meeting_id', meetingIds).limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
    supabase.from('grammarian_word_of_the_day').select('word').eq('club_id', clubId),
    meetingIds.length > 0
      ? supabase
          .from('app_evaluation_pathway')
          .select(
            'role_name, speech_title, pathway_name, project_name, level, evaluation_form, comments_for_evaluator'
          )
          .in('meeting_id', meetingIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const invites = inviteRes.data ?? [];
  const userManagement = computeClubUserManagementOnboarding(invites, members, shareAppUsed);
  const excommManagement = computeExcommClubOnboarding(profileSetup);

  const preparedSpeechDetailsUpdated = hasPreparedSpeechDetailsCaptured(
    roles,
    evaluationPathwayRes.data ?? []
  );

  const toastmasterThemeUpdated = (toastmasterThemesRes.data ?? []).some(
    (row) => typeof row.theme_of_the_day === 'string' && row.theme_of_the_day.trim().length > 0
  );

  const wordOfTheDayUpdated = (grammarianWordsRes.data ?? []).some(
    (row) => typeof row.word === 'string' && row.word.trim().length > 0
  );

  const grammarianReportPublished =
    (grammarianWordPublishedRes.count ?? 0) > 0 ||
    (grammarianIdiomPublishedRes.count ?? 0) > 0 ||
    (grammarianQuotePublishedRes.count ?? 0) > 0;

  const meetingManagement = computeMeetingManagementOnboarding({
    meetings,
    roles,
    timerReportCount: timerReportRes.count ?? 0,
    grammarianReportPublished,
    ahCounterReportCount: ahCounterReportRes.count ?? 0,
    toastmasterThemeUpdated,
    preparedSpeechDetailsUpdated,
    wordOfTheDayUpdated,
    tableTopicsQuestionsUpdated: (tableTopicsRes.data ?? []).length > 0,
  });

  const meetingAgenda = computeMeetingAgendaOnboarding({
    agendaItemCount: agendaItemsRes.count ?? 0,
    meetings,
    agendaBannerColorChanged: agendaBannerChanged,
  });

  const distinctVoterCount = new Set(
    (pollVotesRes.data ?? []).map((row) => row.user_id).filter(Boolean)
  ).size;

  const distinctQuestionCount = new Set(
    (pollItemsRes.data ?? []).map((row) => row.question_id).filter(Boolean)
  ).size;

  const votingOperations = computeVotingOperationsOnboarding({
    pollCount: polls.length,
    distinctVoterCount,
    distinctQuestionCount,
    pollClosedCount: polls.filter((p) => p.status === 'completed').length,
  });

  return summarize(
    buildSections({
      club,
      profile: profileSetup,
      faqRows: faqRes.data ?? [],
      userManagement,
      excommManagement,
      meetingManagement,
      meetingAgenda,
      votingOperations,
    })
  );
}
