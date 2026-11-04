import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'v-not-found',
  imports: [RouterLink],
  template: `
    <main>
      <span class="eyebrow">Error 404</span>
      <h1>Esta página se fue sin cita.</h1>
      <p class="muted">El enlace puede estar mal escrito o el negocio cambió su dirección.</p>
      <a routerLink="/" class="btn accent">Volver al inicio</a>
    </main>
  `,
  styles: `
    main { min-height: 100vh; display: grid; place-content: center; justify-items: center; gap: 16px; text-align: center; padding: 24px; }
    h1 { font-size: clamp(34px, 6vw, 60px); max-width: 14ch; }
  `,
})
export class NotFound {}
