import { useState } from "react";
import { X, Plus, Trash2, Phone } from "lucide-react";

/**
 * PropertyForms — Sell and Buy forms shown after the user picks Buy/Sell.
 * No database yet: onSave receives the collected data (currently just logged).
 *
 * Usage (from PropertyMap.jsx):
 *   <SellForm property={{ propertyId, areaSqft, gps }} onCancel={...} onSave={...} />
 *   <BuyForm  property={{ propertyId, areaSqft, gps }} onCancel={...} onSave={...} />
 */

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const label = "block text-xs font-medium text-gray-600 mb-1";

function PropertySummary({ property }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-2 text-sm mb-5">
      <div>
        <div className="text-xs text-gray-500">ID</div>
        <b className="text-blue-700">{property?.propertyId || "—"}</b>
      </div>
      <div>
        <div className="text-xs text-gray-500">Area</div>
        <b>{property?.areaSqft || "—"} sq ft</b>
      </div>
      <div>
        <div className="text-xs text-gray-500">GPS</div>
        <b className="text-xs">{property?.gps || "—"}</b>
      </div>
    </div>
  );
}

function Modal({ title, children, onCancel, onSave, saveLabel = "Save", saveDisabled = false }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-blue-800">{title}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">{children}</div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saveDisabled}
            className={
              "px-5 py-2 rounded-lg text-white font-medium " +
              (saveDisabled
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 cursor-pointer")
            }
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- SELL FORM ---------------------------- */
export function SellForm({ property, onCancel, onSave }) {
  const [seller, setSeller] = useState({ fullName: "", nrc: "", phone: "", address: "" });
  const [listing, setListing] = useState({
    type: "Land",
    price: "",
    currency: "Lakhs",
    negotiable: "Yes",
    paymentTerms: "Total Amount Once",
  });

  const setF = (obj, setObj, key) => (e) => setObj({ ...obj, [key]: e.target.value });

  const handleSave = () => {
    onSave?.({ kind: "sell", property, seller, listing });
  };

  return (
    <Modal title="Sell Property" onCancel={onCancel} onSave={handleSave} saveLabel="Save Listing">
      <PropertySummary property={property} />

      <h3 className="text-sm font-bold text-green-700 underline mb-3">SELLER INFORMATION</h3>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div>
          <label className={label}>Full Name</label>
          <input className={input} placeholder="Full Name"
            value={seller.fullName} onChange={setF(seller, setSeller, "fullName")} />
        </div>
        <div>
          <label className={label}>NRC Number</label>
          <input className={input} placeholder="NRC Number"
            value={seller.nrc} onChange={setF(seller, setSeller, "nrc")} />
        </div>
        <div>
          <label className={label}>Phone Number</label>
          <input className={input} placeholder="Phone Number"
            value={seller.phone} onChange={setF(seller, setSeller, "phone")} />
        </div>
        <div className="col-span-2">
          <label className={label}>Full Address</label>
          <textarea className={input} rows={2} placeholder="Full Address"
            value={seller.address} onChange={setF(seller, setSeller, "address")} />
        </div>
      </div>

      <h3 className="text-sm font-bold text-blue-700 underline mb-3">LISTING DETAILS</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Property Type</label>
          <select className={input} value={listing.type} onChange={setF(listing, setListing, "type")}>
            <option>Land</option><option>House</option><option>Apartment</option>
            <option>Commercial</option><option>Agricultural</option>
          </select>
        </div>
        <div>
          <label className={label}>Asking Price</label>
          <input className={input} type="number" placeholder="e.g. 10000"
            value={listing.price} onChange={setF(listing, setListing, "price")} />
        </div>
        <div>
          <label className={label}>Currency</label>
          <select className={input} value={listing.currency} onChange={setF(listing, setListing, "currency")}>
            <option>Lakhs</option><option>Crore</option><option>MMK</option>
          </select>
        </div>
        <div>
          <label className={label}>Negotiable</label>
          <select className={input} value={listing.negotiable} onChange={setF(listing, setListing, "negotiable")}>
            <option>Yes</option><option>No</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className={label}>Payment Terms</label>
          <select className={input} value={listing.paymentTerms} onChange={setF(listing, setListing, "paymentTerms")}>
            <option>Total Amount Once</option><option>Installments</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------- BUY FORM ---------------------------- */
export function BuyForm({
  property,
  seller = { name: "U Aung Min", phone: "09790000000" }, // sample until DB
  onCancel,
  onSave,
}) {
  const [shareholders, setShareholders] = useState([
    { fullName: "", share: 100, nrc: "", phone: "", address: "" },
  ]);
  const [payment, setPayment] = useState({
    agreedPrice: "",
    currency: "Lakhs",
    method: "Full Cash",
    downPayment: "",
    installments: "",
    frequency: "Monthly",
    bankName: "",
    tenure: "",
  });

  const totalShare = shareholders.reduce((s, sh) => s + Number(sh.share || 0), 0);
  const setP = (key) => (e) => setPayment({ ...payment, [key]: e.target.value });

  const updateSh = (i, key, val) => {
    const next = shareholders.slice();
    next[i] = { ...next[i], [key]: val };
    setShareholders(next);
  };
  const addSh = () =>
    setShareholders([...shareholders, { fullName: "", share: 0, nrc: "", phone: "", address: "" }]);
  const removeSh = (i) => setShareholders(shareholders.filter((_, idx) => idx !== i));

  const handleSave = () => {
    onSave?.({ kind: "buy", property, seller, shareholders, payment });
  };

  return (
    <Modal
      title="Buy Property"
      onCancel={onCancel}
      onSave={handleSave}
      saveLabel="Submit"
      saveDisabled={totalShare !== 100}
    >
      <PropertySummary property={property} />

      {/* Seller contact (read-only) + Call */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Seller / Owner</div>
          <div className="font-semibold text-gray-800">{seller.name}</div>
          <div className="text-sm text-gray-600">{seller.phone}</div>
        </div>
        <a
          href={`tel:${seller.phone}`}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 cursor-pointer"
        >
          <Phone size={16} /> Call
        </a>
      </div>

      {/* Buyer stakeholders */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-blue-700 underline">BUYER / STAKEHOLDERS</h3>
        <button
          onClick={addSh}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-700 cursor-pointer"
        >
          <Plus size={14} /> Add Stakeholder
        </button>
      </div>

      <div className="space-y-3 mb-3">
        {shareholders.map((sh, i) => (
          <div key={i} className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 relative">
            <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
              {i + 1}
            </div>
            {shareholders.length > 1 && (
              <button
                onClick={() => removeSh(i)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-600 cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <input className={`${input} col-span-2`} placeholder="Full Name"
                value={sh.fullName} onChange={(e) => updateSh(i, "fullName", e.target.value)} />
              <div className="flex items-center gap-1">
                <input className={input} type="number" placeholder="100"
                  value={sh.share} onChange={(e) => updateSh(i, "share", e.target.value)} />
                <span className="text-gray-500 text-sm">%</span>
              </div>
              <input className={`${input} col-span-3`} placeholder="NRC Number"
                value={sh.nrc} onChange={(e) => updateSh(i, "nrc", e.target.value)} />
              <input className={`${input} col-span-3`} placeholder="Phone Number"
                value={sh.phone} onChange={(e) => updateSh(i, "phone", e.target.value)} />
              <textarea className={`${input} col-span-3`} rows={2} placeholder="Full Address"
                value={sh.address} onChange={(e) => updateSh(i, "address", e.target.value)} />
            </div>
          </div>
        ))}
      </div>

      <div
        className={
          "rounded-lg p-2 text-center text-sm font-semibold mb-6 " +
          (totalShare === 100 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")
        }
      >
        Total Ownership: {totalShare}%
      </div>

      {/* Payment */}
      <h3 className="text-sm font-bold text-blue-700 underline mb-3">PAYMENT</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Agreed Price</label>
          <input className={input} type="number" placeholder="e.g. 10000"
            value={payment.agreedPrice} onChange={setP("agreedPrice")} />
        </div>
        <div>
          <label className={label}>Currency</label>
          <select className={input} value={payment.currency} onChange={setP("currency")}>
            <option>Lakhs</option><option>Crore</option><option>MMK</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className={label}>Payment Method</label>
          <select className={input} value={payment.method} onChange={setP("method")}>
            <option>Full Cash</option>
            <option>Cash Down + Installments</option>
            <option>Bank Loan</option>
          </select>
        </div>

        {payment.method === "Cash Down + Installments" && (
          <>
            <div>
              <label className={label}>Down Payment</label>
              <input className={input} type="number" placeholder="Down payment"
                value={payment.downPayment} onChange={setP("downPayment")} />
            </div>
            <div>
              <label className={label}>No. of Installments</label>
              <input className={input} type="number" placeholder="e.g. 12"
                value={payment.installments} onChange={setP("installments")} />
            </div>
            <div className="col-span-2">
              <label className={label}>Installment Frequency</label>
              <select className={input} value={payment.frequency} onChange={setP("frequency")}>
                <option>Monthly</option><option>Quarterly</option><option>Yearly</option>
              </select>
            </div>
          </>
        )}

        {payment.method === "Bank Loan" && (
          <>
            <div>
              <label className={label}>Down Payment</label>
              <input className={input} type="number" placeholder="Down payment"
                value={payment.downPayment} onChange={setP("downPayment")} />
            </div>
            <div>
              <label className={label}>Bank Name</label>
              <input className={input} placeholder="e.g. KBZ Bank"
                value={payment.bankName} onChange={setP("bankName")} />
            </div>
            <div className="col-span-2">
              <label className={label}>Loan Tenure (months)</label>
              <input className={input} type="number" placeholder="e.g. 60"
                value={payment.tenure} onChange={setP("tenure")} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}