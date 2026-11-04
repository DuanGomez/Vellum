import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError } from '../core/api';
import { Business } from '../core/models';
import { Toast } from '../core/toast';

@Component({
  selector: 'v-settings',
  imports: [FormsModule],
  template: `
    <div class="bar">
      <div>
        <span class="eyebrow">Ajustes</span>
        <h1>Tu negocio</h1>
      </div>
    </div>

    <div class="layout">
      <form class="card box" (ngSubmit)="save()">
        <h3>Datos</h3>
        <div class="grid-2">
          <label class="field"><span>Nombre</span><input name="name" [(ngModel)]="f.name" /></label>
          <label class="field"><span>WhatsApp del negocio</span><input name="phone" [(ngModel)]="f.phone" inputmode="tel" /></label>
        </div>
        <label class="field"><span>Frase corta</span><input name="tagline" [(ngModel)]="f.tagline" /></label>
        <div class="grid-2">
          <label class="field"><span>Dirección</span><input name="address" [(ngModel)]="f.address" /></label>
          <label class="field"><span>Ciudad</span><input name="city" [(ngModel)]="f.city" /></label>
        </div>
        <div class="field">
          <span>Color de tu marca</span>
          <div class="colors">
            @for (c of colors; track c) {
              <button type="button" class="sw" [style.background]="c" [class.sel]="f.color === c" (click)="f.color = c"></button>
            }
            <input type="color" name="color" [(ngModel)]="f.color" />
          </div>
        </div>

        <h3>Reservas en línea</h3>
        <div class="grid-2">
          <label class="field">
            <span>Ofrecer horas cada</span>
            <select name="slot_step" [(ngModel)]="f.slot_step">
              @for (m of [5, 10, 15, 20, 30, 60]; track m) {
                <option [ngValue]="m">{{ m }} minutos</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Anticipación mínima</span>
            <select name="min_notice" [(ngModel)]="f.min_notice">
              @for (o of notices; track o.v) {
                <option [ngValue]="o.v">{{ o.l }}</option>
              }
            </select>
          </label>
        </div>
        <label class="field"><span>Se puede reservar hasta (días)</span><input name="max_days" type="number" min="1" max="180" [(ngModel)]="f.max_days" /></label>

        <h3>Recordatorio por WhatsApp</h3>
        <label class="field">
          <span>Mensaje</span>
          <textarea name="tpl" rows="4" [(ngModel)]="f.reminder_template"></textarea>
          <small>Usa {{ placeholders }}.</small>
        </label>
        <label class="field">
          <span>Enviar automáticamente</span>
          <select name="rh" [(ngModel)]="f.reminder_hours">
            @for (h of [2, 4, 12, 24, 48]; track h) {
              <option [ngValue]="h">{{ h }} horas antes</option>
            }
          </select>
          <small>{{ api.business()?.whatsapp_auto ? 'Envío automático conectado.' : 'Aplica cuando conectes la API oficial de WhatsApp.' }}</small>
        </label>
        <button class="btn accent" [disabled]="busy()">Guardar cambios</button>
      </form>

      <aside class="card share">
        <span class="eyebrow">Tu página de reservas</span>
        <h3>Compártela</h3>
        <p class="muted">Ponla en tu bio de Instagram, en Google Maps o imprime el QR para el local.</p>
        <div class="url">{{ url() }}</div>
        <div class="btns">
          <button class="btn soft sm" (click)="copy()">Copiar enlace</button>
          <a class="btn ghost sm" [href]="url()" target="_blank" rel="noopener">Abrir</a>
        </div>
        <img class="qr" [src]="qr()" alt="Código QR de la página de reservas" width="220" height="220" />
        <a class="link" [href]="qr()" download="qr-reservas.png" target="_blank">Descargar QR</a>
      </aside>
    </div>
  `,
  styles: `
    :host { display: block; padding: 22px clamp(14px, 3vw, 32px); }
    .bar { margin-bottom: 18px; }
    h1 { font-size: clamp(26px, 3.4vw, 36px); margin-top: 4px; }
    h3 { font-size: 20px; margin-top: 8px; }
    .layout { display: grid; grid-template-columns: 1fr 340px; gap: 16px; align-items: start; }
    .box { padding: 24px; display: grid; gap: 14px; }
    .box .btn { justify-self: start; }
    .colors { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .sw { width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--card); box-shadow: 0 0 0 1px var(--line-2); cursor: pointer; }
    .sw.sel { box-shadow: 0 0 0 2px var(--ink); }
    input[type=color] { width: 40px; height: 32px; border: 0; background: none; padding: 0; }
    .share { position: sticky; top: 16px; padding: 22px; display: grid; gap: 10px; justify-items: start; }
    .url { width: 100%; padding: 10px 12px; border-radius: 10px; background: var(--paper); font-size: 13px; font-weight: 700; word-break: break-all; }
    .btns { display: flex; gap: 8px; }
    .qr { justify-self: center; margin-top: 8px; border-radius: 12px; border: 1px solid var(--line); background: #fff; padding: 8px; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } .share { position: static; } }
  `,
})
export class Settings implements OnInit {
  protected api = inject(Api);
  private toast = inject(Toast);
  protected busy = signal(false);
  protected f: Partial<Business> = {};
  protected placeholders = '{cliente}, {servicio}, {negocio}, {fecha}, {hora} y {profesional}';
  protected colors = ['#B4532A', '#B0476E', '#2C7A7B', '#3D5A99', '#5B4BB7', '#6B8E3F', '#1F1A16', '#C98A3A'];
  protected notices = [
    { v: 0, l: 'Sin anticipación' },
    { v: 30, l: '30 minutos' },
    { v: 60, l: '1 hora' },
    { v: 120, l: '2 horas' },
    { v: 240, l: '4 horas' },
    { v: 1440, l: '1 día' },
  ];
  protected url = computed(() => `${location.origin}/reservar/${this.api.business()?.slug}`);
  protected qr = computed(() => `https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=8&data=${encodeURIComponent(this.url())}`);

  ngOnInit() {
    this.f = { ...this.api.business()! };
  }

  async save() {
    this.busy.set(true);
    try {
      const b = await this.api.patch<Business>('/business', {
        name: this.f.name,
        phone: this.f.phone || null,
        tagline: this.f.tagline || null,
        address: this.f.address || null,
        city: this.f.city || null,
        color: this.f.color,
        slot_step: this.f.slot_step,
        min_notice: this.f.min_notice,
        max_days: Number(this.f.max_days),
        reminder_hours: this.f.reminder_hours,
        reminder_template: this.f.reminder_template,
      });
      this.api.business.set(b);
      this.toast.show('Cambios guardados');
    } catch (e) {
      this.toast.show((e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.url());
      this.toast.show('Enlace copiado');
    } catch {
      this.toast.show(this.url());
    }
  }
}
