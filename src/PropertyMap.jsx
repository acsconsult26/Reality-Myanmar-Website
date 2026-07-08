import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { Pencil, Trash2, Search, Layers, X, Check, List } from "lucide-react";
import { SellForm, BuyForm } from "./PropertyForms";
import { saveListing, savePurchase, deleteListing } from "./db";
import SavedListings from "./SavedListings";   
/**
 * PropertyMap — Google Maps satellite measure tool.
 *
 * Area & distance use Google's geodesic geometry library (computeArea /
 * computeDistanceBetween) — the same math as Google's "Measure distance",
 * so values match Google's tool closely.
 *
 * Flow:
 *   1. Click Draw (pencil).
 *   2. Click a starting point, then keep clicking corners (as many as you want).
 *   3. Close the boundary by clicking the FIRST point again (or Finish).
 *   4. A center modal shows the ID, GPS, and area with Buy / Sell buttons.
 *
 * No database yet.
 *
 * Setup:
 *   npm install @googlemaps/js-api-loader lucide-react
 *   .env:  VITE_GOOGLE_MAPS_API_KEY=your_maps_key
 *   Enable: Maps JavaScript API, Places API, Geocoding API.
 */

const SQM_TO_SQFT = 10.76391041671;
const M_TO_FT = 3.280839895;

const DEFAULT_CENTER = { lat: 16.7775, lng: 96.1647 };
const DEFAULT_ZOOM = 18;

setOptions({ key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, v: "weekly" });

