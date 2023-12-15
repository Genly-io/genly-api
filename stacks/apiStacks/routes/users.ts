const userRoutes = {
  "GET /users": "packages/functions/users/list.main",
  "GET /users/{id}": "packages/functions/users/get.main",
  "POST /users": "packages/functions/users/create.main",
  "PUT /users/{id}": "packages/functions/users/update.main",
  "DELETE /users/{id}": "packages/functions/users/delete.main",
};

export default userRoutes;
