import Papa from "papaparse";
import { saveAs } from "file-saver";

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) return alert("No data available to export.");
  
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
};
