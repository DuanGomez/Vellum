import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError } from '../core/api';
import { addDays, cop, hour, initials, isoWeekday, longDate, minutesOf, pad, parse, shortDate, today, ymd } from '../core/format';
import { Appointment, Professional, Service, TimeOff, STATUS_LABEL } from '../core/models';
import { Toast } from '../core/toast';
import { AppointmentDialog } from './appointment-dialog';

interface AgendaData {
  from: string;
  days: number;
  professionals: Professional[];
  appointments: Appointment[];
  time_offs: TimeOff[];
  summary: { total: number; attended: number; expected: number };
}

const PX = 2; // píxeles por minuto en la vista de día

@Component({
  selector: 'v-agenda',
  imports: [FormsModule, AppointmentDialog],
  templateUrl: './agenda.html',
  styleUrl: './agenda.scss',
})
export class Agenda implements OnInit, OnDestroy {
  private api = inject(Api);
  private toast = inject(Toast);

  protected readonly cop = cop;
  protected readonly hour = hour;
  protected readonly initials = initials;
  protected readonly longDate = longDate;
  protected readonly shortDate = shortDate;
  protected readonly statusLabel = STATUS_LABEL;

  protected view = signal<'day' | 'week'>(window.innerWidth < 700 ? 'day' : 'day');
  protected date = signal<Date>(today());
  protected data = signal<AgendaData | null>(null);
  protected services = signal<Service[]>([]);
  protected loading = signal(true);
  protected filterPro = signal<number | null>(null);
  protected now = signal(new Date());
  private timer: ReturnType<typeof setInterval> | undefined;

  protected dialog = signal<{ appointment: Appointment | null; preset: { date: string; time?: string; professional?: number } | null } | null>(null);

  protected dayKey = computed(() => ymd(this.date()));
  protected isToday = computed(() => this.dayKey() === ymd(today()));

  protected pros = computed(() => {
    const all = this.data()?.professionals ?? [];
    const f = this.filterPro();
    return f ? all.filter((p) => p.id === f) : all;
  });

  /** Rango de horas visible: del primer horario al último, con margen. */
  protected range = computed(() => {
    const wd = isoWeekday(this.date());
    let start = 24 * 60;
    let end = 0;
    for (const p of this.data()?.professionals ?? []) {
      for (const s of p.schedules ?? []) {
        if (this.view() === 'day' && s.weekday !== wd) continue;
        start = Math.min(start, minutesOf(s.start));
        end = Math.max(end, minutesOf(s.end));
      }
    }
    for (const a of this.data()?.appointments ?? []) {
      start = Math.min(start, minutesOf(a.starts_at));
      end = Math.max(end, minutesOf(a.ends_at));
    }
    if (start >= end) {
      start = 8 * 60;
      end = 18 * 60;
    }
    start = Math.floor(start / 60) * 60;
    end = Math.ceil(end / 60) * 60;
    return { start, end };
  });

  protected hours = computed(() => {
    const { start, end } = this.range();
    const out: { label: string; top: number }[] = [];
    for (let m = start; m < end; m += 60) out.push({ label: hour(`${pad(m / 60)}:00`), top: (m - start) * PX });
    return out;
  });

  protected height = computed(() => (this.range().end - this.range().start) * PX);

  protected nowTop = computed(() => {
    if (!this.isToday()) return null;
    const n = this.now();
    const m = n.getHours() * 60 + n.getMinutes();
    const { start, end } = this.range();
    return m >= start && m <= end ? (m - start) * PX : null;
  });

  /** Para cada profesional: bloques de horario, ausencias y citas del día. */
  protected columns = computed(() => {
    const d = this.data();
    if (!d) return [];
    const wd = isoWeekday(this.date());
    const { start } = this.range();
    const key = this.dayKey();
    return this.pros().map((p) => ({
      pro: p,
      work: (p.schedules ?? [])
        .filter((s) => s.weekday === wd)
        .map((s) => ({ top: (minutesOf(s.start) - start) * PX, height: (minutesOf(s.end) - minutesOf(s.start)) * PX })),
      offs: d.time_offs
        .filter((t) => t.professional_id === p.id && t.starts_at.slice(0, 10) <= key && t.ends_at.slice(0, 10) >= key)
        .map((t) => {
          const s = t.starts_at.slice(0, 10) < key ? start : minutesOf(t.starts_at);
          const e = t.ends_at.slice(0, 10) > key ? this.range().end : minutesOf(t.ends_at);
          return { top: (Math.max(s, start) - start) * PX, height: (e - Math.max(s, start)) * PX, reason: t.reason };
        }),
      items: d.appointments
        .filter((a) => a.professional.id === p.id && a.starts_at.startsWith(key))
        .map((a) => {
          const h = Math.max(26, (minutesOf(a.ends_at) - minutesOf(a.starts_at)) * PX - 3);
          return { a, top: (minutesOf(a.starts_at) - start) * PX, height: h, compact: h < 64 };
        }),
      count: d.appointments.filter((a) => a.professional.id === p.id && a.starts_at.startsWith(key) && a.status !== 'cancelada').length,
    }));
  });

  protected week = computed(() => {
    const d = this.data();
    if (!d) return [];
    const f = this.filterPro();
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(this.monday(), i);
      const key = ymd(day);
      const items = d.appointments.filter((a) => a.starts_at.startsWith(key) && (!f || a.professional.id === f));
      return {
        key,
        day,
        isToday: key === ymd(today()),
        items,
        revenue: items.filter((a) => a.status !== 'cancelada').reduce((s, a) => s + a.price, 0),
      };
    });
  });

  ngOnInit() {
    this.load();
    this.api.get<Service[]>('/services').then((s) => this.services.set(s)).catch(() => null);
    this.timer = setInterval(() => this.now.set(new Date()), 60_000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  private monday(): Date {
    const d = this.date();
    return addDays(d, 1 - isoWeekday(d));
  }

  async load() {
    this.loading.set(this.data() === null);
    const week = this.view() === 'week';
    try {
      this.data.set(await this.api.get<AgendaData>('/agenda', { date: ymd(week ? this.monday() : this.date()), days: week ? 7 : 1 }));
    } catch (e) {
      this.toast.show((e as ApiError).message);
    } finally {
      this.loading.set(false);
    }
  }

  move(days: number) {
    this.date.set(addDays(this.date(), this.view() === 'week' ? days * 7 : days));
    this.load();
  }

  goToday() {
    this.date.set(today());
    this.load();
  }

  pickDate(v: string) {
    if (!v) return;
    this.date.set(parse(v));
    this.load();
  }

  setView(v: 'day' | 'week') {
    this.view.set(v);
    this.load();
  }

  openDay(d: Date) {
    this.date.set(d);
    this.setView('day');
  }

  /** Clic en un hueco de la columna: nueva cita a esa hora. */
  createAt(event: MouseEvent, pro: Professional) {
    const el = event.currentTarget as HTMLElement;
    const y = event.clientY - el.getBoundingClientRect().top;
    const step = this.api.business()?.slot_step ?? 15;
    const m = this.range().start + Math.floor(y / PX / step) * step;
    this.dialog.set({ appointment: null, preset: { date: this.dayKey(), time: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`, professional: pro.id } });
  }

  newAppointment() {
    this.dialog.set({ appointment: null, preset: { date: this.dayKey(), professional: this.filterPro() ?? undefined } });
  }

  open(a: Appointment, event?: Event) {
    event?.stopPropagation();
    this.dialog.set({ appointment: a, preset: null });
  }

  closeDialog(changed: boolean) {
    this.dialog.set(null);
    if (changed) this.load();
  }
}
