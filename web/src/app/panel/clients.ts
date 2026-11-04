import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError } from '../core/api';
import { cop, hour, initials, phone, shortDate } from '../core/format';
import { Appointment, STATUS_LABEL } from '../core/models';
import { Toast } from '../core/toast';

interface ClientRow {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  visits: number;
  no_shows: number;
  last_visit: string | null;
  whatsapp: string;
}

interface ClientDetail extends Omit<ClientRow, 'visits' | 'no_shows' | 'last_visit' | 'whatsapp'> {
  appointments: Appointment[];
}

@Component({
  selector: 'v-clients',
  imports: [FormsModule],
  template: `
    <div class="bar">
      <div>
        <span class="eyebrow">Clientes</span>
        <h1>Tu gente</h1>
      </div>
      <input class="input search" placeholder="Buscar por nombre o teléfono…" [(ngModel)]="q" (input)="search()" />
    </div>

    <div class="layout">
      <div class="list card">
        @for (c of rows(); track c.id) {
          <button class="row" [class.sel]="detail()?.id === c.id" (click)="open(c.id)">
            <span class="avatar" [style.background]="color(c.name)">{{ initials(c.name) }}</span>
            <div class="info">
              <strong>{{ c.name }}</strong>
              <span class="muted">{{ phone(c.phone) }}</span>
            </div>
            <div class="stats">
              <b>{{ c.visits }}</b><span class="muted">visitas</span>
              @if (c.no_shows) {
                <span class="chip no_asistio">{{ c.no_shows }} sin venir</span>
              }
            </div>
          </button>
        } @empty {
          <p class="empty">{{ loading() ? 'Cargando…' : 'No hay clientes con esa búsqueda.' }}</p>
        }
      </div>

      @if (detail(); as d) {
        <aside class="detail card">
          <header>
            <span class="avatar big" [style.background]="color(d.name)">{{ initials(d.name) }}</span>
            <div>
              <h2>{{ d.name }}</h2>
              <span class="muted">{{ phone(d.phone) }}{{ d.email ? ' · ' + d.email : '' }}</span>
            </div>
          </header>
          <div class="quick">
            <a class="btn accent sm" [href]="waLink(d)" target="_blank" rel="noopener">Escribir por WhatsApp</a>
          </div>
          <label class="field">
            <span>Notas del cliente</span>
            <textarea [(ngModel)]="notes" rows="3" placeholder="Preferencias, alergias, cómo le gusta…"></textarea>
          </label>
          <button class="btn ghost sm" (click)="saveNotes(d.id)">Guardar notas</button>

          <h3>Historial</h3>
          <div class="history">
            @for (a of d.appointments; track a.id) {
              <div class="h">
                <div>
                  <b>{{ a.service.name }}</b>
                  <span class="muted">{{ shortDate(a.starts_at) }} · {{ hour(a.starts_at) }} · {{ a.professional.name }}</span>
                </div>
                <div class="right">
                  <span class="chip" [class]="a.status">{{ statusLabel[a.status] }}</span>
                  <span class="muted">{{ cop(a.price) }}</span>
                </div>
              </div>
            } @empty {
              <p class="muted">Sin citas todavía.</p>
            }
          </div>
        </aside>
      }
    </div>
  `,
  styles: `
    :host { display: block; padding: 22px clamp(14px, 3vw, 32px); }
    .bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 14px; margin-bottom: 16px; }
    h1 { font-size: clamp(26px, 3.4vw, 36px); margin-top: 4px; }
    .search { max-width: 340px; border-radius: 999px; }
    .layout { display: grid; grid-template-columns: 1fr 400px; gap: 16px; align-items: start; }
    .list { overflow: hidden; }
    .row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border: 0; border-bottom: 1px solid var(--line); background: none; text-align: left; cursor: pointer; }
    .row:hover, .row.sel { background: var(--paper); }
    .info { flex: 1; display: grid; min-width: 0; }
    .info strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stats { display: flex; align-items: baseline; gap: 6px; font-size: 13px; }
    .stats b { font-family: var(--serif); font-size: 18px; }
    .detail { position: sticky; top: 16px; padding: 22px; display: grid; gap: 14px; }
    .detail header { display: flex; gap: 14px; align-items: center; }
    .avatar.big { width: 56px; height: 56px; font-size: 18px; }
    h2 { font-size: 24px; }
    h3 { font-size: 20px; margin-top: 8px; }
    .history { display: grid; gap: 8px; max-height: 360px; overflow: auto; }
    .h { display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--paper); font-size: 13px; }
    .h > div:first-child { display: grid; }
    .right { display: grid; justify-items: end; gap: 4px; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } .detail { position: static; } }
  `,
})
export class Clients implements OnInit {
  private api = inject(Api);
  private toast = inject(Toast);
  protected readonly cop = cop;
  protected readonly hour = hour;
  protected readonly shortDate = shortDate;
  protected readonly initials = initials;
  protected readonly phone = phone;
  protected readonly statusLabel = STATUS_LABEL;
  protected q = '';
  protected rows = signal<ClientRow[]>([]);
  protected detail = signal<ClientDetail | null>(null);
  protected loading = signal(true);
  protected notes = '';
  private debounce: ReturnType<typeof setTimeout> | undefined;

  ngOnInit() {
    this.load();
  }

  async load() {
    try {
      this.rows.set(await this.api.get<ClientRow[]>('/clients', { q: this.q }));
    } catch (e) {
      this.toast.show((e as ApiError).message);
    } finally {
      this.loading.set(false);
    }
  }

  search() {
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.load(), 250);
  }

  async open(id: number) {
    const d = await this.api.get<ClientDetail>(`/clients/${id}`).catch(() => null);
    this.detail.set(d);
    this.notes = d?.notes ?? '';
  }

  async saveNotes(id: number) {
    try {
      await this.api.patch(`/clients/${id}`, { notes: this.notes });
      this.toast.show('Notas guardadas');
    } catch (e) {
      this.toast.show((e as ApiError).message);
    }
  }

  waLink(d: ClientDetail): string {
    return this.rows().find((r) => r.id === d.id)?.whatsapp ?? `https://wa.me/${d.phone}`;
  }

  color(name: string): string {
    const palette = ['#B4532A', '#3F6C8E', '#6B8E3F', '#8E6BB0', '#B0476E', '#2C7A7B', '#C98A3A'];
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return palette[h % palette.length];
  }
}
