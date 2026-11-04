import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { Api } from './core/api';

const signedIn = async () => {
  const api = inject(Api);
  return (await api.restore()) || inject(Router).parseUrl('/entrar');
};

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing').then((m) => m.Landing) },
  { path: 'reservar/:slug', loadComponent: () => import('./pages/booking').then((m) => m.Booking) },
  { path: 'cita/:code', loadComponent: () => import('./pages/appointment-view').then((m) => m.AppointmentView) },
  { path: 'entrar', loadComponent: () => import('./pages/auth').then((m) => m.Login) },
  { path: 'crear-cuenta', loadComponent: () => import('./pages/auth').then((m) => m.Register) },
  {
    path: 'panel',
    canActivate: [signedIn],
    loadComponent: () => import('./panel/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'agenda' },
      { path: 'agenda', loadComponent: () => import('./panel/agenda').then((m) => m.Agenda) },
      { path: 'recordatorios', loadComponent: () => import('./panel/reminders').then((m) => m.Reminders) },
      { path: 'clientes', loadComponent: () => import('./panel/clients').then((m) => m.Clients) },
      { path: 'servicios', loadComponent: () => import('./panel/services').then((m) => m.Services) },
      { path: 'equipo', loadComponent: () => import('./panel/team').then((m) => m.Team) },
      { path: 'reportes', loadComponent: () => import('./panel/reports').then((m) => m.Reports) },
      { path: 'ajustes', loadComponent: () => import('./panel/settings').then((m) => m.Settings) },
    ],
  },
  { path: '**', loadComponent: () => import('./pages/not-found').then((m) => m.NotFound) },
];
