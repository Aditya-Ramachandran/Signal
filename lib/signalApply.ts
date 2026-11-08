export const APPLICATION_SOURCES = ['workday', 'linkedin', 'indeed', 'external'] as const;
export const APPLICATION_PLATFORMS = ['workday', 'linkedin_easy_apply', 'indeed_apply', 'external'] as const;
export const APPLICATION_MODES = ['agent', 'manual_pack'] as const;
export const APPLICATION_STATUSES = [
  'draft',
  'approved_to_prepare',
  'waiting_for_runner',
  'running',
  'needs_you',
  'ready_to_submit',
  'submit_approved',
  'submitted',
  'failed',
  'cancelled',
] as const;

export type ListingSource = (typeof APPLICATION_SOURCES)[number];
export type ApplicationPlatform = (typeof APPLICATION_PLATFORMS)[number];
export type ApplicationMode = (typeof APPLICATION_MODES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ContactProfile = {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
};

export type LinkProfile = {
  linkedin?: string;
  github?: string;
  portfolio?: string;
};

export type ExperienceEntry = {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
};

export type EducationEntry = {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
};

export type ApplicationProfile = {
  userId: string;
  version: number;
  contact: ContactProfile;
  links: LinkProfile;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: string[];
  commonAnswers: Record<string, string>;
  updatedAt?: string;
};

export type ResumeRecord = {
  id: string;
  userId: string;
  storagePath: string;
  fileName: string;
  contentType: string | null;
  byteSize: number | null;
  sha256: string | null;
  isActive: boolean;
  createdAt?: string;
};

export type JobApplicationTarget = {
  jobId: string;
  company: string;
  role: string;
  applicationUrl: string;
  listingSource: ListingSource;
  listingUrl?: string;
};

export type ApplicationRoute = {
  platform: ApplicationPlatform;
  mode: ApplicationMode;
  destinationHost: string | null;
};

export type ProfileSnapshot = Omit<ApplicationProfile, 'userId' | 'updatedAt'> & {
  capturedAt: string;
};

export type ApplicationRequestDraft = {
  user_id: string;
  job_id: string;
  job_snapshot: JobApplicationTarget & { listingUrl?: string };
  listing_source: ListingSource;
  application_platform: ApplicationPlatform;
  application_mode: ApplicationMode;
  application_url: string;
  destination_host: string | null;
  status: 'draft';
  resume_id: string | null;
  profile_version: number;
  profile_snapshot: ProfileSnapshot;
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const sensitiveAnswerPattern = /(salary|compensation|notice|sponsorship|visa|work authorization|citizen|disability|veteran|gender|race|ethnicity|religion|criminal|legal)/i;

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isWorkdayHost(host: string): boolean {
  return host === 'workdayjobs.com' || host.endsWith('.workdayjobs.com');
}

function isLinkedInHost(host: string): boolean {
  return host === 'linkedin.com' || host.endsWith('.linkedin.com');
}

function isIndeedHost(host: string): boolean {
  return host === 'indeed.com' || host.endsWith('.indeed.com');
}

export function classifyApplicationRoute(applicationUrl: string): ApplicationRoute {
  if (!isHttpUrl(applicationUrl)) return { platform: 'external', mode: 'manual_pack', destinationHost: null };

  const host = new URL(applicationUrl).hostname.toLowerCase();
  if (isWorkdayHost(host)) return { platform: 'workday', mode: 'agent', destinationHost: host };
  if (isLinkedInHost(host)) return { platform: 'linkedin_easy_apply', mode: 'manual_pack', destinationHost: host };
  if (isIndeedHost(host)) return { platform: 'indeed_apply', mode: 'manual_pack', destinationHost: host };
  return { platform: 'external', mode: 'manual_pack', destinationHost: host };
}

export function validateApplicationProfile(profile: ApplicationProfile): ValidationResult<ApplicationProfile> {
  const errors: string[] = [];
  const fullName = cleanText(profile.contact.fullName);
  const email = cleanText(profile.contact.email);
  const phone = cleanText(profile.contact.phone);

  if (!profile.userId) errors.push('A signed-in user is required.');
  if (!Number.isInteger(profile.version) || profile.version < 1) errors.push('Profile version must be a positive whole number.');
  if (!fullName) errors.push('Add your full name before creating an application packet.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.push('Add a valid email address before creating an application packet.');
  if (!phone) errors.push('Add a phone number before creating an application packet.');

  for (const [key, value] of Object.entries(profile.links)) {
    if (value && !isHttpUrl(value)) errors.push(`${key} must be a full http(s) URL.`);
  }

  profile.experience.forEach((entry, index) => {
    if (!cleanText(entry.company) || !cleanText(entry.title)) errors.push(`Experience entry ${index + 1} needs a company and job title.`);
  });

  profile.education.forEach((entry, index) => {
    if (!cleanText(entry.school)) errors.push(`Education entry ${index + 1} needs a school name.`);
  });

  for (const key of Object.keys(profile.commonAnswers)) {
    if (sensitiveAnswerPattern.test(key)) errors.push(`Keep “${key}” out of saved automatic answers; review it per application instead.`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: profile };
}

export function createProfileSnapshot(profile: ApplicationProfile, capturedAt = new Date().toISOString()): ProfileSnapshot {
  return {
    version: profile.version,
    contact: structuredClone(profile.contact),
    links: structuredClone(profile.links),
    experience: structuredClone(profile.experience),
    education: structuredClone(profile.education),
    skills: structuredClone(profile.skills),
    commonAnswers: structuredClone(profile.commonAnswers),
    capturedAt,
  };
}

export function createApplicationRequestDraft(
  target: JobApplicationTarget,
  profile: ApplicationProfile,
  resume: Pick<ResumeRecord, 'id' | 'userId'> | null,
  capturedAt = new Date().toISOString(),
): ValidationResult<ApplicationRequestDraft> {
  const profileValidation = validateApplicationProfile(profile);
  const errors = profileValidation.ok ? [] : profileValidation.errors.slice();

  if (!cleanText(target.jobId)) errors.push('This role is missing its job identifier.');
  if (!cleanText(target.company) || !cleanText(target.role)) errors.push('This role is missing its company or title.');
  if (!isHttpUrl(target.applicationUrl)) errors.push('This role does not have a valid application URL.');
  if (resume && resume.userId !== profile.userId) errors.push('The selected resume does not belong to this workspace.');

  if (errors.length) return { ok: false, errors };

  const route = classifyApplicationRoute(target.applicationUrl);
  const snapshot = createProfileSnapshot(profile, capturedAt);

  return {
    ok: true,
    value: {
      user_id: profile.userId,
      job_id: target.jobId,
      job_snapshot: structuredClone(target),
      listing_source: target.listingSource,
      application_platform: route.platform,
      application_mode: route.mode,
      application_url: target.applicationUrl,
      destination_host: route.destinationHost,
      status: 'draft',
      resume_id: resume?.id ?? null,
      profile_version: profile.version,
      profile_snapshot: snapshot,
    },
  };
}

export function validateResumeUpload(file: Pick<File, 'name' | 'size' | 'type'>): ValidationResult<Pick<File, 'name' | 'size' | 'type'>> {
  const acceptedTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ]);
  const errors: string[] = [];
  if (!cleanText(file.name)) errors.push('Choose a resume file.');
  if (file.size <= 0) errors.push('That resume file is empty.');
  if (file.size > 10 * 1024 * 1024) errors.push('Resume files must be 10 MB or smaller.');
  if (file.type && !acceptedTypes.has(file.type)) errors.push('Use a PDF, DOC, or DOCX resume.');
  return errors.length ? { ok: false, errors } : { ok: true, value: file };
}
