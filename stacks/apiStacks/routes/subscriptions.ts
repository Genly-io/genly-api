const subscriptionRoutes = {
  "GET /subscriptions": "packages/functions/subscriptions/list.main",
  "GET /subscriptions/{id}": "packages/functions/subscriptions/get.main",
  "POST /subscriptions": "packages/functions/subscriptions/create.main",
  "PUT /subscriptions/{id}": "packages/functions/subscriptions/update.main",
  "DELETE /subscriptions/{id}": "packages/functions/subscriptions/delete.main",
};
export default subscriptionRoutes;
