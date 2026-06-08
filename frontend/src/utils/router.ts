export type AppRoute = "/" | "/upload" | "/dashboard";

export const routes: Record<string, AppRoute> = {
  home: "/",
  upload: "/upload",
  dashboard: "/dashboard",
};

export function normalizeRoute(pathname: string): AppRoute {
  if (pathname === routes.upload || pathname === routes.dashboard) {
    return pathname;
  }

  return routes.home;
}
