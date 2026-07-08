import { useEffect, useState } from "react";
import { getApplications } from "./db";

export default function BuyerList({ reloadSignal }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await getApplications();
        if (active) setApps(data || []);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [reloadSignal]);

  if (loading) return <div className="p-3 text-sm text-gray-500">Loading…</div>;
  if (error) return <div className="p-3 text-sm text-red-600">Failed: {error}</div>;
  if (apps.length === 0) return <div className="p-3 text-sm text-gray-400">No buyers yet.</div>;

  return (
    <div className="p-3 space-y-3">
      {apps.map((a) => (
        <div key={a.id} className="border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="font-bold text-blue-800">{a.property_id || "—"}</div>
            <div className="text-green-700 font-semibold text-sm">
              {a.agreed_price} {a.currency}
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{a.payment_method}</div>

          <div className="mt-2 space-y-1">
            {(a.stakeholders || []).map((s) => (
              <div key={s.id} className="text-xs bg-gray-50 rounded-lg px-2 py-1 flex justify-between">
                <span className="font-medium text-gray-800">{s.full_name || "—"}</span>
                <span className="text-gray-500">{s.share_pct}% · {s.phone}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}