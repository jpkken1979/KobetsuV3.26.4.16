// Route: /api/factory-yearly-config — CRUD para configuración anual por fábrica
import { Hono } from "hono";
import { z } from "zod";
import {
  getAllConfigsForFactory,
  getConfigForYear,
  createYearlyConfig,
  updateYearlyConfig,
  deleteYearlyConfig,
  getFiscalYear,
  getFactoryYearlyConfigSummary,
  copyYearlyConfig,
} from "../services/factory-yearly-config.js";

export const factoryYearlyConfigRouter = new Hono();

const configSchema = z.object({
  factoryId: z.number().int().positive(),
  fiscalYear: z.number().int().min(2000).max(2100),
  sagyobiText: z.string().nullable().optional(),
  kyujitsuText: z.string().nullable().optional(),
  kyuukashori: z.string().nullable().optional(),
  supervisorName: z.string().nullable().optional(),
  supervisorDept: z.string().nullable().optional(),
  supervisorRole: z.string().nullable().optional(),
  supervisorPhone: z.string().nullable().optional(),
  hakensakiManagerName: z.string().nullable().optional(),
  hakensakiManagerDept: z.string().nullable().optional(),
  hakensakiManagerRole: z.string().nullable().optional(),
  hakensakiManagerPhone: z.string().nullable().optional(),
});

const updateSchema = configSchema.omit({ factoryId: true, fiscalYear: true }).partial();

// GET /api/factory-yearly-config/summary — lista de factoryIds con al menos una config (literal ANTES de /:factoryId)
factoryYearlyConfigRouter.get("/summary", async (c) => {
  try {
    const ids = await getFactoryYearlyConfigSummary();
    return c.json(ids);
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});

// POST /api/factory-yearly-config/copy-to — copia config de año fiscal a múltiples fábricas
factoryYearlyConfigRouter.post("/copy-to", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const schema = z.object({
      sourceFactoryId: z.number().int().positive(),
      fiscalYear: z.number().int().min(2000).max(2100),
      targetFactoryIds: z.array(z.number().int().positive()).min(1),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    const result = copyYearlyConfig(
      parsed.data.sourceFactoryId,
      parsed.data.fiscalYear,
      parsed.data.targetFactoryIds
    );
    return c.json(result);
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});

// GET /api/factory-yearly-config/:factoryId — todas las configs de una fábrica
factoryYearlyConfigRouter.get("/:factoryId", async (c) => {
  try {
    const factoryId = Number(c.req.param("factoryId"));
    if (isNaN(factoryId)) return c.json({ error: "factoryId inválido" }, 400);
    const configs = await getAllConfigsForFactory(factoryId);
    return c.json(configs);
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});

// GET /api/factory-yearly-config/:factoryId/:fiscalYear — config de un año específico
factoryYearlyConfigRouter.get("/:factoryId/:fiscalYear", async (c) => {
  try {
    const factoryId = Number(c.req.param("factoryId"));
    const fiscalYear = Number(c.req.param("fiscalYear"));
    if (isNaN(factoryId) || isNaN(fiscalYear)) return c.json({ error: "Parámetros inválidos" }, 400);
    const fakeDate = `${fiscalYear}-10-01`;
    const config = await getConfigForYear(factoryId, fakeDate);
    if (!config) return c.json({ error: "No encontrado" }, 404);
    return c.json(config);
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});

// POST /api/factory-yearly-config — crear nueva config anual
factoryYearlyConfigRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const config = await createYearlyConfig(parsed.data);
    return c.json(config, 201);
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes("UNIQUE")) return c.json({ error: "Ya existe una configuración para ese año fiscal" }, 409);
    return c.json({ error: msg }, 500);
  }
});

// PUT /api/factory-yearly-config/:id — actualizar config
factoryYearlyConfigRouter.put("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "id inválido" }, 400);
    const body = await c.req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const updated = await updateYearlyConfig(id, parsed.data);
    if (!updated) return c.json({ error: "No encontrado" }, 404);
    return c.json(updated);
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});

// DELETE /api/factory-yearly-config/:id — eliminar config
factoryYearlyConfigRouter.delete("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "id inválido" }, 400);
    await deleteYearlyConfig(id);
    return c.json({ ok: true });
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});

// GET /api/factory-yearly-config/fiscal-year/resolve?date=YYYY-MM-DD
factoryYearlyConfigRouter.get("/fiscal-year/resolve", async (c) => {
  const date = c.req.query("date");
  if (!date) return c.json({ error: "Parámetro date requerido" }, 400);
  return c.json({ fiscalYear: getFiscalYear(date) });
});
