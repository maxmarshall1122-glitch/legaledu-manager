import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "demo-2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/Elektron pochta|Email/).fill(email);
  await page.getByLabel(/Parol|Password/).fill(PASSWORD);
  await page.getByRole("button", { name: /^(Kirish|Sign in)$/ }).click();
  await page.waitForURL(/\/(dashboard|my)$/);
}

async function logout(page: Page) {
  await page.context().clearCookies({ name: "le_demo_session" });
}

test.describe.configure({ mode: "serial" });

test("rejects wrong password and redirects anonymous users to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Elektron pochta").fill("lecturer@demo.legaledu.local");
  await page.getByLabel("Parol").fill("wrong");
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "notoʻgʻri" })).toBeVisible();
});

test("lecturer: Uzbek by default, every navigation item works, language persists", async ({ page }) => {
  await login(page, "lecturer@demo.legaledu.local");
  await expect(page.getByRole("heading", { level: 1, name: "Boshqaruv paneli" })).toBeVisible();
  await expect(page.getByText("Demo rejim")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Asosiy navigatsiya" }).first();
  const items = ["Talabalar", "Guruhlar", "Fanlar", "Topshiriqlar", "Topshirilgan ishlar", "Baholash va fikr-mulohaza", "Oʻquv materiallari", "Hisobotlar", "Sozlamalar", "Boshqaruv paneli"];
  for (const name of items) {
    await nav.getByRole("link", { name }).click();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("Xatolik yuz berdi")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("lecturer: add a student, duplicate ID is rejected, search finds them", async ({ page }) => {
  await login(page, "lecturer@demo.legaledu.local");
  await page.goto("/students");
  await page.getByRole("button", { name: "Add student" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Student ID").fill("E2E-26-0001");
  await dialog.getByLabel("Full name").fill("Playwright Fictional");
  await dialog.getByLabel("LAW-101").check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Student created.")).toBeVisible();
  await expect(page.getByRole("link", { name: "E2E-26-0001" })).toBeVisible();

  await page.getByRole("button", { name: "Add student" }).click();
  await dialog.getByLabel("Student ID").fill("e2e-26-0001");
  await dialog.getByLabel("Full name").fill("Duplicate");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("A student with this ID already exists.")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("searchbox", { name: "Search" }).first().fill("Playwright");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: /E2E-26-0001/ })).toBeVisible();
});

test("lecturer: create and publish an assignment for LAW-101", async ({ page }) => {
  await login(page, "lecturer@demo.legaledu.local");
  await page.goto("/assignments/new");
  await page.getByLabel("Title").fill("E2E fictional essay");
  await page.getByLabel("Assignment language").selectOption("en");
  await page.getByLabel("Deadline").fill("2030-01-15T18:00");
  await page.getByRole("checkbox", { name: "LAW-101" }).check();
  await page.getByLabel("Start from template").selectOption("essay");
  await expect(page.getByLabel("Instructions", { exact: true })).toHaveValue(/2,000–2,500 words/);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E fictional essay" })).toBeVisible();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
});

test("student: sees the assignment, uploads a file; cannot open staff pages", async ({ page }) => {
  await login(page, "student1@demo.legaledu.local");
  await expect(page).toHaveURL(/\/my$/);
  await page.getByRole("link", { name: "E2E fictional essay" }).click();
  await page.getByLabel(/Files|Fayllar/).setInputFiles({ name: "my-essay.txt", mimeType: "text/plain", buffer: Buffer.from("Fictional essay text for E2E.") });
  await page.getByRole("button", { name: /^(Upload|Yuklash)$/ }).click();
  await expect(page.getByText(/Submission uploaded\.|Ish yuklandi\./)).toBeVisible();
  await expect(page.getByText("my-essay.txt")).toBeVisible();
  // spoofed file is rejected server-side
  await page.getByLabel(/Files|Fayllar/).setInputFiles({ name: "evil.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ not a pdf") });
  await page.getByRole("button", { name: /^(Upload|Yuklash)$/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "evil.pdf" })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/my$/);
  const res = await page.request.get("/api/reports?type=grades");
  expect(res.status()).toBe(403);
});

test("lecturer: grades the submission with rubric, approves; student sees the final score", async ({ page }) => {
  await login(page, "lecturer@demo.legaledu.local");
  await page.goto("/grading");
  await page.getByRole("row", { name: /E2E fictional essay/ }).getByRole("link", { name: "Grade" }).click();
  await expect(page.getByText("Live AI review is disabled")).toBeVisible();
  const scores = [22, 18, 17, 13, 9, 8];
  for (const [i, s] of scores.entries()) await page.locator(`#score-${i}`).fill(String(s));
  await expect(page.getByText("87 / 100")).toBeVisible();
  await page.locator("#score-0").fill("30");
  await expect(page.getByText("Score must be between 0 and 25.")).toBeVisible();
  await page.locator("#score-0").fill("22");
  await page.getByLabel("Feedback for the student").fill("Solid fictional work.");
  await page.getByRole("button", { name: "Approve final grade" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve final grade" }).click();
  await expect(page.getByText("Final grade approved.")).toBeVisible();
  await expect(page.getByText("Instructor-approved evaluation")).toBeVisible();

  await logout(page);
  await login(page, "student1@demo.legaledu.local");
  await page.getByRole("link", { name: "E2E fictional essay" }).click();
  await expect(page.getByText("Solid fictional work.")).toBeVisible();
  await expect(page.getByText(/87/).first()).toBeVisible();
});

test("reports export CSV and dark theme / mobile navigation work", async ({ page }) => {
  await login(page, "lecturer@demo.legaledu.local");
  await page.goto("/reports?type=grades");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/legaledu-grades-.*\.csv/);

  await page.getByRole("button", { name: "Toggle dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Students" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Students" })).toBeVisible();
});
