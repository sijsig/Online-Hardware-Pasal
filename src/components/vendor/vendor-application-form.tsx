"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function applicationError(message: string) {
  const lower = message.toLowerCase();
  if (message.includes("28000")) return "Please sign in again before submitting a shop application.";
  if (message.includes("22023")) return message.replace(/^.*?:\s*/, "");
  return lower.includes("duplicate") ? "We could not create this shop profile. Please try again." : "We could not submit the shop application. Check the details and try again.";
}

export function VendorApplicationForm({ email }: { email: string }) {
  const router = useRouter();
  const [coordinates, setCoordinates] = useState({ latitude: "", longitude: "" });
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  function captureLocation() {
    if (!navigator.geolocation) {
      setMessage("Location is not available in this browser. Enter the shop coordinates below.");
      return;
    }
    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setCoordinates({ latitude: String(coords.latitude), longitude: String(coords.longitude) });
      setLocating(false);
      setMessage("Shop location captured. Adjust the pin coordinates if needed.");
    }, (error) => {
      setLocating(false);
      setMessage(error.code === error.PERMISSION_DENIED
        ? "Allow location access in your browser, or enter the shop coordinates manually."
        : "We could not get your location. Enter the coordinates manually or try again.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const latitude = Number(coordinates.latitude);
    const longitude = Number(coordinates.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setMessage("Set the shop location with the location button or enter its latitude and longitude.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const { data: vendorId, error } = await createClient().rpc("apply_for_vendor_shop", {
        p_name: String(form.get("name") ?? "").trim(),
        p_phone: String(form.get("phone") ?? "").trim(),
        p_email: String(form.get("email") ?? "").trim() || null,
        p_address_line: String(form.get("address") ?? "").trim(),
        p_city: String(form.get("city") ?? "").trim(),
        p_district: String(form.get("district") ?? "").trim() || null,
        p_province: String(form.get("province") ?? "").trim() || null,
        p_description: String(form.get("description") ?? "").trim() || null,
        p_latitude: latitude,
        p_longitude: longitude,
      });
      if (error || !vendorId) throw error ?? new Error("Application was not created.");
      router.replace(`/vendor?shop=${vendorId}`);
      router.refresh();
    } catch (error) {
      console.error("Shop application failed:", error);
      setMessage(error instanceof Error ? applicationError(error.message) : "We could not submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="vendor-application-form" onSubmit={submitApplication}>
      <div className="vendor-application-grid">
        <label>Shop name<input name="name" required minLength={2} maxLength={120} placeholder="e.g. New Road Hardware" /></label>
        <label>Shop phone<input name="phone" type="tel" required minLength={7} maxLength={32} autoComplete="tel" placeholder="98XXXXXXXX" /></label>
        <label>Contact email <span>Optional</span><input name="email" type="email" maxLength={254} defaultValue={email} autoComplete="email" placeholder="shop@example.com" /></label>
        <label>Street address<input name="address" required minLength={3} maxLength={240} autoComplete="street-address" placeholder="Tole, road, or landmark" /></label>
        <label>City / municipality<input name="city" required minLength={2} maxLength={100} autoComplete="address-level2" placeholder="Kathmandu" /></label>
        <label>District <span>Optional</span><input name="district" maxLength={100} placeholder="Kathmandu" /></label>
        <label>Province <span>Optional</span><input name="province" maxLength={100} placeholder="Bagmati" /></label>
      </div>
      <label className="vendor-description-label">About your shop <span>Optional</span><textarea name="description" maxLength={1000} rows={3} placeholder="What hardware products does your shop carry?" /></label>
      <section className="vendor-location-section" aria-label="Shop map location">
        <div><strong>Shop location</strong><p>We use the map point to show nearby customers your distance and delivery area.</p></div>
        <button className="secondary-button" type="button" disabled={locating} onClick={captureLocation}>{locating ? "Getting location…" : "Use current location"}</button>
        <div className="vendor-application-grid coordinates-grid">
          <label>Latitude<input type="number" step="any" min="26" max="31" inputMode="decimal" value={coordinates.latitude} onChange={(event) => setCoordinates((current) => ({ ...current, latitude: event.target.value }))} placeholder="27.7172" /></label>
          <label>Longitude<input type="number" step="any" min="80" max="89" inputMode="decimal" value={coordinates.longitude} onChange={(event) => setCoordinates((current) => ({ ...current, longitude: event.target.value }))} placeholder="85.3240" /></label>
        </div>
      </section>
      {message && <p className="vendor-application-message" role="status">{message}</p>}
      <button className="vendor-application-submit" type="submit" disabled={submitting || locating}>{submitting ? "Submitting application…" : "Submit shop for review"}</button>
      <p className="vendor-application-footnote">Your shop will stay pending until the marketplace team reviews it. It won’t appear in customer search before approval.</p>
    </form>
  );
}
