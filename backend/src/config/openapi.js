export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "BillIT Backend API",
    version: "1.0.0",
    description: "ISP Billing and Network Management API",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths: {
    "/api/health": { get: { summary: "Health check" } },
    "/api/auth/login": { post: { summary: "Login and get JWT" } },
    "/api/auth/register": {
      post: { summary: "Create user (admin after bootstrap)", security: [{ bearerAuth: [] }] },
    },
    "/api/auth/me": { get: { summary: "Get current user", security: [{ bearerAuth: [] }] } },
    "/api/customers": {
      get: { summary: "List customers" },
      post: { summary: "Create customer", security: [{ bearerAuth: [] }] },
    },
    "/api/plans": {
      get: { summary: "List plans" },
      post: { summary: "Create plan", security: [{ bearerAuth: [] }] },
    },
    "/api/invoices": { get: { summary: "List invoices", security: [{ bearerAuth: [] }] } },
    "/api/invoices/generate": {
      post: { summary: "Generate invoices for current period", security: [{ bearerAuth: [] }] },
    },
    "/api/routers": {
      get: { summary: "List routers" },
      post: { summary: "Create router", security: [{ bearerAuth: [] }] },
    },
    "/api/routers/{id}/configure": {
      patch: { summary: "Configure router", security: [{ bearerAuth: [] }] },
    },
    "/api/routers/{id}/test-connection": {
      post: { summary: "Test router API TCP connection", security: [{ bearerAuth: [] }] },
    },
    "/api/routers/{id}/sessions": {
      get: { summary: "Get synced sessions", security: [{ bearerAuth: [] }] },
    },
    "/api/radius/auth": { post: { summary: "RADIUS auth simulation" } },
    "/api/radius/logs": {
      get: { summary: "RADIUS auth logs", security: [{ bearerAuth: [] }] },
    },
    "/api/reports/summary": { get: { summary: "Summary report" } },
    "/api/reports/logs": {
      get: { summary: "Security and router logs", security: [{ bearerAuth: [] }] },
    },
  },
};
