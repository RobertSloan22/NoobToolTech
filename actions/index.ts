import { fetchVehicleDataAction } from "./vehicleData.ts";
import { createCustomerAction } from "./customerData.ts";
import { getAllCustomersAction } from "./customerData.ts";
import { searchCustomersByLastNameAction } from "./customerData.ts";
import { searchCustomersAction } from "./customerData.ts";
import { updateCustomerAction } from "./updateCustomer.ts";
import { fetchLatestLogsAction } from "./latestLogs.ts";
import { sendCustomerEmailAction } from "./emailActions.ts";
import { getCustomerEmailsAction } from "./emailActions.ts";
import searchAutoPartsAction from "./searchAutoPartsAction.ts";
export { fetchLatestLogsAction, fetchVehicleDataAction, updateCustomerAction, createCustomerAction, getAllCustomersAction, searchCustomersByLastNameAction, searchCustomersAction };
export * from './emailActions.js';

// ... existing exports ...
export const actions = [
  fetchVehicleDataAction,
  fetchLatestLogsAction,
  createCustomerAction,
  getAllCustomersAction,
  searchCustomersByLastNameAction,
  searchCustomersAction,
  sendCustomerEmailAction,
  getCustomerEmailsAction,
  searchAutoPartsAction,
];