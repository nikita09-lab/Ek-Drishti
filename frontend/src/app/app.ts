import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { OneViewApiService, DashboardSummary, InstitutionRecord, OfficerRecord, CaseRecord as ApiCase } from './oneview-api.service';
import { AuthService } from './auth.service';

type CaseRecord = { id: string; institution: string; category: string; bureau: string; officer: string; status: string; due: string; priority: string; age: number };

export interface LoginPortal {
  id: 'aicte_official' | 'bureau_officer' | 'system_admin' | 'institution';
  title: string;
  shortTitle: string;
  badge: string;
  roleHint: string;
  description: string;
  glyph: string;
  allowedRoles: string[];
  placeholderUsername: string;
  demoUsername: string;
  demoPassword: string;
  demoLabel: string;
}

@Component({ selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './app.html', styleUrl: './app.scss' })
export class App implements OnInit {
  constructor(
    private api: OneViewApiService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}


  readonly loginPortals: LoginPortal[] = [
    {
      id: 'aicte_official',
      title: 'AICTE Officials (Administration)',
      shortTitle: 'AICTE Officials',
      badge: 'Administration',
      roleHint: 'Apex Administration & Bureau Heads',
      description: 'Official access for AICTE leadership, directors, and bureau heads to monitor nationwide cases, cross-bureau intelligence, and policy escalations.',
      glyph: '🏛️',
      allowedRoles: ['admin', 'bureau_head'],
      placeholderUsername: 'Official Email / Username (e.g. aicte.official)',
      demoUsername: 'aicte.official',
      demoPassword: '1234',
      demoLabel: 'Prof. M. Sharma (AICTE Admin)'
    },
    {
      id: 'bureau_officer',
      title: 'Bureau Officers',
      shortTitle: 'Bureau Officers',
      badge: 'RB & PGRC Officers',
      roleHint: 'Regulation & Grievance Bureaus',
      description: 'Operational portal for assigned Regulation Bureau (RB) and Public Grievance Redressal Cell (PGRC) officers managing active complaints and investigations.',
      glyph: '⚖️',
      allowedRoles: ['officer', 'case_manager', 'bureau_head', 'admin'],
      placeholderUsername: 'Officer Email / Username (e.g. officer.rb)',
      demoUsername: 'officer.rb',
      demoPassword: 'Officer1234!',
      demoLabel: 'Demo Officer One (RB Officer)'
    },
    {
      id: 'system_admin',
      title: 'System Admin',
      shortTitle: 'System Admin',
      badge: 'IT & Security',
      roleHint: 'System Security & Configuration',
      description: 'Administrative access for technical administrators managing database configurations, audit logs, credential policies, and user accounts.',
      glyph: '🛡️',
      allowedRoles: ['admin'],
      placeholderUsername: 'System Admin Username (e.g. admin)',
      demoUsername: 'admin',
      demoPassword: '1234',
      demoLabel: 'System Administrator'
    },
    {
      id: 'institution',
      title: 'Institution',
      shortTitle: 'Institution Portal',
      badge: 'Colleges & Universities',
      roleHint: 'Approved Institutions & Nodal Desks',
      description: 'Institutional portal for technical colleges, polytechnics, and universities to track submitted complaints, compliance notices, and case updates.',
      glyph: '🎓',
      allowedRoles: ['institution', 'viewer', 'admin'],
      placeholderUsername: 'Institution ID / Email (e.g. INST-DEMO-1001)',
      demoUsername: 'INST-DEMO-1001',
      demoPassword: '1234',
      demoLabel: 'Demo Technical Institute'
    }
  ];

  selectedPortalId: LoginPortal['id'] = 'aicte_official';

  get currentPortal(): LoginPortal {
    return this.loginPortals.find(p => p.id === this.selectedPortalId) || this.loginPortals[0];
  }

  selectPortal(portalId: LoginPortal['id']): void {
    this.selectedPortalId = portalId;
    this.loginError = '';
    const p = this.currentPortal;
    this.loginUsername = p.demoUsername;
    this.loginPassword = p.demoPassword;
    this.cdr.detectChanges();
  }

  fillDemo(portal: LoginPortal): void {
    this.selectedPortalId = portal.id;
    this.loginUsername = portal.demoUsername;
    this.loginPassword = portal.demoPassword;
    this.loginError = '';
    this.cdr.detectChanges();
  }

