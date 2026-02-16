/**
 * Deterministic tree layout algorithm for org chart.
 *
 * Builds a coordinate map from org_chart_edges (parent→children adjacency).
 * Parent is centered above its children; siblings are laid out left→right
 * sorted by position_index. Subtree widths prevent overlaps.
 *
 * All coordinates are in canvas-space pixels.
 */

// ── Layout constants (exported so canvas can reuse) ──
export const CARD_W = 180;
export const CARD_H = 90;
export const GAP_X = 50;
export const GAP_Y = 70;

/** Anchor Y for the company icon row (root sits one level below) */
export const COMPANY_Y = 80;
export const ROOT_Y = COMPANY_Y + CARD_H + GAP_Y; // first contact row

export interface TreeNodePosition {
  contactId: string;
  x: number;
  y: number;
  depth: number;
}

/**
 * Compute deterministic positions for every contact in the tree.
 *
 * @param rootContactId  – the contact whose parent_contact_id is null
 * @param childrenMap    – parentId → sorted child ids (already sorted by position_index)
 * @param anchorX        – horizontal center for the root node (typically canvasWidth / 2)
 * @returns Map<contactId, TreeNodePosition>
 */
export function computeTreeLayout(
  rootContactId: string | null,
  childrenMap: Map<string, string[]>,
  anchorX: number,
): Map<string, TreeNodePosition> {
  const positions = new Map<string, TreeNodePosition>();

  if (!rootContactId) return positions;

  // 1. Compute subtree widths (in "slots") bottom-up
  const subtreeWidth = new Map<string, number>();

  const getWidth = (id: string): number => {
    if (subtreeWidth.has(id)) return subtreeWidth.get(id)!;
    const kids = childrenMap.get(id) || [];
    if (kids.length === 0) {
      subtreeWidth.set(id, 1);
      return 1;
    }
    const w = kids.reduce((sum, kid) => sum + getWidth(kid), 0);
    subtreeWidth.set(id, w);
    return w;
  };

  getWidth(rootContactId);

  // 2. Assign coordinates top-down
  const slotWidth = CARD_W + GAP_X; // px per slot

  const assign = (id: string, centerX: number, depth: number) => {
    const y = ROOT_Y + depth * (CARD_H + GAP_Y);
    positions.set(id, { contactId: id, x: centerX, y, depth });

    const kids = childrenMap.get(id) || [];
    if (kids.length === 0) return;

    // Total width of children subtrees in px
    const totalSlots = kids.reduce((s, kid) => s + getWidth(kid), 0);
    const totalW = totalSlots * slotWidth;
    let cursor = centerX - totalW / 2;

    kids.forEach((kid) => {
      const kidSlots = getWidth(kid);
      const kidW = kidSlots * slotWidth;
      const kidCenterX = cursor + kidW / 2;
      assign(kid, kidCenterX, depth + 1);
      cursor += kidW;
    });
  };

  assign(rootContactId, anchorX, 0);

  return positions;
}

/**
 * For contacts that are NOT in the tree (no edge row), place them in a
 * horizontal row below the tree so they are visible but clearly "unlinked".
 */
export function computeUnlinkedPositions(
  unlinkedIds: string[],
  treePositions: Map<string, TreeNodePosition>,
  anchorX: number,
): Map<string, TreeNodePosition> {
  const out = new Map<string, TreeNodePosition>();
  if (unlinkedIds.length === 0) return out;

  // Find max Y from tree to place unlinked below
  let maxY = ROOT_Y;
  treePositions.forEach((p) => {
    if (p.y > maxY) maxY = p.y;
  });

  const startY = maxY + CARD_H + GAP_Y * 2;
  const slotWidth = CARD_W + GAP_X;
  const totalW = unlinkedIds.length * slotWidth;
  let cursor = anchorX - totalW / 2;

  unlinkedIds.forEach((id) => {
    const cx = cursor + slotWidth / 2;
    out.set(id, { contactId: id, x: cx, y: startY, depth: -1 });
    cursor += slotWidth;
  });

  return out;
}
