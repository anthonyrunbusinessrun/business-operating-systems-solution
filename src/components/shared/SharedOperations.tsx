"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { parseOrderLines } from "@/lib/order-entry";
import type { SharedCommand } from "@/lib/shared-contract";
import { useSharedOperations } from "./useSharedOperations";

const labels = [
  "partners",
  "products",
  "orders",
  "shipments",
  "transactions",
  "messages",
  "documents",
  "log",
  "outbox",
] as const;
type Tab = (typeof labels)[number];
export function SharedOperations({
  base = "/api/operations",
  otherUrl = "https://frontend-boss-production.up.railway.app/multiplexer",
  otherLabel = "Open BOSS",
}: {
  base?: string;
  otherUrl?: string;
  otherLabel?: string;
}) {
  const { snapshot, error, connected, busy, dispatch, refresh } =
    useSharedOperations(base);
  const [tab, setTab] = useState<Tab>("orders"),
    [action, setAction] = useState("createOrder"),
    [notice, setNotice] = useState(""),
    [contextOrderId, setContextOrderId] = useState("");
  const data = snapshot?.data;
  const contextOrder = data?.orders.find(o => o.id === contextOrderId);
  const rows = (tab === "outbox" ? snapshot?.outbox : data?.[tab]) ?? [];
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const str = (name: string) => String(f.get(name) ?? "").trim();
    const num = (name: string) => Number(str(name));
    let command: SharedCommand;
    const context = {
      ...(str("destinationName") || str("city") || str("region") || str("country") ? { shipTo: { name: str("destinationName"), city: str("city"), region: str("region"), country: str("country").toUpperCase() } } : {}),
      sourceNote: str("sourceNote"),
      testOnly: f.get("testOnly") === "on",
    };
    try {
      switch (action) {
        case "updateOrderContext":
          command = { action, id: contextOrderId, ...context };
          break;
        case "savePartner":
          command = {
            action,
            partner: {
              id: str("id"),
              name: str("name"),
              site: str("site"),
              email: str("email"),
              mobile: str("mobile"),
            },
          };
          break;
        case "saveProduct":
          command = {
            action,
            product: {
              sku: str("sku"),
              name: str("name"),
              unit: str("unit"),
              location: str("location"),
              reorderPoint: num("reorderPoint"),
            },
          };
          break;
        case "receiveStock":
          command = { action, sku: str("sku"), qty: num("qty") };
          break;
        case "saveShipment":
          command = {
            action,
            id: str("id"),
            carrier: str("carrier"),
            tracking: str("tracking"),
            eta: new Date(str("due")).getTime(),
          };
          break;
        default:
          command = {
            action: "createOrder",
            ...context,
            partnerId: str("partnerId"),
            reference: str("reference"),
            due: new Date(str("due")).getTime(),
            lines: parseOrderLines(str("lines")),
          };
      }
      const result = await dispatch(command);
      setNotice(result.message);
      if (action !== "updateOrderContext") form.reset();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Save failed");
    }
  };
  const field = (
    name: string,
    label: string,
    type = "text",
    required = true,
    defaultValue?: string,
  ) => (
    <label key={name}>
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        type={type}
        required={required}
        maxLength={300}
        min={type === "number" ? 0 : undefined}
      />
    </label>
  );
  const run = async (command: SharedCommand) => {
    try {
      setNotice((await dispatch(command)).message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
    }
  };
  return (
    <section className="shared-operations">
      <style>{`.shared-operations{padding:24px;max-width:1400px;margin:auto;color:inherit}.shared-operations h1{font-size:26px;margin:0 0 10px}.shared-operations p{margin:10px 0}.shared-operations nav{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}.shared-operations button,.shared-operations select,.shared-operations input,.shared-operations textarea{font:inherit;padding:9px;border:1px solid var(--border-strong);border-radius:6px;background:transparent;color:inherit}.shared-operations button{cursor:pointer}.shared-operations button:disabled{opacity:.5;cursor:wait}.shared-operations button[aria-pressed=true]{background:var(--primary);color:var(--text-on-primary)}.shared-operations form{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:16px 0}.shared-operations label{display:flex;flex-direction:column;gap:5px}.shared-operations .shared-table{overflow:auto;max-height:520px}.shared-operations table{border-collapse:collapse;width:100%;text-align:left}.shared-operations th,.shared-operations td{padding:10px;border-bottom:1px solid var(--border-subtle);vertical-align:top}.shared-operations pre{max-width:520px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.shared-operations a{color:var(--link)}.shared-operations [role=alert]{color:var(--danger-text)}`}</style>
      <h1>Shared operations</h1>
      <p><Link href={base === "/api/multiplexer" ? "/multiplexer/test" : "/shared/test"}>FEMA scenario test: EDI → inventory → ASN → BOSS voucher</Link></p>
      <p>
        {connected
          ? "● Live updates connected"
          : "○ Reconnecting / refresh fallback"}{" "}
        · Revision {snapshot?.revision ?? "—"} · Supabase primary
      </p>
      <p>
        Shared by BOSS and Multiplexer. External EDI, email, fax and OCR are not
        connected. Outbound requests are stored, never marked delivered
        automatically.
      </p>
      <p>
        <a href={otherUrl} target="_blank" rel="noreferrer">
          {otherLabel}
        </a>{" "}
        · <button onClick={() => void refresh()}>Refresh</button>
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <details>
        <summary>Add or update shared data</summary>
        <label>
          Operation
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="createOrder">Create order</option>
            <option value="updateOrderContext">Update order context</option>
            <option value="savePartner">Save partner</option>
            <option value="saveProduct">Save product</option>
            <option value="receiveStock">Receive stock</option>
            <option value="saveShipment">Set shipment tracking</option>
          </select>
        </label>
        {action === "updateOrderContext" && <label>Order to update
          <select value={contextOrderId} onChange={e => setContextOrderId(e.target.value)}>
            <option value="">Choose an unreserved order</option>
            {data?.orders.filter(o => ["new", "short"].includes(o.status)).map(o => <option key={o.id} value={o.id}>{o.id} - {o.reference}</option>)}
          </select>
        </label>}
        <form key={action + contextOrderId} onSubmit={submit}>
          {action === "savePartner" && (
            <>
              {field("id", "Partner ID")}
              {field("name", "Name")}
              {field("site", "Site", "text", false)}
              {field("email", "Email", "email", false)}
              {field("mobile", "Phone", "text", false)}
            </>
          )}
          {action === "saveProduct" && (
            <>
              {field("sku", "SKU")}
              {field("name", "Name")}
              {field("unit", "Unit")}
              {field("location", "Location", "text", false)}
              {field("reorderPoint", "Reorder point", "number")}
            </>
          )}
          {action === "createOrder" && (
            <>
              <label>
                Partner
                <select name="partnerId" required>
                  {data?.partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {field("reference", "Partner order reference")}
              {field("due", "Due date", "date")}
              <label>
                Lines: one SKU,quantity per line
                <textarea
                  name="lines"
                  required
                  placeholder={"SKU-001,10\nSKU-002,5"}
                />
              </label>
            </>
          )}
          {["createOrder", "updateOrderContext"].includes(action) && <>
            {field("destinationName", "Destination / receiving site", "text", false, action === "updateOrderContext" ? contextOrder?.shipTo?.name : undefined)}
            {field("city", "Destination city", "text", false, action === "updateOrderContext" ? contextOrder?.shipTo?.city : undefined)}
            {field("region", "Destination state / territory", "text", false, action === "updateOrderContext" ? contextOrder?.shipTo?.region : undefined)}
            {field("country", "Country code (2 letters)", "text", false, action === "updateOrderContext" ? contextOrder?.shipTo?.country : undefined)}
            {field("sourceNote", "Source and assumptions", "text", false, action === "updateOrderContext" ? contextOrder?.sourceNote : undefined)}
            <label><span><input name="testOnly" type="checkbox" disabled={action === "updateOrderContext" && contextOrder?.testOnly} defaultChecked={action === "updateOrderContext" && contextOrder?.testOnly} /> Reference-only test order</span></label>
            <p>Enter all four destination fields together. Reference-only orders cannot reserve stock or create shipments. This designation cannot be removed. Record source pages, provisional units and assumed dates here.</p>
          </>}
          {action === "receiveStock" && (
            <>
              <label>
                Product
                <select name="sku" required>
                  {data?.products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </label>
              {field("qty", "Quantity received", "number")}
            </>
          )}
          {action === "saveShipment" && (
            <>
              {field("id", "Shipment ID")}
              {field("carrier", "Carrier")}
              {field("tracking", "Tracking reference")}
              {field("due", "Estimated delivery", "date")}
            </>
          )}
          <button type="submit" disabled={busy || !snapshot || (action === "updateOrderContext" && !contextOrder)}>
            {busy ? "Saving…" : "Save shared data"}
          </button>
        </form>
        <p>
          Use the same partner ID or SKU to update details. Product edits
          preserve stock; use Receive stock for additions. Order references are
          unique per partner.
        </p>
      </details>
      <nav aria-label="Shared record types">
        {labels.map((label) => (
          <button
            key={label}
            aria-pressed={tab === label}
            onClick={() => setTab(label)}
          >
            {label} (
            {label === "outbox"
              ? (snapshot?.outbox.length ?? 0)
              : (data?.[label].length ?? 0)}
            )
          </button>
        ))}
      </nav>
      <div className="shared-table">
        <table>
          <thead>
            <tr>
              <th>Record</th>
              <th>Details</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => {
              const record = item as unknown as Record<string, unknown>;
              const id = String(record.id ?? record.sku ?? index);
              return (
                <tr key={id}>
                  <td>{String(record.name ?? record.subject ?? id)}{record.testOnly === true && <p>REFERENCE ONLY</p>}</td>
                  <td>
                    <pre>{JSON.stringify(item, null, 2)}</pre>
                  </td>
                  <td>
                    {tab === "orders" &&
                      !record.testOnly && ["new", "short", "ready"].includes(
                        String(record.status),
                      ) && (
                        <button
                          disabled={busy}
                          onClick={() => void run({ action: "runOrder", id })}
                        >
                          {record.status === "ready"
                            ? "Create shipment"
                            : "Check and reserve stock"}
                        </button>
                      )}
                    {tab === "shipments" && record.status !== "delivered" && (
                      <button
                        disabled={busy}
                        onClick={() => void run({ action: "runShipment", id })}
                      >
                        {record.status === "preparing"
                          ? "Dispatch manually"
                          : "Record delivered"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p>No shared {tab} yet. No demonstration records are imported.</p>
        )}
      </div>
    </section>
  );
}
