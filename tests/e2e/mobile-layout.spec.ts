import { expect, test, type Page } from "@playwright/test";

import { readyTools } from "../../lib/tools/registry";

// This spec runs only under the emulated phone projects in playwright.config.ts,
// so it never calls setViewportSize: the device descriptor supplies the viewport,
// the device pixel ratio, and a touch-capable user agent. Each test targets a
// layout rule that a desktop viewport cannot exercise.

/** Pages that exist without a tool fixture and should hold up on a phone. */
const CORE_PAGES = ["/", "/tools", "/privacy", "/methodology", "/support", "/offline"];

/** The WCAG 2.5.5 target floor, and the value the mobile CSS block asserts. */
const MIN_TARGET = 44;

/**
 * Interactive elements that are laid out as standalone controls. Links inside a
 * paragraph are deliberately excluded: padding them to 44px would break the text
 * flow, and WCAG exempts inline text links from the target size rule.
 */
const TARGET_SELECTOR = [
  '[data-slot="button"]',
  '[data-slot="input"]',
  '[data-slot="select"]',
  "select",
  '[role="button"]',
  "footer a",
  '[role="group"] button',
].join(", ");

async function measureTargets(page: Page) {
  return page.evaluate(
    ({ selector, floor }) => {
      const tooSmall: { label: string; width: number; height: number }[] = [];
      for (const element of document.querySelectorAll<HTMLElement>(selector)) {
        const box = element.getBoundingClientRect();
        // Hidden controls (a closed menu, an unmounted panel) have no box.
        if (box.width === 0 && box.height === 0) continue;
        if (element.offsetParent === null && getComputedStyle(element).position !== "fixed") continue;
        if (box.height + 0.5 < floor || box.width + 0.5 < floor) {
          const label =
            element.getAttribute("aria-label") ||
            element.textContent?.trim().slice(0, 40) ||
            `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 60);
          tooSmall.push({ label, width: Math.round(box.width), height: Math.round(box.height) });
        }
      }
      return tooSmall;
    },
    { selector: TARGET_SELECTOR, floor: MIN_TARGET },
  );
}

test("core pages fit the viewport width without a horizontal scrollbar", async ({ page }) => {
  for (const path of CORE_PAGES) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const box = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(box.scroll, `${path} overflows horizontally`).toBeLessThanOrEqual(box.client);
  }
});

test("standalone controls meet the 44px touch target floor", async ({ page }) => {
  for (const path of ["/", "/tools", "/support", "/tools/json-formatter", "/tools/image-compressor"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const tooSmall = await measureTargets(page);
    expect(tooSmall, `${path} has undersized touch targets: ${JSON.stringify(tooSmall)}`).toEqual([]);
  }
});

test("the mobile navigation panel opens within the viewport and closes again", async ({ page }) => {
  await page.goto("/tools", { waitUntil: "domcontentloaded" });

  const menuButton = page.getByRole("button", { name: "Open navigation" });
  await expect(menuButton).toBeVisible();
  await menuButton.tap();

  const panel = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(panel).toBeVisible();

  // The panel is absolutely positioned against the header, so a width mistake
  // pushes it off-screen rather than causing document overflow.
  const bounds = await panel.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, width: window.innerWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width + 0.5);

  // Scope the link to the panel: "Privacy" is also a tool category and a footer
  // destination, so an unscoped role query matches eight elements.
  await panel.getByRole("link", { name: "Privacy", exact: true }).tap();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(panel).toHaveCount(0);
});

test("the page gutter clears the safe-area inset", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  // env() resolves to 0px under emulation, so the assertion is that the gutter
  // is driven by max(gutter, inset) and never falls below the base gutter. A
  // regression to a bare `env()` or a dropped class shows up as a smaller value.
  const padding = await page.locator(".page-gutter").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { start: parseFloat(style.paddingInlineStart), end: parseFloat(style.paddingInlineEnd) };
  });
  expect(padding.start).toBeGreaterThanOrEqual(20);
  expect(padding.end).toBeGreaterThanOrEqual(20);

  const gutterCount = await page.locator(".page-gutter").count();
  expect(gutterCount, "the page gutter class is missing from the layout").toBeGreaterThan(0);
});

test("full-height containers use the dynamic viewport unit", async ({ page }) => {
  await page.goto("/tools", { waitUntil: "domcontentloaded" });

  // 100vh is the *largest* viewport on mobile, so a page using it is taller than
  // the visible area even with nothing in it. dvh matches what the user can see.
  const usesStaticViewport = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("div, main, body")].some((element) =>
      /(^|\s)min-h-screen(\s|$)/.test(element.className),
    ),
  );
  expect(usesStaticViewport, "found min-h-screen; use min-h-dvh on mobile").toBe(false);
});

test("the category filter strip is swipeable rather than wrapped", async ({ page }) => {
  await page.goto("/tools", { waitUntil: "domcontentloaded" });

  const strip = page.locator(".scroll-strip").first();
  await expect(strip).toBeVisible();

  const metrics = await strip.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    overflowX: getComputedStyle(element).overflowX,
    height: element.getBoundingClientRect().height,
  }));

  // The pills exceed one line on a phone; the strip must scroll them instead of
  // wrapping into a tall block that pushes the grid down.
  expect(metrics.overflowX).toBe("auto");
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.height).toBeLessThan(120);

  // Scrolling the strip must not scroll the document sideways.
  await strip.evaluate((element) => element.scrollBy({ left: 200 }));
  expect(await strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});

test("filtering keeps the grid usable and the count accurate", async ({ page }) => {
  await page.goto("/tools", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: /^Developer/ }).tap();
  await expect(page.getByRole("status")).toContainText(`of ${readyTools.length} tools`);

  const box = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(box.scroll, "filtering introduced horizontal overflow").toBeLessThanOrEqual(box.client);

  await page.getByRole("button", { name: /clear filters/i }).tap();
  await expect(page.getByRole("status")).toContainText(`all ${readyTools.length} tools`);
});

test("the entrance stagger plays once and does not re-run on filtering", async ({ page }) => {
  await page.goto("/tools", { waitUntil: "domcontentloaded" });

  // The stagger is carried by .motion-grid. Re-applying it on every keystroke
  // replays the animation on all cards, which reads as lag rather than polish.
  await expect(page.locator(".motion-grid")).toHaveCount(1);

  await page.getByRole("searchbox", { name: /search tools/i }).fill("hash");
  await expect(page.locator(".motion-grid")).toHaveCount(0);

  await page.getByRole("button", { name: /clear filters/i }).tap();
  await expect(page.getByRole("status")).toContainText(`all ${readyTools.length} tools`);
  await expect(page.locator(".motion-grid")).toHaveCount(0);
});

test("the empty state offers a way back", async ({ page }) => {
  await page.goto("/tools", { waitUntil: "domcontentloaded" });

  await page.getByRole("searchbox", { name: /search tools/i }).fill("nothingmatchesthis");
  const empty = page.getByText("No tools match that search.");
  await expect(empty).toBeVisible();

  // Recovery has to live in the empty state itself: with no grid, a button
  // below the grid is the only control on screen and reads as unrelated.
  const reset = page.getByRole("button", { name: /clear filters/i });
  await expect(reset).toHaveCount(1);
  await reset.tap();
  await expect(page.getByRole("status")).toContainText(`all ${readyTools.length} tools`);
});

test("the hero promise panel stacks instead of breaking words", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  // "file uploads" is the longest label and the first to break mid-word when
  // three columns are forced into a narrow panel.
  const label = page.getByText("file uploads", { exact: true });
  await expect(label).toBeVisible();

  const layout = await label.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const line = parseFloat(getComputedStyle(element).lineHeight);
    return { height: box.height, line, width: box.width, scrollWidth: element.scrollWidth };
  });

  // A single line means the column is wide enough for the text as written.
  expect(layout.height).toBeLessThan(layout.line * 1.8);
  expect(layout.scrollWidth).toBeLessThanOrEqual(Math.ceil(layout.width) + 1);
});

test("the select popup opens on touch and stays inside the viewport", async ({ page }) => {
  await page.goto("/tools/image-compressor", { waitUntil: "domcontentloaded" });

  const trigger = page.getByRole("combobox", { name: "Output format" });
  await expect(trigger).toBeVisible();

  // The trigger replaced a native select, whose popup was platform chrome that
  // could not be styled or measured. This one is ours, so it must behave.
  const triggerBox = await trigger.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { height: box.height, width: box.width };
  });
  expect(triggerBox.height).toBeGreaterThanOrEqual(40);

  await trigger.tap();
  const popup = page.locator('[data-slot="select-popup"]');
  await expect(popup).toBeVisible();

  const bounds = await popup.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-0.5);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 0.5);
  expect(bounds.top).toBeGreaterThanOrEqual(-0.5);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 0.5);

  // Options are real elements with a11y semantics, unlike native <option>, and
  // each row is tappable at the 44px floor.
  const options = popup.getByRole("option");
  await expect(options).toHaveCount(3);
  const shortestOption = await options.evaluateAll((rows) =>
    Math.min(...rows.map((row) => row.getBoundingClientRect().height)),
  );
  expect(shortestOption).toBeGreaterThanOrEqual(44);

  await options.filter({ hasText: "JPEG" }).tap();
  // The primitive keeps the popup mounted and hides its container rather than
  // unmounting, so assert on visibility and the trigger's expanded state.
  await expect(popup).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toContainText("JPEG");
});

test("Geist is applied rather than a browser default", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  // A self-referential --font-sans silently yields the platform default, which
  // looks plausible in a screenshot but is not the site's typeface.
  const heading = await page.getByRole("heading", { level: 1 }).evaluate((element) => ({
    family: getComputedStyle(element).fontFamily,
    rootFamily: getComputedStyle(document.documentElement).fontFamily,
  }));
  expect(heading.family).toMatch(/Geist/);
  expect(heading.rootFamily).toMatch(/Geist/);
});

test("elevation tokens resolve to real shadows in both themes", async ({ page }) => {
  for (const theme of ["light", "dark"] as const) {
    // Seed the stored preference the way the app's own initializer reads it, so
    // the theme is already correct at first paint. Toggling the class after load
    // would start the card's box-shadow transition and getComputedStyle would
    // return an interpolated value rather than the token.
    await page.addInitScript((mode) => {
      localStorage.setItem("notrak-theme", mode);
    }, theme);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^((?!dark).)*$/);

    const shadow = await page.locator(".tool-card").first().evaluate(
      (element) => getComputedStyle(element).boxShadow,
    );
    // An unresolved var() or a bad color-mix collapses the whole declaration to
    // "none", which is exactly the failure the literal oklch tokens avoid.
    expect(shadow, `${theme} tool card lost its shadow`).not.toBe("none");
    // Engines serialize the color in their own space, so accept any notation.
    expect(shadow, `${theme} shadow has no resolved color`).toMatch(/okl(ch|ab)\(|rgba?\(/);
    // Three layers per token — contact, thickness, ambient — plus the inset
    // highlight. Splitting on commas outside parentheses counts them.
    const layers = shadow.split(/,(?![^()]*\))/);
    expect(layers.length, `${theme} shadow is not layered: ${shadow}`).toBeGreaterThanOrEqual(4);
    expect(layers.some((layer) => layer.includes("inset")), "missing surface highlight").toBe(true);
  }
});

test("every tool page holds its layout on a phone", async ({ page }) => {
  test.slow();

  for (const tool of readyTools) {
    await page.goto(`/tools/${tool.slug}`, { waitUntil: "domcontentloaded" });
    const box = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(box.scroll, `/tools/${tool.slug} overflows horizontally`).toBeLessThanOrEqual(box.client);
  }
});
