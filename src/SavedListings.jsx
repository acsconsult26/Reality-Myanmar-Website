// import { useEffect, useState } from "react";
// import { getListings } from "./db";
// import { ChevronLeft, Trash2 } from "lucide-react";


// const currencyShort = (c) =>
//   c === "Lakhs" ? "L" : c === "Crore" ? "Cr" : c === "MMK" ? "Ks" : c || "";

// export default function SavedListings({ reloadSignal, onView, onBuy, onClose, onDelete }) {  const [listings, setListings] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     let active = true;
//     (async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         const data = await getListings();
//         if (active) setListings(data || []);
//       } catch (e) {
//         if (active) setError(e.message);
//       } finally {
//         if (active) setLoading(false);
//       }
//     })();
//     return () => { active = false; };
//   }, [reloadSignal]);

//   const handleDelete = async (listing) => {
//     if (!window.confirm(`Delete listing ${listing.property_id}?`)) return;
//     // remove from the list immediately (optimistic UI)
//     setListings((prev) => prev.filter((x) => x.id !== listing.id));
//     try {
//       await onDelete?.(listing); // parent deletes from DB + clears the map
//     } catch (e) {
//       setError("Delete failed: " + e.message);
//       // put it back if the DB delete failed
//       setListings((prev) => [listing, ...prev]);
//     }
//   };

//   return (
//     <div className="absolute top-0 left-0 h-full w-72 z-20 bg-white shadow-xl flex flex-col">
//       {/* Header */}
//       <div className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between">
//         <div>
//           <div className="font-bold tracking-wide">SAVED LISTINGS</div>
//           <div className="text-xs text-blue-200">TOTAL: {listings.length}</div>
//         </div>
//         <button
//           onClick={onClose}
//           className="text-white/80 hover:text-white cursor-pointer"
//           title="Hide"
//         >
//           <ChevronLeft size={18} />
//         </button>
//       </div>

//       {/* List */}
//       <div className="flex-1 overflow-y-auto p-3 space-y-3">
//         {loading && <div className="text-sm text-gray-500">Loading…</div>}
//         {error && <div className="text-sm text-red-600">Failed to load: {error}</div>}
//         {!loading && !error && listings.length === 0 && (
//           <div className="text-sm text-gray-400">
//             No listings yet. Draw a plot, click Sell, and save one.
//           </div>
//         )}

//         {listings.map((l) => (
//           <div key={l.id} className="border border-gray-200 rounded-xl p-3 shadow-sm">
//             <div className="flex justify-between items-start gap-2">
//               <div className="font-bold text-blue-800">{l.property_id}</div>
//               <div className="text-green-700 font-semibold text-sm whitespace-nowrap">
//                 {l.price} {currencyShort(l.currency)}
//               </div>
//             </div>
//             <div className="text-xs text-gray-500 mt-1 truncate">
//               {l.description || l.property_type || "—"}
//             </div>
//             {/* <div className="flex items-center justify-between mt-3">
//               <button
//                 onClick={() => onBuy?.(l)}
//                 className="text-xs bg-blue-50 text-blue-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-100 cursor-pointer"
//               >
//                 BUY
//               </button>
//               <button
//                 onClick={() => onView?.(l)}
//                 className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
//               >
//                 VIEW ON MAP →
//               </button>
//             </div> */}

// <div className="flex items-center justify-between mt-3">
//               <button
//                 onClick={() => onBuy?.(l)}
//                 className="text-xs bg-blue-50 text-blue-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-100 cursor-pointer"
//               >
//                 BUY
//               </button>
//               <div className="flex items-center gap-3">
//                 <button
//                   onClick={() => onView?.(l)}
//                   className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
//                 >
//                   VIEW ON MAP →
//                 </button>
//                 <button
//                   onClick={() => handleDelete(l)}
//                   title="Delete"
//                   className="text-red-400 hover:text-gray-600 cursor-pointer"
//                 >
//                   <Trash2 size={15} />
//                 </button>
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from "react";
import { getListings, getApplications } from "./db";
import { ChevronLeft, Trash2 } from "lucide-react";

