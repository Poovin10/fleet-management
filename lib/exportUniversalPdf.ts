// lib/exportUniversalPdf.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateUniversalPdf(title: string, subtitle: string, headers: string[], rows: any[][], filename: string) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.setTextColor(255, 90, 0); // KSS Brand Orange
  doc.text("KSS ROADWAYS PRIVATE LIMITED", 14, 20);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(title, 14, 27);

  // Subtitle / Date Meta
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(subtitle, 14, 36);

  // Data Table
  autoTable(doc, {
    startY: 42,
    head: [headers],
    body: rows.length > 0 ? rows : [headers.map(() => 'No data available')],
    theme: 'grid',
    headStyles: { fillColor: [18, 20, 28] },
    styles: { fontSize: 8 }
  });

  // Save PDF file
  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
}
