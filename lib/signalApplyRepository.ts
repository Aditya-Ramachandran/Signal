import { supabase } from './supabase';
import { validateApplicationProfile, validateResumeUpload } from './signalApply';
import type {
  ApplicationProfile,
  ApplicationRequestDraft,
  ApplicationStatus,
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

type ApplicationRequestRow = {
  id: string;
  job_id: string;
  job_snapshot: ApplicationRequestDraft['job_snapshot'];
  application_platform: ApplicationRequestDraft['application_platform'];
  application_mode: ApplicationRequestDraft['application_mode'];
  status: ApplicationStatus;
  resume_id: string | null;
  preparation_approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationRequestRecord = {
  id: string;
  jobId: string;
  jobSnapshot: ApplicationRequestDraft['job_snapshot'];
  platform: ApplicationRequestDraft['application_platform'];
  mode: ApplicationRequestDraft['application_mode'];
  status: ApplicationStatus;
  resumeId: string | null;
  preparationApprovedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export async function uploadApplicationResume(userId: string, file: File): Promise<ResumeRecord> {
  const validation = validateResumeUpload(file);
  if (!validation.ok) throw new Error(validation.errors.join(' '));

  const client = requireClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await client.storage.from('application-resumes').upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await client
    .rpc('activate_application_resume', {
      p_storage_path: storagePath,
      p_file_name: file.name,
      p_content_type: file.type || null,
      p_byte_size: file.size,
    })
    .single<ResumeRow>();
  if (error) {
    await client.storage.from('application-resumes').remove([storagePath]);
    throw error;
  }
  return toResume(data);
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

export async function getApplicationRequests(): Promise<ApplicationRequestRecord[]> {
  const { data, error } = await requireClient()
    .from('application_requests')
    .select('id,job_id,job_snapshot,application_platform,application_mode,status,resume_id,preparation_approved_at,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .returns<ApplicationRequestRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    jobId: row.job_id,
    jobSnapshot: row.job_snapshot,
    platform: row.application_platform,
    mode: row.application_mode,
    status: row.status,
    resumeId: row.resume_id,
    preparationApprovedAt: row.preparation_approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function serializeValidationErrors<T>(result: ValidationResult<T>): string | null {
  return result.ok ? null : result.errors.join(' ');
}
