# Database Security & Performance Issues - Status Report

## ✅ FIXED Issues

### 1. Unindexed Foreign Keys (12 issues) - **FIXED**
Added indexes to all foreign key columns to prevent table scans:
- `ah_counter_tracked_members.created_by`
- `app_evaluation_pathway.vpe_approved_by`
- `app_meeting_timer_notes.timer_user_id`
- `app_prepared_speech_evaluations.uploaded_by`
- `app_timer_selected_members` (both foreign keys)
- `grammarian_live_good_usage` (both foreign keys)
- `grammarian_live_improvements` (both foreign keys)
- `shared_agendas.created_by`
- `toastmaster_theme_activity_log.user_id`

**Impact**: Significant query performance improvement, especially on joins.

### 2. Duplicate Indexes (2 issues) - **FIXED**
Removed duplicate indexes:
- Dropped `idx_app_club_user_relationship_active_members`
- Dropped `idx_app_evaluation_pathway_assigned_evaluator_id`

**Impact**: Reduced storage overhead and faster writes.

### 3. Unused Indexes (100+ issues) - **FIXED**
Removed all unused indexes across multiple categories:
- Club profile search indexes
- Poll and voting indexes
- Evaluation pathway indexes
- Meeting collaboration indexes
- Role completion indexes
- User invitation indexes
- Attendance snapshot indexes
- Grammarian feature indexes
- And many more...

**Impact**: Reduced storage usage, faster writes, simplified maintenance.

### 4. Auth RLS Performance (Partial - 5 critical tables) - **FIXED**
Optimized RLS policies to use `(select auth.uid())` pattern for:
- `app_user_profiles`
- `app_club_user_relationship`
- `club_join_requests`
- `poll_votes`
- `simple_poll_votes`

**Impact**: Better query performance at scale by preventing re-evaluation of auth functions.

---

## ⚠️ REMAINING Critical Issues (Require Manual Review)

### 1. RLS Policy Always True - **SECURITY CRITICAL**
These policies allow unrestricted access and bypass RLS:

**Tables with Unrestricted Access:**
- `user_performance_metrics` - Allow ANY authenticated user to insert/update/delete
- `clubs` - Allow ANY authenticated user to insert/update
- `meetings` - Allow ANY authenticated user full access
- `app_club_meeting` - Allow ANY authenticated user full access
- `app_meeting_roles_management` - Allow ANY authenticated user full access
- `app_user_invitation` - Allow ANY authenticated user full access
- `polls`, `poll_items`, `polls_questions` - Allow ANY authenticated user full access
- `poll_results_repository` - Allow ANY authenticated user full access
- `resources` - Allow ANY authenticated user full access
- `role_completions` - Allow ANY authenticated user full access
- `speeches` - Allow ANY authenticated user full access
- `user_invitations` - Allow ANY authenticated user full access
- `user_management_audit` - Allow ANY authenticated user full access
- `user_pathways` - Allow ANY authenticated user full access
- `waitlist_entries` - Allow ANYONE (even anonymous) to insert

**Action Required**: Review each table's business logic and implement proper club-based or role-based restrictions.

**Example Fix Pattern:**
```sql
-- Instead of:
CREATE POLICY "Authenticated users can manage meetings" ON meetings
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Use:
CREATE POLICY "Club members can manage their club meetings" ON meetings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE club_id = meetings.club_id
        AND user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_club_user_relationship
      WHERE club_id = meetings.club_id
        AND user_id = (select auth.uid())
    )
  );
```

### 2. Auth RLS Initialization - **PERFORMANCE ISSUE**
130+ RLS policies still use `auth.uid()` without wrapping in `(select auth.uid())`.

**Affected Tables** (sample):
- `mentor_assignments` (4 policies)
- `table_topic_master_questions` (2 policies)
- `grammarian_live_good_usage` (2 policies)
- `app_meeting_toastmaster_notes` (2 policies)
- `app_meeting_collaboration` (multiple policies)
- `app_prepared_speech_evaluations` (3 policies)
- `toastmaster_meeting_data` (3 policies)
- `club_profiles` (3 policies)
- `ah_counter_reports` (4 policies)
- `grammarian_reports` (4 policies)
- Many more...

**Action Required**: Systematically update all policies to use `(select auth.uid())` pattern.

