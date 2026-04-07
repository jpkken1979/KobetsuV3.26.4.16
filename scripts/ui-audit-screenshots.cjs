/**
 * UI Audit: Take screenshots of all pages in dark + light mode.
 * Usage: node scripts/ui-audit-screenshots.cjs
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:3026";
const OUT = path.resolve("output/ui-audit");

const PAGES = [
  { name: "01-dashboard", path: "/" },
  { name: "02-contracts", path: "/contracts" },
  { name: "03-employees", path: "/employees" },
  { name: "04-companies", path: "/companies" },
  { name: "05-documents", path: "/documents" },
  { name: "06-import", path: "/import" },
  { name: "07-history", path: "/history" },
  { name: "08-audit", path: "/audit" },
  { name: "09-settings", path: "/settings" },
  { name: "10-companies-table", path: "/companies/table" },
  { name: "11-batch", path: "/contracts/batch" },
  { name: "12-new-hires", path: "/contracts/new-hires" },
];

async function run() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  for (const mode of ["dark", "light"]) {
    console.log(`\n=== ${mode.toUpperCase()} MODE ===`);

    for (const pg of PAGES) {
      const url = `${BASE}${pg.path}`;
      console.log(`  ${pg.name}...`);

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });

        // Set theme mode
        if (mode === "light") {
          await page.evaluate(() => {
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
            localStorage.setItem("theme", "light");
          });
        } else {
          await page.evaluate(() => {
            document.documentElement.classList.remove("light");
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
          });
        }

        // Wait for re-render
        await page.waitForTimeout(500);

        const filename = `${pg.name}-${mode}.png`;
        await page.screenshot({ path: path.join(OUT, filename), fullPage: true });
        console.log(`    -> ${filename}`);
      } catch (err) {
        console.log(`    !! ERROR: ${err.message}`);
      }
    }
  }

  await browser.close();
  console.log(`\nDone! Screenshots in: ${OUT}`);
}

run().catch(console.error);
