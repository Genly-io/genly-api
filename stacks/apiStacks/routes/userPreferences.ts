const userpreferenceRoutes = {
  "GET /userpreferences": "packages/functions/userpreferences/list.main",
  "GET /userpreferences/{id}": "packages/functions/userpreferences/get.main",
  "POST /userpreferences": "packages/functions/userpreferences/create.main",
  "PUT /userpreferences/{id}": "packages/functions/userpreferences/update.main",
  "DELETE /userpreferences/{id}":
    "packages/functions/userpreferences/delete.main",
};

export default userpreferenceRoutes;