const currencyShort = (c) =>
  c === "Lakhs" ? "L" : c === "Crore" ? "Cr" : c === "MMK" ? "Ks" : c || "";

export default function SavedListings({ reloadSignal, onView, onBuy, onClose, onDelete }) {
  const [tab, setTab] = useState("listings"); // "listings" | "buyers"
  const [listings, setListings] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [l, a] = await Promise.all([getListings(), getApplications()]);
        if (active) { setListings(l || []); setApps(a || []); }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [reloadSignal]);

  const handleDelete = async (listing) => {
    if (!window.confirm(`Delete listing ${listing.property_id}?`)) return;
    setListings((prev) => prev.filter((x) => x.id !== listing.id));
    try {
      await onDelete?.(listing);
    } catch (e) {
      setError("Delete failed: " + e.message);
      setListings((prev) => [listing, ...prev]);
    }
  };

  return (
    <div className="absolute top-0 left-0 h-full w-72 z-20 bg-white shadow-xl flex flex-col">
      {/* Header */}
      <div className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="font-bold tracking-wide">SAVED</div>
        <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer" title="Hide">
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setTab("listings")}
          className={`flex-1 py-2 text-sm font-semibold cursor-pointer ${
            tab === "listings" ? "text-blue-700 border-b-2 border-blue-700" : "text-gray-500"
          }`}
        >
          Listings ({listings.length})
        </button>
        <button
          onClick={() => setTab("buyers")}
          className={`flex-1 py-2 text-sm font-semibold cursor-pointer ${
            tab === "buyers" ? "text-blue-700 border-b-2 border-blue-700" : "text-gray-500"
          }`}
        >
          Buyers ({apps.length})
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && <div className="text-sm text-gray-500">Loading…</div>}
        {error && <div className="text-sm text-red-600">Failed: {error}</div>}

        {/* LISTINGS TAB */}
        {!loading && tab === "listings" && listings.length === 0 && (
          <div className="text-sm text-gray-400">No listings yet.</div>
        )}
        {!loading && tab === "listings" && listings.map((l) => (
          <div key={l.id} className="border border-gray-200 rounded-xl p-3 shadow-sm">
            <div className="flex justify-between items-start gap-2">
              <div className="font-bold text-blue-800">{l.property_id}</div>
              <div className="text-green-700 font-semibold text-sm whitespace-nowrap">
                {l.price} {currencyShort(l.currency)}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1 truncate">
              {l.description || l.property_type || "—"}
            </div>
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={() => onBuy?.(l)}
                className="text-xs bg-blue-50 text-blue-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-100 cursor-pointer"
              >
                BUY
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onView?.(l)}
                  className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  VIEW ON MAP →
                </button>
                <button
                  onClick={() => handleDelete(l)}
                  title="Delete"
                  className="text-red-400 hover:text-gray-600 cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* BUYERS TAB */}
        {!loading && tab === "buyers" && apps.length === 0 && (
          <div className="text-sm text-gray-400">No buyers yet.</div>
        )}
        {!loading && tab === "buyers" && apps.map((a) => (
          <div key={a.id} className="border border-gray-200 rounded-xl p-3 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="font-bold text-blue-800">{a.property_id || "—"}</div>
              <div className="text-green-700 font-semibold text-sm">
                {a.agreed_price} {currencyShort(a.currency)}
                
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{a.payment_method}</div>
            <div className="mt-2 space-y-1">
              {(a.stakeholders || []).map((s) => (
                <div key={s.id} className="text-xs bg-gray-50 rounded-lg px-2 py-1 flex justify-between gap-2">
                  <span className="font-medium text-gray-800 truncate">{s.full_name || "—"}</span>
                  <span className="text-gray-500 whitespace-nowrap">{s.share_pct}% · {s.phone}</span>
                  <button
                  onClick={() => handleDelete(l)}
                  title="Delete"
                  className="text-red-400 hover:text-gray-600 cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}