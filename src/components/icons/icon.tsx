import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  Ban, Check, CircleAlert, CircleCheck, Clock3, Download, Eye, FileDown, Filter, Pencil, Plus, Printer,
  RefreshCw, Save, Search, Trash2, Upload, X, type LucideIcon,
} from './glyphs';

const actions = {
  add: Plus, approve: Check, cancel: X, close: X, delete: Trash2, download: Download,
  edit: Pencil, export: FileDown, filter: Filter, print: Printer, refresh: RefreshCw,
  reject: X, save: Save, search: Search, upload: Upload, view: Eye, warning: CircleAlert,
};

export type IconPalette = keyof typeof iconPalette;
export const iconPalette = {
  general: '#6366F1', innovation: '#8B5CF6', workspace: '#3B82F6', finance: '#10B981',
  payments: '#F59E0B', documents: '#64748B', events: '#EC4899', analytics: '#06B6D4',
};

export type DashboardArtwork =
  | 'applications' | 'reviewers' | 'directory' | 'configuration'
  | 'invoices' | 'payments' | 'deposits' | 'transactions'
  | 'receipts' | 'notifications' | 'overview' | 'reports'
  | 'ledger' | 'staff-payments' | 'conference' | 'workspace';

export function ActionIcon({ name, className }: { name: keyof typeof actions; className?: string }) {
  const Glyph = actions[name];
  return <Glyph aria-hidden="true" focusable="false" strokeWidth={1.75} className={cn('app-action-icon', className)} />;
}

export function NavigationIcon({ icon: Glyph, className }: { icon: LucideIcon; className?: string }) {
  return <Glyph aria-hidden="true" focusable="false" size={20} strokeWidth={1.75} className={cn('shrink-0', className)} />;
}

export function InvoiceStatusIcon({ status }: { status: string }) {
  const Glyph = status === 'paid' ? CircleCheck : status === 'overdue' ? CircleAlert : status === 'void' ? Ban : Clock3;
  return <Glyph aria-hidden="true" focusable="false" strokeWidth={1.75} className="size-3.5 shrink-0" />;
}

export function ModuleIcon({ icon: Glyph, palette = 'general', className }: {
  icon: LucideIcon;
  palette?: IconPalette;
  className?: string;
}) {
  const accent = iconPalette[palette];
  return <svg className={cn('size-10 shrink-0', className)} viewBox="0 0 40 40" aria-hidden="true" focusable="false" style={{ color: accent }}>
    <rect x="1" y="1" width="38" height="38" rx="12" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeOpacity=".25" />
    <path d="M28 39h-8V26a6 6 0 0 1 6-6h13v8a11 11 0 0 1-11 11Z" fill="currentColor" fillOpacity=".13" />
    <Glyph x="9" y="9" width="22" height="22" strokeWidth={1.75} className="app-module-glyph" />
  </svg>;
}

export function DashboardIcon({ artwork, palette }: { artwork: DashboardArtwork; palette: IconPalette }) {
  return <span className="app-dashboard-icon" style={{ backgroundColor: `${iconPalette[palette]}16` }}>
    <Image src={`/assets/icons/dashboard/${artwork}.webp`} width={56} height={56} alt="" unoptimized />
  </span>;
}
