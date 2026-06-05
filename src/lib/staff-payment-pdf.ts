/**
 * Payment slip PDF generator for SIIF staff salary / honorarium payments.
 * Outgoing payment from SIIF — numbered SIIF-PAY-YYYY-NNNNN.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const monthLabel = (paymentMonth: string) => {
  const [year, month] = paymentMonth.slice(0, 7).split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const amountWords = (amount: number): string => {
  if (amount === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = convert(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
  return result + ' Only';
};

export interface PaymentSlipDetails {
  paymentNumber: string;
  paymentDate: string;
  paymentMonth: string;
  staffName: string;
  designation: string;
  paymentType: 'salary' | 'honorarium';
  amount: number;
  paymentMode: string;
  transactionReference?: string | null;
  paidBy?: string | null;
  remarks?: string | null;
  logoDataUrl?: string;
}

export const downloadPaymentSlipPdf = (details: PaymentSlipDetails) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──────────────────────────────────────────────
  const headerTop = 24;
  const logoSize = 52;

  if (details.logoDataUrl) {
    doc.addImage(details.logoDataUrl, 'PNG', 32, headerTop, logoSize, logoSize);
  }

  const textX = 32 + logoSize + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(220, 38, 38);
  doc.text('SJCET Innovation and Incubation Foundation', textX, headerTop + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text("St.Joseph's College of Engineering & Technology Palai, Choondacherry PO, Meenachil Taluk,", textX, headerTop + 30);
  doc.text('Kottayam, Kerala, India, 686579', textX, headerTop + 42);

  // Divider
  const dividerY = headerTop + logoSize + 10;
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(1.5);
  doc.line(32, dividerY, pageWidth - 32, dividerY);

  // Centered title
  const slipTitle = details.paymentType === 'honorarium' ? 'Honorarium Payment Slip' : 'Salary Payment Slip';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  const titleW = doc.getTextWidth(slipTitle);
  doc.text(slipTitle, (pageWidth - titleW) / 2, dividerY + 20);

  // ── Payment details table ────────────────────────────────
  const amountFormatted = `INR ${Number(details.amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const paymentModeFormatted = (details.paymentMode || '').replace(/_/g, ' ').toUpperCase();

  autoTable(doc, {
    startY: dividerY + 40,
    head: [['Details', 'Information']],
    body: [
      ['Payment Number', details.paymentNumber],
      ['Payment Date', details.paymentDate],
      ['Payment Month', monthLabel(details.paymentMonth)],
      ['Staff Name', details.staffName],
      ['Designation', details.designation],
      ['Payment Type', details.paymentType.charAt(0).toUpperCase() + details.paymentType.slice(1)],
      ['Amount', amountFormatted],
      ['Amount in Words', amountWords(Number(details.amount))],
      ['Payment Mode', paymentModeFormatted],
      ['Transaction Reference', details.transactionReference || 'N/A'],
      ...(details.remarks ? [['Remarks', details.remarks]] : []),
    ],
    theme: 'grid',
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 180 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 40, right: 40 },
  });

  // Electronic notice
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || dividerY + 220;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  const notice = 'This is an electronically generated payment slip. No signature is required.';
  const noticeW = doc.getTextWidth(notice);
  doc.text(notice, (pageWidth - noticeW) / 2, finalY + 24);

  doc.save(`${details.paymentNumber}.pdf`);
};
