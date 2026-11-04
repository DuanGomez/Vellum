import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError } from '../core/api';
import { cop, duration } from '../core/format';
import { Professional, Service } from '../core/models';
import { Toast } from '../core/toast';

type Draft = Omit<Service, 'id' | 'professionals'> & { id?: number; professionals: number[] };

@Component({
  selector: 'v-services',
  imports: [FormsModule],
  template: `
    <div class="bar">
      <div>
        <span class="eyebrow">Servicios</span>
        <h1>Lo que ofreces</h1>
        <p class="muted">La duración define qué horas se ofrecen en tu página de reservas.</p>
      </div>
      <button class="btn accent" (click)="edit()">+ Nuevo servicio</button>
    </div>

    <div class="grid">
      @for (s of services(); track s.id) {
        <article class="svc card" [class.off]="!s.active" (click)="edit(s)">
          <div class="top">
            <span class="chip">{{ s.category || 'General' }}</span>
            @if (!s.active) {
              <span class="chip cancelada">Oculto</span>
            }
          </div>
          <h3>{{ s.name }}</h3>
          @if (s.description) {
            <p class="muted">{{ s.description }}</p>
          }
          <div class="foot">
            <b class="serif">{{ cop(s.price) }}</b>
            <span class="muted">{{ duration(s.duration) }} · {{ s.professionals?.length }} {{ s.professionals?.length === 1 ? 'profesional' : 'profesionales' }}</span>
          </div>
        </article>
      }
    </div>

    @if (draft(); as d) {
      <div class="backdrop" (click)="draft.set(null)">
        <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="save()">
          <header>
            <h2>{{ d.id ? 'Editar servicio' : 'Nuevo servicio' }}</h2>
            <button type="button" class="btn ghost icon sm" (click)="draft.set(null)">✕</button>
          </header>
          <div class="form">
            <label class="field"><span>Nombre</span><input name="name" [(ngModel)]="d.name" required /></label>
            <div class="grid-2">
              <label class="field"><span>Categoría</span><input name="category" [(ngModel)]="d.category" placeholder="Cortes, Facial, Ortodoncia…" /></label>
              <label class="field"><span>Precio (COP)</span><input name="price" type="number" min="0" step="1000" [(ngModel)]="d.price" /></label>
            </div>
            <label class="field">
              <span>Duración</span>
              <select name="duration" [(ngModel)]="d.duration">
                @for (m of durations; track m) {
                  <option [ngValue]="m">{{ duration(m) }}</option>
                }
              </select>
            </label>
            <label class="field"><span>Descripción (opcional)</span><textarea name="description" [(ngModel)]="d.description" rows="2"></textarea></label>
            <div class="field">
              <span>¿Quién lo hace?</span>
              <div class="checks">
                @for (p of pros(); track p.id) {
                  <label class="check"><input type="checkbox" [checked]="d.professionals.includes(p.id)" (change)="toggle(d, p.id)" />{{ p.name }}</label>
                }
              </div>
            </div>
            <label class="check"><input type="checkbox" name="active" [(ngModel)]="d.active" /> Visible en la página de reservas</label>
            @if (error()) {
              <p class="error">{{ error() }}</p>
            }
            <div class="row">
              @if (d.id) {
                <button type="button" class="link danger" (click)="remove(d.id)">Eliminar</button>
              }
              <button class="btn accent" [disabled]="busy()">Guardar</button>
            </div>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    :host { display: block; padding: 22px clamp(14px, 3vw, 32px); }
    .bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 14px; margin-bottom: 18px; }
    h1 { font-size: clamp(26px, 3.4vw, 36px); margin: 4px 0 6px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .svc { display: grid; gap: 8px; padding: 20px; cursor: pointer; transition: transform .12s, box-shadow .15s; }
    .svc:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
    .svc.off { opacity: .6; }
    .svc h3 { font-size: 22px; }
    .svc p { font-size: 13px; }
    .top { display: flex; gap: 6px; }
    .foot { display: flex; justify-content: space-between; align-items: baseline; margin-top: auto; padding-top: 10px; border-top: 1px dashed var(--line); }
    .foot b { font-size: 22px; }
    .foot span { font-size: 12px; }
    .form { display: grid; gap: 14px; }
    h2 { font-size: 26px; }
    .checks { display: flex; flex-wrap: wrap; gap: 8px; }
    .check { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; background: var(--paper); font-weight: 600; font-size: 14px; cursor: pointer; }
    .row { display: flex; justify-content: space-between; align-items: center; }
    .row .btn { margin-left: auto; }
    .danger { color: var(--danger); }
  `,
})
export class Services implements OnInit {
  private api = inject(Api);
  private toast = inject(Toast);
  protected readonly cop = cop;
  protected readonly duration = duration;
  protected services = signal<Service[]>([]);
  protected pros = signal<Professional[]>([]);
  protected draft = signal<Draft | null>(null);
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected durations = [10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 240];

  ngOnInit() {
    this.load();
  }

  async load() {
    const [s, p] = await Promise.all([this.api.get<Service[]>('/services'), this.api.get<Professional[]>('/professionals')]).catch((e) => {
      this.toast.show((e as ApiError).message);
      return [[], []] as [Service[], Professional[]];
    });
    this.services.set(s);
    this.pros.set(p.filter((x) => x.active));
  }

  edit(s?: Service) {
    this.error.set(null);
    this.draft.set(
      s
        ? { ...s, professionals: [...(s.professionals ?? [])] }
        : { name: '', category: '', description: '', duration: 30, price: 0, active: true, professionals: this.pros().map((p) => p.id) },
    );
  }

  toggle(d: Draft, id: number) {
    d.professionals = d.professionals.includes(id) ? d.professionals.filter((x) => x !== id) : [...d.professionals, id];
  }

  async save() {
    const d = this.draft()!;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (d.id) await this.api.put(`/services/${d.id}`, d);
      else await this.api.post('/services', d);
      this.draft.set(null);
      this.toast.show('Servicio guardado');
      this.load();
    } catch (e) {
      this.error.set((e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }

  async remove(id: number) {
    if (!confirm('¿Eliminar este servicio? Si ya tiene citas, solo se oculta.')) return;
    await this.api.delete(`/services/${id}`).catch(() => null);
    this.draft.set(null);
    this.load();
  }
}
