import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type FeeSettingStatus = 'active' | 'inactive';
export type DepositStatus = 'pending' | 'collected' | 'partially_refunded' | 'refunded';
export type InvoiceStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue';
export type CollectionType =
  | 'monthly_fee'
  | 'refundable_deposit'
  | 'additional_charges'
  | 'penalty_charges'
  | 'other_fees'
  | 'deposit_refund';
export type PaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';

export type FeeSettingRecord = {
  id: string;
  company_id: string;
  monthly_fee: number;
  refundable_deposit: number;
  deposit_collection_date: string | null;
  deposit_status: DepositStatus;
  start_date: string;
  due_day: number;
  grace_period_days: number;
  status: FeeSettingStatus;
  created_at?: string;
  updated_at?: string;
};

export type InvoiceRecord = {
  id: string;
  company_id: string;
  invoice_number: string;
  billing_month: string;
  amount: number;
  amount_paid: number;
  due_date: string;
  status: InvoiceStatus;
  remarks: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DepositRecord = {
  id: string;
  company_id: string;
  deposit_amount: number;
  amount_collected: number;
  amount_refunded: number;
  balance_amount: number;
  collection_date: string | null;
  refund_date: string | null;
  status: DepositStatus;
  remarks: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CollectionRecord = {
  id: string;
  company_id: string;
  receipt_number: string;
  collection_type: CollectionType;
  invoice_id: string | null;
  deposit_id: string | null;
  collection_date: string;
  amount_collected: number;
  payment_mode: PaymentMode;
  transaction_reference: string | null;
  collected_by: string | null;
  remarks: string | null;
  attachment_url: string | null;
  status: 'recorded' | 'cancelled';
  created_at?: string;
};

export const COLLECTION_TYPE_OPTIONS: Array<{ value: CollectionType; label: string }> = [
  { value: 'monthly_fee', label: 'Monthly Incubation Fee' },
  { value: 'refundable_deposit', label: 'Refundable Deposit' },
  { value: 'additional_charges', label: 'Additional Charges' },
  { value: 'penalty_charges', label: 'Penalty Charges' },
  { value: 'other_fees', label: 'Other Fees' },
  { value: 'deposit_refund', label: 'Deposit Refund' },
];

export const PAYMENT_MODE_OPTIONS: Array<{ value: PaymentMode; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  pending: '#F59E0B',
  partially_paid: '#2AA0D3',
  paid: '#16A34A',
  overdue: '#DC2626',
};

export const DEPOSIT_STATUS_COLORS: Record<DepositStatus, string> = {
  pending: '#F59E0B',
  collected: '#16A34A',
  partially_refunded: '#2AA0D3',
  refunded: '#6B7280',
};

export const formatCurrency = (amount: number | null | undefined) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

export const formatBillingMonth = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export const getMonthKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const buildInvoiceNumber = (companyId: string, billingMonth: string | Date) => {
  return `INV-${companyId.slice(0, 8).toUpperCase()}-${getMonthKey(billingMonth).replace('-', '')}`;
};

export const buildReceiptNumber = () => {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  return `RCPT-${timestamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

export const computeInvoiceStatus = ({
  amount,
  amountPaid,
  dueDate,
  gracePeriodDays,
}: {
  amount: number;
  amountPaid: number;
  dueDate: string;
  gracePeriodDays: number;
}): InvoiceStatus => {
  if (amountPaid >= amount) return 'paid';

  const due = new Date(dueDate);
  due.setDate(due.getDate() + gracePeriodDays);
  const now = new Date();

  if (amountPaid > 0) {
    return now > due ? 'overdue' : 'partially_paid';
  }

  return now > due ? 'overdue' : 'pending';
};

export const computeDepositStatus = ({
  depositAmount,
  amountCollected,
  amountRefunded,
}: {
  depositAmount: number;
  amountCollected: number;
  amountRefunded: number;
}): DepositStatus => {
  if (amountRefunded >= amountCollected && amountCollected > 0) return 'refunded';
  if (amountRefunded > 0) return 'partially_refunded';
  if (amountCollected >= depositAmount && depositAmount > 0) return 'collected';
  return 'pending';
};

export const exportCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const normalizePdfCell = (cell: string | number): string | number => {
  if (typeof cell === 'number') return cell;
  return cell.replace(/₹\s?/g, 'INR ');
};

export const downloadReceiptPdf = (details: {
  receiptNumber: string;
  receiptDate: string;
  companyName: string;
  collectionType: string;
  invoiceNumber?: string | null;
  billingMonth?: string | null;
  depositReference?: string | null;
  amountPaid: number;
  paymentMode: string;
  transactionReference?: string | null;
  receivedBy?: string | null;
}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFontSize(20);
  doc.setTextColor(220, 38, 38);
  doc.text('SIIF Incubator Receipt', 40, 50);
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text('St. Joseph\'s College of Engineering and Technology, Palai', 40, 70);

  autoTable(doc, {
    startY: 100,
    head: [['Field', 'Value']],
    body: [
      ['Receipt Number', details.receiptNumber],
      ['Receipt Date', details.receiptDate],
      ['Company Name', details.companyName],
      ['Collection Type', details.collectionType],
      ['Invoice Number', details.invoiceNumber || 'N/A'],
      ['Billing Month', details.billingMonth || 'N/A'],
      ['Deposit Reference', details.depositReference || 'N/A'],
      ['Amount Paid', formatCurrency(details.amountPaid)],
      ['Payment Mode', details.paymentMode],
      ['Transaction Reference', details.transactionReference || 'N/A'],
      ['Received By', details.receivedBy || 'N/A'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [255, 59, 59] },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });

  doc.text('Authorized Signatory', 40, doc.internal.pageSize.getHeight() - 50);
  doc.save(`${details.receiptNumber}.pdf`);
};

export const downloadReportPdf = ({
  title,
  headers,
  rows,
  logoDataUrl,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  logoDataUrl?: string;
}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header block ---
  const headerTop = 24;
  const logoSize = 52;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 32, headerTop, logoSize, logoSize);
  }
  const textX = logoDataUrl ? 32 + logoSize + 12 : 32;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(220, 38, 38);
  doc.text('SJCET Innovation and Incubation Foundation (SIIF)', textX, headerTop + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(
    "St.Joseph's College of Engineering & Technology Palai, Choondacherry PO, Meenachil Taluk,",
    textX,
    headerTop + 30
  );
  doc.text('Kottayam, Kerala, India, 686579.', textX, headerTop + 42);

  // Divider
  const dividerY = headerTop + logoSize + 10;
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(1.5);
  doc.line(32, dividerY, pageWidth - 32, dividerY);

  // Report title + timestamp
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text(title, 32, dividerY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 32, dividerY + 30);

  // --- Table ---
  autoTable(doc, {
    startY: dividerY + 44,
    head: [headers],
    body: rows.map((row) => row.map(normalizePdfCell)),
    theme: 'grid',
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    styles: { fontSize: 9, cellPadding: 5 },
    margin: { left: 30, right: 30 },
  });

  // --- Footer with page numbers ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `SIIF - Confidential | Page ${i} of ${pageCount}`,
      32,
      doc.internal.pageSize.getHeight() - 18
    );
  }

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
};
