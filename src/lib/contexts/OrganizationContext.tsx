"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Organization, CreateOrganizationData } from '@/lib/types/organization';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/AuthContext';

interface OrganizationContextType {
  organizations: Organization[];
  selectedOrganization: Organization | null;
  isLoading: boolean;
  selectOrganization: (org: Organization | null) => void;
  createOrganization: (data: CreateOrganizationData) => Promise<Organization | null>;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = createClient();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setSelectedOrganization(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data: membershipData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (!membershipData || membershipData.length === 0) {
        setOrganizations([]);
        setIsLoading(false);
        return;
      }

      const orgIds = membershipData.map(m => m.organization_id);
      
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)
        .order('created_at', { ascending: false });

      const orgs: Organization[] = (orgsData || []).map(o => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        businessModel: o.business_model,
        isPrivate: o.is_private,
        ownerId: o.owner_id,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
      }));

      setOrganizations(orgs);

      const savedOrgId = localStorage.getItem('selected_organization_id');
      if (savedOrgId) {
        const savedOrg = orgs.find(o => o.id === savedOrgId);
        if (savedOrg) {
          setSelectedOrganization(savedOrg);
        }
      }
    } catch (e) {
      console.error('Failed to load organizations:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const selectOrganization = useCallback((org: Organization | null) => {
    setSelectedOrganization(org);
    if (org) {
      localStorage.setItem('selected_organization_id', org.id);
    } else {
      localStorage.removeItem('selected_organization_id');
    }
  }, []);

  const createOrganization = useCallback(async (data: CreateOrganizationData): Promise<Organization | null> => {
    if (!user) return null;

    try {
      const slug = data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: data.name,
          slug: `${slug}-${Date.now().toString(36)}`,
          business_model: data.businessModel,
          is_private: data.isPrivate,
          owner_id: user.id,
        })
        .select()
        .single();

      if (orgError) {
        console.error('Failed to create organization:', orgError);
        return null;
      }

      await supabase
        .from('organization_members')
        .insert({
          organization_id: orgData.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        });

      for (const invite of data.invites) {
        if (invite.email) {
          await supabase
            .from('organization_invites')
            .insert({
              organization_id: orgData.id,
              email: invite.email.toLowerCase(),
              role: invite.role,
              invited_by: user.id,
            });
        }
      }

      const newOrg: Organization = {
        id: orgData.id,
        name: orgData.name,
        slug: orgData.slug,
        businessModel: orgData.business_model,
        isPrivate: orgData.is_private,
        ownerId: orgData.owner_id,
        createdAt: orgData.created_at,
        updatedAt: orgData.updated_at,
      };

      setOrganizations(prev => [newOrg, ...prev]);
      setSelectedOrganization(newOrg);
      localStorage.setItem('selected_organization_id', newOrg.id);

      return newOrg;
    } catch (e) {
      console.error('Failed to create organization:', e);
      return null;
    }
  }, [user, supabase]);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        selectedOrganization,
        isLoading,
        selectOrganization,
        createOrganization,
        refreshOrganizations: loadOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
