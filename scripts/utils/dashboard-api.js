import { DASHBOARD_APP_ID } from "../constants.js";
import { AqbDashboardApp } from "../apps/dashboard.js";

export function getDashboardInstance() {
  return foundry.applications.instances.get(DASHBOARD_APP_ID);
}

export async function openDashboard() {
  let app = getDashboardInstance();
  if (!app) {
    app = new AqbDashboardApp();
  }
  await app.render(true);
  return app;
}

export async function closeDashboard() {
  const app = getDashboardInstance();
  if (app) await app.close();
}
