const paymentMethodRoutes = {
  "GET /paymentmethods": "packages/functions/paymentmethods/list.main",
  "GET /paymentmethods/{id}": "packages/functions/paymentmethods/get.main",
  "POST /paymentmethods": "packages/functions/paymentmethods/create.main",
  "PUT /paymentmethods/{id}": "packages/functions/paymentmethods/update.main",
  "DELETE /paymentmethods/{id}":
    "packages/functions/paymentmethods/delete.main",
};
export default paymentMethodRoutes;
