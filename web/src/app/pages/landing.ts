import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, ApiError } from '../core/api';
import { Session } from '../core/models';
import { Toast } from '../core/toast';

interface Demo {
  kind: 'barberia' | 'estetica' | 'odontologia';
  slug: string;
  name: string;
  label: string;
  color: string;
  blurb: string;
  services: string[];
}

@Component({
  selector: 'v-landing',
  imports: [RouterLink],
  template: `
    <header class="top">
      <a routerLink="/" class="brand"><span class="mark">V</span>Vellum</a>
      <nav>
        <a href="#rubros">Rubros</a>
        <a href="#como">Cómo funciona</a>
        <a href="#whatsapp">Recordatorios</a>
      </nav>
      <div class="cta">
        <a routerLink="/entrar" class="btn ghost sm">Entrar</a>
        <a routerLink="/crear-cuenta" class="btn sm">Crear mi agenda</a>
      </div>
    </header>

    <section class="hero">
      <div class="copy">
        <span class="eyebrow">Agenda para barberías, estéticas y consultorios</span>
        <h1>Tu agenda,<br /><em>sin enredos.</em></h1>
        <p class="lead">
          Tus clientes reservan solos a cualquier hora, cada profesional tiene su horario
          y Vellum les recuerda la cita por WhatsApp. Tú solo atiendes.
        </p>
        <div class="actions">
          <button class="btn accent lg" (click)="enter('barberia')" [disabled]="busy()">Probar la demo</button>
          <a routerLink="/reservar/navaja-y-oficio" class="btn ghost lg">Ver página de reservas</a>
        </div>
        <ul class="ticks">
          <li>Sin instalar nada</li>
          <li>Funciona en el celular</li>
          <li>Pensado para Colombia</li>
        </ul>
      </div>

      <div class="paper" aria-hidden="true">
        <div class="sheet">
          <div class="sheet-head">
            <div>
              <span class="small">Hoy · jueves</span>
              <strong class="serif">Navaja &amp; Oficio</strong>
            </div>
            <span class="chip confirmada">14 citas</span>
          </div>
          <div class="cols">
            @for (col of mock; track col.name) {
              <div class="col">
                <div class="who"><span class="avatar" [style.background]="col.color">{{ col.name[0] }}</span>{{ col.name }}</div>
                @for (a of col.items; track a.t) {
                  <div class="appt" [style.--c]="col.color" [style.height.px]="a.h">
                    <b>{{ a.t }}</b><span>{{ a.s }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
        <div class="bubble">
          <span class="wa">WhatsApp</span>
          Hola Andrés 👋 Te recordamos tu cita de <b>Corte + barba</b> mañana a las <b>10:20 a. m.</b> con Julián.
        </div>
      </div>
    </section>

    <section id="rubros" class="band">
      <div class="head">
        <span class="eyebrow">Tres rubros, una agenda</span>
        <h2>Entra a una demo real</h2>
        <p class="muted">Cada demo trae su equipo, servicios y un mes de citas. Cambia lo que quieras: se reinicia sola cada día.</p>
      </div>
      <div class="demos">
        @for (d of demos; track d.kind) {
          <article class="demo card" [style.--accent]="d.color">
            <span class="eyebrow">{{ d.label }}</span>
            <h3>{{ d.name }}</h3>
            <p class="muted">{{ d.blurb }}</p>
            <ul>
              @for (s of d.services; track s) {
                <li>{{ s }}</li>
              }
            </ul>
            <div class="row">
              <button class="btn accent sm" (click)="enter(d.kind)" [disabled]="busy()">Abrir el panel</button>
              <a class="btn ghost sm" [routerLink]="['/reservar', d.slug]">Reservar como cliente</a>
            </div>
          </article>
        }
      </div>
    </section>

    <section id="como" class="steps">
      <div class="head">
        <span class="eyebrow">Cómo funciona</span>
        <h2>De la reserva al recordatorio</h2>
      </div>
      <ol>
        <li>
          <span class="n">1</span>
          <h3>Comparte tu enlace</h3>
          <p class="muted">Ponlo en tu Instagram, en Google o en el QR del local. Tu página muestra servicios, precios y equipo.</p>
        </li>
        <li>
          <span class="n">2</span>
          <h3>El cliente elige su hora</h3>
          <p class="muted">Solo ve horas libres de verdad: Vellum cruza horarios, descansos, duración del servicio y citas tomadas.</p>
        </li>
        <li>
          <span class="n">3</span>
          <h3>Tú lo ves en tu agenda</h3>
          <p class="muted">Una columna por profesional, cambios con un toque y estados para saber quién vino y quién no.</p>
        </li>
      </ol>
    </section>

    <section id="whatsapp" class="wa-band">
      <div>
        <span class="eyebrow">Recordatorios por WhatsApp</span>
        <h2>Menos sillas vacías</h2>
        <p>
          Cada tarde ves las citas de mañana con el mensaje listo para enviar con un toque.
          Si conectas la API oficial de WhatsApp, Vellum los envía solo a la hora que elijas.
        </p>
        <ul class="ticks light">
          <li>Plantilla de mensaje a tu estilo</li>
          <li>Marca quién ya fue recordado</li>
          <li>Reportes de inasistencia</li>
        </ul>
      </div>
      <div class="phone" aria-hidden="true">
        <div class="msg in">Hola Valentina 👋 Te recordamos tu cita de <b>Limpieza facial</b> mañana a las <b>3:00 p. m.</b> con Catalina en Alma Estética.</div>
        <div class="msg out">¡Gracias! Allá estaré 🙌</div>
      </div>
    </section>

    <section class="final">
      <h2>Empieza hoy con tu negocio</h2>
      <p class="muted">Crea tu cuenta y Vellum te propone servicios y horarios según tu rubro. Los ajustas en cinco minutos.</p>
      <a routerLink="/crear-cuenta" class="btn accent lg">Crear mi agenda gratis</a>
    </section>

    <footer>
      <span>Vellum · hecho en Medellín por <a href="https://dcodea.pages.dev" target="_blank" rel="noopener">Dcodea</a></span>
      <a href="https://github.com/DuanGomez/Vellum" target="_blank" rel="noopener">Código en GitHub</a>
    </footer>

    @if (api.waking()) {
      <div class="toast">Despertando el servidor… tarda unos segundos la primera vez</div>
    }
  `,
  styleUrl: './landing.scss',
})
export class Landing {
  protected api = inject(Api);
  private router = inject(Router);
  private toast = inject(Toast);
  protected busy = signal(false);