  loginUsername = 'aicte.official';
  loginPassword = '1234';
  loginBusy = false;
  loginError = '';
  get userDisplayName(): string { return this.auth.user?.full_name || this.auth.user?.username || 'Authorized user'; }
  get roleLabel(): string { return (this.auth.user?.role || 'viewer').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  get initials(): string { return this.userDisplayName.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0].toUpperCase()).join('') || 'U'; }

  submitLogin(): void {
    this.loginError = '';
    if (!this.loginUsername.trim() || !this.loginPassword) {
      this.loginError = 'Enter your username and password.';
      this.cdr.detectChanges();
      return;
    }
    this.loginBusy = true;
    this.cdr.detectChanges();

    this.auth.login(this.loginUsername.trim(), this.loginPassword, this.selectedPortalId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          const userRole = res.user?.role;
          this.loginPassword = '';
          this.loginBusy = false;
          this.loginError = '';
          if (userRole === 'institution') {
            this.activePage = 'Institutions';
          } else {
            this.activePage = 'Command Center';
          }
          this.cdr.detectChanges();
          this.refreshData();
        });
      },
      error: err => {
        this.ngZone.run(() => {
          this.loginBusy = false;
          this.loginError = err?.error?.detail || 'Sign-in failed. Check your credentials and API connection.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  logout(): void {
    this.auth.logout();
    this.loginPassword = '';
    this.loginError = '';
    this.apiConnected = false;
    this.cases = [];
    this.complaints = [];
    this.institutions = [];
    this.officers = [];
    this.activePage = 'Command Center';
    this.cdr.detectChanges();
  }
  activePage = 'Command Center'; mobileNavOpen = false; searchTerm = ''; bureauFilter = 'All Bureaus'; statusFilter = 'All statuses'; notice = '';
  loading = true; apiConnected = false; loadError = '';
  summary: DashboardSummary = { total_complaints: 0, total_cases: 0, pending_cases: 0, disposed_cases: 0, overdue_cases: 0, institutions: 0, officers: 0 };
  institutions: InstitutionRecord[] = []; officers: OfficerRecord[] = []; cases: CaseRecord[] = [];
  complaints: any[] = []; overlaps: any[] = []; issueGroups: any[] = []; notifications: any[] = []; timeline: any[] = []; reports: any = {};
  selectedCaseId = ''; showComplaintForm = false; showInstitutionForm = false; showOfficerForm = false; showCaseForm = false;
  complaintForm: any = { institution_id: '', subject: '', description: '', category: 'General', source: 'Internal', assigned_bureau: 'PGRC', expected_disposal_date: '' };
  institutionForm: any = { name: '', institution_type: 'University/College', address: '', state: '', region: '', status: 'Active' };
  officerForm: any = { name: '', designation: '', bureau: 'RB', email: '' };
  caseForm: any = { institution_id: '', title: '', bureau: 'RB', officer_id: '', status: 'Open', priority: 'Normal', expected_disposal_date: '', next_action: '' };
  actionForm: any = { action_type: 'Status updated', new_status: 'Under Review', remarks: '', officer_name: '' };
  recommendation: any = null; overlapRemarks = '';
  get pageSubtitle(): string {
    const subtitles: Record<string, string> = {
      'Command Center': 'Unified monitoring across the Regulation Bureau and Public Grievance Redressal Cell',
      'Institutions': 'Institution profile, complaint history, and related case intelligence',
      'All Complaints': 'Search and review complaint submissions and their linked cases',
      'Case Management': 'Manage assignments, workflow status, deadlines, and case history',
      'Overlap Intelligence': 'Human-reviewed signals for duplicate submissions and cross-Bureau coordination',
      'Bureau Recommendations': 'Advisory routing support with evidence and accountable human decisions',
      'Case Timeline': 'Chronological case actions, assignments, and deadline history',
      'Deadline Monitoring': 'Track upcoming deadlines and cases requiring escalation',
      'Officers & Assignments': 'Review officer assignments and workload distribution',
      'Reports & Analytics': 'Review institution-wise, Bureau-wise, and officer-wise summaries',
      'Notifications': 'Updates requiring attention from the current official',
      'Administration & Settings': 'Manage users, permissions, and workflow configuration'
    };
    return subtitles[this.activePage] ?? 'AICTE OneView administrative workspace';
  }
  readonly navItems = [
    { label: 'Command Center', glyph: '▦' }, { label: 'Institutions', glyph: '▤' },
    { label: 'All Complaints', glyph: '▧' }, { label: 'Case Management', glyph: '▣' },
    { label: 'Overlap Intelligence', glyph: '⇄' }, { label: 'Bureau Recommendations', glyph: '◎' },
    { label: 'Case Timeline', glyph: '≋' }, { label: 'Deadline Monitoring', glyph: '◷' },
    { label: 'Officers & Assignments', glyph: '♙' }, { label: 'Reports & Analytics', glyph: '▥' },
    { label: 'Notifications', glyph: '♧' }, { label: 'Administration & Settings', glyph: '⚙' }
  ];
  get rbCasesCount(): number { return this.cases.filter(c => c.bureau === 'RB').length; }
  get pgrcCasesCount(): number { return this.cases.filter(c => c.bureau === 'PGRC').length; }
  get rbCasesPercent(): number { return this.summary.total_cases ? this.rbCasesCount / this.summary.total_cases * 100 : 0; }
  get pgrcCasesPercent(): number { return this.summary.total_cases ? this.pgrcCasesCount / this.summary.total_cases * 100 : 0; }
  get stats() { return [
    { label: 'Total complaints', value: String(this.summary.total_complaints), note: 'From connected database' },
    { label: 'Pending cases', value: String(this.summary.pending_cases), note: 'Currently not disposed' },
    { label: 'Under process', value: String(this.cases.filter(c => !['Disposed','Closed','Open'].includes(c.status)).length), note: 'Current case records' },
    { label: 'Disposed cases', value: String(this.summary.disposed_cases), note: 'Disposed or closed' },
    { label: 'Institutions', value: String(this.summary.institutions), note: 'Registered institutions' },
    { label: 'Overdue cases', value: String(this.summary.overdue_cases), note: 'Review required' },
    { label: 'Active officers', value: String(this.summary.officers), note: 'Registered active officers' },
    { label: 'Total cases', value: String(this.summary.total_cases), note: 'From connected database' }
  ]; }
  ngOnInit(): void { if (this.auth.isAuthenticated) this.refreshData(); }
  refreshData(): void {
    this.loading = true; this.loadError = '';
    forkJoin({ summary: this.api.dashboardSummary(), institutions: this.api.institutions(), officers: this.api.officers(), cases: this.api.cases() }).subscribe({
      next: data => {
        this.ngZone.run(() => {
          this.summary = data.summary;
          this.institutions = data.institutions;
          this.officers = data.officers;
          this.cases = data.cases.map(c => {
            const institution = data.institutions.find(i => i.id === c.institution_id);
            const officer = data.officers.find(o => o.id === c.officer_id);
            return { id: c.id, institution: institution?.name ?? c.institution_id, category: c.title, bureau: c.bureau || 'Unassigned', officer: officer?.name ?? 'Unassigned', status: c.status, due: c.expected_disposal_date ? this.formatDate(c.expected_disposal_date) : 'Not set', priority: c.priority || 'Normal', age: this.daysOpen(c.opened_at) };
          });
          this.apiConnected = true;
          this.loading = false;
          this.cdr.detectChanges();
          this.api.complaints().subscribe({
            next: rows => { this.complaints = rows; this.cdr.detectChanges(); },
            error: () => { this.complaints = []; this.cdr.detectChanges(); }
          });
          this.loadPageData();
        });
      },
      error: err => {
        this.ngZone.run(() => {
          this.apiConnected = false;
          this.loading = false;
          this.loadError = err?.status === 0 
            ? 'Cannot reach the API. Start the FastAPI backend at http://127.0.0.1:8000.' 
            : `Could not load records from API (${err?.status ?? 'Unknown error'}: ${err?.error?.detail || err?.statusText || 'Error'}). Check backend logs.`;
          this.cdr.detectChanges();
        });
      }

    });
  }
  private formatDate(value: string): string { return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  private daysOpen(value: string): number { return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)); }
  get filteredCases(): CaseRecord[] {
    const q = this.searchTerm.trim().toLowerCase();
    return this.cases.filter(c => (!q || [c.id,c.institution,c.category,c.officer].some(v => v.toLowerCase().includes(q))) && (this.bureauFilter === 'All Bureaus' || c.bureau === this.bureauFilter) && (this.statusFilter === 'All statuses' || c.status === this.statusFilter));
  }
  navigate(label: string): void { this.activePage = label; this.mobileNavOpen = false; this.notice = ''; this.loadPageData(); }
  loadPageData(): void {
    if (this.activePage === 'Overlap Intelligence') {
      this.api.overlaps().subscribe({ next: x => this.overlaps = x, error: () => this.action('Could not load overlap signals.') });
      this.api.issueGroups().subscribe({ next: x => this.issueGroups = x, error: () => this.issueGroups = [] });
    }
    if (this.activePage === 'Notifications') this.api.notifications().subscribe({ next: x => this.notifications = x, error: () => this.action('Could not load notifications.') });
    if (this.activePage === 'Reports & Analytics') this.api.reportSummary().subscribe({ next: x => this.reports = x, error: () => this.action('Could not load reports.') });
  }
  registerComplaint(): void {
    const p = { ...this.complaintForm, expected_disposal_date: this.complaintForm.expected_disposal_date || null };
    this.api.createComplaint(p).subscribe({ next: r => { this.action(`Complaint ${r.id} registered.`); this.showComplaintForm = false; this.refreshData(); }, error: e => this.action(e?.error?.detail || 'Complaint registration failed. Check institution ID and API.') });
  }
  registerInstitution(): void { this.api.createInstitution(this.institutionForm).subscribe({ next: r => { this.action(`Institution ${r.name} created.`); this.showInstitutionForm = false; this.refreshData(); }, error: e => this.action(e?.error?.detail || 'Institution creation failed.') }); }
  registerOfficer(): void { this.api.createOfficer(this.officerForm).subscribe({ next: r => { this.action(`Officer ${r.name} created.`); this.showOfficerForm = false; this.refreshData(); }, error: e => this.action(e?.error?.detail || 'Officer creation failed.') }); }
  registerCase(): void { const p = { ...this.caseForm, officer_id: this.caseForm.officer_id || null, expected_disposal_date: this.caseForm.expected_disposal_date || null }; this.api.createCase(p).subscribe({ next: r => { this.action(`Case ${r.id} created.`); this.showCaseForm = false; this.refreshData(); }, error: e => this.action(e?.error?.detail || 'Case creation failed.') }); }
  openTimeline(c: CaseRecord): void { this.selectedCaseId = c.id; this.activePage = 'Case Timeline'; this.api.caseTimeline(c.id).subscribe({ next: x => this.timeline = x, error: () => this.timeline = [] }); }
  saveCaseAction(): void { if (!this.selectedCaseId) { this.action('Open a case using its Open button first.'); return; } this.api.addCaseAction(this.selectedCaseId, this.actionForm).subscribe({ next: () => { this.action('Case status/action saved to database.'); this.api.caseTimeline(this.selectedCaseId).subscribe(x => this.timeline = x); this.refreshData(); }, error: e => this.action(e?.error?.detail || 'Could not save case action.') }); }
  runRecommendation(): void { const c = this.complaints[0]; if (!c) { this.action('Register a complaint before requesting a recommendation.'); return; } this.api.recommendBureau({ subject: c.subject, description: c.description, category: c.category }).subscribe({ next: r => this.recommendation = { ...r, complaint: c }, error: () => this.action('Recommendation request failed.') }); }
  reviewOverlap(o: any, decision: string): void { this.api.reviewOverlap({ complaint_id: o.complaint_id, related_complaint_id: o.related_complaint_id, decision, remarks: this.overlapRemarks || null }).subscribe({ next: () => { this.action(`Overlap decision saved: ${decision}. Source complaints remain separate.`); this.api.overlaps().subscribe(x => this.overlaps = x); this.api.issueGroups().subscribe(x => this.issueGroups = x); this.overlapRemarks = ''; }, error: e => this.action(e?.error?.detail || 'Could not save review decision.') }); }
  get deadlineCases(): CaseRecord[] { return this.cases.filter(c => c.due !== 'Not set' && new Date(c.due) < new Date() && !['Closed', 'Disposed'].includes(c.status)); }
  action(message: string): void { this.notice = message; }
  resetFilters(): void { this.searchTerm = ''; this.bureauFilter = 'All Bureaus'; this.statusFilter = 'All statuses'; }
  exportCsv(): void {
    const header = ['Case ID','Institution','Category','Bureau','Officer','Status','Expected disposal','Priority'];
    const rows = this.filteredCases.map(c => [c.id,c.institution,c.category,c.bureau,c.officer,c.status,c.due,c.priority]);
    const csv = [header,...rows].map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'aicte-oneview-cases.csv'; link.click(); URL.revokeObjectURL(url);
    this.action('CSV export prepared from records currently loaded from the backend.');
  }
}