**Automated Fix Script** (template):
```sql
DROP POLICY IF EXISTS "[policy_name]" ON [table_name];
CREATE POLICY "[policy_name]" ON [table_name]
  FOR [operation]
  TO authenticated
  USING ([original_condition_with_select_auth_uid])
  WITH CHECK ([original_condition_with_select_auth_uid]);
```

### 3. Multiple Permissive Policies - **COMPLEXITY ISSUE**
50+ tables have multiple permissive policies for the same role/action combination.

**Examples:**
- `app_evaluation_pathway` - 4 SELECT policies for authenticated users
- `app_meeting_collaboration` - 5 SELECT policies, 3 UPDATE policies
- `app_prepared_speech_evaluations` - 3 SELECT policies
- `club_join_requests` - 2 SELECT policies, 2 UPDATE policies

**Issue**: When multiple permissive policies exist, ANY one being true grants access (OR logic). This can lead to unintended access patterns.

**Action Required**: Consolidate policies or clearly document why multiple are needed.

### 4. Function Search Path Mutable - **SECURITY ISSUE**
200+ functions have role mutable search paths, making them vulnerable to search_path attacks.

**Risk**: An attacker could potentially redirect function calls to malicious code.

**Fix Pattern**: Add `SET search_path = public` or use schema-qualified names.

**Example:**
```sql
ALTER FUNCTION function_name() SET search_path = public;
```

### 5. Extensions in Public Schema - **BEST PRACTICE ISSUE**
Extensions installed in public schema:
- `pg_net`
- `http`
- `pg_trgm`

**Action Required**: Move to separate schema (e.g., `extensions`).

### 6. Auth Configuration Issues

**a) Auth DB Connection Strategy Not Percentage-Based**
- Current: Fixed at 10 connections
- Recommended: Use percentage-based allocation

**b) Auth OTP Long Expiry**
- Current: > 1 hour
- Recommended: < 1 hour for security

**c) Leaked Password Protection Disabled**
- Feature: HaveIBeenPwned.org integration
- Status: Disabled
- Recommended: Enable

**d) Postgres Version Security Patches**
- Current: `supabase-postgres-17.4.1.45`
- Status: Outstanding security patches available
- Action: Upgrade database

---

## 📊 Summary Statistics

| Category | Total Issues | Fixed | Remaining |
|----------|--------------|-------|-----------|
| Unindexed Foreign Keys | 12 | 12 ✅ | 0 |
| Duplicate Indexes | 2 | 2 ✅ | 0 |
| Unused Indexes | ~120 | ~120 ✅ | 0 |
| RLS Always True | 18 | 0 | 18 ⚠️ |
| RLS Auth Performance | 135+ | 5 | 130+ ⚠️ |
| Multiple Permissive Policies | 50+ | 0 | 50+ ⚠️ |
| Function Search Path | 200+ | 0 | 200+ ⚠️ |
| Extension Location | 3 | 0 | 3 ⚠️ |
| Auth Config | 4 | 0 | 4 ⚠️ |

---

## 🎯 Recommended Priority

### 🔴 IMMEDIATE (Security Critical)
1. **Fix RLS Policies Always True** - These are actual security vulnerabilities
2. **Review and restrict overly permissive table access**

### 🟠 HIGH (Security & Performance)
3. **Fix Function Search Path issues** - Security vulnerability
4. **Enable Leaked Password Protection** - Security enhancement
5. **Upgrade Postgres version** - Security patches

### 🟡 MEDIUM (Performance)
6. **Optimize remaining RLS policies with auth.uid()** - Performance at scale
7. **Consolidate Multiple Permissive Policies** - Clarity and potential security

### 🟢 LOW (Best Practices)
8. **Move extensions out of public schema** - Best practice
9. **Update Auth DB connection strategy** - Scalability
10. **Reduce OTP expiry time** - Security best practice

---

## 🛠️ Next Steps

1. **Review Business Logic**: Before fixing RLS policies, document which users should have access to which data
2. **Create Access Matrix**: Define roles (Member, ExComm, Club Owner, etc.) and their permissions
3. **Test Thoroughly**: After fixing RLS policies, test with different user roles
4. **Monitor Performance**: Check query performance after RLS optimizations
5. **Schedule Postgres Upgrade**: Plan maintenance window for database upgrade

---

## 📝 Notes

- All migrations applied are reversible if needed
- Dropped indexes can be recreated if they're actually needed
- The fixes applied are low-risk and provide immediate benefits
- The remaining issues require careful business logic review before fixing
