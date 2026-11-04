import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from '../core/api';
import { KIND_LABEL } from '../core/models';

@Component({
  selector: 'v-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  host: { '[style.--accent]': 'api.business()?.color' },
  template: `
    <aside class="side">
      <a routerLink="/" class="brand"><span class="mark">V</span>Vellum</a>
      <div class="biz">
        <strong>{{ api.business()?.name }}</strong>
        <span class="muted">{{ kind() }}</span>
      </div>
      <nav>
        @for (item of nav; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="on"><span class="ico" aria-hidden="true">{{ item.icon }}</span>{{ item.label }}</a>
        }
      </nav>
      <div class="foot">
        <a class="btn ghost sm block" [href]="bookingUrl()" target="_blank" rel="noopener">Ver mi página de reservas ↗</a>
        <button class="link" (click)="logout()">Cerrar sesión</button>
      </div>
    </aside>

    <div class="main">
      @if (api.business()?.is_demo) {
        <div class="demo-bar">
          <span>Estás en una <b>demo</b>: cambia lo que quieras, se reinicia sola cada día.</span>
          <a routerLink="/crear-cuenta" class="link">Crear mi agenda real</a>
        </div>
      }
      <router-outlet />
    </div>

    <nav class="bottom">
      @for (item of mobileNav; track item.path) {
        <a [routerLink]="item.path" routerLinkActive="on"><span aria-hidden="true">{{ item.icon }}</span>{{ item.short }}</a>
      }
    </nav>

    @if (api.waking()) {
      <div class="toast">Despertando el servidor… unos segundos</div>
    }
  `,
  styles: `
    :host { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }
    .side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 22px; padding: 22px 16px; border-right: 1px solid var(--line); background: var(--card); }
    .brand { display: flex; align-items: center; gap: 10px; font-family: var(--serif); font-size: 22px; font-weight: 700; text-decoration: none; padding: 0 8px; }
    .mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: var(--ink); color: var(--paper); font-size: 17px; }
    .biz { display: grid; padding: 14px; border-radius: 14px; background: var(--paper); border-left: 4px solid var(--accent); }
    .biz strong { font-size: 15px; }
    .biz span { font-size: 12px; font-weight: 700; }
    nav { display: grid; gap: 2px; }
    nav a { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; text-decoration: none; font-weight: 700; color: var(--ink-2); font-size: 14px; }
    nav a:hover { background: var(--paper); }
    nav a.on { background: var(--accent-soft); color: var(--accent); }
    .ico { width: 20px; text-align: center; }
    .foot { margin-top: auto; display: grid; gap: 12px; justify-items: center; }
    .main { min-width: 0; padding-bottom: 40px; }
    .demo-bar { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; padding: 9px 16px; background: var(--amber-soft); color: #6b4a12; font-size: 13px; text-align: center; }
    .bottom { display: none; }
    @media (max-width: 900px) {
      :host { grid-template-columns: 1fr; }
      .side { display: none; }
      .main { padding-bottom: 84px; }
      .bottom { display: grid; grid-template-columns: repeat(5, 1fr); position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: var(--card); border-top: 1px solid var(--line); padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); }
      .bottom a { display: grid; justify-items: center; gap: 2px; padding: 6px 2px; font-size: 11px; font-weight: 800; text-decoration: none; color: var(--muted); border-radius: 10px; }
      .bottom a span { font-size: 18px; }
      .bottom a.on { color: var(--accent); background: var(--accent-soft); }
    }
  `,
})
export class Shell {
  protected api = inject(Api);
  private router = inject(Router);

  protected nav = [
    { path: 'agenda', label: 'Agenda', short: 'Agenda', icon: '◷' },
    { path: 'recordatorios', label: 'Recordatorios', short: 'Avisos', icon: '✉' },
    { path: 'clientes', label: 'Clientes', short: 'Clientes', icon: '☺' },
    { path: 'servicios', label: 'Servicios', short: 'Servicios', icon: '✂' },
    { path: 'equipo', label: 'Equipo y horarios', short: 'Equipo', icon: '♟' },
    { path: 'reportes', label: 'Reportes', short: 'Reportes', icon: '▤' },
    { path: 'ajustes', label: 'Ajustes', short: 'Ajustes', icon: '⚙' },
  ];
  protected mobileNav = this.nav.filter((n) => ['agenda', 'recordatorios', 'clientes', 'reportes', 'ajustes'].includes(n.path));

  protected kind = computed(() => {
    const b = this.api.business();
    return b ? KIND_LABEL[b.kind] + (b.city ? ' · ' + b.city : '') : '';
  });

  protected bookingUrl = computed(() => `${location.origin}/reservar/${this.api.business()?.slug}`);

  async logout() {
    await this.api.logout();
    await this.router.navigateByUrl('/');
  }
}
