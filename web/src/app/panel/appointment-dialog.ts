import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, ApiError } from '../core/api';
import { cop, duration, hour, longDate, phone } from '../core/format';
import { Appointment, Professional, Service, Slot, Status, STATUS_LABEL } from '../core/models';
import { Toast } from '../core/toast';

interface ClientHit {
  id: number;
  name: string;
  phone: string;
}

/** Crear una cita nueva o gestionar una existente (estado, mover, notas). */
@Component({
  selector: 'v-appointment-dialog',
  imports: [FormsModule, NgTemplateOutlet],
  templateUrl: './appointment-dialog.html',
  styleUrl: './appointment-dialog.scss',
})
export class AppointmentDialog implements OnInit {
  readonly appointment = input<Appointment | null>(null);
  readonly services = input.required<Service[]>();
  readonly professionals = input.required<Professional[]>();
  readonly preset = input<{ date: string; time?: string; professional?: number } | null>(null);
  readonly closed = output<boolean>(); // true = hubo cambios

  private api = inject(Api);
  private toast = inject(Toast);

  protected readonly cop = cop;
  protected readonly hour = hour;
  protected readonly duration = duration;
  protected readonly longDate = longDate;
  protected readonly phone = phone;
  protected readonly statusLabel = STATUS_LABEL;

  protected mode = signal<'view' | 'create' | 'move'>('create');
  protected serviceId = signal<number | null>(null);
  protected professionalId = signal<number | null>(null);
  protected date = signal('');
  protected time = signal<string | null>(null);
  protected customTime = '';
  protected slots = signal<Slot[]>([]);
  protected loadingSlots = signal(false);
  protected error = signal<string | null>(null);
  protected canForce = signal(false);
  protected busy = signal(false);

  protected clientQuery = '';
  protected hits = signal<ClientHit[]>([]);
  protected client = signal<ClientHit | null>(null);
  protected newClient = { name: '', phone: '' };
  protected notes = '';

  protected service = computed(() => this.services().find((s) => s.id === this.serviceId()) ?? null);
  protected prosForService = computed(() => {
    const s = this.service();
    return this.professionals().filter((p) => !s || p.services?.includes(s.id));
  });
  protected slotsForPro = computed(() => {
    const pid = this.professionalId();
    return this.slots().filter((s) => !pid || s.professionals.includes(pid));
  });

  ngOnInit() {
    const a = this.appointment();
    if (a) {
      this.mode.set('view');
      this.serviceId.set(a.service.id);
      this.professionalId.set(a.professional.id);
      this.date.set(a.starts_at.slice(0, 10));
      this.notes = a.notes ?? '';
    } else {
      const p = this.preset();
      this.mode.set('create');
      this.date.set(p?.date ?? new Date().toISOString().slice(0, 10));
      this.professionalId.set(p?.professional ?? null);
      const first = this.services().find((s) => s.active && (!p?.professional || s.professionals?.includes(p.professional)));
      this.serviceId.set(first?.id ?? null);
      if (p?.time) this.customTime = p.time;
      this.loadSlots(p?.time);
    }
  }

  async loadSlots(prefer?: string) {
    const s = this.serviceId();
    if (!s || !this.date()) return;
    this.loadingSlots.set(true);
    try {
      const slots = await this.api.get<Slot[]>('/agenda/slots', {
        service: s,
        date: this.date(),
        professional: this.professionalId(),
        ignore: this.appointment()?.id,
      });
      this.slots.set(slots);
      this.time.set(prefer && slots.some((x) => x.time === prefer) ? prefer : null);
    } catch {
      this.slots.set([]);
    } finally {
      this.loadingSlots.set(false);
    }
  }

  setService(id: number) {
    this.serviceId.set(Number(id));
    if (this.professionalId() && !this.prosForService().some((p) => p.id === this.professionalId())) this.professionalId.set(null);
    this.loadSlots();
  }

  setProfessional(id: number | null) {
    this.professionalId.set(id ? Number(id) : null);
    this.loadSlots(this.time() ?? undefined);
  }

  setDate(d: string) {
    this.date.set(d);
    this.loadSlots();
  }

  async searchClients() {
    const q = this.clientQuery.trim();
    if (q.length < 2) return this.hits.set([]);
    this.hits.set(await this.api.get<ClientHit[]>('/clients', { q }).catch(() => []));
  }

  pickClient(c: ClientHit) {
    this.client.set(c);
    this.hits.set([]);
    this.clientQuery = '';
  }

  private chosenTime(): string | null {
    return this.time() ?? (this.customTime || null);
  }

  async create(force = false) {
    this.error.set(null);
    const t = this.chosenTime();
    if (!this.serviceId() || !this.professionalId()) return this.error.set('Elige servicio y profesional.');
    if (!t) return this.error.set('Elige una hora.');
    if (!this.client() && (this.newClient.name.trim().length < 2 || this.newClient.phone.replace(/\D/g, '').length < 7)) {
      return this.error.set('Busca un cliente o escribe nombre y WhatsApp del nuevo.');
    }
    this.busy.set(true);
    try {
      await this.api.post('/appointments', {
        service_id: this.serviceId(),
        professional_id: this.professionalId(),
        date: this.date(),
        time: t,
        client_id: this.client()?.id ?? null,
        name: this.newClient.name || null,
        phone: this.newClient.phone || null,
        notes: this.notes || null,
        force,
      });
      this.toast.show('Cita creada');
      this.closed.emit(true);
    } catch (e) {
      this.error.set((e as ApiError).message);
      this.canForce.set((e as ApiError).canForce);
    } finally {
      this.busy.set(false);
    }
  }

  async setStatus(status: Status) {
    await this.save({ status }, `Marcada como «${STATUS_LABEL[status].toLowerCase()}»`);
  }

  async saveNotes() {
    await this.save({ notes: this.notes || null }, 'Notas guardadas', false);
  }

  async move(force = false) {
    const t = this.chosenTime();
    if (!t) return this.error.set('Elige la nueva hora.');
    await this.save({ date: this.date(), time: t, professional_id: this.professionalId(), force }, 'Cita movida');
  }

  private async save(body: Record<string, unknown>, ok: string, close = true) {
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.api.patch(`/appointments/${this.appointment()!.id}`, body);
      this.toast.show(ok);
      if (close) this.closed.emit(true);
    } catch (e) {
      this.error.set((e as ApiError).message);
      this.canForce.set((e as ApiError).canForce);
    } finally {
      this.busy.set(false);
    }
  }

  async remove() {
    if (!confirm('¿Borrar esta cita para siempre? Si solo no vino, mejor márcala como «No asistió».')) return;
    this.busy.set(true);
    try {
      await this.api.delete(`/appointments/${this.appointment()!.id}`);
      this.toast.show('Cita borrada');
      this.closed.emit(true);
    } catch (e) {
      this.error.set((e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }

  async remind() {
    const a = this.appointment()!;
    window.open(a.reminder_link, '_blank', 'noopener');
    await this.api.post(`/reminders/${a.id}/sent`).catch(() => null);
  }

  startMove() {
    this.mode.set('move');
    this.loadSlots();
  }
}
