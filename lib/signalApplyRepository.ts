import { supabase } from './supabase';
import { validateApplicationProfile } from './signalApply';
import type {
  ApplicationProfile,
  ApplicationRequestDraft,
  ResumeRecord,
  ValidationResult,
} from './signalApply';

type ApplicationProfileRow = {
  user_id: string;
  version: number;
  contact: ApplicationProfile['contact'];
  links: ApplicationProfile['links'];
  experience: ApplicationProfile['experience'];
  education: ApplicationProfile['education'];
  skills: string[];
  common_answers: Record<string, string>;
  updated_at: string;
};

type ResumeRow = {
  id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  byte_size: number | null;
  sha256: string | null;
  is_active: boolean;
  created_at: string;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  return supabase;
}

function toProfile(row: ApplicationProfileRow): ApplicationProfile {
  return {
    userId: row.user_id,
    version: row.version,
    contact: row.contact,
    links: row.links,
    experience: row.experience,
    education: row.education,
    skills: row.skills,
    commonAnswers: row.common_answers,
    updatedAt: row.updated_at,
  };
}

function toResume(row: ResumeRow): ResumeRecord {
  return {
    id: row.id,
    userId: row.user_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: row.byte_size,
    sha256: row.sha256,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function getApplicationProfile(userId: string): Promise<ApplicationProfile | null> {
  const { data, error } = await requireClient()
    .from('application_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<ApplicationProfileRow>();
  if (error) throw error;
  return data ? toProfile(data) : null;
}

export async function saveApplicationProfile(profile: ApplicationProfile): Promise<ApplicationProfile> {
  const validation = validateApplicationProfile(profile);
  if (!validation.ok) throw new Error(validation.errors.join(' '));

  const { data, error } = await requireClient()
    .from('application_profiles')
    .upsert({
      user_id: profile.userId,
      version: profile.version,
      contact: profile.contact,
      links: profile.links,
      experience: profile.experience,
      education: profile.education,
      skills: profile.skills,
      common_answers: profile.commonAnswers,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single<ApplicationProfileRow>();
  if (error) throw error;
  return toProfile(data);
}

export async function getResumes(userId: string): Promise<ResumeRecord[]> {
  const { data, error } = await requireClient()
    .from('application_resumes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<ResumeRow[]>();
  if (error) throw error;
  return (data ?? []).map(toResume);
}

export async function createApplicationDraft(draft: ApplicationRequestDraft): Promise<string> {
  const { data, error } = await requireClient()
    .from('application_requests')
    .insert(draft)
    .select('id')
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function approveApplicationPreparation(requestId: string): Promise<void> {
  const { data, error } = await requireClient()
    .from('application_requests')
    .update({ status: 'approved_to_prepare', preparation_approved_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!data) throw new Error('This application is no longer available to approve. Refresh Signal and try again.');
}

export function serializeValidationErrors<T>(result: ValidationResult<T>): string | null {
  return result.ok ? null : result.errors.join(' ');
}
