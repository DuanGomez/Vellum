import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError } from '../core/api';
import { addDays, hour, longDate, today, ymd } from '../core/format';
import { Appointment } from '../core/models';
import { Toast } from '../core/toast';

@Component({
  selector: 'v-reminders',
  imports: [FormsModule],
  template: `
    <div class="bar">
      <div>
        <span class="eyebrow">Recordatorios por WhatsApp</span>
        <h1>Citas de {{ isTomorrow() ? 'mañana' : longDate(date()) }}</h1>
        <p class="muted">Toca «Enviar» y se abre WhatsApp con el mensaje listo. Quedan marcadas para que no repitas.</p>
      </div>
      <input type="date" class="input date" [ngModel]="date()" (ngModelChange)="setDate($event)" />
    </div>

    @if (auto()) {
      <div class="note ok">✓ Envío automático activo: Vellum los manda solo {{ hours() }} horas antes. Igual puedes enviarlos a mano.</div>
    } @else {
      <div class="note">
        Envío automático apagado. Para activarlo conecta la API oficial de WhatsApp (Meta) en el servidor.
        Mientras tanto, el envío con un toque funciona igual.
      </div>
    }

    <div class="progress card">
      <div>
        <b class="serif">{{ sent() }} / {{ items().length }}</b>
        <span class="muted">recordatorios enviados</span>
      </div>
      <div class="track"><i [style.width.%]="items().length ? (sent() / items().length) * 100 : 0"></i></div>
    </div>

    @if (loading()) {
      <div class="loading"><div class="spinner"></div></div>
    } @else {
      <div class="list">
        @for (a of items(); track a.id) {
          <article class="item card" [class.done]="a.reminder_sent_at">
            <div class="when">
              <b>{{ hour(a.starts_at) }}</b>
              <span class="muted">{{ a.service.duration }} min</span>
            </div>
            <div class="who">
              <strong>{{ a.client.name }}</strong>
              <span class="muted">{{ a.service.name }} · con {{ a.professional.name }}</span>
              <p class="msg">{{ a.message }}</p>
            </div>
            <div class="act">
              @if (a.reminder_sent_at) {
                <span class="chip atendida">✓ Enviado</span>
                <button class="link" (click)="send(a)">Reenviar</button>
              } @else {
                <button class="btn accent sm" (click)="send(a)">Enviar</button>
              }
            </div>
          </article>
        } @empty {
          <div class="empty card">No hay citas confirmadas para ese día. 🎉</div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; padding: 22px clamp(14px, 3vw, 32px); max-width: 980px; }
    .bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 14px; margin-bottom: 16px; }
    h1 { font-size: clamp(26px, 3.4vw, 36px); margin: 4px 0 6px; }
    .date { width: auto; border-radius: 999px; }
    .note { padding: 12px 16px; border-radius: 12px; background: var(--paper-2); font-size: 13px; margin-bottom: 14px; }
    .note.ok { background: var(--sage-soft); color: var(--sage); font-weight: 700; }
    .progress { display: flex; align-items: center; gap: 18px; padding: 16px 20px; margin-bottom: 14px; }
    .progress b { font-size: 26px; margin-right: 6px; }
    .track { flex: 1; height: 8px; border-radius: 99px; background: var(--paper-2); overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--sage); transition: width .3s; }
    .list { display: grid; gap: 10px; }
    .item { display: grid; grid-template-columns: 90px 1fr auto; gap: 16px; align-items: start; padding: 16px 18px; }
    .item.done { opacity: .7; }
    .when { display: grid; }
    .when b { font-family: var(--serif); font-size: 20px; }
    .who strong { display: block; }
    .msg { margin-top: 8px; padding: 10px 12px; border-radius: 12px 12px 12px 2px; background: #e8f7dc; font-size: 13px; color: #1b2a17; }
    .act { display: grid; gap: 6px; justify-items: end; }
    @media (max-width: 640px) { .item { grid-template-columns: 1fr; } .act { justify-items: start; grid-auto-flow: column; } }
  `,
})
export class Reminders implements OnInit {
  private api = inject(Api);
  private toast = inject(Toast);
  protected readonly hour = hour;
  protected readonly longDate = longDate;
  protected date = signal(ymd(addDays(today(), 1)));
  protected items = signal<Appointment[]>([]);
  protected auto = signal(false);
  protected loading = signal(true);
  protected hours = computed(() => this.api.business()?.reminder_hours ?? 24);
  protected sent = computed(() => this.items().filter((a) => a.reminder_sent_at).length);
  protected isTomorrow = computed(() => this.date() === ymd(addDays(today(), 1)));

  ngOnInit() {
    this.load();
  }

  setDate(d: string) {
    if (!d) return;
    this.date.set(d);
    this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const r = await this.api.get<{ auto: boolean; items: Appointment[] }>('/reminders', { date: this.date() });
      this.items.set(r.items);
      this.auto.set(r.auto);
    } catch (e) {
      this.toast.show((e as ApiError).message);
    } finally {
      this.loading.set(false);
    }
  }

  async send(a: Appointment) {
    window.open(a.reminder_link, '_blank', 'noopener');
    try {
      const updated = await this.api.post<Appointment>(`/reminders/${a.id}/sent`);
      this.items.update((list) => list.map((x) => (x.id === a.id ? { ...x, reminder_sent_at: updated.reminder_sent_at } : x)));
    } catch {}
  }
}
