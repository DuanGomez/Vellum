import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../core/api';
import { hour, longDate } from '../core/format';
import { Appointment, STATUS_LABEL } from '../core/models';
import { Toast } from '../core/toast';

@Component({
  selector: 'v-appointment-view',
  imports: [RouterLink],
  host: { '[style.--accent]': 'appt()?.business?.color' },
  template: `
    <main class="wrap">
      @if (loading()) {
        <div class="loading"><div class="spinner"></div>Cargando tu cita…</div>
      } @else if (appt(); as a) {
        <article class="card box">
          <span class="eyebrow">{{ a.business?.name }}</span>
          <h1>{{ a.service.name }}</h1>
          <span class="chip" [class]="a.status">{{ statusLabel[a.status] }}</span>
          <dl>
            <div><dt>Cuándo</dt><dd>{{ longDate(a.starts_at) }} · {{ hour(a.starts_at) }}</dd></div>
            <div><dt>Con</dt><dd>{{ a.professional.name }}</dd></div>
            @if (a.business?.address) {
              <div><dt>Dónde</dt><dd>{{ a.business?.address }}{{ a.business?.city ? ', ' + a.business?.city : '' }}</dd></div>
            }
            <div><dt>Código</dt><dd class="code">{{ a.code }}</dd></div>
          </dl>
          <div class="actions">
            @if (a.status === 'confirmada') {
              @if (confirming()) {
                <p class="muted">¿Seguro que quieres cancelar? Liberarás la hora para otra persona.</p>
                <div class="row">
                  <button class="btn danger" (click)="cancel()" [disabled]="busy()">Sí, cancelar</button>
                  <button class="btn ghost" (click)="confirming.set(false)">No</button>
                </div>
              } @else {
                <button class="btn ghost" (click)="confirming.set(true)">Cancelar mi cita</button>
              }
            }
            <a class="btn accent" [routerLink]="['/reservar', a.business?.slug]">Reservar otra cita</a>
          </div>
        </article>
      } @else {
        <div class="loading">
          <h2>No encontramos esa cita</h2>
          <a routerLink="/" class="btn ghost">Ir a Vellum</a>
        </div>
      }
    </main>
  `,
  styles: `
    .wrap { max-width: 520px; margin: 0 auto; padding: 48px 16px; }
    .box { padding: 30px; display: grid; gap: 14px; justify-items: start; border-top: 5px solid var(--accent); }
    h1 { font-size: 34px; }
    dl { display: grid; gap: 12px; width: 100%; margin: 8px 0; }
    dl div { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 10px; border-bottom: 1px dashed var(--line); }
    dt { color: var(--muted); font-weight: 700; font-size: 13px; }
    dd { margin: 0; font-weight: 700; text-align: right; }
    .code { font-family: ui-monospace, monospace; letter-spacing: .12em; }
    .actions { display: grid; gap: 10px; width: 100%; }
    .row { display: flex; gap: 8px; }
  `,
})
export class AppointmentView implements OnInit {
  readonly code = input.required<string>();
  private api = inject(Api);
  private toast = inject(Toast);
  protected appt = signal<Appointment | null>(null);
  protected loading = signal(true);
  protected busy = signal(false);
  protected confirming = signal(false);
  protected readonly hour = hour;
  protected readonly longDate = longDate;
  protected readonly statusLabel = STATUS_LABEL;

  async ngOnInit() {
    try {
      this.appt.set(await this.api.get<Appointment>(`/public/appointments/${this.code()}`));
    } catch {
      this.appt.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async cancel() {
    this.busy.set(true);
    try {
      this.appt.set(await this.api.post<Appointment>(`/public/appointments/${this.code()}/cancel`));
      this.toast.show('Tu cita quedó cancelada.');
    } catch (e) {
      this.toast.show((e as ApiError).message);
    } finally {
      this.busy.set(false);
      this.confirming.set(false);
    }
  }
}
