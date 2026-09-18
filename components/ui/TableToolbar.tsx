import { exportToCSV } from "@/lib/utils/exportManager";

interface TableToolbarProps {
  title: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  exportData: any[];
  exportFilename: string;
}

export function TableToolbar({ title, searchQuery, setSearchQuery, exportData, exportFilename }: TableToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center bg-[#12141C] p-4 border-b border-[#272B36] gap-4">
      <h3 className="text-sm font-black text-white uppercase tracking-wide">{title}</h3>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="relative w-full sm:w-64">
          <input 
            type="text" 
            placeholder="Search records..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs p-2.5 pl-3 rounded-lg bg-[#0F1117] border border-[#2B3142] text-white focus:border-[#FF5A00] outline-none transition-all"
          />
        </div>
        <button 
          onClick={() => exportToCSV(exportData, exportFilename)}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-all border border-slate-600 flex-shrink-0"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
