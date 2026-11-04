import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Appointment, Business, Session } from './models';

/** En el PC se usa la API local; publicado, la de Render. */
export const API_URL =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8010/api'
    : 'https://vellum-api.onrender.com/api';

const TOKEN_KEY = 'vellum.token';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  readonly token = signal<string | null>(readToken());
  readonly business = signal<Business | null>(null);
  readonly userName = signal<string>('');
  readonly loggedIn = computed(() => !!this.token());
  /** El servidor gratis de Render se duerme: avisar si tarda en despertar. */
  readonly waking = signal(false);

  private headers(): Record<string, string> {
    const t = this.token();
    return t ? { Authorization: `Bearer ${t}`, Accept: 'application/json' } : { Accept: 'application/json' };
  }

  private async run<T>(req: () => Promise<T>): Promise<T> {
    const timer = setTimeout(() => this.waking.set(true), 2500);
    try {
      return await req();
    } catch (e) {
      throw new ApiError(e);
    } finally {
      clearTimeout(timer);
      this.waking.set(false);
    }
  }

  get<T>(path: string, params: Record<string, string | number | null | undefined> = {}): Promise<T> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    return this.run(() => firstValueFrom(this.http.get<T>(API_URL + path, { headers: this.headers(), params: p })));
  }

  post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.run(() => firstValueFrom(this.http.post<T>(API_URL + path, body, { headers: this.headers() })));
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.run(() => firstValueFrom(this.http.put<T>(API_URL + path, body, { headers: this.headers() })));
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.run(() => firstValueFrom(this.http.patch<T>(API_URL + path, body, { headers: this.headers() })));
  }

  delete<T>(path: string): Promise<T> {
    return this.run(() => firstValueFrom(this.http.delete<T>(API_URL + path, { headers: this.headers() })));
  }

  // --- Sesión ---------------------------------------------------------

  start(s: Session) {
    try {
      localStorage.setItem(TOKEN_KEY, s.token);
    } catch {}
    this.token.set(s.token);
    this.business.set(s.business);
    this.userName.set(s.user.name);
  }

  async restore(): Promise<boolean> {
    if (!this.token()) return false;
    if (this.business()) return true;
    try {
      const me = await this.get<{ user: { name: string }; business: Business }>('/me');
      this.business.set(me.business);
      this.userName.set(me.user.name);
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  async logout() {
    try {
      await this.post('/auth/logout');
    } catch {}
    this.clear();
  }

  private clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    this.token.set(null);
    this.business.set(null);
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Error con un mensaje listo para mostrar. */
export class ApiError extends Error {
  status = 0;
  canForce = false;
  constructor(e: unknown) {
    super('No se pudo conectar. Revisa tu internet e intenta de nuevo.');
    if (e instanceof HttpErrorResponse) {
      this.status = e.status;
      const body = e.error ?? {};
      this.canForce = !!body.can_force;
      const first = body.errors ? (Object.values(body.errors)[0] as string[])?.[0] : null;
      if (first) this.message = first;
      else if (body.message && e.status !== 500) this.message = body.message;
      else if (e.status === 401) this.message = 'Tu sesión terminó. Vuelve a entrar.';
      else if (e.status === 404) this.message = 'No encontramos lo que buscas.';
      else if (e.status >= 500) this.message = 'El servidor tuvo un problema. Intenta en un momento.';
    }
  }
}

export type { Appointment };
