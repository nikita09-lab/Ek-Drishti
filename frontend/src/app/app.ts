import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import {
  OneViewApiService,
  DashboardSummary,
  InstitutionRecord,
  OfficerRecord,
  CaseRecord as ApiCase,
  ComplaintRecord,
  OverlapSignal,
  IssueGroup,
  NotificationRecord,
  ReportSummary,
  MonthlyTrendItem,
  CategoryTrendItem,
  CaseAgeItem,
  OfficerDashboardSummary,
  InstitutionDashboardSummary,
  AdminSystemSummary,
  InstitutionProfile,
  SystemHealth,
  UserRecord,
  AccessRequestRecord
} from './oneview-api.service';
import { AuthService } from './auth.service';

export interface DisplayCase {
  id: string;
  institution: string;
  institution_id?: string;
  category: string;
  bureau: string;
  officer: string;
  officer_id?: string | null;
  status: string;
  due: string;
  dueDateRaw?: string | null;
  priority: string;
  age: number;
  rawTitle?: string;
  nextAction?: string | null;
}

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

export type RolePortalType = 'aicte_official' | 'bureau_officer' | 'system_admin' | 'institution';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  constructor(
    public api: OneViewApiService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  // ==========================================
  // LOGIN SCREEN & AUTHENTICATION
  // ==========================================
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
  primaryRole: RolePortalType = 'aicte_official';

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

  get userDisplayName(): string {
    return this.auth.user?.full_name || this.auth.user?.username || 'Authorized user';
  }

  get roleLabel(): string {
    return (this.auth.user?.role || 'viewer').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  get initials(): string {
    return this.userDisplayName.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('') || 'U';
  }

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
          this.loginPassword = '';
          this.loginBusy = false;
          this.loginError = '';
          this.determineRoleAndDefaultPage(res.user?.role);
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

  determineRoleAndDefaultPage(role?: string): void {
    const r = role || this.auth.user?.role;
    if (r === 'institution') {
      this.primaryRole = 'institution';
      this.activePage = 'Institution Dashboard';
    } else if (r === 'officer' || r === 'case_manager') {
      this.primaryRole = 'bureau_officer';
      this.activePage = 'My Dashboard';
    } else if (r === 'admin') {
      // If user signed in via aicte_official portal, let them start on official
      if (this.selectedPortalId === 'aicte_official') {
        this.primaryRole = 'aicte_official';
        this.activePage = 'Executive Dashboard';
      } else {
        this.primaryRole = 'system_admin';
        this.activePage = 'System Overview';
      }
    } else {
      // Default to official for bureau_head or others
      this.primaryRole = 'aicte_official';
      this.activePage = 'Executive Dashboard';
    }
  }

  switchAdminPerspective(target: 'aicte_official' | 'system_admin'): void {
    if (this.auth.user?.role !== 'admin') return;
    this.primaryRole = target;
    this.activePage = target === 'system_admin' ? 'System Overview' : 'Executive Dashboard';
    this.refreshData();
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
    this.activePage = 'Executive Dashboard';
    this.cdr.detectChanges();
  }

  // ==========================================
  // NAVIGATION & SHELL STATE
  // ==========================================
  activePage = 'Executive Dashboard';
  mobileNavOpen = false;
  searchTerm = '';
  bureauFilter = 'All Bureaus';
  statusFilter = 'All statuses';
  notice = '';
  loading = true;
  apiConnected = false;
  loadError = '';

  get navItems(): { label: string; glyph: string; badge?: string | number }[] {
    switch (this.primaryRole) {
      case 'aicte_official':
        return [
          { label: 'Executive Dashboard', glyph: '▦' },
          { label: 'All Complaints', glyph: '▧' },
          { label: 'Institution Intelligence', glyph: '▤' },
          { label: 'Bureau Performance', glyph: '⚖️' },
          { label: 'Cross-Bureau Coordination', glyph: '⇄', badge: this.summary?.overdue_cases || undefined },
          { label: 'Overdue Cases & Escalations', glyph: '◷' },
          { label: 'Reports & Analytics', glyph: '▥' },
          { label: 'Notifications', glyph: '♧' },
          { label: 'Audit & Oversight', glyph: '🛡️' },
          { label: 'Profile & Settings', glyph: '⚙' }
        ];

      case 'bureau_officer':
        return [
          { label: 'My Dashboard', glyph: '▦' },
          { label: 'My Assigned Cases', glyph: '▣' },
          { label: 'Complaint Inbox', glyph: '📥' },
          { label: 'Case Management', glyph: '🗂️' },
          { label: 'Overlap Intelligence', glyph: '⇄', badge: this.overlaps.length || undefined },
          { label: 'Case Timeline', glyph: '≋' },
          { label: 'Deadline Monitoring', glyph: '◷' },
          { label: 'Cross-Bureau Coordination', glyph: '🏛️' },
          { label: 'Notifications', glyph: '♧' },
          { label: 'My Reports', glyph: '▥' },
          { label: 'My Profile', glyph: '👤' }
        ];

      case 'system_admin':
        return [
          { label: 'System Overview', glyph: '▦' },
          { label: 'User Management', glyph: '👥' },
          { label: 'Roles & Permissions', glyph: '🔑' },
          { label: 'Institution Registry', glyph: '▤' },
          { label: 'Bureau Management', glyph: '🏛️' },
          { label: 'Officer Management', glyph: '♙' },
          { label: 'Access Requests', glyph: '📋', badge: this.adminSummary?.pending_access_requests || undefined },
          { label: 'Audit Logs', glyph: '📜' },
          { label: 'System Health', glyph: '💓' },
          { label: 'Notification Configuration', glyph: '🔔' },
          { label: 'System Settings', glyph: '⚙' },
          { label: 'My Profile', glyph: '👤' }
        ];

      case 'institution':
        return [
          { label: 'Institution Dashboard', glyph: '▦' },
          { label: 'Submit Complaint', glyph: '＋' },
          { label: 'My Complaints', glyph: '▧' },
          { label: 'Track Complaint', glyph: '🔍' },
          { label: 'Requests for Information', glyph: '❓', badge: this.institutionSummary?.awaiting_info || undefined },
          { label: 'Notifications', glyph: '♧' },
          { label: 'Institution Profile', glyph: '🎓' },
          { label: 'Help & Support', glyph: '💬' },
          { label: 'My Profile', glyph: '👤' }
        ];
    }
  }

  get pageSubtitle(): string {
    const subtitles: Record<string, string> = {
      'Executive Dashboard': 'Consolidated governance, nationwide metrics, and cross-bureau intelligence',
      'My Dashboard': 'Assigned grievances, pending investigations, and compliance deadlines',
      'System Overview': 'User administration, access controls, audit logs, and infrastructure health',
      'Institution Dashboard': 'Official institutional grievance desk, submissions, and milestone tracking',
      'Submit Complaint': 'File a formal compliance, administrative, or student grievance with AICTE',
      'My Complaints': 'Review submitted grievances, current investigation stages, and formal findings',
      'Track Complaint': 'Step-by-step milestone progression for specific complaint IDs',
      'Requests for Information': 'Clarifications, documentation requests, and notices from investigating officers',
      'Institution Profile': 'Verified AICTE registry information and institutional nodal contact',
      'User Management': 'Active credentials, role authorizations, and administrative security state',
      'Access Requests': 'Incoming account provisioning and bureau assignment petitions',
      'System Health': 'Database connection pool, API latency, and operational telemetry',
      'Audit Logs': 'Tamper-evident system activity and authentication audit trails',
      'Institution Registry': 'Central repository of approved polytechnics, colleges, and technical universities',
      'All Complaints': 'Master complaint register with category filters and bureau dispatching',
      'Institution Intelligence': 'Institutional compliance history, repeat grievance flags, and regional records',
      'Bureau Performance': 'Comparative case disposal velocity between RB and PGRC',
      'Cross-Bureau Coordination': 'Multi-bureau coordination for overlapping compliance and grievance cases',
      'Overdue Cases & Escalations': 'Critical cases that have exceeded statutory disposal deadlines',
      'Overlap Intelligence': 'Advisory AI similarity signals with accountable human officer review',
      'Case Management': 'Manage operational workflows, status transitions, and assigned officers',
      'Case Timeline': 'Auditable chronological history of status changes, notes, and milestones',
      'Deadline Monitoring': 'Proactive tracking of upcoming statutory deadlines to prevent escalations',
      'Officers & Assignments': 'Registry of verified bureau officers and current caseload allocations',
      'Reports & Analytics': 'Comprehensive statistical breakdowns by category, age, and disposition',
      'Notifications': 'Priority updates and administrative alerts requiring official attention'
    };
    return subtitles[this.activePage] ?? 'AICTE OneView Governance Platform';
  }

  // ==========================================
  // DATA STORE
  // ==========================================
  summary: DashboardSummary = {
    total_complaints: 0,
    total_cases: 0,
    pending_cases: 0,
    disposed_cases: 0,
    overdue_cases: 0,
    institutions: 0,
    officers: 0
  };

  officerSummary: OfficerDashboardSummary | null = null;
  institutionSummary: InstitutionDashboardSummary | null = null;
  adminSummary: AdminSystemSummary | null = null;
  systemHealthData: SystemHealth | null = null;
  institutionProfileData: InstitutionProfile | null = null;

  monthlyTrends: MonthlyTrendItem[] = [];
  categoryTrends: CategoryTrendItem[] = [];
  caseAgeDistribution: CaseAgeItem[] = [];

  institutions: InstitutionRecord[] = [];
  officers: OfficerRecord[] = [];
  cases: DisplayCase[] = [];
  complaints: ComplaintRecord[] = [];
  overlaps: OverlapSignal[] = [];
  issueGroups: IssueGroup[] = [];
  notifications: NotificationRecord[] = [];
  timeline: any[] = [];
  reports: ReportSummary = {
    cases_by_bureau: [],
    cases_by_status: [],
    institutions_by_region: []
  };

  usersList: UserRecord[] = [];
  accessRequestsList: AccessRequestRecord[] = [];

  // ==========================================
  // MODALS & FORMS
  // ==========================================
  selectedCaseId = '';
  selectedCase: DisplayCase | null = null;
  showCaseDetailModal = false;
  showComplaintForm = false;
  showInstitutionForm = false;
  showOfficerForm = false;
  showCaseForm = false;
  showUserCreateModal = false;

  // Track Complaint State
  trackComplaintId = '';
  trackedComplaint: ComplaintRecord | null = null;
  trackedCase: DisplayCase | null = null;

  // Forms
  complaintForm: any = {
    institution_id: '',
    subject: '',
    description: '',
    category: 'General',
    department: '',
    supporting_doc: '',
    declaration_agreed: false,
    assigned_bureau: 'PGRC',
    expected_disposal_date: ''
  };

  institutionForm: any = {
    name: '',
    institution_type: 'Engineering & Technology',
    address: '',
    state: 'Delhi',
    region: 'Northern',
    status: 'Active'
  };

  officerForm: any = {
    name: '',
    designation: 'Assistant Director',
    bureau: 'RB',
    email: ''
  };

  caseForm: any = {
    institution_id: '',
    title: '',
    bureau: 'RB',
    officer_id: '',
    status: 'Open',
    priority: 'Normal',
    expected_disposal_date: '',
    next_action: ''
  };

  actionForm: any = {
    action_type: 'Status updated',
    new_status: 'Under Review',
    remarks: '',
    officer_name: ''
  };

  newUserForm: any = {
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'officer',
    assigned_bureau: 'RB'
  };

  overlapRemarks = '';
  recommendation: any = null;

  // ==========================================
  // COMPUTED PROPERTIES
  // ==========================================
  get rbCasesCount(): number {
    return this.cases.filter(c => c.bureau === 'RB').length;
  }
  get pgrcCasesCount(): number {
    return this.cases.filter(c => c.bureau === 'PGRC').length;
  }
  get rbCasesPercent(): number {
    return this.summary.total_cases ? Math.round((this.rbCasesCount / this.summary.total_cases) * 100) : 0;
  }
  get pgrcCasesPercent(): number {
    return this.summary.total_cases ? Math.round((this.pgrcCasesCount / this.summary.total_cases) * 100) : 0;
  }

  get stats() {
    return [
      { label: 'Total complaints', value: String(this.summary.total_complaints), note: 'Verified complaints registered' },
      { label: 'Pending complaints', value: String(this.summary.pending_cases), note: 'Under investigation / action' },
      { label: 'Under process', value: String(this.cases.filter(c => ['Under Review', 'Under Process', 'Info Requested', 'Coordination'].includes(c.status)).length), note: 'Active procedural stage' },
      { label: 'Disposed complaints', value: String(this.summary.disposed_cases), note: 'Concluded with formal order' },
      { label: 'Overdue cases', value: String(this.summary.overdue_cases), note: 'Exceeded statutory timeline' },
      { label: 'Registered institutions', value: String(this.summary.institutions), note: 'From AICTE central registry' },
      { label: 'Active bureau officers', value: String(this.summary.officers), note: 'RB and PGRC roster' },
      { label: 'Cases awaiting coordination', value: String(this.cases.filter(c => c.status === 'Coordination').length), note: 'Cross-bureau coordination' }
    ];
  }

  get filteredCases(): DisplayCase[] {
    const q = this.searchTerm.trim().toLowerCase();
    return this.cases.filter(c => {
      const matchSearch = !q || [c.id, c.institution, c.category, c.officer, c.bureau, c.status].some(v => (v || '').toLowerCase().includes(q));
      const matchBureau = this.bureauFilter === 'All Bureaus' || c.bureau === this.bureauFilter;
      const matchStatus = this.statusFilter === 'All statuses' || c.status === this.statusFilter;
      return matchSearch && matchBureau && matchStatus;
    });
  }

  get myAssignedCases(): DisplayCase[] {
    const currentName = this.auth.user?.full_name?.toLowerCase();
    const currentUsername = this.auth.user?.username?.toLowerCase();
    return this.cases.filter(c => {
      const off = c.officer?.toLowerCase() || '';
      return (currentName && off.includes(currentName)) || (currentUsername && off.includes(currentUsername)) || c.status === 'Under Review';
    });
  }

  get deadlineCases(): DisplayCase[] {
    return this.cases.filter(c => {
      if (c.due === 'Not set' || ['Closed', 'Disposed'].includes(c.status)) return false;
      if (!c.dueDateRaw) return false;
      return new Date(c.dueDateRaw) < new Date();
    });
  }

  // ==========================================
  // LIFECYCLE & DATA REFRESH
  // ==========================================
  ngOnInit(): void {
    if (this.auth.isAuthenticated) {
      this.determineRoleAndDefaultPage();
      this.refreshData();
    }
  }

  refreshData(): void {
    this.loading = true;
    this.loadError = '';

    // Load common datasets based on role permissions
    const requests: Record<string, any> = {
      institutions: this.api.institutions(),
      cases: this.api.cases(),
      complaints: this.api.complaints()
    };

    if (this.primaryRole === 'aicte_official' || this.primaryRole === 'system_admin') {
      requests['summary'] = this.api.dashboardSummary();
      requests['officers'] = this.api.officers();
      requests['monthlyTrends'] = this.api.monthlyTrends();
      requests['categoryTrends'] = this.api.categoryTrends();
      requests['caseAge'] = this.api.caseAgeDistribution();
    }

    if (this.primaryRole === 'bureau_officer') {
      requests['officerSummary'] = this.api.officerDashboardSummary();
      requests['officers'] = this.api.officers();
      requests['monthlyTrends'] = this.api.monthlyTrends();
    }

    if (this.primaryRole === 'institution') {
      requests['institutionSummary'] = this.api.institutionDashboardSummary();
      requests['institutionProfile'] = this.api.institutionProfile();
    }

    if (this.primaryRole === 'system_admin') {
      requests['adminSummary'] = this.api.adminSystemSummary();
      requests['systemHealth'] = this.api.systemHealth();
      requests['users'] = this.api.users();
      requests['accessRequests'] = this.api.accessRequests();
    }

    forkJoin(requests).subscribe({
      next: (data: any) => {
        this.ngZone.run(() => {
          this.institutions = data.institutions || [];
          this.complaints = data.complaints || [];

          if (data.officers) this.officers = data.officers;
          if (data.summary) this.summary = data.summary;
          if (data.officerSummary) this.officerSummary = data.officerSummary;
          if (data.institutionSummary) this.institutionSummary = data.institutionSummary;
          if (data.adminSummary) this.adminSummary = data.adminSummary;
          if (data.systemHealth) this.systemHealthData = data.systemHealth;
          if (data.institutionProfile) this.institutionProfileData = data.institutionProfile;
          if (data.monthlyTrends) this.monthlyTrends = data.monthlyTrends;
          if (data.categoryTrends) this.categoryTrends = data.categoryTrends;
          if (data.caseAge) this.caseAgeDistribution = data.caseAge;
          if (data.users) this.usersList = data.users;
          if (data.accessRequests) this.accessRequestsList = data.accessRequests;

          // Format Cases for display
          const rawCases: ApiCase[] = data.cases || [];
          this.cases = rawCases.map(c => {
            const inst = this.institutions.find(i => i.id === c.institution_id);
            const off = this.officers.find(o => o.id === c.officer_id);
            return {
              id: c.id,
              institution: inst?.name ?? c.institution_id,
              institution_id: c.institution_id,
              category: c.title,
              rawTitle: c.title,
              bureau: c.bureau || 'Unassigned',
              officer: off?.name ?? (c.officer_id ? `Officer (${c.officer_id})` : 'Unassigned'),
              officer_id: c.officer_id,
              status: c.status,
              due: c.expected_disposal_date ? this.formatDate(c.expected_disposal_date) : 'Not set',
              dueDateRaw: c.expected_disposal_date,
              priority: c.priority || 'Normal',
              age: this.daysOpen(c.opened_at),
              nextAction: c.next_action
            };
          });

          this.apiConnected = true;
          this.loading = false;
          this.cdr.detectChanges();
          this.loadPageData();
        });
      },
      error: err => {
        this.ngZone.run(() => {
          this.apiConnected = false;
          this.loading = false;
          this.loadError = err?.status === 0
            ? 'Cannot reach the backend API. Please ensure the server is running on http://127.0.0.1:8000.'
            : `API communication issue (${err?.status ?? 'Error'}): ${err?.error?.detail || err?.statusText || 'Could not fetch records'}.`;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private formatDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private daysOpen(value: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  }

  navigate(label: string): void {
    this.activePage = label;
    this.mobileNavOpen = false;
    this.notice = '';
    this.loadPageData();
  }

  loadPageData(): void {
    if (this.activePage === 'Overlap Intelligence') {
      this.api.overlaps().subscribe({
        next: x => { this.overlaps = x; this.cdr.detectChanges(); },
        error: () => this.action('Could not load overlap signals.')
      });
      this.api.issueGroups().subscribe({
        next: x => { this.issueGroups = x; this.cdr.detectChanges(); },
        error: () => this.issueGroups = []
      });
    }

    if (this.activePage === 'Notifications') {
      this.api.notifications().subscribe({
        next: x => { this.notifications = x; this.cdr.detectChanges(); },
        error: () => this.action('Could not load notifications.')
      });
    }

    if (this.activePage === 'Reports & Analytics' || this.activePage === 'My Reports') {
      this.api.reportSummary().subscribe({
        next: x => { this.reports = x; this.cdr.detectChanges(); },
        error: () => this.action('Could not load reports.')
      });
    }

    if (this.activePage === 'Audit Logs' || this.activePage === 'Audit & Oversight') {
      this.api.notifications().subscribe({
        next: x => { this.notifications = x; this.cdr.detectChanges(); },
        error: () => {}
      });
    }

    if (this.activePage === 'User Management' && this.auth.user?.role === 'admin') {
      this.api.users().subscribe({
        next: (u: UserRecord[]) => { this.usersList = u; this.cdr.detectChanges(); },
        error: () => {}
      });
    }

    if (this.activePage === 'Access Requests' && this.auth.user?.role === 'admin') {
      this.api.accessRequests().subscribe({
        next: (r: AccessRequestRecord[]) => { this.accessRequestsList = r; this.cdr.detectChanges(); },
        error: () => {}
      });
    }
  }

  // ==========================================
  // CASE ACTIONS & WORKFLOW MODAL
  // ==========================================
  openCaseDetails(c: DisplayCase): void {
    this.selectedCaseId = c.id;
    this.selectedCase = c;
    this.showCaseDetailModal = true;
    this.actionForm = {
      action_type: 'Investigation updated',
      new_status: c.status,
      remarks: '',
      officer_name: this.auth.user?.full_name || 'Assigned Officer'
    };
    this.api.caseTimeline(c.id).subscribe({
      next: x => { this.timeline = x; this.cdr.detectChanges(); },
      error: () => { this.timeline = []; }
    });
  }

  closeCaseDetails(): void {
    this.showCaseDetailModal = false;
    this.selectedCase = null;
  }

  quickAcknowledge(c: DisplayCase): void {
    this.api.addCaseAction(c.id, {
      action_type: 'Assignment Acknowledged',
      new_status: 'Under Review',
      officer_name: this.auth.user?.full_name || 'Officer',
      remarks: 'Officer acknowledged assignment and initiated formal file inspection.'
    }).subscribe({
      next: () => {
        this.action(`Case ${c.id} acknowledged. Status set to Under Review.`);
        this.refreshData();
      },
      error: e => this.action(e?.error?.detail || 'Could not acknowledge case.')
    });
  }

  quickRequestInfo(c: DisplayCase): void {
    const reason = prompt('Specify what information or documentation is requested from the institution:');
    if (!reason) return;
    this.api.addCaseAction(c.id, {
      action_type: 'Information Requested',
      new_status: 'Info Requested',
      officer_name: this.auth.user?.full_name || 'Officer',
      remarks: `Official Notice: ${reason}`
    }).subscribe({
      next: () => {
        this.action(`Information request sent to ${c.institution} for case ${c.id}.`);
        this.refreshData();
      },
      error: e => this.action(e?.error?.detail || 'Could not record information request.')
    });
  }

  quickEscalate(c: DisplayCase): void {
    if (!confirm(`Are you sure you want to escalate Case ${c.id} to AICTE Central Administration?`)) return;
    this.api.addCaseAction(c.id, {
      action_type: 'Case Escalated to Apex Oversight',
      new_status: 'Coordination',
      officer_name: this.auth.user?.full_name || 'Officer',
      remarks: 'Escalated due to complex cross-bureau implications or high regulatory sensitivity.'
    }).subscribe({
      next: () => {
        this.action(`Case ${c.id} escalated to AICTE Administration.`);
        this.refreshData();
      },
      error: e => this.action(e?.error?.detail || 'Escalation failed.')
    });
  }

  saveModalAction(): void {
    if (!this.selectedCaseId) return;
    this.api.addCaseAction(this.selectedCaseId, this.actionForm).subscribe({
      next: () => {
        this.action(`Action recorded for Case ${this.selectedCaseId}.`);
        this.api.caseTimeline(this.selectedCaseId).subscribe(x => this.timeline = x);
        this.refreshData();
      },
      error: e => this.action(e?.error?.detail || 'Could not save case action.')
    });
  }

  openTimeline(c: DisplayCase): void {
    this.selectedCaseId = c.id;
    this.selectedCase = c;
    this.activePage = 'Case Timeline';
    this.api.caseTimeline(c.id).subscribe({
      next: x => { this.timeline = x; this.cdr.detectChanges(); },
      error: () => this.timeline = []
    });
  }

  saveCaseAction(): void {
    if (!this.selectedCaseId) {
      this.action('Open a case using its Open button first.');
      return;
    }
    this.api.addCaseAction(this.selectedCaseId, this.actionForm).subscribe({
      next: () => {
        this.action('Case status/action saved to database.');
        this.api.caseTimeline(this.selectedCaseId).subscribe(x => this.timeline = x);
        this.refreshData();
      },
      error: e => this.action(e?.error?.detail || 'Could not save case action.')
    });
  }

  // ==========================================
  // INSTITUTION COMPLAINT SUBMISSION & TRACKING
  // ==========================================
  submitInstitutionComplaint(): void {
    if (!this.complaintForm.subject.trim()) {
      this.action('Please enter a complaint title/subject.');
      return;
    }
    if (!this.complaintForm.description.trim()) {
      this.action('Please describe the grievance in detail.');
      return;
    }
    if (!this.complaintForm.declaration_agreed) {
      this.action('You must agree to the institutional declaration before submitting.');
      return;
    }

    const payload = {
      institution_id: this.auth.user?.institution_id || this.auth.user?.username || 'INST-DEMO-1001',
      subject: this.complaintForm.subject.trim(),
      description: `${this.complaintForm.description.trim()}${this.complaintForm.department ? ` [Department: ${this.complaintForm.department}]` : ''}`,
      category: this.complaintForm.category,
      source: 'Institution Portal',
      assigned_bureau: this.complaintForm.assigned_bureau || 'PGRC',
      expected_disposal_date: this.complaintForm.expected_disposal_date || null
    };

    this.api.createComplaint(payload).subscribe({
      next: (res) => {
        this.action(`Complaint submitted successfully! Generated Tracking ID: ${res.id}`);
        this.complaintForm = {
          institution_id: '',
          subject: '',
          description: '',
          category: 'General',
          department: '',
          supporting_doc: '',
          declaration_agreed: false,
          assigned_bureau: 'PGRC',
          expected_disposal_date: ''
        };
        this.showComplaintForm = false;
        this.trackComplaintId = res.id;
        this.selectTrackComplaint(res.id);
        this.activePage = 'Track Complaint';
        this.refreshData();
      },
      error: (err) => {
        this.action(err?.error?.detail || 'Complaint submission failed. Please verify the required fields.');
      }
    });
  }

  selectTrackComplaint(id: string): void {
    this.trackComplaintId = id;
    this.trackedComplaint = this.complaints.find(c => c.id === id) || null;
    this.trackedCase = this.cases.find(c => c.id === id || c.category === this.trackedComplaint?.subject) || null;
  }

  getMilestoneIndex(status: string): number {
    switch (status) {
      case 'Open':
      case 'Registered':
        return 1;
      case 'Under Review':
        return 2;
      case 'Under Process':
        return 3;
      case 'Info Requested':
      case 'Coordination':
        return 4;
      case 'Disposed':
      case 'Closed':
        return 5;
      default:
        return 2;
    }
  }

  // ==========================================
  // ADMIN USER MANAGEMENT & ACCESS REQUESTS
  // ==========================================
  createUserAccount(): void {
    if (!this.newUserForm.username.trim() || !this.newUserForm.password) {
      this.action('Username and password are required.');
      return;
    }

    const payload = {
      username: this.newUserForm.username.trim(),
      email: this.newUserForm.email.trim() || `${this.newUserForm.username}@aicte-india.org`,
      full_name: this.newUserForm.full_name.trim() || this.newUserForm.username,
      password: this.newUserForm.password,
      role: this.newUserForm.role,
      assigned_bureau: this.newUserForm.assigned_bureau || null
    };

    this.api.register(payload).subscribe({
      next: () => {
        this.action(`User account ${payload.username} created successfully.`);
        this.showUserCreateModal = false;
        this.newUserForm = {
          username: '',
          email: '',
          full_name: '',
          password: '',
          role: 'officer',
          assigned_bureau: 'RB'
        };
        this.api.users().subscribe((u: UserRecord[]) => this.usersList = u);
      },
      error: (err: any) => {
        this.action(err?.error?.detail || 'User creation failed.');
      }
    });
  }

  toggleUserActiveStatus(user: UserRecord): void {
    const updatedStatus = user.active !== undefined ? !user.active : !user.is_active;
    this.api.updateUser(user.id, { active: updatedStatus, is_active: updatedStatus }).subscribe({
      next: (res: UserRecord) => {
        user.active = !!(res.active ?? res.is_active);
        user.is_active = user.active;
        this.action(`User ${user.username} is now ${user.active ? 'Active' : 'Deactivated'}.`);
      },
      error: (err: any) => {
        this.action(err?.error?.detail || 'Status update failed.');
      }
    });
  }

  reviewAccessRequest(req: AccessRequestRecord, decision: 'Approved' | 'Rejected'): void {
    this.api.reviewAccessRequest(req.id, decision).subscribe({
      next: () => {
        req.status = decision;
        this.action(`Access request for ${req.full_name} (${req.requested_role}) has been ${decision}.`);
        if (decision === 'Approved') {
          this.api.users().subscribe((u: UserRecord[]) => this.usersList = u);
        }
      },
      error: (err: any) => {
        this.action(err?.error?.detail || 'Action failed.');
      }
    });
  }

  // ==========================================
  // REGISTRATIONS & AI OVERLAP
  // ==========================================
  registerComplaint(): void {
    const p = { ...this.complaintForm, expected_disposal_date: this.complaintForm.expected_disposal_date || null };
    this.api.createComplaint(p).subscribe({
      next: r => {
        this.action(`Complaint ${r.id} registered.`);
        this.showComplaintForm = false;
        this.refreshData();
      },
      error: e => this.action(e?.error?.detail || 'Complaint registration failed. Check institution ID and API.')
    });
  }

  registerInstitution(): void {
    this.api.createInstitution(this.institutionForm).subscribe({
      next: r => {
        this.action(`Institution ${r.name} created.`);
        this.showInstitutionForm = false;
        this.refreshData();
      },
      error: e => this.action(e?.error?.detail || 'Institution creation failed.')
    });
  }

  registerOfficer(): void {
    this.api.createOfficer(this.officerForm).subscribe({
      next: r => {
        this.action(`Officer ${r.name} created.`);
        this.showOfficerForm = false;
        this.refreshData();
      },
      error: e => this.action(e?.error?.detail || 'Officer creation failed.')
    });
  }

  registerCase(): void {
    const p = {
      ...this.caseForm,
      officer_id: this.caseForm.officer_id || null,
      expected_disposal_date: this.caseForm.expected_disposal_date || null
    };
    this.api.createCase(p).subscribe({
      next: r => {
        this.action(`Case ${r.id} created.`);
        this.showCaseForm = false;
        this.refreshData();
      },
      error: e => this.action(e?.error?.detail || 'Case creation failed.')
    });
  }

  runRecommendation(): void {
    const c = this.complaints[0];
    if (!c) {
      this.action('Register a complaint before requesting a recommendation.');
      return;
    }
    this.api.recommendBureau({ subject: c.subject, description: c.description, category: c.category }).subscribe({
      next: r => this.recommendation = { ...r, complaint: c },
      error: () => this.action('Recommendation request failed.')
    });
  }

  reviewOverlap(o: any, decision: string): void {
    this.api.reviewOverlap({
      complaint_id: o.complaint_id,
      related_complaint_id: o.related_complaint_id,
      decision,
      remarks: this.overlapRemarks || null
    }).subscribe({
      next: () => {
        this.action(`Overlap decision saved: ${decision}. Source complaints remain separate.`);
        this.api.overlaps().subscribe(x => this.overlaps = x);
        this.api.issueGroups().subscribe(x => this.issueGroups = x);
        this.overlapRemarks = '';
      },
      error: e => this.action(e?.error?.detail || 'Could not save review decision.')
    });
  }

  action(message: string): void {
    this.notice = message;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.bureauFilter = 'All Bureaus';
    this.statusFilter = 'All statuses';
  }

  exportCsv(): void {
    const header = ['Case ID', 'Institution', 'Category', 'Bureau', 'Officer', 'Status', 'Expected disposal', 'Priority'];
    const rows = this.filteredCases.map(c => [c.id, c.institution, c.category, c.bureau, c.officer, c.status, c.due, c.priority]);
    const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aicte-oneview-cases.csv';
    link.click();
    URL.revokeObjectURL(url);
    this.action('CSV export prepared from records currently loaded from the backend.');
  }
}
