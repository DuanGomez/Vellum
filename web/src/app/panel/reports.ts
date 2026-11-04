import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError } from '../core/api';
import { addDays, cop, hour, pad, shortDate, today, ymd } from '../core/format';
import { Toast } from '../core/toast';

interface Stats {
  from: string;
  to: string;
  appointments: number;
  attended: number;
  revenue: number;
  average_ticket: number;
  no_show_rate: number;
  cancelled: number;
  online_share: number;
  new_clients: number;
  by_day: { date: string; appointments: number; revenue: number }[];
  by_professional: { name: string; appointments: number; revenue: number }[];
  by_service: { name: string; appointments: number; revenue: number }[];
  by_hour: { hour: number; appointments: number }[];
}

@Component({
  selector: 'v-reports',
  imports: [FormsModule],
  template: `
    <div class="bar">
      <div>
        <span class="eyebrow">Reportes</span>
        <h1>¿Cómo va el negocio?</h1>
      </div>
      <div class="seg">
        @for (r of ranges; track r.key) {
          <button [class.on]="range() === r.key" (click)="setRange(r.key)">{{ r.label }}</button>
        }
      </div>
    </div>

    @if (stats(); as s) {
      <div class="kpis">
        <div class="kpi card"><span>Ingresos atendidos</span><b class="serif">{{ cop(s.revenue) }}</b><small class="muted">{{ s.attended }} citas atendidas</small></div>
        <div class="kpi card"><span>Citas agendadas</span><b class="serif">{{ s.appointments }}</b><small class="muted">{{ s.online_share }}% reservadas en línea</small></div>
        <div class="kpi card"><span>Ticket promedio</span><b class="serif">{{ cop(s.average_ticket) }}</b><small class="muted">{{ s.new_clients }} clientes nuevos</small></div>
        <div class="kpi card" [class.warn]="s.no_show_rate > 10"><span>Inasistencia</span><b class="serif">{{ s.no_show_rate }}%</b><small class="muted">{{ s.cancelled }} canceladas</small></div>
      </div>

      <section class="card chart">
        <header><h3>Ingresos por día</h3><span class="muted">{{ shortDate(s.from) }} – {{ shortDate(s.to) }}</span></header>
        <div class="bars">
          @for (d of s.by_day; track d.date) {
            <div class="b" [title]="shortDate(d.date) + ': ' + cop(d.revenue) + ' · ' + d.appointments + ' citas'">
              <i [style.height.%]="maxRevenue() ? (d.revenue / maxRevenue()) * 100 : 0"></i>
              @if (s.by_day.length <= 16) {
                <span>{{ d.date.slice(8) }}</span>
              }
            </div>
          }
        </div>
      </section>

      <div class="two">
        <section class="card table">
          <h3>Por profesional</h3>
          @for (p of s.by_professional; track p.name) {
            <div class="tr">
              <span>{{ p.name }}</span>
              <div class="meter"><i [style.width.%]="(p.appointments / (s.by_professional[0]?.appointments || 1)) * 100"></i></div>
              <b>{{ p.appointments }}</b>
              <span class="muted r">{{ cop(p.revenue) }}</span>
            </div>
          }
        </section>
        <section class="card table">
          <h3>Servicios más pedidos</h3>
          @for (p of s.by_service.slice(0, 6); track p.name) {
            <div class="tr">
              <span>{{ p.name }}</span>
              <div class="meter"><i [style.width.%]="(p.appointments / (s.by_service[0]?.appointments || 1)) * 100"></i></div>
              <b>{{ p.appointments }}</b>
              <span class="muted r">{{ cop(p.revenue) }}</span>
            </div>
          }
        </section>
      </div>

      <section class="card chart">
        <header><h3>Horas más pedidas</h3><span class="muted">Para decidir cuándo reforzar el equipo</span></header>
        <div class="heat">
          @for (h of s.by_hour; track h.hour) {
            <div class="cell" [style.--v]="h.appointments / maxHour()">
              <b>{{ h.appointments }}</b><span>{{ hourLabel(h.hour) }}</span>
            </div>
          }
        </div>
      </section>
    } @else {
      <div class="loading"><div class="spinner"></div></div>
    }
  `,
  styles: `
    :host { display: block; padding: 22px clamp(14px, 3vw, 32px); }
    .bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 14px; margin-bottom: 18px; }
    h1 { font-size: clamp(26px, 3.4vw, 36px); margin-top: 4px; }
    h3 { font-size: 20px; }
    .seg { display: inline-flex; border: 1px solid var(--line-2); border-radius: 999px; overflow: hidden; background: var(--card); }
    .seg button { height: 38px; padding: 0 14px; border: 0; background: none; font-weight: 700; cursor: pointer; }
    .seg button.on { background: var(--ink); color: var(--paper); }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
    .kpi { display: grid; gap: 4px; padding: 18px; }
    .kpi span { font-size: 12px; font-weight: 800; color: var(--muted); }
    .kpi b { font-size: clamp(24px, 2.6vw, 32px); }
    .kpi.warn b { color: var(--amber); }
    .chart, .table { padding: 20px; margin-bottom: 14px; }
    .chart header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; gap: 10px; flex-wrap: wrap; }
    .bars { display: flex; align-items: end; gap: 4px; height: 200px; }
    .b { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: end; align-items: center; gap: 4px; }
    .b i { width: 100%; min-height: 2px; border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, white)); }
    .b span { font-size: 10px; color: var(--muted); font-weight: 700; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .table h3 { margin-bottom: 12px; }
    .tr { display: grid; grid-template-columns: 1.2fr 1fr 36px 100px; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--line); font-size: 14px; }
    .meter { height: 8px; border-radius: 99px; background: var(--paper-2); overflow: hidden; }
    .meter i { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
    .r { text-align: right; font-size: 13px; }
    .heat { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 6px; }
    .cell { display: grid; justify-items: center; padding: 10px 4px; border-radius: 10px; background: color-mix(in srgb, var(--accent) calc(var(--v) * 70%), var(--paper)); }
    .cell b { font-family: var(--serif); font-size: 18px; }
    .cell span { font-size: 11px; font-weight: 700; }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } .two { grid-template-columns: 1fr; } }
  `,
})
export class Reports implements OnInit {
  private api = inject(Api);
  private toast = inject(Toast);
  protected readonly cop = cop;
  protected readonly shortDate = shortDate;
  protected stats = signal<Stats | null>(null);
  protected range = signal<'7' | '30' | 'month' | 'next'>('30');
  protected ranges = [
    { key: '7' as const, label: '7 días' },
    { key: '30' as const, label: '30 días' },
    { key: 'month' as const, label: 'Este mes' },
    { key: 'next' as const, label: 'Próximos 14' },
  ];
  protected maxRevenue = computed(() => Math.max(0, ...(this.stats()?.by_day.map((d) => d.revenue) ?? [0])));
  protected maxHour = computed(() => Math.max(1, ...(this.stats()?.by_hour.map((d) => d.appointments) ?? [1])));

  ngOnInit() {
    this.load();
  }

  setRange(r: '7' | '30' | 'month' | 'next') {
    this.range.set(r);
    this.load();
  }

  hourLabel(h: number): string {
    return hour(`${pad(h)}:00`).replace(':00', '');
  }

  async load() {
    const t = today();
    const r = this.range();
    const from = r === '7' ? addDays(t, -6) : r === '30' ? addDays(t, -29) : r === 'month' ? new Date(t.getFullYear(), t.getMonth(), 1) : t;
    const to = r === 'next' ? addDays(t, 14) : t;
    try {
      this.stats.set(await this.api.get<Stats>('/stats', { from: ymd(from), to: ymd(to) }));
    } catch (e) {
      this.toast.show((e as ApiError).message);
    }
  }
}
