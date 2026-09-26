import * as XLSX from "xlsx";
import Papa from "papaparse";
import { saveAs } from "file-saver";

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) return alert("No data available to export.");
  
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
};

export const exportToExcel = (data: any[], filename: string) => {
  if (!data || data.length === 0) return alert("No data available to export.");

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(
    workbook,
    `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`
  );
};
