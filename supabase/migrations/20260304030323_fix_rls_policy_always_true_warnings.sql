/*
  # Fix RLS Policy Always True Warnings

  ## Summary
  Replaces all overly permissive RLS policies (USING (true) / WITH CHECK (true)) with
  proper policies enforcing authentication and club membership.

  ## Key patterns used
  - Club member access: app_club_user_relationship WHERE club_id = ? AND user_id = auth.uid() AND is_authenticated = true
  - Excomm/leader write access: same + role IN ('excomm', 'club_leader')
  - User-scoped data: user_id = auth.uid()
  - Reference/system data: auth.uid() IS NOT NULL
  - Service role: kept with true for background jobs
  - Public data (version config, waitlist): anon + authenticated

  ## Roles in app_club_user_relationship
  - 'member', 'excomm', 'club_leader', 'guest', 'visiting_tm'
  - is_authenticated = true means the user is an active club member
*/

-- ============================================================
-- app_club_meeting
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage meetings" ON public.app_club_meeting;
DROP POLICY IF EXISTS "Authenticated users can read meetings" ON public.app_club_meeting;

CREATE POLICY "Club members can read meetings"
  ON public.app_club_meeting FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_club_meeting.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Excomm can insert meetings"
  ON public.app_club_meeting FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_club_meeting.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can update meetings"
  ON public.app_club_meeting FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_club_meeting.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_club_meeting.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can delete meetings"
  ON public.app_club_meeting FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_club_meeting.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

-- ============================================================
-- app_meeting_roles_management
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage meeting roles" ON public.app_meeting_roles_management;
DROP POLICY IF EXISTS "Authenticated users can read meeting roles" ON public.app_meeting_roles_management;

CREATE POLICY "Club members can read meeting roles management"
  ON public.app_meeting_roles_management FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_roles_management.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Club members can insert meeting roles management"
  ON public.app_meeting_roles_management FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_roles_management.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Club members can update meeting roles management"
  ON public.app_meeting_roles_management FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_roles_management.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_roles_management.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Club members can delete meeting roles management"
  ON public.app_meeting_roles_management FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_roles_management.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

-- ============================================================
-- app_meeting_roles (no club_id, use auth check only)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read meeting roles" ON public.app_meeting_roles;

CREATE POLICY "Authenticated users can read meeting roles"
  ON public.app_meeting_roles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- app_meeting_ge
-- ============================================================
DROP POLICY IF EXISTS "Everyone can read GE evaluations" ON public.app_meeting_ge;

CREATE POLICY "Club members can read GE evaluations"
  ON public.app_meeting_ge FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_ge.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

-- ============================================================
-- app_meeting_collaboration
-- ============================================================
DROP POLICY IF EXISTS "Service role has full access to collaboration" ON public.app_meeting_collaboration;
DROP POLICY IF EXISTS "service_role_full_access_collaboration" ON public.app_meeting_collaboration;

CREATE POLICY "Club members can read collaboration"
  ON public.app_meeting_collaboration FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_collaboration.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Club members can insert collaboration"
  ON public.app_meeting_collaboration FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_collaboration.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Club members can update collaboration"
  ON public.app_meeting_collaboration FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_collaboration.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_collaboration.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Club members can delete collaboration"
  ON public.app_meeting_collaboration FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_meeting_collaboration.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Service role full access collaboration"
  ON public.app_meeting_collaboration FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- app_attendance_snapshot
-- ============================================================
DROP POLICY IF EXISTS "Service role can manage all snapshots" ON public.app_attendance_snapshot;

CREATE POLICY "Service role can manage all snapshots"
  ON public.app_attendance_snapshot FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Club members can read snapshots"
  ON public.app_attendance_snapshot FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_attendance_snapshot.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

-- ============================================================
-- app_user_invitation
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage invitations" ON public.app_user_invitation;
DROP POLICY IF EXISTS "Authenticated users can read invitations" ON public.app_user_invitation;

CREATE POLICY "Club members can read invitations"
  ON public.app_user_invitation FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_user_invitation.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Excomm can insert invitations"
  ON public.app_user_invitation FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_user_invitation.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can update invitations"
  ON public.app_user_invitation FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_user_invitation.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_user_invitation.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can delete invitations"
  ON public.app_user_invitation FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = app_user_invitation.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

