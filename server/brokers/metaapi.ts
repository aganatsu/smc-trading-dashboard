import axios from "axios";

const METAAPI_BASE_URL = "https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai";
const METAAPI_PROVISIONING_URL = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

interface MetaApiConfig {
  token: string; // MetaApi auth token
  accountId: string; // MetaApi account ID (not MT4/MT5 account number)
}

function getHeaders(token: string) {
  return {
    "auth-token": token,
    "Content-Type": "application/json",
  };
}

// Convert our symbol format to MT4/MT5 format (EUR/USD -> EURUSD)
function toMtSymbol(symbol: string): string {
  return symbol.replace("/", "");
}

export async function getMetaApiAccounts(token: string) {
  const url = `${METAAPI_PROVISIONING_URL}/users/current/accounts`;
  const response = await axios.get(url, { headers: getHeaders(token) });
  return response.data;
}

export async function getMetaApiAccountInfo(config: MetaApiConfig) {
  const url = `${METAAPI_BASE_URL}/users/current/accounts/${config.accountId}/account-information`;
  const response = await axios.get(url, { headers: getHeaders(config.token) });
  return response.data;
}

export async function getMetaApiPositions(config: MetaApiConfig) {
  const url = `${METAAPI_BASE_URL}/users/current/accounts/${config.accountId}/positions`;
  const response = await axios.get(url, { headers: getHeaders(config.token) });
  return response.data;
}

export async function getMetaApiOrders(config: MetaApiConfig) {
  const url = `${METAAPI_BASE_URL}/users/current/accounts/${config.accountId}/orders`;
  const response = await axios.get(url, { headers: getHeaders(config.token) });
  return response.data;
}

export async function placeMetaApiMarketOrder(
  config: MetaApiConfig,
  params: {
    symbol: string;
    direction: "long" | "short";
    volume: number; // lot size (e.g., 0.01, 0.1, 1.0)
    stopLoss?: number;
    takeProfit?: number;
  }
) {
  const url = `${METAAPI_BASE_URL}/users/current/accounts/${config.accountId}/trade`;
  const mtSymbol = toMtSymbol(params.symbol);

  const body: any = {
    actionType: params.direction === "long" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL",
    symbol: mtSymbol,
    volume: params.volume,
  };

  if (params.stopLoss !== undefined) {
    body.stopLoss = params.stopLoss;
  }

  if (params.takeProfit !== undefined) {
    body.takeProfit = params.takeProfit;
  }

  const response = await axios.post(url, body, {
    headers: getHeaders(config.token),
  });

  return response.data;
}

export async function closeMetaApiPosition(config: MetaApiConfig, positionId: string) {
  const url = `${METAAPI_BASE_URL}/users/current/accounts/${config.accountId}/trade`;
  const body = {
    actionType: "POSITION_CLOSE_ID",
    positionId,
  };
  const response = await axios.post(url, body, {
    headers: getHeaders(config.token),
  });
  return response.data;
}
