const workspaceRoutes = {
  "GET /workspaces": "packages/functions/workspaces/list.main",
  "GET /workspaces/{id}": "packages/functions/workspaces/get.main",
  "POST /workspaces": "packages/functions/workspaces/create.main",
  "PUT /workspaces/{id}": "packages/functions/workspaces/update.main",
  "DELETE /workspaces/{id}": "packages/functions/workspaces/delete.main",
};

export default workspaceRoutes;
