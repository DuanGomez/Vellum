import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError } from '../core/api';
import { initials, shortDate, hour, WEEKDAYS } from '../core/format';
import { Professional, ScheduleRange, Service } from '../core/models';
import { Toast } from '../core/toast';

interface DayRow {
  weekday: number;
  on: boolean;
  ranges: { start: string; end: string }[];
}

interface Draft {
  id?: number;
  name: string;
  title: string;
  color: string;
  active: boolean;
  services: number[];
  days: DayRow[];
}

const COLORS = ['#B4532A', '#3F6C8E', '#6B8E3F', '#8E6BB0', '#B0476E', '#2C7A7B', '#C98A3A', '#3D5A99', '#7A4E2D'];

@Component({
  selector: 'v-team',
  imports: [FormsModule],
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class Team implements OnInit {
  private api = inject(Api);
  private toast = inject(Toast);
  protected readonly initials = initials;
  protected readonly weekdays = WEEKDAYS;
  protected readonly colors = COLORS;
  protected readonly shortDate = shortDate;
  protected readonly hour = hour;

  protected pros = signal<Professional[]>([]);
  protected services = signal<Service[]>([]);
  protected draft = signal<Draft | null>(null);
  protected busy = signal(false);
  protected error = signal<string | null>(null);

  protected off = { professional_id: 0, date: '', from: '09:00', toDate: '', to: '18:00', reason: '' };
  protected offFor = signal<Professional | null>(null);

  ngOnInit() {
    this.load();
  }

  async load() {
    try {
      const [p, s] = await Promise.all([this.api.get<Professional[]>('/professionals'), this.api.get<Service[]>('/services')]);
      this.pros.set(p);
      this.services.set(s);
    } catch (e) {
      this.toast.show((e as ApiError).message);
    }
  }

  summary(p: Professional): string {
    const days = new Set((p.schedules ?? []).map((s) => s.weekday));
    if (!days.size) return 'Sin horario';
    return [1, 2, 3, 4, 5, 6, 7].filter((d) => days.has(d)).map((d) => WEEKDAYS[d - 1].slice(0, 3)).join(' · ');
  }

  edit(p?: Professional) {
    this.error.set(null);
    const schedules: ScheduleRange[] = p?.schedules ?? [];
    const days: DayRow[] = [1, 2, 3, 4, 5, 6, 7].map((wd) => {
      const ranges = schedules.filter((s) => s.weekday === wd).map((s) => ({ start: s.start, end: s.end }));
      return { weekday: wd, on: ranges.length > 0, ranges: ranges.length ? ranges : [{ start: '09:00', end: '18:00' }] };
    });
    if (!p) {
      days.forEach((d) => {
        d.on = d.weekday <= 6;
        d.ranges = d.weekday === 6 ? [{ start: '09:00', end: '15:00' }] : [{ start: '09:00', end: '12:30' }, { start: '14:00', end: '19:00' }];
      });
    }
    this.draft.set({
      id: p?.id,
      name: p?.name ?? '',
      title: p?.title ?? '',
      color: p?.color ?? COLORS[this.pros().length % COLORS.length],
      active: p?.active ?? true,
      services: p ? [...(p.services ?? [])] : this.services().map((s) => s.id),
      days,
    });
  }

  toggleService(d: Draft, id: number) {
    d.services = d.services.includes(id) ? d.services.filter((x) => x !== id) : [...d.services, id];
  }

  addRange(day: DayRow) {
    const last = day.ranges[day.ranges.length - 1];
    day.ranges.push({ start: last?.end ?? '14:00', end: '19:00' });
  }

  copyToAll(d: Draft, from: DayRow) {
    for (const day of d.days) {
      if (day.weekday !== from.weekday && day.on) day.ranges = from.ranges.map((r) => ({ ...r }));
    }
    this.toast.show('Horario copiado a los demás días activos');
  }

  async save() {
    const d = this.draft()!;
    if (d.name.trim().length < 2) return this.error.set('Escribe el nombre.');
    const schedules = d.days.filter((x) => x.on).flatMap((x) => x.ranges.map((r) => ({ weekday: x.weekday, start: r.start, end: r.end })));
    if (schedules.some((s) => s.start >= s.end)) return this.error.set('Revisa los horarios: la hora final debe ser después de la inicial.');
    this.busy.set(true);
    this.error.set(null);
    const body = { name: d.name, title: d.title || null, color: d.color, active: d.active, services: d.services, schedules };
    try {
      if (d.id) await this.api.put(`/professionals/${d.id}`, body);
      else await this.api.post('/professionals', body);
      this.draft.set(null);
      this.toast.show('Guardado');
      this.load();
    } catch (e) {
      this.error.set((e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }

  async remove(id: number) {
    if (!confirm('¿Quitar a esta persona? Si ya tiene citas, queda inactiva para conservar el historial.')) return;
    await this.api.delete(`/professionals/${id}`).catch(() => null);
    this.draft.set(null);
    this.load();
  }

  openOff(p: Professional) {
    const t = new Date().toISOString().slice(0, 10);
    this.off = { professional_id: p.id, date: t, from: '09:00', toDate: t, to: '18:00', reason: '' };
    this.offFor.set(p);
  }

  async saveOff() {
    try {
      await this.api.post('/time-offs', {
        professional_id: this.off.professional_id,
        starts_at: `${this.off.date} ${this.off.from}`,
        ends_at: `${this.off.toDate || this.off.date} ${this.off.to}`,
        reason: this.off.reason || null,
      });
      this.offFor.set(null);
      this.toast.show('Ausencia guardada: esas horas ya no se ofrecen');
      this.load();
    } catch (e) {
      this.toast.show((e as ApiError).message);
    }
  }

  async removeOff(id: number) {
    await this.api.delete(`/time-offs/${id}`).catch(() => null);
    this.load();
  }
}
