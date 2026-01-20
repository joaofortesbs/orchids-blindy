export interface Organization {
  id: string;
  name: string;
  slug: string;
  businessModel: string;
  isPrivate: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  invitedAt: string;
  joinedAt: string | null;
  status: 'pending' | 'active';
}

export interface OrganizationInvite {
  email: string;
  role: 'admin' | 'member';
}

export interface CreateOrganizationData {
  name: string;
  businessModel: string;
  isPrivate: boolean;
  invites: OrganizationInvite[];
}

export const BUSINESS_MODELS = [
  { id: 'startup', label: 'Startup' },
  { id: 'agency', label: 'Agência' },
  { id: 'freelancer', label: 'Freelancer' },
  { id: 'enterprise', label: 'Empresa' },
  { id: 'nonprofit', label: 'ONG / Sem fins lucrativos' },
  { id: 'education', label: 'Educação' },
  { id: 'other', label: 'Outro' },
] as const;
