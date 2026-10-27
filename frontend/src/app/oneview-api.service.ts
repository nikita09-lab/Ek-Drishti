import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `http://${window.location.hostname}:8000/api`;
  }
  return 'http://127.0.0.1:8000/api';
}

export const API_BASE_URL = getApiBaseUrl();

export interface DashboardSummary {
  total_complaints: number;
  total_cases: number;
  pending_cases: number;
  disposed_cases: number;
  overdue_cases: number;
  institutions: number;
  officers: number;
  under_process?: number;
  pending_complaints?: number;
  disposed_complaints?: number;
  registered_institutions?: number;
  active_officers?: number;
  cases_awaiting_coordination?: number;
}

export interface OfficerDashboardSummary {
  my_assigned_cases: number;
  awaiting_action: number;
  awaiting_my_action?: number;
  under_review: number;
  overdue_cases: number;
  due_soon: number;
  resolved_cases: number;
  bureau?: string;
  officer_name?: string;
}

export interface InstitutionDashboardSummary {
  institution_id: string;
  institution_name: string;
  total_complaints: number;
  under_review: number;
  awaiting_info: number;
  awaiting_information?: number;
  resolved: number;
  active_cases: number;
}

export interface AdminSystemSummary {
  total_users: number;
  active_users: number;
  registered_institutions: number;
  registered_officers: number;
  pending_access_requests: number;
  recent_security_events: number;
  application_health: string;
  database_status: string;
  database_connection?: string;
}

export interface MonthlyTrendItem {
  month: string;
  year: number;
  received: number;
  disposed: number;
}

export interface CategoryTrendItem {
  category: string;
  count: number;
}

export interface CaseAgeItem {
  range: string;
  bucket?: string;
  count: number;
}

export interface UserRecord {
  id: string;
  username: string;
  full_name: string;
  role: string;
  email?: string;
  assigned_bureau?: string | null;
  active: boolean;
  is_active?: boolean;
  created_at: string;
}

export interface AccessRequestRecord {
  id: string;
  full_name: string;
  email: string;
  requested_role: string;
  organization: string;
  justification: string;
  status: string;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  actor_user_id: string | null;
  actor_username: string;
  action: string;
  resource: string;
  status_code: number;
  ip_address: string | null;
  created_at: string;
}

export interface InstitutionRecord {
  id: string;
  name: string;
  institution_type: string | null;
  address: string | null;
  state: string | null;
  region: string | null;
  status: string;
  created_at: string;
}

export interface InstitutionProfile extends InstitutionRecord {}

export interface SystemHealth {
  status: string;
  database: string;
  database_status?: string;
  api_latency_ms?: number;
}

export interface OverlapSignal {
  complaint_id: string;
  related_complaint_id: string;
  similarity: number;
  same_institution: boolean;
  subject?: string;
  related_subject?: string;
  review_status: string;
  issue_group_id?: string | null;
  review_remarks?: string | null;
}

export interface IssueGroup {
  id: string;
  classification: string;
  primary_complaint_id: string;
  complaints: { id: string; institution_id: string }[];
}

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export interface ReportSummary {
  cases_by_bureau: { bureau: string; count: number }[];
  cases_by_status: { status: string; count: number }[];
  institutions_by_region: { region: string; count: number }[];
}

export interface OfficerRecord {
  id: string;
  name: string;
  designation: string | null;
  bureau: string;
  email: string | null;
  active: boolean;
}

export interface CaseRecord {
  id: string;
  institution_id: string;
  title: string;
  bureau: string;
  officer_id: string | null;
  status: string;
  priority: string;
  opened_at: string;
  expected_disposal_date: string | null;
  next_action: string | null;
}

export interface ComplaintRecord {
  id: string;
  institution_id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  source: string | null;
  assigned_bureau: string | null;
  assigned_officer_id: string | null;
  received_at: string;
  expected_disposal_date: string | null;
  review_status: string;
}

@Injectable({ providedIn: 'root' })
export class OneViewApiService {
  get apiBase(): string {
    return getApiBaseUrl();
  }

  constructor(private http: HttpClient) {}