  protected demos: Demo[] = [
    {
      kind: 'barberia',
      slug: 'navaja-y-oficio',
      name: 'Navaja & Oficio',
      label: 'Barbería',
      color: '#B4532A',
      blurb: 'Tres barberos, cortes y barba. Uno descansa los lunes y abre los domingos.',
      services: ['Corte clásico · 40 min', 'Corte + barba · 60 min', 'Afeitado tradicional · 40 min'],
    },
    {
      kind: 'estetica',
      slug: 'estetica-alma',
      name: 'Alma Estética',
      label: 'Estética',
      color: '#B0476E',
      blurb: 'Facial, uñas, cejas y masajes, con sesiones largas y cortas en la misma agenda.',
      services: ['Limpieza facial · 75 min', 'Manicure semipermanente · 60 min', 'Lifting de pestañas · 60 min'],
    },
    {
      kind: 'odontologia',
      slug: 'sonrisa-clara',
      name: 'Sonrisa Clara',
      label: 'Odontología',
      color: '#2C7A7B',
      blurb: 'Dos odontólogos con especialidades distintas y citas cada 15 minutos.',
      services: ['Valoración · 30 min', 'Limpieza y profilaxis · 45 min', 'Blanqueamiento · 90 min'],
    },
  ];

  protected mock = [
    {
      name: 'Julián',
      color: '#B4532A',
      items: [
        { t: '9:00', s: 'Corte clásico', h: 54 },
        { t: '10:20', s: 'Corte + barba', h: 72 },
        { t: '11:40', s: 'Cejas', h: 30 },
      ],
    },
    {
      name: 'Kevin',
      color: '#3F6C8E',
      items: [
        { t: '9:20', s: 'Arreglo de barba', h: 44 },
        { t: '10:00', s: 'Corte infantil', h: 44 },
        { t: '11:00', s: 'Afeitado', h: 54 },
      ],
    },
  ];

  async enter(kind: Demo['kind']) {
    this.busy.set(true);
    try {
      this.api.start(await this.api.post<Session>('/auth/demo', { kind }));
      await this.router.navigateByUrl('/panel/agenda');
    } catch (e) {
      this.toast.show((e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }
}