const genPropertyId = () => "RE-" + Math.floor(10000 + Math.random() * 90000);
const fmt2 = (n) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PropertyMap() {
  const mapEl = useRef(null);
  const mapObj = useRef(null);
  const lineRef = useRef(null);      // open chain shown WHILE drawing
  const polyRef = useRef(null);      // closed editable polygon AFTER closing
  const pathRef = useRef(null);      // shared path (MVCArray) for both
  const ghostRef = useRef(null);     // line from last point to cursor
  const dotsRef = useRef([]);        // vertex dots while drawing
  const labelsRef = useRef([]);
  const LabelClassRef = useRef(null);
  const propertyIdRef = useRef(null);
  const finishedRef = useRef(false);
  const recomputeRef = useRef(() => {});
  const closeShapeRef = useRef(() => {});
  const searchEl = useRef(null);
  const geocoderRef = useRef(null);
  const modeRef = useRef("pan");
  const viewPolyRef = useRef(null);   // ← add: a saved listing's boundary
  const viewInfoRef = useRef(null);   // ← add: its popup

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [mapType, setMapType] = useState("hybrid");
  const [pointCount, setPointCount] = useState(0);
  const [areaSqft, setAreaSqft] = useState(0);
  const [areaSqm, setAreaSqm] = useState(0);
  const [perimFt, setPerimFt] = useState(0);
  const [perimM, setPerimM] = useState(0);
  const [propertyId, setPropertyId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [gps, setGps] = useState("");
  const [listingType, setListingType] = useState(null);
  const [reloadSignal, setReloadSignal] = useState(0);      // ← add
  const [activeListing, setActiveListing] = useState(null); // ← add
  const [showListings, setShowListings] = useState(false);   // panel hidden by default

  const setDrawMode = useCallback((on) => {
    modeRef.current = on ? "draw" : "pan";
    setDrawing(on);
    if (mapObj.current) {
      mapObj.current.setOptions({
        draggableCursor: on ? "crosshair" : null,
        disableDoubleClickZoom: on,
      });
    }
  }, []);

  const recompute = () => {
    const map = mapObj.current;
    const path = pathRef.current;
    if (!path) return;
    const arr = path.getArray();
    const n = arr.length;
    setPointCount(n);

    const closed = finishedRef.current && n >= 3;

    // edges: open chain while drawing, closed loop after finishing
    const edges = [];
    if (n >= 2) {
      const lim = closed ? n : n - 1;
      for (let i = 0; i < lim; i++) edges.push([arr[i], arr[(i + 1) % n]]);
    }

    const Label = LabelClassRef.current;
    const lab = labelsRef.current;
    while (lab.length > edges.length) lab.pop().setMap(null);
    let perim = 0;
    edges.forEach(([a, b], i) => {
      const d = google.maps.geometry.spherical.computeDistanceBetween(a, b);
      perim += d;
      const mid = google.maps.geometry.spherical.interpolate(a, b, 0.5);
      const text = fmt2(d * M_TO_FT) + " ft";
      if (lab[i]) lab[i].update(mid, text);
      else { lab[i] = new Label(mid, text); lab[i].setMap(map); }
    });

    // Geodesic area — same model as Google's Measure distance tool.
    const sqm = n >= 3 ? google.maps.geometry.spherical.computeArea(arr) : 0;
    setAreaSqm(sqm);
    setAreaSqft(sqm * SQM_TO_SQFT);
    setPerimM(perim);
    setPerimFt(perim * M_TO_FT);

    if (n >= 3 && !propertyIdRef.current) {
      const id = genPropertyId();
      propertyIdRef.current = id;
      setPropertyId(id);
    }
  };
  recomputeRef.current = recompute;

  const removeDots = () => {
    dotsRef.current.forEach((d) => d.setMap(null));
    dotsRef.current = [];
  };

  const makeDot = (latLng, isFirst) =>
    new google.maps.Marker({
      position: latLng,
      map: mapObj.current,
      zIndex: 30,
      title: isFirst ? "Click here to close the boundary" : "",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: isFirst ? 7 : 5,
        fillColor: isFirst ? "#1a73e8" : "#ffffff",
        fillOpacity: 1,
        strokeColor: isFirst ? "#ffffff" : "#1a73e8",
        strokeWeight: 2,
      },
    });

  const addPoint = (latLng) => {
    const isFirst = pathRef.current.getLength() === 0;
    pathRef.current.push(latLng); // fires insert_at -> recompute
    const dot = makeDot(latLng, isFirst);
    if (isFirst) dot.addListener("click", () => closeShapeRef.current());
    dotsRef.current.push(dot);
  };

  const updateGhost = (cursor) => {
    const path = pathRef.current;
    if (!ghostRef.current || !path) return;
    const n = path.getLength();
    ghostRef.current.setPath(n === 0 ? [] : [path.getAt(n - 1), cursor]);
  };

  const closeShape = () => {
    const path = pathRef.current;
    if (!path || path.getLength() < 3) return;
    finishedRef.current = true;
    setFinished(true);
    removeDots();
    if (ghostRef.current) ghostRef.current.setPath([]);
    if (lineRef.current) lineRef.current.setVisible(false); // hide open chain
    if (polyRef.current) {
      polyRef.current.setMap(mapObj.current); // show closed shaded polygon
      polyRef.current.setEditable(true);      // native drag/insert/delete
    }

    // plot center for GPS readout
    const pts = path.getArray();
    let clat = 0, clng = 0;
    pts.forEach((p) => { clat += p.lat(); clng += p.lng(); });
    setGps((clat / pts.length).toFixed(6) + ", " + (clng / pts.length).toFixed(6));

    setShowModal(true);
    setDrawMode(false);
    recompute();
  };
  closeShapeRef.current = closeShape;

  const clearAll = useCallback(() => {
    if (pathRef.current) pathRef.current.clear();
    removeDots();
    if (ghostRef.current) ghostRef.current.setPath([]);
    if (lineRef.current) lineRef.current.setVisible(true);
    if (polyRef.current) { polyRef.current.setEditable(false); polyRef.current.setMap(null); }
    labelsRef.current.forEach((o) => o.setMap(null));
    labelsRef.current = [];
    propertyIdRef.current = null;
    finishedRef.current = false;
    setFinished(false);
    setPropertyId(null);
    setPointCount(0);
    setAreaSqft(0); setAreaSqm(0); setPerimFt(0); setPerimM(0);
    setShowModal(false);
    setGps("");
    setListingType(null);
  }, []);

  const startDraw = useCallback(() => {
    clearAll();
    setDrawMode(true);
  }, [clearAll, setDrawMode]);

  const handleDelete = useCallback(() => {
    clearAll();
    setDrawMode(false);
  }, [clearAll, setDrawMode]);

  const handleAction = useCallback((type) => {
    setListingType(type);
    setShowModal(false);
  }, []);

  const handleView = (listing) => {
    const map = mapObj.current;
    if (!map) return;
    if (viewPolyRef.current) viewPolyRef.current.setMap(null);
    if (viewInfoRef.current) viewInfoRef.current.close();

    const boundary = Array.isArray(listing.boundary) ? listing.boundary : [];

    if (boundary.length >= 3) {
      viewPolyRef.current = new google.maps.Polygon({
        map,
        paths: boundary,
        fillColor: "#1a73e8", fillOpacity: 0.15,
        strokeColor: "#1a73e8", strokeWeight: 3,
        clickable: false,
      });
      const bounds = new google.maps.LatLngBounds();
      boundary.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds);
    } else if (listing.center_lat && listing.center_lng) {
      map.setCenter({ lat: Number(listing.center_lat), lng: Number(listing.center_lng) });
      map.setZoom(18);
    }

    const center = { lat: Number(listing.center_lat), lng: Number(listing.center_lng) };
    if (!viewInfoRef.current) viewInfoRef.current = new google.maps.InfoWindow();
    viewInfoRef.current.setContent(
      `<div style="font-family:system-ui"><b>ID: ${listing.property_id}</b><br/>Price: ${listing.price} ${listing.currency}</div>`
    );
    viewInfoRef.current.setPosition(center);
    viewInfoRef.current.open(map);
  };

  const handleBuyListing = (listing) => {
    setActiveListing(listing);
    setListingType("buy");
  };

  const handleDeleteListing = async (listing) => {
    await deleteListing(listing.id); // remove from Supabase (throws on failure)
    // if this listing's boundary is currently shown on the map, clear it
    if (viewPolyRef.current) { viewPolyRef.current.setMap(null); viewPolyRef.current = null; }
    if (viewInfoRef.current) viewInfoRef.current.close();
  };
  

  const doSearch = useCallback(() => {
    const q = searchEl.current?.value?.trim();
    if (!q || !geocoderRef.current) return;
    geocoderRef.current.geocode({ address: q }, (results, status) => {
      if (status === "OK" && results[0]) {
        const r = results[0];
        if (r.geometry.viewport) mapObj.current.fitBounds(r.geometry.viewport);
        else { mapObj.current.setCenter(r.geometry.location); mapObj.current.setZoom(18); }
      } else {
        setError("Location not found. Try a more specific search.");
        setTimeout(() => setError(null), 2500);
      }
    });
  }, []);

  const toggleMapType = useCallback(() => {
    const next = mapType === "hybrid" ? "roadmap" : "hybrid";
    setMapType(next);
    if (mapObj.current) mapObj.current.setMapTypeId(next);
  }, [mapType]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await importLibrary("maps");
        await importLibrary("geometry");
        await importLibrary("places");
        await importLibrary("geocoding");
        if (cancelled) return;

        class LabelOverlay extends google.maps.OverlayView {
          constructor(position, text) { super(); this.position = position; this.text = text; this.div = null; }
          onAdd() {
            const d = document.createElement("div");
            d.style.cssText =
              "position:absolute;transform:translate(-50%,-50%);background:#fff;color:#202124;" +
              "font:600 11px system-ui;padding:2px 7px;border-radius:12px;" +
              "box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap;pointer-events:none";
            d.textContent = this.text;
            this.div = d;
            this.getPanes().floatPane.appendChild(d);
          }
          draw() {
            if (!this.div) return;
            const p = this.getProjection().fromLatLngToDivPixel(this.position);
            if (p) { this.div.style.left = p.x + "px"; this.div.style.top = p.y + "px"; }
          }
          update(position, text) {
            this.position = position; this.text = text;
            if (this.div) this.div.textContent = text;
            this.draw();
          }
          onRemove() { if (this.div) { this.div.remove(); this.div = null; } }
        }
        LabelClassRef.current = LabelOverlay;

        const map = new google.maps.Map(mapEl.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeId: "hybrid",
          tilt: 0,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapObj.current = map;
        geocoderRef.current = new google.maps.Geocoder();

        // Shared path used by both the drawing line and the final polygon.
        const path = new google.maps.MVCArray();
        pathRef.current = path;

        lineRef.current = new google.maps.Polyline({
          map, path, editable: false, clickable: false,
          strokeColor: "#1a73e8", strokeWeight: 3, zIndex: 3,
        });
        ghostRef.current = new google.maps.Polyline({
          map, path: [], clickable: false,
          strokeColor: "#1a73e8", strokeOpacity: 0.5, strokeWeight: 2, zIndex: 2,
        });
        polyRef.current = new google.maps.Polygon({
          paths: path, clickable: false, editable: false,
          fillColor: "#1a73e8", fillOpacity: 0.18,
          strokeColor: "#1a73e8", strokeWeight: 3, zIndex: 1,
          map: null, // shown only after closing
        });

        ["insert_at", "set_at", "remove_at"].forEach((ev) =>
          google.maps.event.addListener(path, ev, () => recomputeRef.current())
        );

        google.maps.event.addListener(map, "click", (e) => {
          if (modeRef.current === "draw") addPoint(e.latLng);
        });
        google.maps.event.addListener(map, "mousemove", (e) => {
          if (modeRef.current === "draw") updateGhost(e.latLng);
        });

        if (searchEl.current) {
          try {
            const ac = new google.maps.places.Autocomplete(searchEl.current, { fields: ["geometry"] });
            ac.bindTo("bounds", map);
            ac.addListener("place_changed", () => {
              const place = ac.getPlace();
              if (place.geometry?.viewport) map.fitBounds(place.geometry.viewport);
              else if (place.geometry?.location) { map.setCenter(place.geometry.location); map.setZoom(18); }
            });
          } catch (e) {
            console.warn("Autocomplete unavailable, using Search button only.", e);
          }
        }

        setReady(true);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e.message || "Failed to load Google Maps");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showPanel = drawing || pointCount > 0;
  const canFinish = drawing && pointCount >= 3;

  return (
    <div className="relative w-full h-full min-h-screen">
      <div ref={mapEl} className="absolute inset-0" />
      {/* <SavedListings
        reloadSignal={reloadSignal}
        onView={handleView}
        onBuy={handleBuyListing}
      /> */}
      {showListings && (
        <SavedListings
          reloadSignal={reloadSignal}
          onView={handleView}
          onBuy={handleBuyListing}
          onClose={() => setShowListings(false)}
          onDelete={handleDeleteListing}
        />
      )}
      {/* Search bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex shadow-lg rounded-lg overflow-hidden bg-white">
        <input
          ref={searchEl}
          type="text"
          placeholder="Search a location…"
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          className="px-4 py-2 w-72 outline-none text-sm"
        />
        <button
          onClick={doSearch}
          className="bg-blue-600 text-white px-5 text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
        >
          <Search size={16} /> Search
        </button>
      </div>

      {/* Toolbar (left): Draw + Delete */}
      {/* <div className="absolute top-1/2 -translate-y-1/2 left-3 z-10 flex flex-col gap-1 bg-white rounded-xl shadow-lg p-1">
        <button
          title="Draw boundary"
          disabled={!ready}
          onClick={startDraw}
          className={`p-2.5 rounded-lg transition disabled:opacity-40 ${
            drawing ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <Pencil size={18} />
        </button>
        <button
          title="Delete"
          disabled={!ready}
          onClick={handleDelete}
          className="p-2.5 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        >
          <Trash2 size={18} />
        </button>
      </div> */}
      {/* Toolbar (left): Draw + Delete + Listings toggle — always visible */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1 bg-white rounded-xl shadow-lg p-1 transition-all duration-200 ${
          showListings ? "left-[19rem]" : "left-3"
        }`}
      >
        <button
          title="Draw boundary"
          disabled={!ready}
          onClick={startDraw}
          className={`p-2.5 rounded-lg transition disabled:opacity-40 ${
            drawing ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <Pencil size={18} />
        </button>
        <button
          title="Delete"
          disabled={!ready}
          onClick={handleDelete}
          className="p-2.5 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        >
          <Trash2 size={18} />
        </button>
        <div className="h-px bg-gray-200 my-1" />
        <button
          title="Saved listings"
          onClick={() => setShowListings((v) => !v)}
          className={`p-2.5 rounded-lg transition ${
            showListings ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          <List size={18} />
        </button>
      </div>

      {/* Map / Satellite toggle (bottom-right) */}
      <button
        onClick={toggleMapType}
        disabled={!ready}
        className="absolute bottom-6 right-4 z-10 bg-white shadow-lg rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
      >
        <Layers size={16} />
        {mapType === "hybrid" ? "Map view" : "Satellite"}
      </button>

      {/* Drawing hint */}
      {drawing && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
          {pointCount === 0
            ? "Click a starting point"
            : pointCount < 3
            ? "Click the next corner — keep adding as many as you need"
            : "Keep clicking, then click the FIRST point (or Finish) to close"}
        </div>
      )}

      {/* Panel (bottom-left) */}
      {showPanel && (
        <div className="absolute bottom-6 left-3 z-10 bg-white rounded-xl shadow-xl p-4 w-72">
          <div className="flex items-start justify-between">
            <div className="font-semibold text-gray-800">Plot measurement</div>
            <button onClick={handleDelete} className="text-gray-400 hover:text-gray-700">
              <X size={16} />
            </button>
          </div>

          {propertyId && (
            <div className="mt-3 text-blue-700 font-bold text-lg">ID: {propertyId}</div>
          )}

          <div className="mt-2 text-sm text-gray-800">
            Area: <b>{fmt2(areaSqft)}</b> ft²
            <span className="text-gray-400"> ({fmt2(areaSqm)} m²)</span>
          </div>
          <div className="text-sm text-gray-800">
            {finished ? "Perimeter" : "Length"}: <b>{fmt2(perimFt)}</b> ft
            <span className="text-gray-400"> ({fmt2(perimM)} m)</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">{pointCount} points</div>

          {canFinish && (
            <button
              onClick={() => closeShapeRef.current()}
              className="mt-3 w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Check size={16} /> Finish (close boundary)
            </button>
          )}

          <p className="text-[11px] text-gray-400 mt-2 leading-snug">
            {finished
              ? "Drag points to adjust • drag a midpoint to add one • right-click to delete."
              : "Tip: the big blue dot is your start — click it to close the shape."}
          </p>
        </div>
      )}

      {/* Center modal after closing the boundary */}
      {showModal && propertyId && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-full p-6">
            <h2 className="text-center text-lg font-bold tracking-wide text-gray-800">
              PROPERTY SUMMARY
            </h2>
            <div className="mt-5 bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <b className="text-gray-900">{propertyId}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">GPS</span>
                <b className="text-gray-900">{gps}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Area</span>
                <b className="text-blue-700">
                  {fmt2(areaSqft)} sq ft
                  <span className="text-gray-400 font-normal"> ({fmt2(areaSqm)} m²)</span>
                </b>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAction("buy")}
                className="py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 cursor-pointer"
              >
                Buy
              </button>
              <button
                onClick={() => handleAction("sell")}
                className="py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Sell
              </button>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sell / Buy forms — open when a Buy/Sell button in the summary is clicked */}
      {/* {listingType === "sell" && (
        <SellForm
          property={{ propertyId, areaSqft: fmt2(areaSqft), gps }}
          onCancel={() => setListingType(null)}
          onSave={(data) => {
            console.log("SELL form data:", data);
            setListingType(null);
          }}
        />
      )}
      {listingType === "buy" && (
        <BuyForm
          property={{ propertyId, areaSqft: fmt2(areaSqft), gps }}
          onCancel={() => setListingType(null)}
          onSave={(data) => {
            console.log("BUY form data:", data);
            setListingType(null);
          }}
        />
      )} */}

      {listingType === "sell" && (
        <SellForm
          property={{ propertyId, areaSqft: fmt2(areaSqft), gps }}
          onCancel={() => setListingType(null)}
          onSave={async (data) => {
            try {
              await saveListing({
                property: {
                  propertyId,
                  areaSqftNum: areaSqft,
                  perimeterFtNum: perimFt,
                  lat: parseFloat(gps.split(",")[0]),
                  lng: parseFloat(gps.split(",")[1]),
                  boundary: pathRef.current.getArray().map((p) => ({ lat: p.lat(), lng: p.lng() })),
                },
                seller: data.seller,
                listing: data.listing,
              });
              setReloadSignal((n) => n + 1);   // ← add: reloads the panel
              setListingType(null);
            } catch (e) {
              setError("Save failed: " + e.message);
            }
          }}
        />
      )}
      {/* {listingType === "buy" && (
        <BuyForm
          property={{ propertyId, areaSqft: fmt2(areaSqft), gps }}
          onCancel={() => setListingType(null)}
          onSave={async (data) => {
            try {
              await savePurchase({
                property: { propertyId },
                payment: data.payment,
                shareholders: data.shareholders,
              });
              setListingType(null);
            } catch (e) {
              setError("Save failed: " + e.message);
            }
          }}
        />
      )} */}
      {listingType === "buy" && (
        <BuyForm
          property={
            activeListing
              ? {
                  propertyId: activeListing.property_id,
                  areaSqft: Number(activeListing.area_sqft).toLocaleString(),
                  gps: `${activeListing.center_lat}, ${activeListing.center_lng}`,
                }
              : { propertyId, areaSqft: fmt2(areaSqft), gps }
          }
          seller={
            activeListing
              ? { name: activeListing.seller_name, phone: activeListing.seller_phone }
              : undefined
          }
          onCancel={() => { setListingType(null); setActiveListing(null); }}
          onSave={async (data) => {
            try {
              await savePurchase({
                property: { propertyId: data.property.propertyId },
                payment: data.payment,
                shareholders: data.shareholders,
                listingId: activeListing ? activeListing.id : null,
              });
              setReloadSignal((n) => n + 1); 
              setListingType(null);
              setActiveListing(null);
            } catch (e) {
              setError("Save failed: " + e.message);
            }
          }}
        />
      )}

      {error && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-10 bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg shadow">
          {error}
        </div>
      )}
    </div>
  );
}