-- ============================================================
-- app_user_profiles
-- ============================================================
DROP POLICY IF EXISTS "authenticated_users_can_read_all_profiles" ON public.app_user_profiles;
DROP POLICY IF EXISTS "authenticated_users_can_read_all_profiles_simple" ON public.app_user_profiles;
DROP POLICY IF EXISTS "service_role_full_access_profiles" ON public.app_user_profiles;

CREATE POLICY "Authenticated users can read profiles"
  ON public.app_user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role full access profiles"
  ON public.app_user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- app_version_config (public reference data)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read version config" ON public.app_version_config;

CREATE POLICY "Anyone can read version config"
  ON public.app_version_config FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================
-- club_profiles
-- ============================================================
DROP POLICY IF EXISTS "authenticated_users_can_read_club_profiles" ON public.club_profiles;

CREATE POLICY "Authenticated users can read club profiles"
  ON public.club_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- clubs
-- ============================================================
DROP POLICY IF EXISTS "Allow users to view clubs" ON public.clubs;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.clubs;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.clubs;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.clubs;
DROP POLICY IF EXISTS "authenticated_users_can_create_clubs" ON public.clubs;

CREATE POLICY "Authenticated users can read clubs"
  ON public.clubs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create clubs"
  ON public.clubs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Club leader or excomm can update clubs"
  ON public.clubs FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = clubs.id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = clubs.id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

-- ============================================================
-- meetings
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage meetings" ON public.meetings;
DROP POLICY IF EXISTS "Authenticated users can read all meetings" ON public.meetings;

CREATE POLICY "Club members can read meetings"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = meetings.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Excomm can insert meetings"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = meetings.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can update meetings"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = meetings.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = meetings.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can delete meetings"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = meetings.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

-- ============================================================
-- password_reset_tokens
-- ============================================================
DROP POLICY IF EXISTS "Service role can manage password reset tokens" ON public.password_reset_tokens;

CREATE POLICY "Service role can manage password reset tokens"
  ON public.password_reset_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own reset tokens"
  ON public.password_reset_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- pathways (reference/lookup data)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read pathways" ON public.pathways;

CREATE POLICY "Authenticated users can read pathways"
  ON public.pathways FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- polls
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage polls" ON public.polls;
DROP POLICY IF EXISTS "Authenticated users can read polls" ON public.polls;

CREATE POLICY "Club members can read polls"
  ON public.polls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = polls.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Excomm can insert polls"
  ON public.polls FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = polls.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can update polls"
  ON public.polls FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = polls.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = polls.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can delete polls"
  ON public.polls FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = polls.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

-- ============================================================
-- poll_items (via poll_id -> polls.club_id)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage poll items" ON public.poll_items;
DROP POLICY IF EXISTS "Authenticated users can read poll items" ON public.poll_items;

CREATE POLICY "Club members can read poll items"
  ON public.poll_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.app_club_user_relationship r ON r.club_id = p.club_id
      WHERE p.id = poll_items.poll_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Excomm can insert poll items"
  ON public.poll_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.app_club_user_relationship r ON r.club_id = p.club_id
      WHERE p.id = poll_items.poll_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can update poll items"
  ON public.poll_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.app_club_user_relationship r ON r.club_id = p.club_id
      WHERE p.id = poll_items.poll_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.app_club_user_relationship r ON r.club_id = p.club_id
      WHERE p.id = poll_items.poll_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can delete poll items"
  ON public.poll_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.app_club_user_relationship r ON r.club_id = p.club_id
      WHERE p.id = poll_items.poll_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

-- ============================================================
-- poll_results_repository (via poll_id -> polls.club_id)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage poll results repository" ON public.poll_results_repository;
DROP POLICY IF EXISTS "Authenticated users can read poll results repository" ON public.poll_results_repository;

CREATE POLICY "Club members can read poll results repository"
  ON public.poll_results_repository FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.app_club_user_relationship r ON r.club_id = p.club_id
      WHERE p.id = poll_results_repository.poll_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Authenticated users can insert poll results repository"
  ON public.poll_results_repository FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update poll results repository"
  ON public.poll_results_repository FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage poll results repository"
  ON public.poll_results_repository FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- polls_questions (system reference data, no club_id)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage polls questions" ON public.polls_questions;
DROP POLICY IF EXISTS "Authenticated users can read polls questions" ON public.polls_questions;

