export type Job = {
  id: string;
  company: string;
  role: string;
  location: string;
  companySize: string;
  postedDate: string;
  postedDaysAgo: number;
  experience: string;
  salary: string;
  applyLink: string;
  jobId: string;
  idType: string;
  tier: 'A' | 'B';
  status: 'New' | 'Applied' | 'Referred' | 'Rejected';
  whyFit: string;
  referralMessage: string;
  findContactsLink: string;
  dateFound: string;
};

export type OutreachContact = {
  id: string;
  name: string;
  role: string;
  company: string;
  profileUrl: string;
  emailInferred: boolean;
  emailDraft: string;
  dateGenerated: string;
};

export const jobs: Job[] = [
  { id: 'j1', company: 'Northstar Systems', role: 'Senior Backend Engineer', location: 'Bengaluru · hybrid', companySize: '84 employees', postedDate: '17 Oct 2026', postedDaysAgo: 0, experience: '5–8 years', salary: '₹32–44 LPA', applyLink: 'https://example.com/apply/ns-4821', jobId: 'NS-4821', idType: 'internal', tier: 'A', status: 'New', whyFit: 'Strong match for your Go, PostgreSQL, and event-driven systems experience.', referralMessage: 'Hi Priya — I’m applying for the Senior Backend Engineer role at Northstar Systems (NS-4821). I’ve spent the last four years building Go services and event-driven workflows with PostgreSQL, and the role’s focus on reliable platform systems feels like a strong fit. Would you be open to referring me or pointing me to the right person on the team?', findContactsLink: 'https://www.linkedin.com/search/results/people/?keywords=Northstar%20Systems', dateFound: '17 Oct 2026' },
  { id: 'j2', company: 'Morrow Data', role: 'Staff Backend Engineer', location: 'Hyderabad · hybrid', companySize: '112 employees', postedDate: '17 Oct 2026', postedDaysAgo: 0, experience: '7–10 years', salary: '₹45–60 LPA', applyLink: 'https://example.com/apply/md-7712', jobId: 'MD-7712', idType: 'internal', tier: 'A', status: 'New', whyFit: 'The platform team is moving a high-volume data pipeline to Go and Kafka — close to your recent systems work.', referralMessage: 'Hi Arjun — I’m interested in the Staff Backend Engineer role at Morrow Data (MD-7712). My recent work has focused on Go, Kafka, and operating data-heavy services, so the platform migration stood out. Would you be open to a referral or a quick pointer to the hiring team?', findContactsLink: 'https://www.linkedin.com/search/results/people/?keywords=Morrow%20Data', dateFound: '17 Oct 2026' },
  { id: 'j3', company: 'Kiteframe', role: 'Backend Engineer II', location: 'Pune · remote-first', companySize: '47 employees', postedDate: '17 Oct 2026', postedDaysAgo: 0, experience: '3–6 years', salary: '₹24–34 LPA', applyLink: 'https://example.com/apply/kf-2084', jobId: 'KF-2084', idType: 'internal', tier: 'A', status: 'New', whyFit: 'A focused API role with a small team, practical ownership, and a stack that matches your TypeScript and Postgres experience.', referralMessage: 'Hi Neha — I’m applying for the Backend Engineer II role at Kiteframe (KF-2084). I’ve built TypeScript APIs and PostgreSQL-backed services in small, ownership-heavy teams. Would you feel comfortable referring me or sharing who owns hiring for this role?', findContactsLink: 'https://www.linkedin.com/search/results/people/?keywords=Kiteframe', dateFound: '17 Oct 2026' },
  { id: 'j4', company: 'Fieldnote Cloud', role: 'Platform Engineer', location: 'Bengaluru · hybrid', companySize: '63 employees', postedDate: '16 Oct 2026', postedDaysAgo: 1, experience: '4–7 years', salary: '₹28–38 LPA', applyLink: 'https://example.com/apply/fc-1903', jobId: 'FC-1903', idType: 'internal', tier: 'A', status: 'New', whyFit: 'A good infrastructure-adjacent role with room to work across deployment tooling and developer experience.', referralMessage: 'Hi Dev — I’m reaching out about the Platform Engineer opening at Fieldnote Cloud (FC-1903). My background in Go services, CI/CD, and internal tooling looks aligned with the team’s platform work. Could you point me toward the right person for a referral?', findContactsLink: 'https://www.linkedin.com/search/results/people/?keywords=Fieldnote%20Cloud', dateFound: '16 Oct 2026' },
  { id: 'j5', company: 'Lattice Grove', role: 'Software Engineer, Services', location: 'India · remote', companySize: '129 employees', postedDate: '16 Oct 2026', postedDaysAgo: 1, experience: '3–5 years', salary: '₹22–32 LPA', applyLink: 'https://example.com/apply/lg-5510', jobId: 'LG-5510', idType: 'internal', tier: 'A', status: 'New', whyFit: 'Remote role with a clear backend scope and an unusually close match to your API reliability work.', referralMessage: 'Hi Rohan — I’m interested in the Software Engineer, Services role at Lattice Grove (LG-5510). I’ve worked on reliable APIs and background processing systems, and this role looks closely aligned. Would you be open to a referral?', findContactsLink: 'https://www.linkedin.com/search/results/people/?keywords=Lattice%20Grove', dateFound: '16 Oct 2026' },
  { id: 'j6', company: 'Copperline Health', role: 'Backend Developer', location: 'Mumbai · hybrid', companySize: '205 employees', postedDate: '15 Oct 2026', postedDaysAgo: 2, experience: '2–4 years', salary: '₹18–26 LPA', applyLink: 'https://example.com/apply/ch-3320', jobId: 'CH-3320', idType: 'internal', tier: 'B', status: 'New', whyFit: 'A credible apply-first role, though the scope is narrower than the Tier A queue.', referralMessage: 'Hi — I’m applying for the Backend Developer role at Copperline Health (CH-3320). My experience with service APIs and relational databases seems relevant to the role. If you know the hiring team, I’d appreciate a pointer.', findContactsLink: 'https://www.linkedin.com/search/results/people/?keywords=Copperline%20Health', dateFound: '15 Oct 2026' },
  { id: 'j7', company: 'Common Thread', role: 'API Engineer', location: 'Bengaluru · onsite', companySize: '71 employees', postedDate: '15 Oct 2026', postedDaysAgo: 2, experience: '3–5 years', salary: '₹20–29 LPA', applyLink: 'https://example.com/apply/ct-4178', jobId: 'CT-4178', idType: 'internal', tier: 'B', status: 'Applied', whyFit: 'Good technical overlap, but the onsite requirement makes this a lower-priority follow-up.', referralMessage: 'Hi — I recently applied for the API Engineer role at Common Thread (CT-4178). My background is in building and maintaining backend APIs with TypeScript and PostgreSQL. Thanks for any context you can share.', findContactsLink: 'https://www.linkedin.com/search/results/people/?keywords=Common%20Thread', dateFound: '15 Oct 2026' },
  { id: 'j8', company: 'Juniper Works', role: 'Software Engineer', location: 'Hyderabad · hybrid', companySize: '91 employees', postedDate: '14 Oct 2026', postedDaysAgo: 3, experience: '2–5 years', salary: '₹19–27 LPA', applyLink: 'https://example.com/apply/jw-8821', jobId: 'JW-8821', idType: 'internal', tier: 'B', status: 'Referred', whyFit: 'Solid baseline match with a useful connection already identified.', referralMessage: 'Hi — I’m following up on the Software Engineer opening at Juniper Works (JW-8821). I’ve worked across backend services and database-backed workflows and would be glad to share more context.', findContactsLink: 'https://www.linkedin.com/search/results/people/?keywords=Juniper%20Works', dateFound: '14 Oct 2026' },
];

