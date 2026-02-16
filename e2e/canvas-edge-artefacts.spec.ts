import { test, expect } from "../playwright-fixture";

/**
 * Regression test: Canvas edge artefacts
 *
 * Scenario: drag node, unlink it, drag again, link to different parent
 * → only one link exists; no remnants.
 *
 * This test validates that the canvas page loads and that the core
 * edge-rebuild logic doesn't produce visible errors. Full visual
 * regression requires a screenshot-based approach, but this ensures
 * the component mounts without throwing.
 */
test.describe("Canvas edge artefacts regression", () => {
  test("canvas page loads without console errors related to edges", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Navigate to canvas (will show demo/mock data if not authenticated)
    await page.goto("/canvas");
    await page.waitForTimeout(2000);

    // Verify canvas element renders
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Check no edge-related errors
    const edgeErrors = errors.filter(
      (e) =>
        e.includes("rebuildAllEdges") ||
        e.includes("hierarchyLines") ||
        e.includes("Cannot read properties of null")
    );
    expect(edgeErrors).toHaveLength(0);
  });
});
