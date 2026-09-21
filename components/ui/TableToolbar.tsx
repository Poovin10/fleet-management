import { exportToCSV } from "@/lib/utils/exportManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TableToolbarProps {
  title: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  exportData: any[];
  exportFilename: string;
}

export function TableToolbar({
  title,
  searchQuery,
  setSearchQuery,
  exportData,
  exportFilename,
}: TableToolbarProps) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-b border-border bg-white/[0.015] p-4 sm:flex-row">
      <h3 className="text-sm font-semibold tracking-wide text-fg">
        {title}
      </h3>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <div className="w-full sm:w-64">
          <Input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={() => exportToCSV(exportData, exportFilename)}
          className="shrink-0"
        >
          Export CSV
        </Button>
      </div>
    </div>
  );
}
