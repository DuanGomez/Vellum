export type Kind = 'barberia' | 'estetica' | 'odontologia' | 'otro';
export type Status = 'confirmada' | 'atendida' | 'no_asistio' | 'cancelada';

export interface Business {
  id: number;
  slug: string;
  name: string;
  kind: Kind;
  tagline: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  color: string;
  slot_step: number;
  min_notice: number;
  max_days: number;
  is_demo: boolean;
  reminder_hours?: number;
  reminder_template?: string;
  whatsapp_auto?: boolean;
}

export interface Service {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  duration: number;
  price: number;
  active: boolean;
  professionals: number[] | null;
}

export interface ScheduleRange {
  weekday: number;
  start: string;
  end: string;
}

export interface TimeOff {
  id: number;
  professional_id?: number;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface Professional {
  id: number;
  name: string;
  title: string | null;
  color: string;
  photo_url: string | null;
  active: boolean;
  services: number[] | null;
  schedules?: ScheduleRange[];
  time_offs?: TimeOff[];
}

export interface Appointment {
  id: number;
  code: string;
  starts_at: string;
  ends_at: string;
  status: Status;
  price: number;
  service: { id: number; name: string; duration: number };
  professional: { id: number; name: string; color: string };
  client: { id: number; name: string; phone?: string; email?: string | null };
  notes?: string | null;
  source?: 'online' | 'panel';
  reminder_sent_at?: string | null;
  reminder_link?: string;
  message?: string;
  business?: Business;
}

export interface Slot {
  time: string;
  professionals: number[];
}

export interface Session {
  token: string;
  user: { id: number; name: string; email: string; role: string };
  business: Business;
}

export const KIND_LABEL: Record<Kind, string> = {
  barberia: 'Barbería',
  estetica: 'Estética',
  odontologia: 'Odontología',
  otro: 'Otro',
};

export const STATUS_LABEL: Record<Status, string> = {
  confirmada: 'Confirmada',
  atendida: 'Atendida',
  no_asistio: 'No asistió',
  cancelada: 'Cancelada',
};
