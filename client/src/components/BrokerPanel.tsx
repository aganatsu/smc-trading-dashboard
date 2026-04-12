import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface BrokerPanelProps {
  symbol: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  direction: "long" | "short";
  positionSize: string;
}

export default function BrokerPanel({
  symbol,
  entryPrice,
  stopLoss,
  takeProfit,
  direction,
  positionSize,
}: BrokerPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [units, setUnits] = useState(positionSize || "1000");

  // Form state for adding a connection
  const [formBrokerType, setFormBrokerType] = useState<"oanda" | "metaapi">("oanda");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formIsLive, setFormIsLive] = useState(false);

  const { data: connections, refetch: refetchConnections } = trpc.broker.connections.useQuery(
    undefined,
    { retry: false }
  );

  const accountInfo = trpc.broker.accountInfo.useQuery(
    { connectionId: selectedConnectionId! },
    { enabled: !!selectedConnectionId, retry: false }
  );

  const positions = trpc.broker.positions.useQuery(
    { connectionId: selectedConnectionId! },
    { enabled: !!selectedConnectionId, retry: false, refetchInterval: 10000 }
  );

  const addConnection = trpc.broker.addConnection.useMutation({
    onSuccess: () => {
      toast.success("Broker connected successfully!");
      setShowAddModal(false);
      setFormDisplayName("");
      setFormApiKey("");
      setFormAccountId("");
      refetchConnections();
    },
    onError: (err) => {
      toast.error(`Connection failed: ${err.message}`);
    },
  });

  const removeConnection = trpc.broker.removeConnection.useMutation({
    onSuccess: () => {
      toast.success("Broker disconnected");
      setSelectedConnectionId(null);
      refetchConnections();
    },
  });

  const placeOrder = trpc.broker.placeOrder.useMutation({
    onSuccess: (data) => {
      toast.success(`Order placed! ID: ${data.orderId}`);
      positions.refetch();
      accountInfo.refetch();
    },
    onError: (err) => {
      toast.error(`Order failed: ${err.message}`);
    },
  });

  const closePosition = trpc.broker.closePosition.useMutation({
    onSuccess: () => {
      toast.success("Position closed");
      positions.refetch();
      accountInfo.refetch();
    },
    onError: (err) => {
      toast.error(`Close failed: ${err.message}`);
    },
  });

  const handlePlaceOrder = () => {
    if (!selectedConnectionId) {
      toast.error("Select a broker connection first");
      return;
    }
    placeOrder.mutate({
      connectionId: selectedConnectionId,
      symbol,
      direction,
      units: parseFloat(units),
      stopLoss: stopLoss || undefined,
      takeProfit: takeProfit || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
          Trade Execution
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-[10px] uppercase tracking-wider text-cyan hover:text-cyan/80 transition-colors"
        >
          + Connect
        </button>
      </div>

      {/* Connection Selector */}
      {connections && connections.length > 0 ? (
        <div className="space-y-2">
          <select
            value={selectedConnectionId ?? ""}
            onChange={(e) => setSelectedConnectionId(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-background border border-border text-foreground text-xs p-2 rounded"
          >
            <option value="">Select broker...</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName} ({c.brokerType.toUpperCase()}) {c.isLive ? "LIVE" : "DEMO"}
              </option>
            ))}
          </select>

          {/* Account Summary */}
          {accountInfo.data && (
            <div className="bg-card/50 border border-border rounded p-2 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">BALANCE</span>
                <span className="text-foreground font-mono">
                  {accountInfo.data.currency} {accountInfo.data.balance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">UNREALIZED P&L</span>
                <span
                  className={`font-mono ${
                    accountInfo.data.unrealizedPL >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {accountInfo.data.unrealizedPL >= 0 ? "+" : ""}
                  {accountInfo.data.unrealizedPL.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">MARGIN AVAIL</span>
                <span className="text-foreground font-mono">
                  {accountInfo.data.marginAvailable.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Order Form */}
          {selectedConnectionId && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Units/Lots</label>
                  <input
                    type="number"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="w-full bg-background border border-border text-foreground text-xs p-1.5 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Direction</label>
                  <div className="flex gap-1 mt-0.5">
                    <span
                      className={`flex-1 text-center text-[10px] py-1.5 rounded font-bold uppercase ${
                        direction === "long"
                          ? "bg-green-500/20 text-green-400 border border-green-500/50"
                          : "bg-card/50 text-muted-foreground border border-border"
                      }`}
                    >
                      BUY
                    </span>
                    <span
                      className={`flex-1 text-center text-[10px] py-1.5 rounded font-bold uppercase ${
                        direction === "short"
                          ? "bg-red-500/20 text-red-400 border border-red-500/50"
                          : "bg-card/50 text-muted-foreground border border-border"
                      }`}
                    >
                      SELL
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-muted-foreground">SL: </span>
                  <span className="text-red-400 font-mono">{stopLoss || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">TP: </span>
                  <span className="text-green-400 font-mono">{takeProfit || "—"}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={placeOrder.isPending}
                className={`w-full py-2 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                  direction === "long"
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                } disabled:opacity-50`}
              >
                {placeOrder.isPending
                  ? "PLACING..."
                  : `${direction === "long" ? "BUY" : "SELL"} ${symbol}`}
              </button>
            </div>
          )}

          {/* Open Positions */}
          {positions.data && positions.data.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Open Positions
              </h4>
              {positions.data.map((pos: any) => (
                <div
                  key={pos.id}
                  className="bg-card/50 border border-border rounded p-2 flex items-center justify-between"
                >
                  <div>
                    <div className="text-[10px] font-bold text-foreground">
                      {pos.symbol}{" "}
                      <span
                        className={
                          pos.direction === "long" ? "text-green-400" : "text-red-400"
                        }
                      >
                        {pos.direction.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {pos.units} units @ {pos.entryPrice}
                    </div>
                    <div
                      className={`text-[10px] font-mono ${
                        pos.unrealizedPL >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {pos.unrealizedPL >= 0 ? "+" : ""}
                      {pos.unrealizedPL.toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      closePosition.mutate({
                        connectionId: selectedConnectionId!,
                        positionId: pos.id,
                      })
                    }
                    className="text-[10px] px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30 transition-colors"
                  >
                    CLOSE
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Remove connection */}
          {selectedConnectionId && (
            <button
              onClick={() => removeConnection.mutate({ id: selectedConnectionId })}
              className="w-full text-[10px] text-red-400/60 hover:text-red-400 transition-colors py-1"
            >
              Disconnect broker
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-[10px] text-muted-foreground mb-2">No broker connected</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-cyan/20 text-cyan border border-cyan/50 rounded text-xs font-bold uppercase tracking-wider hover:bg-cyan/30 transition-colors"
          >
            Connect Broker
          </button>
        </div>
      )}

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card border-2 border-border rounded-lg p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Connect Broker
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Broker Type
                </label>
                <select
                  value={formBrokerType}
                  onChange={(e) => setFormBrokerType(e.target.value as "oanda" | "metaapi")}
                  className="w-full bg-background border border-border text-foreground text-xs p-2 rounded mt-1"
                >
                  <option value="oanda">OANDA (Direct API)</option>
                  <option value="metaapi">HFM / MT4/MT5 (via MetaApi)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder={formBrokerType === "oanda" ? "My OANDA Account" : "My HFM Account"}
                  className="w-full bg-background border border-border text-foreground text-xs p-2 rounded mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {formBrokerType === "oanda" ? "OANDA API Token" : "MetaApi Auth Token"}
                </label>
                <input
                  type="password"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder="Paste your API token here..."
                  className="w-full bg-background border border-border text-foreground text-xs p-2 rounded mt-1 font-mono"
                />
                <p className="text-[9px] text-muted-foreground mt-1">
                  {formBrokerType === "oanda"
                    ? "Get from: OANDA → Account → Manage API Access"
                    : "Get from: metaapi.cloud → Dashboard → Auth Token"}
                </p>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {formBrokerType === "oanda" ? "Account ID" : "MetaApi Account ID"}
                </label>
                <input
                  type="text"
                  value={formAccountId}
                  onChange={(e) => setFormAccountId(e.target.value)}
                  placeholder={
                    formBrokerType === "oanda"
                      ? "e.g., 101-001-12345678-001"
                      : "e.g., abc123def456..."
                  }
                  className="w-full bg-background border border-border text-foreground text-xs p-2 rounded mt-1 font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isLive"
                  checked={formIsLive}
                  onChange={(e) => setFormIsLive(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="isLive" className="text-xs text-foreground">
                  Live account (uncheck for demo/practice)
                </label>
              </div>

              {formIsLive && (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                  <p className="text-[10px] text-red-400 font-bold uppercase">
                    ⚠ LIVE TRADING WARNING
                  </p>
                  <p className="text-[9px] text-red-400/80 mt-1">
                    You are connecting a live account. Real money will be at risk. Always use proper
                    risk management.
                  </p>
                </div>
              )}

              <button
                onClick={() =>
                  addConnection.mutate({
                    brokerType: formBrokerType,
                    displayName: formDisplayName,
                    apiKey: formApiKey,
                    accountId: formAccountId,
                    isLive: formIsLive,
                  })
                }
                disabled={
                  addConnection.isPending || !formDisplayName || !formApiKey || !formAccountId
                }
                className="w-full py-2.5 bg-cyan text-background font-bold text-xs uppercase tracking-wider rounded hover:bg-cyan/90 transition-colors disabled:opacity-50"
              >
                {addConnection.isPending ? "CONNECTING..." : "CONNECT BROKER"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
