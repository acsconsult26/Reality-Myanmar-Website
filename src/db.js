import { supabase } from "./supabaseClient";

// SELL → insert a listing
export async function saveListing({ property, seller, listing }) {
  const { data, error } = await supabase.from("listings").insert({
    property_id: property.propertyId,
    area_sqft: property.areaSqftNum,
    perimeter_ft: property.perimeterFtNum,
    center_lat: property.lat,
    center_lng: property.lng,
    boundary: property.boundary,
    property_type: listing.type,
    price: Number(listing.price) || null,
    currency: listing.currency,
    negotiable: listing.negotiable === "Yes",
    payment_terms: listing.paymentTerms,
    seller_name: seller.fullName,
    seller_nrc: seller.nrc,
    seller_phone: seller.phone,
    seller_address: seller.address,
  }).select().single();
  if (error) throw error;
  return data;
}

// BUY → insert an application + its stakeholders
export async function savePurchase({ property, payment, shareholders, listingId = null }) {
  const { data: app, error } = await supabase.from("purchase_applications").insert({
    listing_id: listingId,
    property_id: property.propertyId,
    agreed_price: Number(payment.agreedPrice) || null,
    currency: payment.currency,
    payment_method: payment.method,
    down_payment: Number(payment.downPayment) || null,
    installments: Number(payment.installments) || null,
    frequency: payment.frequency,
    bank_name: payment.bankName || null,
    tenure: Number(payment.tenure) || null,
  }).select().single();
  if (error) throw error;

  const rows = shareholders.map((s) => ({
    application_id: app.id,
    full_name: s.fullName,
    nrc: s.nrc,
    phone: s.phone,
    address: s.address,
    share_pct: Number(s.share) || 0,
  }));
  const { error: shErr } = await supabase.from("stakeholders").insert(rows);
  if (shErr) throw shErr;
  return app;
}

// Load all listings (newest first) — for the SAVED LISTINGS panel
export async function getListings() {
  const { data, error } = await supabase
    .from("listings").select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Delete a listing by its row id
export async function deleteListing(id) {
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) throw error;
}

// Load buyer applications (newest first), each with its stakeholders
export async function getApplications() {
  const { data, error } = await supabase
    .from("purchase_applications")
    .select("*, stakeholders(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}