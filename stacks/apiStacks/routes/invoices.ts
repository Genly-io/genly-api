const invoiceRoutes = {
  "GET /invoices": "packages/functions/invoices/list.main",
  "GET /invoices/{id}": "packages/functions/invoices/get.main",
  "POST /invoices": "packages/functions/invoices/create.main",
  "PUT /invoices/{id}": "packages/functions/invoices/update.main",
  "DELETE /invoices/{id}": "packages/functions/invoices/delete.main",
};
export default invoiceRoutes;
