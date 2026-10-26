import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export const API_BASE_URL = 'http://127.0.0.1:8000/api';

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
  constructor(private http: HttpClient) {}
  health(): Observable<{status: string}> { return this.http.get<{status: string}>(`${API_BASE_URL}/health`); }
  dashboardSummary(): Observable<DashboardSummary> { return this.http.get<DashboardSummary>(`${API_BASE_URL}/dashboard/summary`); }
  institutions(search = ''): Observable<InstitutionRecord[]> {
    let params = new HttpParams(); if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<InstitutionRecord[]>(`${API_BASE_URL}/institutions`, { params });
  }
  officers(): Observable<OfficerRecord[]> { return this.http.get<OfficerRecord[]>(`${API_BASE_URL}/officers`); }
  cases(search = '', bureau = '', status = ''): Observable<CaseRecord[]> {
    let params = new HttpParams();
    if (search.trim()) params = params.set('search', search.trim());
    if (bureau && bureau !== 'All Bureaus') params = params.set('bureau', bureau);
    if (status && status !== 'All statuses') params = params.set('status', status);
    return this.http.get<CaseRecord[]>(`${API_BASE_URL}/cases`, { params });
  }
  complaints(search = ''): Observable<ComplaintRecord[]> {
    let params = new HttpParams(); if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ComplaintRecord[]>(`${API_BASE_URL}/complaints`, { params });
  }
  createComplaint(value: unknown): Observable<ComplaintRecord> { return this.http.post<ComplaintRecord>(`${API_BASE_URL}/complaints`, value); }
  createInstitution(value: unknown): Observable<InstitutionRecord> { return this.http.post<InstitutionRecord>(`${API_BASE_URL}/institutions`, value); }
  createOfficer(value: unknown): Observable<OfficerRecord> { return this.http.post<OfficerRecord>(`${API_BASE_URL}/officers`, value); }
  createCase(value: unknown): Observable<CaseRecord> { return this.http.post<CaseRecord>(`${API_BASE_URL}/cases`, value); }
  caseTimeline(id: string): Observable<any[]> { return this.http.get<any[]>(`${API_BASE_URL}/cases/${encodeURIComponent(id)}/timeline`); }
  addCaseAction(id: string, value: unknown): Observable<any> { return this.http.post(`${API_BASE_URL}/cases/${encodeURIComponent(id)}/actions`, value); }
  overlaps(): Observable<any[]> { return this.http.get<any[]>(`${API_BASE_URL}/overlaps`); }
  reviewOverlap(value: unknown): Observable<any> { return this.http.post(`${API_BASE_URL}/overlaps/review`, value); }
  issueGroups(): Observable<any[]> { return this.http.get<any[]>(`${API_BASE_URL}/issue-groups`); }
  recommendBureau(value: unknown): Observable<any> { return this.http.post(`${API_BASE_URL}/recommendations/bureau`, value); }
  notifications(): Observable<any[]> { return this.http.get<any[]>(`${API_BASE_URL}/notifications`); }
  reportSummary(): Observable<any> { return this.http.get(`${API_BASE_URL}/reports/summary`); }

}
