import { useState, useCallback, useRef } from "react";

export interface ColumnConfig {
  id: string;
  label: string;
  category?: string;
  minWidth: number;
  defaultWidth: number;
  visible: boolean;
}

export function useResizableColumns(initialColumns: ColumnConfig[]) {
  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    initialColumns.forEach((col) => {
      widths[col.id] = col.defaultWidth;
    });
    return widths;
  });

  const resizingRef = useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (columnId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const startWidth = columnWidths[columnId] || 100;
      resizingRef.current = {
        columnId,
        startX: e.clientX,
        startWidth,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizingRef.current) return;
        
        const diff = moveEvent.clientX - resizingRef.current.startX;
        const column = columns.find((c) => c.id === resizingRef.current!.columnId);
        const minWidth = column?.minWidth || 50;
        const newWidth = Math.max(minWidth, resizingRef.current.startWidth + diff);
        
        setColumnWidths((prev) => ({
          ...prev,
          [resizingRef.current!.columnId]: newWidth,
        }));
      };

      const handleMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [columnWidths, columns]
  );

  const toggleColumnVisibility = useCallback((columnId: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  }, []);

  const setAllColumnsVisibility = useCallback((visible: boolean) => {
    setColumns((prev) => prev.map((col) => ({ ...col, visible })));
  }, []);

  const setColumnsVisibility = useCallback((visibleColumnIds: string[]) => {
    const visibleSet = new Set(visibleColumnIds);
    setColumns((prev) =>
      prev.map((col) => ({ ...col, visible: visibleSet.has(col.id) }))
    );
  }, []);

  const visibleColumns = columns.filter((col) => col.visible);

  return {
    columns,
    columnWidths,
    visibleColumns,
    handleResizeStart,
    toggleColumnVisibility,
    setAllColumnsVisibility,
    setColumnsVisibility,
  };
}
