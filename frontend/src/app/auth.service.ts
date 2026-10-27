import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { getApiBaseUrl } from './oneview-api.service';
export interface AuthUser { id: string; username: string; full_name?: string; role: string; }
export interface LoginResponse { access_token: string; token_type: string; expires_in: number; portal?: string; portal_title?: string; user: AuthUser; }
const TOKEN_KEY = 'aicte_oneview_access_token';
const USER_KEY = 'aicte_oneview_user';
const PORTAL_KEY = 'aicte_oneview_portal';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser: AuthUser | null = null;
  private currentToken: string | null = null;
  private currentPortal: string | null = null;

  constructor(private http: HttpClient) {
    if (typeof sessionStorage !== 'undefined') {
      this.currentToken = sessionStorage.getItem(TOKEN_KEY);
      this.currentPortal = sessionStorage.getItem(PORTAL_KEY);
      const raw = sessionStorage.getItem(USER_KEY);
      if (raw) {
        try { this.currentUser = JSON.parse(raw) as AuthUser; } catch { this.currentUser = null; }
      }
    }
  }

  get token(): string | null { return this.currentToken; }
  get user(): AuthUser | null { return this.currentUser; }
  get portal(): string | null { return this.currentPortal; }
  get isAuthenticated(): boolean { return !!this.currentToken && !!this.currentUser; }

  login(username: string, password: string, portal?: string): Observable<LoginResponse> {
    const payload: { username: string; password: string; portal?: string } = { username, password };
    if (portal) payload.portal = portal;
    return this.http.post<LoginResponse>(`${getApiBaseUrl()}/auth/login`, payload).pipe(
      tap(r => {
        this.currentToken = r.access_token;
        this.currentUser = r.user;
        this.currentPortal = r.portal || portal || null;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(TOKEN_KEY, r.access_token);
          sessionStorage.setItem(USER_KEY, JSON.stringify(r.user));
          if (this.currentPortal) sessionStorage.setItem(PORTAL_KEY, this.currentPortal);
        }
      })
    );
  }

  logout(): void {
    this.currentToken = null;
    this.currentUser = null;
    this.currentPortal = null;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(PORTAL_KEY);
    }
  }
}

