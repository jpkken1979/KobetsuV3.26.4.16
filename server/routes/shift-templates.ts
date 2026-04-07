/**
 * Shift Templates API — Reusable shift/break patterns.
 *
 * Allows saving named shift configurations (workHours + breakTime text)
 * that can be applied to any factory via the factory editor.
 */
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { shiftTemplates, auditLog } from "../db/schema.js";
import { eq } from "drizzle-orm";

const shiftTemplateSchema = z.object({
  name: z.string().min(1, "name is required"),
  workHours: z.string().min(1, "workHours is required"),
  breakTime: z.string().default(""),
});

export const shiftTemplatesRouter = new Hono();

// ─── GET /shift-templates — list all templates ──────────────────────

shiftTemplatesRouter.get("/", async (c) => {
  try {
    const templates = await db
      .select()
      .from(shiftTemplates)
      .orderBy(shiftTemplates.name);
    return c.json(templates);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

// ─── POST /shift-templates — create a template ─────────────────────

shiftTemplatesRouter.post("/", async (c) => {
  try {
    const raw = await c.req.json().catch(() => null);
    if (!raw) return c.json({ error: "Invalid JSON body" }, 400);

    const validated = shiftTemplateSchema.safeParse(raw);
    if (!validated.success) {
      return c.json({ error: validated.error.issues[0].message }, 400);
    }
    const { name, workHours, breakTime } = validated.data;

    // Count shifts from workHours text
    const shiftNameRe = /[A-Za-z\u4e00-\u9fff\d]+[勤直務]：/g;
    const matches = workHours.match(shiftNameRe);
    const shiftCount = matches ? matches.length : 1;

    const [result] = await db.insert(shiftTemplates).values({
      name,
      workHours,
      breakTime: breakTime || "",
      shiftCount,
    }).returning();

    db.insert(auditLog).values({
      action: "create",
      entityType: "shift_template",
      entityId: result.id,
      detail: `Created shift template: ${name} (${shiftCount} shifts)`,
      userName: "system",
    }).run();

    return c.json(result, 201);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

// ─── DELETE /shift-templates/:id — delete a template ────────────────

shiftTemplatesRouter.delete("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    await db.delete(shiftTemplates).where(eq(shiftTemplates.id, id));

    db.insert(auditLog).values({
      action: "delete",
      entityType: "shift_template",
      entityId: id,
      detail: `Deleted shift template ID ${id}`,
      userName: "system",
    }).run();

    return c.json({ ok: true });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