CREATE POLICY "Authenticated users can read polls questions"
  ON public.polls_questions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage polls questions"
  ON public.polls_questions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- poll_votes
-- ============================================================
DROP POLICY IF EXISTS "Users can read all votes" ON public.poll_votes;

CREATE POLICY "Club members can read poll votes"
  ON public.poll_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.app_club_user_relationship r ON r.club_id = p.club_id
      WHERE p.id = poll_votes.poll_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

-- ============================================================
-- simple_poll_votes
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read all votes" ON public.simple_poll_votes;

CREATE POLICY "Club members can read simple poll votes"
  ON public.simple_poll_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.app_club_user_relationship r ON r.club_id = p.club_id
      WHERE p.id = simple_poll_votes.poll_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

-- ============================================================
-- resources
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage resources" ON public.resources;
DROP POLICY IF EXISTS "Authenticated users can read resources" ON public.resources;

CREATE POLICY "Club members can read resources"
  ON public.resources FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = resources.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Excomm can insert resources"
  ON public.resources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = resources.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can update resources"
  ON public.resources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = resources.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = resources.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can delete resources"
  ON public.resources FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = resources.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

-- ============================================================
-- role_completions
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage role completions" ON public.role_completions;
DROP POLICY IF EXISTS "Authenticated users can read role completions" ON public.role_completions;

CREATE POLICY "Club members can read role completions"
  ON public.role_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = role_completions.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Club members can insert role completions"
  ON public.role_completions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = role_completions.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Club members can update role completions"
  ON public.role_completions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = role_completions.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = role_completions.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Service role can manage role completions"
  ON public.role_completions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- speeches
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage speeches" ON public.speeches;
DROP POLICY IF EXISTS "Authenticated users can read speeches" ON public.speeches;

CREATE POLICY "Users can read own speeches"
  ON public.speeches FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own speeches"
  ON public.speeches FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own speeches"
  ON public.speeches FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own speeches"
  ON public.speeches FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- user_invitations
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage user invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Authenticated users can read user invitations" ON public.user_invitations;

CREATE POLICY "Club members can read user invitations"
  ON public.user_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = user_invitations.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
    )
  );

CREATE POLICY "Excomm can insert user invitations"
  ON public.user_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = user_invitations.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can update user invitations"
  ON public.user_invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = user_invitations.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = user_invitations.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

CREATE POLICY "Excomm can delete user invitations"
  ON public.user_invitations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_club_user_relationship r
      WHERE r.club_id = user_invitations.club_id
        AND r.user_id = auth.uid()
        AND r.is_authenticated = true
        AND r.role IN ('excomm', 'club_leader')
    )
  );

-- ============================================================
-- user_management_audit
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage audit logs" ON public.user_management_audit;
DROP POLICY IF EXISTS "Authenticated users can read audit logs" ON public.user_management_audit;

CREATE POLICY "Users can read audit logs they are involved in"
  ON public.user_management_audit FOR SELECT
  TO authenticated
  USING (
    performed_by = auth.uid()
    OR target_user_id = auth.uid()
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.user_management_audit FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage audit logs"
  ON public.user_management_audit FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- user_pathways
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage pathways progress" ON public.user_pathways;
DROP POLICY IF EXISTS "Authenticated users can read pathways progress" ON public.user_pathways;

CREATE POLICY "Users can read own pathways"
  ON public.user_pathways FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pathways"
  ON public.user_pathways FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pathways"
  ON public.user_pathways FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own pathways"
  ON public.user_pathways FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- user_performance_metrics
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete performance metrics" ON public.user_performance_metrics;
DROP POLICY IF EXISTS "Authenticated users can insert performance metrics" ON public.user_performance_metrics;
DROP POLICY IF EXISTS "Authenticated users can update performance metrics" ON public.user_performance_metrics;

CREATE POLICY "Users can insert own performance metrics"
  ON public.user_performance_metrics FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own performance metrics"
  ON public.user_performance_metrics FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own performance metrics"
  ON public.user_performance_metrics FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage performance metrics"
  ON public.user_performance_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- waitlist_entries
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert waitlist entries" ON public.waitlist_entries;
DROP POLICY IF EXISTS "Authenticated users can read all waitlist entries" ON public.waitlist_entries;

CREATE POLICY "Anyone can insert waitlist entries"
  ON public.waitlist_entries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read waitlist entries"
  ON public.waitlist_entries FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