export const outreachContacts: OutreachContact[] = [
  { id: 'c1', name: 'Priya Nair', role: 'Engineering Manager', company: 'Northstar Systems', profileUrl: 'https://www.linkedin.com/search/results/people/?keywords=Priya%20Nair%20Northstar%20Systems', emailInferred: true, emailDraft: 'Hi Priya — I’m applying for the Senior Backend Engineer role at Northstar Systems. My background in Go, PostgreSQL, and event-driven systems feels closely aligned with the platform work your team is doing. Would you be open to a brief referral conversation?', dateGenerated: '17 Oct 2026' },
  { id: 'c2', name: 'Arjun Menon', role: 'Staff Engineer', company: 'Morrow Data', profileUrl: 'https://www.linkedin.com/search/results/people/?keywords=Arjun%20Menon%20Morrow%20Data', emailInferred: true, emailDraft: 'Hi Arjun — I’m interested in the Staff Backend Engineer role at Morrow Data. I’ve worked on Go, Kafka, and data-heavy services, and the platform migration caught my attention. Would you be open to pointing me toward the right hiring contact?', dateGenerated: '17 Oct 2026' },
  { id: 'c3', name: 'Neha Shah', role: 'Senior Software Engineer', company: 'Kiteframe', profileUrl: 'https://www.linkedin.com/search/results/people/?keywords=Neha%20Shah%20Kiteframe', emailInferred: false, emailDraft: 'Hi Neha — I’m applying for the Backend Engineer II role at Kiteframe. My recent work with TypeScript APIs and PostgreSQL-backed services seems aligned with the team’s needs. Would you feel comfortable referring me?', dateGenerated: '17 Oct 2026' },
  { id: 'c4', name: 'Dev Iyer', role: 'Platform Lead', company: 'Fieldnote Cloud', profileUrl: 'https://www.linkedin.com/search/results/people/?keywords=Dev%20Iyer%20Fieldnote%20Cloud', emailInferred: true, emailDraft: 'Hi Dev — I’m reaching out about the Platform Engineer opening at Fieldnote Cloud. My background in Go services, CI/CD, and internal tooling feels relevant to the team’s platform work. Could you point me toward the right person for a referral?', dateGenerated: '16 Oct 2026' },
];
