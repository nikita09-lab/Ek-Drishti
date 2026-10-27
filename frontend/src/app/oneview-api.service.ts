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
}
export interface InstitutionRecord {
  id: string; name: string; institution_type: string | null; address: string | null;
  state: string | null; region: string | null; status: string; created_at: string;
}
export interface OfficerRecord {
  id: string; name: string; designation: string | null; bureau: string; email: string | null; active: boolean;
}
export interface CaseRecord {
  id: string; institution_id: string; title: string; bureau: string; officer_id: string | null;
  status: string; priority: string; opened_at: string; expected_disposal_date: string | null; next_action: string | null;
}
export interface ComplaintRecord {
  id: string; institution_id: string; subject: string; description: string; category: string;
  status: string; source: string | null; assigned_bureau: string | null; assigned_officer_id: string | null;
  received_at: string; expected_disposal_date: string | null; review_status: string;
}

@Injectable({ providedIn: 'root' })
export class OneViewApiService {
  get apiBase(): string {
    return getApiBaseUrl();
  }

  constructor(private http: HttpClient) {}
  health(): Observable<{status: string}> { return this.http.get<{status: string}>(`${this.apiBase}/health`); }
  dashboardSummary(): Observable<DashboardSummary> { return this.http.get<DashboardSummary>(`${this.apiBase}/dashboard/summary`); }
  institutions(search = ''): Observable<InstitutionRecord[]> {
    let params = new HttpParams(); if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<InstitutionRecord[]>(`${this.apiBase}/institutions`, { params });
  }
  officers(): Observable<OfficerRecord[]> { return this.http.get<OfficerRecord[]>(`${this.apiBase}/officers`); }
  cases(search = '', bureau = '', status = ''): Observable<CaseRecord[]> {
    let params = new HttpParams();
    if (search.trim()) params = params.set('search', search.trim());
    if (bureau && bureau !== 'All Bureaus') params = params.set('bureau', bureau);
    if (status && status !== 'All statuses') params = params.set('status', status);
    return this.http.get<CaseRecord[]>(`${this.apiBase}/cases`, { params });
  }
  complaints(search = ''): Observable<ComplaintRecord[]> {
    let params = new HttpParams(); if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ComplaintRecord[]>(`${this.apiBase}/complaints`, { params });
  }
  createComplaint(value: unknown): Observable<ComplaintRecord> { return this.http.post<ComplaintRecord>(`${this.apiBase}/complaints`, value); }
  createInstitution(value: unknown): Observable<InstitutionRecord> { return this.http.post<InstitutionRecord>(`${this.apiBase}/institutions`, value); }
  createOfficer(value: unknown): Observable<OfficerRecord> { return this.http.post<OfficerRecord>(`${this.apiBase}/officers`, value); }
  createCase(value: unknown): Observable<CaseRecord> { return this.http.post<CaseRecord>(`${this.apiBase}/cases`, value); }
  caseTimeline(id: string): Observable<any[]> { return this.http.get<any[]>(`${this.apiBase}/cases/${encodeURIComponent(id)}/timeline`); }
  addCaseAction(id: string, value: unknown): Observable<any> { return this.http.post(`${this.apiBase}/cases/${encodeURIComponent(id)}/actions`, value); }
  overlaps(): Observable<any[]> { return this.http.get<any[]>(`${this.apiBase}/overlaps`); }
  reviewOverlap(value: unknown): Observable<any> { return this.http.post(`${this.apiBase}/overlaps/review`, value); }
  issueGroups(): Observable<any[]> { return this.http.get<any[]>(`${this.apiBase}/issue-groups`); }
  recommendBureau(value: unknown): Observable<any> { return this.http.post(`${this.apiBase}/recommendations/bureau`, value); }
  notifications(): Observable<any[]> { return this.http.get<any[]>(`${this.apiBase}/notifications`); }
  reportSummary(): Observable<any> { return this.http.get(`${this.apiBase}/reports/summary`); }
}
