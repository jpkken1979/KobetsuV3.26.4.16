/**
 * Factory routes — merged router facade.
 * Submodules: crud, roles, calendars, cascade, excel.
 */
import { Hono } from "hono";
import { factoriesRouter as crudRouter } from "./crud.js";
import { factoriesRouter as rolesRouter } from "./roles.js";
import { factoriesRouter as calendarsRouter } from "./calendars.js";
import { factoriesRouter as cascadeRouter } from "./cascade.js";
import { factoriesRouter as excelRouter } from "./excel.js";

export const factoriesRouter = new Hono();

// Mount each sub-router at the root path (Hono auto-resolves their registered paths)
// Important: mount literal/specialized routes before CRUD's "/:id" handlers.
factoriesRouter.route("/", rolesRouter);
factoriesRouter.route("/", calendarsRouter);
factoriesRouter.route("/", cascadeRouter);
factoriesRouter.route("/", excelRouter);
factoriesRouter.route("/", crudRouter);

export { REQUIRED_FACTORY_FIELDS } from "./crud.js";