  health(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.apiBase}/health`);
  }

  // Dashboard Summaries for 4 Distinct Roles
  dashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.apiBase}/dashboard/summary`);
  }

  officerDashboardSummary(): Observable<OfficerDashboardSummary> {
    return this.http.get<OfficerDashboardSummary>(`${this.apiBase}/officer/dashboard-summary`);
  }

  institutionDashboardSummary(): Observable<InstitutionDashboardSummary> {
    return this.http.get<InstitutionDashboardSummary>(`${this.apiBase}/institution/dashboard-summary`);
  }

  adminSystemSummary(): Observable<AdminSystemSummary> {
    return this.http.get<AdminSystemSummary>(`${this.apiBase}/admin/system-summary`);
  }

  // Analytics & Real Reports
  monthlyTrends(): Observable<MonthlyTrendItem[]> {
    return this.http.get<MonthlyTrendItem[]>(`${this.apiBase}/reports/monthly-trends`);
  }

  categoryTrends(): Observable<CategoryTrendItem[]> {
    return this.http.get<CategoryTrendItem[]>(`${this.apiBase}/reports/category-trends`);
  }

  caseAgeDistribution(): Observable<CaseAgeItem[]> {
    return this.http.get<CaseAgeItem[]>(`${this.apiBase}/reports/case-age`);
  }

  reportSummary(): Observable<ReportSummary> {
    return this.http.get<ReportSummary>(`${this.apiBase}/reports/summary`);
  }

  // User Management & System Administration
  getUsers(search = '', role = ''): Observable<UserRecord[]> {
    let params = new HttpParams();
    if (search.trim()) params = params.set('search', search.trim());
    if (role.trim()) params = params.set('role', role.trim());
    return this.http.get<UserRecord[]>(`${this.apiBase}/auth/users`, { params });
  }

  users(search = '', role = ''): Observable<UserRecord[]> {
    return this.getUsers(search, role);
  }

  register(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiBase}/auth/register`, data);
  }

  updateUser(userId: string, data: any): Observable<UserRecord> {
    return this.http.patch<UserRecord>(`${this.apiBase}/auth/users/${encodeURIComponent(userId)}`, data);
  }

  getAccessRequests(status = ''): Observable<AccessRequestRecord[]> {
    let params = new HttpParams();
    if (status.trim()) params = params.set('status', status.trim());
    return this.http.get<AccessRequestRecord[]>(`${this.apiBase}/admin/access-requests`, { params });
  }

  accessRequests(status = ''): Observable<AccessRequestRecord[]> {
    return this.getAccessRequests(status);
  }

  reviewAccessRequest(requestId: string, statusOrData: string | { status: string }): Observable<AccessRequestRecord> {
    const payload = typeof statusOrData === 'string' ? { status: statusOrData } : statusOrData;
    return this.http.patch<AccessRequestRecord>(`${this.apiBase}/admin/access-requests/${encodeURIComponent(requestId)}`, payload);
  }

  getAuditLogs(limit = 100): Observable<AuditLogRecord[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<AuditLogRecord[]>(`${this.apiBase}/admin/audit-logs`, { params });
  }

  getSystemHealth(): Observable<SystemHealth> {
    return this.http.get<SystemHealth>(`${this.apiBase}/admin/system-health`);
  }

  systemHealth(): Observable<SystemHealth> {
    return this.getSystemHealth();
  }

  // Institutions
  institutions(search = ''): Observable<InstitutionRecord[]> {
    let params = new HttpParams();
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<InstitutionRecord[]>(`${this.apiBase}/institutions`, { params });
  }

  getInstitutionProfile(): Observable<InstitutionRecord> {
    return this.http.get<InstitutionRecord>(`${this.apiBase}/institution/profile`);
  }

  institutionProfile(): Observable<InstitutionRecord> {
    return this.getInstitutionProfile();
  }

  createInstitution(value: unknown): Observable<InstitutionRecord> {
    return this.http.post<InstitutionRecord>(`${this.apiBase}/institutions`, value);
  }

  // Officers
  officers(): Observable<OfficerRecord[]> {
    return this.http.get<OfficerRecord[]>(`${this.apiBase}/officers`);
  }

  createOfficer(value: unknown): Observable<OfficerRecord> {
    return this.http.post<OfficerRecord>(`${this.apiBase}/officers`, value);
  }

  // Cases
  cases(search = '', bureau = '', status = '', assignedToMe = false): Observable<CaseRecord[]> {
    let params = new HttpParams();
    if (search.trim()) params = params.set('search', search.trim());
    if (bureau && bureau !== 'All Bureaus') params = params.set('bureau', bureau);
    if (status && status !== 'All statuses') params = params.set('status', status);
    if (assignedToMe) params = params.set('assigned_to_me', 'true');
    return this.http.get<CaseRecord[]>(`${this.apiBase}/cases`, { params });
  }

  createCase(value: unknown): Observable<CaseRecord> {
    return this.http.post<CaseRecord>(`${this.apiBase}/cases`, value);
  }

  caseTimeline(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBase}/cases/${encodeURIComponent(id)}/timeline`);
  }

  addCaseAction(id: string, value: unknown): Observable<any> {
    return this.http.post(`${this.apiBase}/cases/${encodeURIComponent(id)}/actions`, value);
  }

  // Complaints
  complaints(search = '', status = ''): Observable<ComplaintRecord[]> {
    let params = new HttpParams();
    if (search.trim()) params = params.set('search', search.trim());
    if (status.trim() && status !== 'All statuses') params = params.set('status', status.trim());
    return this.http.get<ComplaintRecord[]>(`${this.apiBase}/complaints`, { params });
  }

  createComplaint(value: unknown): Observable<ComplaintRecord> {
    return this.http.post<ComplaintRecord>(`${this.apiBase}/complaints`, value);
  }

  // Overlap Intelligence & Recommendations
  overlaps(): Observable<OverlapSignal[]> {
    return this.http.get<OverlapSignal[]>(`${this.apiBase}/overlaps`);
  }

  reviewOverlap(value: unknown): Observable<any> {
    return this.http.post(`${this.apiBase}/overlaps/review`, value);
  }

  issueGroups(): Observable<IssueGroup[]> {
    return this.http.get<IssueGroup[]>(`${this.apiBase}/issue-groups`);
  }

  recommendBureau(value: unknown): Observable<any> {
    return this.http.post(`${this.apiBase}/recommendations/bureau`, value);
  }

  notifications(): Observable<NotificationRecord[]> {
    return this.http.get<NotificationRecord[]>(`${this.apiBase}/notifications`);
  }
}
