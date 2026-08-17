import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Parser as CsvParser } from "json2csv";
import { MOOD_LABEL, MoodLevel } from "../types/enums";

export interface ReportRow {
  employeeName: string;
  employeeCode: string;
  department: string;
  subDepartment: string;
  manager: string;
  date: string;
  mood: string;
  comment: string;
}

export function rowsToCsv(rows: ReportRow[]): string {
  const parser = new CsvParser({
    fields: ["employeeName", "employeeCode", "department", "subDepartment", "manager", "date", "mood", "comment"],
  });
  return parser.parse(rows);
}

export async function rowsToExcelBuffer(rows: ReportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Mood Report");
  sheet.columns = [
    { header: "Employee", key: "employeeName", width: 24 },
    { header: "Employee ID", key: "employeeCode", width: 14 },
    { header: "Department", key: "department", width: 18 },
    { header: "Sub-department", key: "subDepartment", width: 20 },
    { header: "Manager", key: "manager", width: 20 },
    { header: "Date", key: "date", width: 14 },
    { header: "Mood", key: "mood", width: 14 },
    { header: "Comment", key: "comment", width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function rowsToPdfBuffer(rows: ReportRow[], title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(title, { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor("#555").text(`Generated ${new Date().toLocaleString()}`);
    doc.moveDown(1);

    const colWidths = [110, 70, 90, 90, 90, 70, 60, 170];
    const headers = ["Employee", "ID", "Department", "Sub-dept", "Manager", "Date", "Mood", "Comment"];
    let y = doc.y;
    doc.fontSize(9).fillColor("#000");
    headers.forEach((h, i) => {
      const x = 36 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(h, x, y, { width: colWidths[i], continued: false });
    });
    doc.moveDown(0.5);

    rows.forEach((row) => {
      y = doc.y;
      if (y > 520) {
        doc.addPage();
        y = doc.y;
      }
      const values = [
        row.employeeName,
        row.employeeCode,
        row.department,
        row.subDepartment,
        row.manager,
        row.date,
        row.mood,
        row.comment,
      ];
      values.forEach((v, i) => {
        const x = 36 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.fontSize(8).text(v ?? "", x, y, { width: colWidths[i] });
      });
      doc.moveDown(0.6);
    });

    doc.end();
  });
}

export function moodDisplay(mood: string): string {
  return MOOD_LABEL[mood as MoodLevel] ?? mood;
}
