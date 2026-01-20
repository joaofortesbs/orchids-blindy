-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view organizations they are members of" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Members can view their organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Owners can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can join organizations" ON organization_members;
DROP POLICY IF EXISTS "Owners and admins can manage invites" ON organization_invites;
DROP POLICY IF EXISTS "Users can view their invites" ON organization_invites;

-- Simplified policies for organizations (no recursion)
CREATE POLICY "org_select_owner" ON organizations
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "org_select_member" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_members.organization_id = organizations.id 
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'active'
    )
  );

CREATE POLICY "org_insert" ON organizations
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "org_update" ON organizations
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "org_delete" ON organizations
  FOR DELETE USING (owner_id = auth.uid());

-- Policies for organization_members (simplified)
CREATE POLICY "member_select_own" ON organization_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "member_select_same_org" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "member_insert_owner" ON organization_members
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "member_update_owner" ON organization_members
  FOR UPDATE USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "member_delete_owner" ON organization_members
  FOR DELETE USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

-- Policies for organization_invites
CREATE POLICY "invite_select" ON organization_invites
  FOR SELECT USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "invite_insert" ON organization_invites
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "invite_delete" ON organization_invites
  FOR DELETE USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );
