import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../core/api';
import { addDays, cop, dayName, duration, hour, initials, longDate, monthName, today, ymd } from '../core/format';
import { Appointment, Business, KIND_LABEL, Professional, Service, Slot } from '../core/models';

type Step = 'service' | 'professional' | 'time' | 'details' | 'done';

@Component({
  selector: 'v-booking',
  imports: [FormsModule, RouterLink],
  templateUrl: './booking.html',
  styleUrl: './booking.scss',
  host: { '[style.--accent]': 'business()?.color' },
})
export class Booking implements OnInit {
  readonly slug = input.required<string>();
  protected api = inject(Api);

  protected business = signal<Business | null>(null);
  protected services = signal<Service[]>([]);
  protected professionals = signal<Professional[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);

  protected step = signal<Step>('service');
  protected service = signal<Service | null>(null);
  protected professional = signal<Professional | null>(null); // null = cualquiera
  protected anyone = signal(false);
  protected date = signal<string>(ymd(today()));
  protected openDays = signal<Record<string, boolean>>({});
  protected slots = signal<Slot[]>([]);
  protected loadingSlots = signal(false);
  protected time = signal<string | null>(null);

  protected form = { name: '', phone: '', email: '', notes: '' };
  protected sending = signal(false);
  protected formError = signal<string | null>(null);
  protected result = signal<{ appointment: Appointment; whatsapp_link: string | null } | null>(null);

  protected readonly cop = cop;
  protected readonly duration = duration;
  protected readonly hour = hour;
  protected readonly initials = initials;
  protected readonly longDate = longDate;
  protected readonly kindLabel = KIND_LABEL;

  protected categories = computed(() => {
    const groups = new Map<string, Service[]>();
    for (const s of this.services()) {
      const k = s.category || 'Servicios';
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    return [...groups.entries()].map(([name, items]) => ({ name, items }));
  });

  protected prosForService = computed(() => {
    const s = this.service();
    return s ? this.professionals().filter((p) => s.professionals?.includes(p.id)) : [];
  });

  protected days = computed(() => {
    const max = this.business()?.max_days ?? 30;
    return Array.from({ length: Math.min(max, 28) + 1 }, (_, i) => {
      const d = addDays(today(), i);
      return { key: ymd(d), day: d.getDate(), name: i === 0 ? 'hoy' : i === 1 ? 'mañ' : dayName(d), month: d.getMonth() };
    });
  });

  protected monthLabel = computed(() => {
    const d = this.date().split('-').map(Number);
    return monthName(d[1] - 1);
  });

  protected slotGroups = computed(() => {
    const groups = [
      { name: 'Mañana', items: [] as Slot[] },
      { name: 'Tarde', items: [] as Slot[] },
      { name: 'Noche', items: [] as Slot[] },
    ];
    for (const s of this.slots()) {
      const h = Number(s.time.slice(0, 2));
      groups[h < 12 ? 0 : h < 18 ? 1 : 2].items.push(s);
    }
    return groups.filter((g) => g.items.length);
  });

  protected stepIndex = computed(() => ['service', 'professional', 'time', 'details', 'done'].indexOf(this.step()));

  async ngOnInit() {
    try {
      const data = await this.api.get<{ business: Business; services: Service[]; professionals: Professional[] }>(`/public/b/${this.slug()}`);
      this.business.set(data.business);
      this.services.set(data.services);
      this.professionals.set(data.professionals);
      document.title = `Reservar en ${data.business.name} · Vellum`;
    } catch (e) {
      this.error.set((e as ApiError).status === 404 ? 'Este negocio no existe o cambió su enlace.' : (e as ApiError).message);
    } finally {
      this.loading.set(false);
    }
  }

  pickService(s: Service) {
    this.service.set(s);
    this.time.set(null);
    const pros = this.prosForService();
    if (pros.length === 1) {
      this.pickProfessional(pros[0]);
    } else {
      this.step.set('professional');
    }
  }

  pickProfessional(p: Professional | null) {
    this.professional.set(p);
    this.anyone.set(p === null);
    this.time.set(null);
    this.step.set('time');
    this.loadDays();
  }

  private async loadDays() {
    const s = this.service();
    if (!s) return;
    const open = await this.api
      .get<Record<string, boolean>>(`/public/b/${this.slug()}/days`, { service: s.id, days: this.days().length, professional: this.professional()?.id })
      .catch(() => ({}) as Record<string, boolean>);
    this.openDays.set(open);
    const first = Object.entries(open).find(([, ok]) => ok)?.[0];
    this.pickDate(open[this.date()] ? this.date() : first ?? this.date());
  }

  async pickDate(d: string) {
    this.date.set(d);
    this.time.set(null);
    this.loadingSlots.set(true);
    try {
      this.slots.set(
        await this.api.get<Slot[]>(`/public/b/${this.slug()}/slots`, { service: this.service()!.id, date: d, professional: this.professional()?.id }),
      );
    } catch {
      this.slots.set([]);
    } finally {
      this.loadingSlots.set(false);
    }
  }

  pickTime(t: string) {
    this.time.set(t);
    this.step.set('details');
    try {
      const saved = JSON.parse(localStorage.getItem('vellum.client') ?? '{}');
      this.form.name ||= saved.name ?? '';
      this.form.phone ||= saved.phone ?? '';
      this.form.email ||= saved.email ?? '';
    } catch {}
  }

  back() {
    const order: Step[] = ['service', 'professional', 'time', 'details'];
    let i = order.indexOf(this.step()) - 1;
    if (order[i] === 'professional' && this.prosForService().length === 1) i--;
    this.step.set(order[Math.max(0, i)]);
  }

  async confirm() {
    this.formError.set(null);
    if (this.form.name.trim().length < 2) return this.formError.set('Escribe tu nombre.');
    if (this.form.phone.replace(/\D/g, '').length < 7) return this.formError.set('Escribe tu número de WhatsApp.');
    this.sending.set(true);
    try {
      const res = await this.api.post<{ appointment: Appointment; whatsapp_link: string | null }>(`/public/b/${this.slug()}/book`, {
        service_id: this.service()!.id,
        professional_id: this.professional()?.id ?? null,
        date: this.date(),
        time: this.time(),
        name: this.form.name.trim(),
        phone: this.form.phone,
        email: this.form.email || null,
        notes: this.form.notes || null,
      });
      this.result.set(res);
      this.step.set('done');
      try {
        localStorage.setItem('vellum.client', JSON.stringify({ name: this.form.name, phone: this.form.phone, email: this.form.email }));
      } catch {}
    } catch (e) {
      const err = e as ApiError;
      this.formError.set(err.message);
      if (err.status === 409) {
        this.step.set('time');
        this.pickDate(this.date());
      }
    } finally {
      this.sending.set(false);
    }
  }

  /** Archivo .ics para guardar la cita en el calendario del celular. */
  calendarLink(): string {
    const a = this.result()?.appointment;
    const b = this.business();
    if (!a || !b) return '#';
    const stamp = (s: string) => s.replace(/[-: ]/g, '').slice(0, 12) + '00';
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Vellum//ES',
      'BEGIN:VEVENT',
      `UID:${a.code}@vellum`,
      `DTSTART;TZID=America/Bogota:${stamp(a.starts_at)}`,
      `DTEND;TZID=America/Bogota:${stamp(a.ends_at)}`,
      `SUMMARY:${a.service.name} · ${b.name}`,
      `DESCRIPTION:Con ${a.professional.name}. Código ${a.code}.`,
      `LOCATION:${[b.address, b.city].filter(Boolean).join(', ')}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Tienes una cita',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }

  restart() {
    this.result.set(null);
    this.service.set(null);
    this.time.set(null);
    this.step.set('service');
  }
}
