import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, ApiError } from '../core/api';
import { Kind, Session } from '../core/models';

const STYLES = `
  :host { display: grid; min-height: 100vh; grid-template-columns: 1fr 1fr; }
  .side { background: var(--ink); color: var(--paper); padding: 48px; display: grid; align-content: space-between; }
  .side h2 { font-size: clamp(32px, 4vw, 48px); max-width: 12ch; }
  .side p { color: rgba(247,242,234,.75); max-width: 36ch; margin-top: 14px; }
  .brand { font-family: var(--serif); font-size: 24px; font-weight: 700; text-decoration: none; }
  .main { display: grid; place-items: center; padding: 32px 16px; }
  form { width: min(420px, 100%); display: grid; gap: 14px; }
  h1 { font-size: 36px; margin-bottom: 4px; }
  .kinds { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .kind { padding: 12px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--card); font-weight: 700; cursor: pointer; }
  .kind.sel { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); color: var(--accent); }
  .alt { text-align: center; font-size: 14px; color: var(--muted); }
  .demo { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  @media (max-width: 820px) { :host { grid-template-columns: 1fr; } .side { display: none; } }
`;

@Component({
  selector: 'v-login',
  imports: [FormsModule, RouterLink],
  template: `
    <aside class="side">
      <a routerLink="/" class="brand">Vellum</a>
      <div>
        <h2>Tu agenda te espera.</h2>
        <p>Entra para ver las citas de hoy, enviar recordatorios y revisar cómo va el mes.</p>
      </div>
      <small>Agenda para barberías, estéticas y consultorios</small>
    </aside>
    <div class="main">
      <form (ngSubmit)="submit()">
        <h1>Entrar</h1>
        <p class="muted">Usa el correo con el que creaste tu agenda.</p>
        <label class="field"><span>Correo</span><input name="email" type="email" [(ngModel)]="email" autocomplete="email" required /></label>
        <label class="field"><span>Contraseña</span><input name="password" type="password" [(ngModel)]="password" autocomplete="current-password" required /></label>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button class="btn accent lg block" [disabled]="busy()">{{ busy() ? 'Entrando…' : 'Entrar' }}</button>
        <p class="alt">¿Nuevo en Vellum? <a routerLink="/crear-cuenta" class="link">Crea tu agenda</a></p>
        <p class="alt">O prueba una demo:</p>
        <div class="demo">
          <button type="button" class="btn ghost sm" (click)="demo('barberia')">Barbería</button>
          <button type="button" class="btn ghost sm" (click)="demo('estetica')">Estética</button>
          <button type="button" class="btn ghost sm" (click)="demo('odontologia')">Odontología</button>
        </div>
        @if (api.waking()) {
          <p class="alt">Despertando el servidor… la primera vez tarda unos segundos.</p>
        }
      </form>
    </div>
  `,
  styles: STYLES,
})
export class Login {
  protected api = inject(Api);
  private router = inject(Router);
  protected email = '';
  protected password = '';
  protected busy = signal(false);
  protected error = signal<string | null>(null);

  async submit() {
    this.error.set(null);
    this.busy.set(true);
    try {
      this.api.start(await this.api.post<Session>('/auth/login', { email: this.email, password: this.password }));
      await this.router.navigateByUrl('/panel/agenda');
    } catch (e) {
      this.error.set((e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }

  async demo(kind: Kind) {
    this.busy.set(true);
    try {
      this.api.start(await this.api.post<Session>('/auth/demo', { kind }));
      await this.router.navigateByUrl('/panel/agenda');
    } catch (e) {
      this.error.set((e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'v-register',
  imports: [FormsModule, RouterLink],
  template: `
    <aside class="side">
      <a routerLink="/" class="brand">Vellum</a>
      <div>
        <h2>Cinco minutos y abres tu agenda.</h2>
        <p>Te proponemos servicios, precios y horarios según tu rubro. Después los ajustas a tu medida.</p>
      </div>
      <small>Sin tarjeta · Sin instalar nada</small>
    </aside>
    <div class="main">
      <form (ngSubmit)="submit()">
        <h1>Crea tu agenda</h1>
        <label class="field"><span>Nombre del negocio</span><input name="business" [(ngModel)]="f.business" required /></label>
        <div class="field">
          <span>¿Qué tipo de negocio es?</span>
          <div class="kinds">
            @for (k of kinds; track k.value) {
              <button type="button" class="kind" [class.sel]="f.kind === k.value" (click)="f.kind = k.value">{{ k.label }}</button>
            }
          </div>
        </div>
        <div class="grid-2">
          <label class="field"><span>Tu nombre</span><input name="name" [(ngModel)]="f.name" autocomplete="name" required /></label>
          <label class="field"><span>WhatsApp del negocio</span><input name="phone" [(ngModel)]="f.phone" inputmode="tel" /></label>
        </div>
        <label class="field"><span>Correo</span><input name="email" type="email" [(ngModel)]="f.email" autocomplete="email" required /></label>
        <label class="field"><span>Contraseña</span><input name="password" type="password" [(ngModel)]="f.password" autocomplete="new-password" minlength="6" required /><small>Mínimo 6 caracteres.</small></label>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button class="btn accent lg block" [disabled]="busy()">{{ busy() ? 'Creando…' : 'Crear mi agenda' }}</button>
        <p class="alt">¿Ya tienes cuenta? <a routerLink="/entrar" class="link">Entra</a></p>
      </form>
    </div>
  `,
  styles: STYLES,
})
export class Register {
  private api = inject(Api);
  private router = inject(Router);
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected f = { business: '', kind: 'barberia' as Kind, name: '', phone: '', email: '', password: '' };
  protected kinds: { value: Kind; label: string }[] = [
    { value: 'barberia', label: 'Barbería' },
    { value: 'estetica', label: 'Estética' },
    { value: 'odontologia', label: 'Odontología' },
    { value: 'otro', label: 'Otro' },
  ];

  async submit() {
    this.error.set(null);
    this.busy.set(true);
    try {
      this.api.start(await this.api.post<Session>('/auth/register', this.f));
      await this.router.navigateByUrl('/panel/agenda');
    } catch (e) {
      this.error.set((e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }
}
