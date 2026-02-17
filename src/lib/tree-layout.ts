/**
 * Deterministic tree layout engine for org charts.
 *
 * Algorithm (Reingold–Tilford-style, simplified):
 *   1. Build an internal tree from flat parent/child data.
 *   2. Bottom-up: compute subtree widths.
 *   3. Top-down: assign x positions so each parent is centered above its children.
 *   4. y positions are computed from depth level with fixed vertical spacing.
 *
 * All positions are in canvas-space pixels.
 */

export interface TreeNodePosition {
  contactId: string;
  x: number;
  y: number;
  depth: number;
  parentContactId: string | null;
}

export interface TreeLayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  horizontalGap: number;
  verticalGap: number;
  /** Y offset for the root node (below company icon) */
  rootY: number;
  /** X center of the canvas / root node */
  centerX: number;
}

const DEFAULT_CONFIG: TreeLayoutConfig = {
  nodeWidth: 180,
  nodeHeight: 90,
  horizontalGap: 40,
  verticalGap: 80,
  rootY: 220,
  centerX: 600,
};

interface InternalNode {
  id: string;
  children: InternalNode[];
  subtreeWidth: number; // in px, computed bottom-up
  x: number;
  y: number;
  depth: number;
}

/**
 * Compute deterministic org chart layout positions from flat contact list.
 *
 * @param contacts   Array of { id, managerId } objects
 * @param config     Optional layout config overrides
 * @returns          Array of TreeNodePosition for every contact that's part of the tree
 */
export function computeTreeLayout(
  contacts: { id: string; managerId: string | null }[],
  config?: Partial<TreeLayoutConfig>
): TreeNodePosition[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (contacts.length === 0) return [];

  // Build lookup maps
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string | null>();
  const contactIds = new Set(contacts.map(c => c.id));

  for (const c of contacts) {
    parentMap.set(c.id, c.managerId);
    if (c.managerId && contactIds.has(c.managerId)) {
      if (!childrenMap.has(c.managerId)) childrenMap.set(c.managerId, []);
      childrenMap.get(c.managerId)!.push(c.id);
    }
  }

  // Find root nodes (no parent, or parent not in contact set)
  const roots = contacts.filter(
    c => !c.managerId || !contactIds.has(c.managerId)
  );

  if (roots.length === 0) return [];

  // Build internal tree recursively
  const buildNode = (id: string, depth: number, visited: Set<string>): InternalNode => {
    visited.add(id);
    const kids = (childrenMap.get(id) || [])
      .filter(kid => !visited.has(kid)) // cycle guard
      .map(kid => buildNode(kid, depth + 1, visited));

    return { id, children: kids, subtreeWidth: 0, x: 0, y: 0, depth };
  };

  const visited = new Set<string>();
  const rootNodes = roots.map(r => buildNode(r.id, 0, visited));

  // Also handle orphan contacts not reachable from roots (place them as separate roots)
  const unreached = contacts.filter(c => !visited.has(c.id));
  for (const c of unreached) {
    if (!visited.has(c.id)) {
      rootNodes.push(buildNode(c.id, 0, visited));
    }
  }

  // Bottom-up: compute subtree widths
  const nodeSlot = cfg.nodeWidth + cfg.horizontalGap;

  const computeWidths = (node: InternalNode): number => {
    if (node.children.length === 0) {
      node.subtreeWidth = cfg.nodeWidth;
      return node.subtreeWidth;
    }
    let totalWidth = 0;
    for (const child of node.children) {
      totalWidth += computeWidths(child);
    }
    // Add gaps between children
    totalWidth += (node.children.length - 1) * cfg.horizontalGap;
    node.subtreeWidth = Math.max(cfg.nodeWidth, totalWidth);
    return node.subtreeWidth;
  };

  // Compute total width of all root trees
  let totalRootWidth = 0;
  for (const root of rootNodes) {
    computeWidths(root);
    totalRootWidth += root.subtreeWidth;
  }
  totalRootWidth += (rootNodes.length - 1) * cfg.horizontalGap;

  // Top-down: assign x,y positions
  const assignPositions = (node: InternalNode, centerX: number) => {
    node.x = centerX;
    node.y = cfg.rootY + node.depth * (cfg.nodeHeight + cfg.verticalGap);

    if (node.children.length === 0) return;

    // Total width needed by children
    let childrenTotalWidth = 0;
    for (const child of node.children) {
      childrenTotalWidth += child.subtreeWidth;
    }
    childrenTotalWidth += (node.children.length - 1) * cfg.horizontalGap;

    // Start x for first child (leftmost edge)
    let startX = centerX - childrenTotalWidth / 2;

    for (const child of node.children) {
      const childCenterX = startX + child.subtreeWidth / 2;
      assignPositions(child, childCenterX);
      startX += child.subtreeWidth + cfg.horizontalGap;
    }
  };

  // Position all root trees side by side
  let rootStartX = cfg.centerX - totalRootWidth / 2;
  for (const root of rootNodes) {
    const rootCenterX = rootStartX + root.subtreeWidth / 2;
    assignPositions(root, rootCenterX);
    rootStartX += root.subtreeWidth + cfg.horizontalGap;
  }

  // Flatten to output
  const result: TreeNodePosition[] = [];
  const flatten = (node: InternalNode) => {
    result.push({
      contactId: node.id,
      x: node.x,
      y: node.y,
      depth: node.depth,
      parentContactId: parentMap.get(node.id) ?? null,
    });
    for (const child of node.children) flatten(child);
  };
  for (const root of rootNodes) flatten(root);

  return result;
}

/**
 * Compute orthogonal connector segments (org-chart style):
 * parent center-bottom → vertical down → horizontal → vertical down → child center-top.
 */
export interface ConnectorSegment {
  fromContactId: string;
  toContactId: string;
  /** Array of [x, y] waypoints for the connector polyline */
  points: [number, number][];
  depth: number;
}

export function computeConnectors(
  positions: TreeNodePosition[],
  config?: Partial<TreeLayoutConfig>
): ConnectorSegment[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const posMap = new Map<string, TreeNodePosition>();
  for (const p of positions) posMap.set(p.contactId, p);

  const connectors: ConnectorSegment[] = [];

  for (const pos of positions) {
    if (!pos.parentContactId) continue;
    const parent = posMap.get(pos.parentContactId);
    if (!parent) continue;

    const parentBottomX = parent.x;
    const parentBottomY = parent.y + cfg.nodeHeight / 2;
    const childTopX = pos.x;
    const childTopY = pos.y - cfg.nodeHeight / 2;

    // Midpoint Y for horizontal segment
    const midY = parentBottomY + (childTopY - parentBottomY) / 2;

    connectors.push({
      fromContactId: parent.contactId,
      toContactId: pos.contactId,
      points: [
        [parentBottomX, parentBottomY],
        [parentBottomX, midY],
        [childTopX, midY],
        [childTopX, childTopY],
      ],
      depth: pos.depth,
    });
  }

  return connectors;
}
