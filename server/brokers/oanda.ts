import axios from "axios";

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";

interface OandaConfig {
  apiKey: string;
  accountId: string;
  isLive: boolean;
}

function getBaseUrl(isLive: boolean) {
  return isLive ? OANDA_LIVE_URL : OANDA_PRACTICE_URL;
}

function getHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept-Datetime-Format": "RFC3339",
  };
}

// Convert our symbol format to OANDA format (EUR/USD -> EUR_USD)
function toOandaSymbol(symbol: string): string {
  return symbol.replace("/", "_");
}

export async function getOandaAccounts(apiKey: string, isLive: boolean) {
  const url = `${getBaseUrl(isLive)}/v3/accounts`;
  const response = await axios.get(url, { headers: getHeaders(apiKey) });
  return response.data.accounts;
}

export async function getOandaAccountSummary(config: OandaConfig) {
  const url = `${getBaseUrl(config.isLive)}/v3/accounts/${config.accountId}/summary`;
  const response = await axios.get(url, { headers: getHeaders(config.apiKey) });
  return response.data.account;
}

export async function getOandaOpenPositions(config: OandaConfig) {
  const url = `${getBaseUrl(config.isLive)}/v3/accounts/${config.accountId}/openPositions`;
  const response = await axios.get(url, { headers: getHeaders(config.apiKey) });
  return response.data.positions;
}

export async function getOandaOpenTrades(config: OandaConfig) {
  const url = `${getBaseUrl(config.isLive)}/v3/accounts/${config.accountId}/openTrades`;
  const response = await axios.get(url, { headers: getHeaders(config.apiKey) });
  return response.data.trades;
}

export async function placeOandaMarketOrder(
  config: OandaConfig,
  params: {
    symbol: string;
    units: number; // positive = buy, negative = sell
    stopLoss?: string;
    takeProfit?: string;
  }
) {
  const url = `${getBaseUrl(config.isLive)}/v3/accounts/${config.accountId}/orders`;
  const instrument = toOandaSymbol(params.symbol);

  const orderBody: any = {
    order: {
      type: "MARKET",
      instrument,
      units: params.units.toString(),
      timeInForce: "FOK",
      positionFill: "DEFAULT",
    },
  };

  if (params.stopLoss) {
    orderBody.order.stopLossOnFill = {
      price: params.stopLoss,
      timeInForce: "GTC",
    };
  }

  if (params.takeProfit) {
    orderBody.order.takeProfitOnFill = {
      price: params.takeProfit,
    };
  }

  const response = await axios.post(url, orderBody, {
    headers: getHeaders(config.apiKey),
  });

  return response.data;
}

export async function closeOandaTrade(config: OandaConfig, tradeId: string, units?: string) {
  const url = `${getBaseUrl(config.isLive)}/v3/accounts/${config.accountId}/trades/${tradeId}/close`;
  const body = units ? { units } : {};
  const response = await axios.put(url, body, {
    headers: getHeaders(config.apiKey),
  });
  return response.data;
}

export async function getOandaPendingOrders(config: OandaConfig) {
  const url = `${getBaseUrl(config.isLive)}/v3/accounts/${config.accountId}/pendingOrders`;
  const response = await axios.get(url, { headers: getHeaders(config.apiKey) });
  return response.data.orders;
}

export async function cancelOandaOrder(config: OandaConfig, orderId: string) {
  const url = `${getBaseUrl(config.isLive)}/v3/accounts/${config.accountId}/orders/${orderId}/cancel`;
  const response = await axios.put(url, {}, { headers: getHeaders(config.apiKey) });
  return response.data;
}
