import { useState, useCallback, useRef, useEffect } from "react";

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  initialPosition?: Position;
  bounds?: "viewport" | "parent" | null;
  storageKey?: string; // localStorage key for persistence
  getDefaultPosition?: () => Position; // Function to compute default position dynamically
}

export const useDraggable = (options: UseDraggableOptions = {}) => {
  const { 
    initialPosition = { x: 0, y: 0 }, 
    bounds = "viewport",
    storageKey,
    getDefaultPosition
  } = options;
  
  // Initialize position from storage or compute default
  const getInitialPosition = useCallback((): Position => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return parsed;
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    // Use dynamic default position if provided, otherwise static initial
    return getDefaultPosition ? getDefaultPosition() : initialPosition;
  }, [storageKey, getDefaultPosition, initialPosition]);

  const [position, setPosition] = useState<Position>(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isPositioned, setIsPositioned] = useState(!!storageKey && !!localStorage.getItem(storageKey || ''));
  const dragRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<Position>({ x: 0, y: 0 });

  // Mark as positioned after first render
  useEffect(() => {
    if (!isPositioned) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        setIsPositioned(true);
      });
    }
  }, [isPositioned]);

  // Persist position to localStorage when dragging ends
  useEffect(() => {
    if (storageKey && !isDragging && isPositioned) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(position));
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [position, isDragging, storageKey, isPositioned]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    
    const rect = dragRef.current.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;

      let newX = e.clientX - offsetRef.current.x;
      let newY = e.clientY - offsetRef.current.y;

      // Apply viewport bounds
      if (bounds === "viewport") {
        const rect = dragRef.current.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        // Ensure card stays at least 100px visible on screen
        newX = Math.max(-rect.width + 100, Math.min(maxX + rect.width - 100, newX));
        newY = Math.max(0, Math.min(maxY, newY));
      }

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, bounds]);

  const resetToDefault = useCallback(() => {
    const defaultPos = getDefaultPosition ? getDefaultPosition() : initialPosition;
    setPosition(defaultPos);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        // Ignore
      }
    }
  }, [getDefaultPosition, initialPosition, storageKey]);

  return {
    position,
    setPosition,
    isDragging,
    isPositioned,
    dragRef,
    resetToDefault,
    dragHandleProps: {
      onMouseDown: handleMouseDown,
      style: { cursor: isDragging ? "grabbing" : "grab" },
    },
  };
};
