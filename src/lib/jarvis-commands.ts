export interface JarvisCommand {
  id: string;
  label: string;
  description: string;
  group: string;
  pages: string[]; // route prefixes where this command shows, or ['global']
  keywords: string[];
  icon?: string; // lucide icon name
  shortcut?: string;
  action: 'navigate' | 'jarvis' | 'click';
  destination?: string; // route or jarvis message or targetId
}

export const JARVIS_COMMANDS: JarvisCommand[] = [
  // ── Global commands ─────────────────────────────────────
  { id: 'nav-home', label: 'Go to Command Centre', description: 'Open the home dashboard', group: 'Navigate', pages: ['global'], keywords: ['home', 'dashboard', 'command'], action: 'navigate', destination: '/home', shortcut: 'G H' },
  { id: 'nav-companies', label: 'Go to Companies', description: 'View all companies', group: 'Navigate', pages: ['global'], keywords: ['companies', 'accounts'], action: 'navigate', destination: '/companies' },
  { id: 'nav-contacts', label: 'Go to Contacts', description: 'View all contacts', group: 'Navigate', pages: ['global'], keywords: ['contacts', 'people'], action: 'navigate', destination: '/contacts' },
  { id: 'nav-talent', label: 'Go to Talent Database', description: 'Search candidates', group: 'Navigate', pages: ['global'], keywords: ['talent', 'candidates'], action: 'navigate', destination: '/talent' },
  { id: 'nav-deals', label: 'Go to Deals', description: 'View deal pipeline', group: 'Navigate', pages: ['global'], keywords: ['deals', 'pipeline'], action: 'navigate', destination: '/deals' },
  { id: 'nav-jobs', label: 'Go to Jobs', description: 'View all jobs', group: 'Navigate', pages: ['global'], keywords: ['jobs', 'roles', 'vacancies'], action: 'navigate', destination: '/jobs' },
  { id: 'nav-outreach', label: 'Go to Outreach', description: 'Manage campaigns', group: 'Navigate', pages: ['global'], keywords: ['outreach', 'campaigns'], action: 'navigate', destination: '/outreach' },
  { id: 'nav-canvas', label: 'Go to Canvas', description: 'Org chart & relationship map', group: 'Navigate', pages: ['global'], keywords: ['canvas', 'org chart'], action: 'navigate', destination: '/canvas' },
  { id: 'nav-analytics', label: 'Go to Analytics', description: 'Reports & insights', group: 'Navigate', pages: ['global'], keywords: ['analytics', 'reports', 'insights'], action: 'navigate', destination: '/insights' },
  { id: 'nav-admin', label: 'Go to Admin', description: 'Admin console', group: 'Navigate', pages: ['global'], keywords: ['admin', 'settings'], action: 'navigate', destination: '/admin' },

  // ── Job Detail commands ─────────────────────────────────
  { id: 'job-gen-spec', label: 'Generate the job spec', description: 'AI writes a full spec from the brief', group: 'On this Job', pages: ['/jobs/'], keywords: ['generate', 'spec', 'write'], action: 'click', destination: 'job-generate-spec-button' },
  { id: 'job-run-shortlist', label: 'Run the shortlist', description: 'Open the Shortlist Builder with AI search', group: 'On this Job', pages: ['/jobs/'], keywords: ['shortlist', 'run', 'search', 'candidates'], action: 'click', destination: 'job-run-shortlist-button' },
  { id: 'job-post-boards', label: 'Post to all job boards', description: 'Generate & post adverts to connected boards', group: 'On this Job', pages: ['/jobs/'], keywords: ['post', 'boards', 'advertise'], action: 'click', destination: 'job-generate-adverts-button' },
  { id: 'job-send-outreach', label: 'Send outreach to shortlisted', description: 'Draft & send messages to shortlisted candidates', group: 'On this Job', pages: ['/jobs/'], keywords: ['outreach', 'send', 'email', 'contact'], action: 'click', destination: 'job-send-outreach-button' },
  { id: 'job-status', label: 'What stage is this job at?', description: 'Jarvis speaks the automation pipeline status', group: 'On this Job', pages: ['/jobs/'], keywords: ['stage', 'status', 'progress'], action: 'jarvis', destination: 'What stage is this job at?' },
  { id: 'job-mark-active', label: 'Mark this job as active', description: 'Set job status to active', group: 'On this Job', pages: ['/jobs/'], keywords: ['active', 'activate', 'live'], action: 'jarvis', destination: 'Mark this job as active' },
  { id: 'job-mark-filled', label: 'Mark this job as filled', description: 'Set job status to filled', group: 'On this Job', pages: ['/jobs/'], keywords: ['filled', 'placed', 'complete'], action: 'jarvis', destination: 'Mark this job as filled' },

  // ── Find Candidates ─────────────────────────────────────
  { id: 'find-skill', label: 'Search for candidates by skill', description: 'Opens shortlist builder with skill pre-filled', group: 'Find Candidates', pages: ['/jobs/', '/talent'], keywords: ['search', 'find', 'skill', 'developer'], action: 'jarvis', destination: 'Search for candidates' },
  { id: 'find-available', label: 'Show available candidates', description: 'Filter talent by availability status', group: 'Find Candidates', pages: ['/jobs/', '/talent'], keywords: ['available', 'free', 'bench'], action: 'navigate', destination: '/talent?status=available' },

  // ── Create & Log ────────────────────────────────────────
  { id: 'create-project', label: 'Create a project', description: 'Open the Create Project modal', group: 'Create & Log', pages: ['global', '/projects'], keywords: ['project', 'create', 'new', 'add'], action: 'click', destination: 'create-project-button' },
  { id: 'create-company', label: 'Add a new company', description: 'Create a company record', group: 'Create & Log', pages: ['global'], keywords: ['add', 'new', 'create', 'company'], action: 'click', destination: 'create-company-button' },
  { id: 'create-contact', label: 'Add a new contact', description: 'Create a contact record', group: 'Create & Log', pages: ['global'], keywords: ['add', 'new', 'create', 'contact'], action: 'click', destination: 'create-contact-button' },
  { id: 'create-contact-at', label: 'Add a contact at a company', description: 'Add contact with company pre-selected', group: 'Create & Log', pages: ['global'], keywords: ['add', 'contact', 'at', 'company'], action: 'jarvis', destination: 'Add a contact at a company' },
  { id: 'log-call', label: 'Log a call', description: 'Record a call note', group: 'Create & Log', pages: ['global'], keywords: ['log', 'call', 'phone', 'note'], action: 'jarvis', destination: 'Log a call' },
  { id: 'create-deal', label: 'Create a deal', description: 'Add a new deal to the pipeline', group: 'Create & Log', pages: ['global'], keywords: ['deal', 'create', 'new', 'pipeline'], action: 'jarvis', destination: 'Create a deal' },

  // ── Companies page ──────────────────────────────────────
  { id: 'company-import', label: 'Import companies', description: 'Bulk import from CSV', group: 'On this Page', pages: ['/companies'], keywords: ['import', 'csv', 'bulk'], action: 'click', destination: 'import-companies-button' },

  // ── Contacts page ───────────────────────────────────────
  { id: 'contact-import', label: 'Import contacts', description: 'Bulk import contacts', group: 'On this Page', pages: ['/contacts'], keywords: ['import', 'csv', 'bulk'], action: 'click', destination: 'import-button' },
  { id: 'contact-orgchart', label: 'View org chart', description: 'See organisation structure', group: 'On this Page', pages: ['/contacts'], keywords: ['org chart', 'structure', 'hierarchy'], action: 'click', destination: 'contacts-view-orgchart-button' },

  // ── Canvas page ─────────────────────────────────────────
  { id: 'canvas-build', label: 'Build org chart', description: 'Start building the org chart', group: 'On this Page', pages: ['/canvas'], keywords: ['build', 'create', 'org chart'], action: 'click', destination: 'canvas-build-orgchart' },
  { id: 'canvas-research', label: 'AI Research company', description: 'Research company structure with AI', group: 'On this Page', pages: ['/canvas'], keywords: ['research', 'ai', 'find'], action: 'click', destination: 'canvas-ai-research' },

  // ── Outreach page ───────────────────────────────────────
  { id: 'outreach-campaign', label: 'Create a campaign', description: 'New outreach campaign', group: 'On this Page', pages: ['/outreach'], keywords: ['campaign', 'create', 'new'], action: 'click', destination: 'new-campaign-button' },
  { id: 'outreach-script', label: 'Create a script', description: 'New call script', group: 'On this Page', pages: ['/outreach'], keywords: ['script', 'call', 'create'], action: 'click', destination: 'new-script-button' },
];

export function getCommandsForPage(pathname: string): JarvisCommand[] {
  return JARVIS_COMMANDS.filter(cmd => {
    if (cmd.pages.includes('global')) return true;
    return cmd.pages.some(p => pathname.startsWith(p));
  });
}

export function searchCommands(commands: JarvisCommand[], query: string): JarvisCommand[] {
  if (!query.trim()) return commands;
  const q = query.toLowerCase();
  return commands.filter(cmd =>
    cmd.label.toLowerCase().includes(q) ||
    cmd.description.toLowerCase().includes(q) ||
    cmd.keywords.some(k => k.includes(q))
  );
}

export function groupCommands(commands: JarvisCommand[]): Record<string, JarvisCommand[]> {
  const groups: Record<string, JarvisCommand[]> = {};
  for (const cmd of commands) {
    if (!groups[cmd.group]) groups[cmd.group] = [];
    groups[cmd.group].push(cmd);
  }
  return groups;
}
