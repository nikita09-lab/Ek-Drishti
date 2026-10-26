import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './oneview-api.service';
export interface AuthUser { id:string; username:string; full_name?:string; role:string; }
interface LoginResponse { access_token:string; token_type:string; expires_in:number; user:AuthUser; }
const TOKEN_KEY='aicte_oneview_access_token';
const USER_KEY='aicte_oneview_user';
@Injectable({providedIn:'root'})
export class AuthService {
  constructor(private http:HttpClient){}
  get token():string|null { return typeof sessionStorage==='undefined'?null:sessionStorage.getItem(TOKEN_KEY); }
  get user():AuthUser|null { if(typeof sessionStorage==='undefined')return null; const raw=sessionStorage.getItem(USER_KEY); if(!raw)return null; try{return JSON.parse(raw) as AuthUser;}catch{return null;} }
  get isAuthenticated():boolean{return !!this.token && !!this.user;}
  login(username:string,password:string):Observable<LoginResponse>{return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`,{username,password}).pipe(tap(r=>{sessionStorage.setItem(TOKEN_KEY,r.access_token);sessionStorage.setItem(USER_KEY,JSON.stringify(r.user));}));}
  logout():void{if(typeof sessionStorage!=='undefined'){sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(USER_KEY);}}
}
