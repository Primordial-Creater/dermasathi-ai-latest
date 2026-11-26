import type { ReactNode } from "react";
import {
  AlertTriangle,
  Ambulance,
  ArrowRight,
  Building2,
  Clock,
  Crosshair,
  Info,
  LayoutGrid,
  Leaf,
  MapPin,
  Minus,
  Navigation,
  Phone,
  Plus,
  Search,
  SearchX,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import styles from "./FindCareExperience.module.css";

/* Mirrors ClinicFacility in NearbyCarePage.tsx. Fields beyond the id/name/category are optional
   so that missing information renders an "unavailable" label instead of an invented value. */
export type FacilityCategory = "dermatology" | "general" | "urgent" | "ayurveda";

export interface CareFacility {
  id: string;
  name: string;
  category: FacilityCategory;
  categoryLabel: string;
  specialist?: string;
  address?: string;
  distance?: string;
  phone?: string;
  timing?: string;
  /** Treated as a demo listing unless explicitly false. */
  isDemo?: boolean;
}

/** Same shape as CATEGORIES in NearbyCarePage.tsx ("all" plus the four categories). */
export interface CategoryOption {
  key: string;
  label: string;
}

export type LocationStatus = "unavailable" | "idle" | "requesting" | "granted" | "denied";

export interface FindCareExperienceProps {
  /** Page background image URL (public/assets). Required. */
  backgroundSrc: string;
  /** Facilities AFTER the page's filtering (see `filterFacilities`). */
  facilities: CareFacility[];
  /** Existing search (name / address / specialist). */
  searchQuery: string;
  onSearchChange: (value: string) => void;
  /** Optional extra fields. If their handler is omitted the field is shown disabled. */
  locationQuery?: string;
  onLocationQueryChange?: (value: string) => void;
  specialtyQuery?: string;
  onSpecialtyQueryChange?: (value: string) => void;
  categories: CategoryOption[];
  activeCategory: string;
  onCategoryChange: (key: string) => void;
  selectedFacilityId?: string | null;
  onSelectFacility?: (id: string | null) => void;
  onGetDirections: (facility: CareFacility) => void;
  /** Live geolocation. Defaults to "unavailable" (shows "Live GPS integration pending."). */
  locationStatus?: LocationStatus;
  onRequestLocation?: () => void;
  onSearchLiveMap?: () => void;
  onClearFilters?: () => void;
}

export interface FacilityFilters {
  query?: string;
  location?: string;
  specialty?: string;
  category?: string;
}

/** Pure helper reproducing NearbyCarePage's filter (name/address/specialist + category), extended
 *  with optional location (address) and specialty (specialist / category label) fields. */
export function filterFacilities(list: CareFacility[], f: FacilityFilters): CareFacility[] {
  const has = (hay: string | undefined, needle: string | undefined) =>
    !needle || (hay ?? "").toLowerCase().includes(needle.trim().toLowerCase());
  return list.filter((x) => {
    const cat = !f.category || f.category === "all" || x.category === f.category;
    const q = !f.query || has(x.name, f.query) || has(x.address, f.query) || has(x.specialist, f.query);
    const loc = has(x.address, f.location);
    const spec = !f.specialty || has(x.specialist, f.specialty) || has(x.categoryLabel, f.specialty);
    return cat && q && loc && spec;
  });
}

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

const CAT_ICON: Record<string, typeof Stethoscope> = {
  all: LayoutGrid,
  dermatology: Stethoscope,
  general: Building2,
  urgent: Ambulance,
  ayurveda: Leaf,
};
const CAT_TONE: Record<string, string> = {
  all: styles.toneBlue,
  dermatology: styles.toneGreen,
  general: styles.toneViolet,
  urgent: styles.toneRed,
  ayurveda: styles.toneLeaf,
};

const LOCATION_TEXT: Record<LocationStatus, string> = {
  unavailable: "Live GPS integration pending.",
  idle: "Location permission not requested.",
  requesting: "Requesting location permission…",
  granted: "Location permission granted.",
  denied: "Location permission denied. Search by location instead.",
};

function Detail({ icon, children, unavailable }: { icon: ReactNode; children: ReactNode; unavailable?: boolean }) {
  return (
    <p className={cx(styles.detail, unavailable && styles.detailOff)}>
      <span className={styles.detailIcon}>{icon}</span>
      <span>{children}</span>
    </p>
  );
}


function MapPreview() {
  return (
    <div className={styles.map} role="img" aria-label="Illustrative map preview. Not a live map.">
      <svg viewBox="0 0 800 220" preserveAspectRatio="xMidYMid slice" className={styles.mapSvg} aria-hidden="true" focusable="false">
        <rect width="800" height="220" fill="#d9f2ee" />
        <path d="M0 150C120 120 200 190 330 150S560 90 800 140V220H0Z" fill="#bfe6f5" opacity=".75" />
        <path d="M-10 60C120 20 240 110 380 70S620 20 810 70" stroke="#93d5ee" strokeWidth="22" fill="none" opacity=".8" strokeLinecap="round" />
        <g stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" opacity=".95">
          <path d="M0 110L800 90" /><path d="M120 0L220 220" /><path d="M360 0L420 220" /><path d="M600 0L560 220" /><path d="M700 0L780 220" />
        </g>
        <g stroke="#fff" strokeWidth="4" fill="none" opacity=".8">
          <path d="M0 40L800 30" /><path d="M0 175L800 160" /><path d="M250 0L300 220" /><path d="M480 0L500 220" />
        </g>
        <g fill="#a7e3b4" opacity=".85">
          <rect x="140" y="120" width="60" height="38" rx="10" /><rect x="440" y="116" width="70" height="40" rx="10" /><rect x="650" y="28" width="60" height="40" rx="10" />
        </g>
        <g>
          <circle cx="400" cy="108" r="34" fill="#38bdf8" opacity=".25" /><circle cx="400" cy="108" r="18" fill="#38bdf8" opacity=".3" />
          <path d="M400 58c-14 0-24 10-24 23 0 17 24 38 24 38s24-21 24-38c0-13-10-23-24-23Z" fill="#2563eb" stroke="#fff" strokeWidth="3" />
          <rect x="396" y="68" width="8" height="22" rx="2" fill="#fff" /><rect x="389" y="75" width="22" height="8" rx="2" fill="#fff" />
        </g>
        <g fill="#3b82f6" stroke="#fff" strokeWidth="2.5">
          <path d="M215 26c-9 0-15 6-15 14 0 10 15 23 15 23s15-13 15-23c0-8-6-14-15-14Z" />
          <path d="M600 74c-9 0-15 6-15 14 0 10 15 23 15 23s15-13 15-23c0-8-6-14-15-14Z" fill="#22c55e" />
          <path d="M722 118c-9 0-15 6-15 14 0 10 15 23 15 23s15-13 15-23c0-8-6-14-15-14Z" fill="#a78bfa" />
        </g>
      </svg>
      <div className={styles.zoom} aria-hidden="true">
        <span><Plus size={16} /></span><span><Minus size={16} /></span>
      </div>
      <ul className={styles.legend} aria-label="Map legend">
        <li><i className={styles.legendBlue} />Healthcare Facility</li>
        <li><i className={styles.legendGreen} />Wellness Centre</li>
      </ul>
    </div>
  );
}

export default function FindCareExperience({
  facilities,
  searchQuery,
  onSearchChange,
  locationQuery = "",
  onLocationQueryChange,
  specialtyQuery = "",
  onSpecialtyQueryChange,
  categories,
  activeCategory,
  onCategoryChange,
  selectedFacilityId = null,
  onSelectFacility,
  onGetDirections,
  locationStatus = "unavailable",
  onRequestLocation,
  onSearchLiveMap,
  onClearFilters,
}: FindCareExperienceProps) {
  const selected = facilities.find((f) => f.id === selectedFacilityId) ?? null;
  const canAskLocation = Boolean(onRequestLocation) && locationStatus !== "unavailable" && locationStatus !== "requesting";

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        {/* Hero */}
        <section className={cx(styles.card, styles.hero)} data-feature-hero="split">
          <div data-hero-copy>
            <span className={styles.eyebrow} data-hero-eyebrow><MapPin size={14} aria-hidden="true" />Geographic clinical directory</span>
            <h1 className={styles.title} data-hero-title>Find Nearby Dermatology &amp; Care Facilities</h1>
            <p className={styles.lead} data-hero-description>
              Explore healthcare options, dermatology services, hospitals and traditional wellness centres from one organised discovery workspace.
            </p>
          </div>
          <img
            className={styles.art}
            src="/assets/find-care-hero-art.png"
            alt=""
            aria-hidden="true"
          />
        </section>

        {/* Location + search */}
        <section className={styles.card} aria-labelledby="fc-where">
          <div className={styles.sectionHead}>
            <h2 id="fc-where" className={styles.heading}><span className={styles.headingIcon}><MapPin size={22} aria-hidden="true" /></span>Where would you like to find care?</h2>
          </div>
          <div className={styles.searchGrid}>
            <label className={styles.field}>
              <span className={styles.sr}>Search by facility name</span>
              <Search size={18} className={styles.fieldIcon} aria-hidden="true" />
              <input className={cx(styles.input, styles.withIcon)} type="search" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search by facility name…" />
            </label>
            <label className={styles.field}>
              <span className={styles.sr}>Search location</span>
              <MapPin size={18} className={styles.fieldIcon} aria-hidden="true" />
              <input className={cx(styles.input, styles.withIcon)} type="search" value={locationQuery} onChange={(e) => onLocationQueryChange?.(e.target.value)} disabled={!onLocationQueryChange} placeholder="Search location…" />
            </label>
            <label className={styles.field}>
              <span className={styles.sr}>Specialty</span>
              <Stethoscope size={18} className={styles.fieldIcon} aria-hidden="true" />
              <input className={cx(styles.input, styles.withIcon)} type="search" value={specialtyQuery} onChange={(e) => onSpecialtyQueryChange?.(e.target.value)} disabled={!onSpecialtyQueryChange} placeholder="Specialty…" />
            </label>
            <button type="button" className={cx(styles.btn, styles.gps)} onClick={onRequestLocation} disabled={!canAskLocation} aria-describedby="fc-gps">
              <Crosshair size={20} aria-hidden="true" />
              <span><b>Use my location</b><small id="fc-gps" role="status">{LOCATION_TEXT[locationStatus]}</small></span>
            </button>
          </div>
        </section>

        {/* Category filters */}
        <div className={styles.filters} role="group" aria-label="Facility categories">
          {categories.map((c) => {
            const Icon = CAT_ICON[c.key] ?? LayoutGrid;
            const on = activeCategory === c.key;
            return (
              <button key={c.key} type="button" className={cx(styles.chip, on && styles.chipActive)} aria-pressed={on} onClick={() => onCategoryChange(c.key)}>
                <span className={cx(styles.chipIcon, !on && (CAT_TONE[c.key] ?? styles.toneBlue))}><Icon size={18} aria-hidden="true" /></span>
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Map preview */}
        <section className={styles.card} aria-labelledby="fc-map">
          <div className={styles.sectionHead}>
            <h2 id="fc-map" className={styles.heading}><span className={styles.headingIcon}><MapPin size={22} aria-hidden="true" /></span>Map Preview &amp; Live Provider Search</h2>
            {onSearchLiveMap && <button type="button" className={cx(styles.btn, styles.btnDir)} onClick={onSearchLiveMap}><Navigation size={15} aria-hidden="true" />Search Live Map</button>}
          </div>
          <MapPreview />
        </section>

        {/* Listings */}
        <section className={styles.card} aria-labelledby="fc-list">
          <div className={styles.sectionHead}>
            <h2 id="fc-list" className={styles.heading}><span className={styles.headingIcon}><Building2 size={22} aria-hidden="true" /></span>Healthcare Facilities</h2>
            <span className={cx(styles.badge, styles.badgeBlue)} role="status">{facilities.length} {facilities.length === 1 ? "listing" : "listings"}</span>
          </div>

          {facilities.length === 0 ? (
            <div className={styles.noResults} role="status">
              <span className={styles.noIcon}><SearchX size={34} aria-hidden="true" /></span>
              <div>
                <h3>No verified in-app facility listings are available.</h3>
                <p className={styles.small}>Use “Search Live Map” above to view current nearby providers in Google Maps. Results, contact details and opening hours are supplied by the map provider and should be confirmed before visiting.</p>
                {onClearFilters && <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.clear)} onClick={onClearFilters}>Clear filters</button>}
              </div>
            </div>
          ) : (
            <ul className={styles.list}>
              {facilities.map((f) => {
                const demo = f.isDemo !== false;
                const Icon = CAT_ICON[f.category] ?? Building2;
                return (
                  <li key={f.id} className={cx(styles.facility, selectedFacilityId === f.id && styles.facilitySelected)}>
                    <span className={cx(styles.facIcon, CAT_TONE[f.category])}><Icon size={26} aria-hidden="true" /></span>
                    <div className={styles.facBody}>
                      {demo && <span className={cx(styles.badge, styles.badgeGold)}>DEMO LISTING — NOT VERIFIED</span>}
                      <h3>{f.name}</h3>
                      <p className={styles.small}>{f.categoryLabel}{f.specialist ? ` · ${f.specialist}` : ""}</p>
                      <Detail icon={<MapPin size={14} aria-hidden="true" />} unavailable={!f.address}>{f.address ?? "Address information pending verification."}</Detail>
                      <Detail icon={<Navigation size={14} aria-hidden="true" />} unavailable={!f.distance}>
                        {f.distance ? `${demo ? "Sample distance: " : ""}${f.distance}` : "Distance unavailable until location integration."}
                      </Detail>
                      <Detail icon={<Clock size={14} aria-hidden="true" />} unavailable={!f.timing}>{f.timing ?? "Opening hours: contact for details."}</Detail>
                      <Detail icon={<Phone size={14} aria-hidden="true" />} unavailable={!f.phone}>
                        {f.phone ? (demo ? `Sample contact: ${f.phone}` : <a href={`tel:${f.phone.replace(/[^0-9+]/g, "")}`}>{f.phone}</a>) : "Contact information pending verification."}
                      </Detail>
                    </div>
                    <div className={styles.facActions}>
                      <button type="button" className={cx(styles.btn, styles.btnView)} onClick={() => onSelectFacility?.(f.id)} disabled={!onSelectFacility} aria-label={`View details for ${f.name}`}>
                        View Details<ArrowRight size={14} aria-hidden="true" />
                      </button>
                      <button type="button" className={cx(styles.btn, styles.btnDir)} onClick={() => onGetDirections(f)} aria-label={`Get directions to ${f.name}`}>
                        <Navigation size={14} aria-hidden="true" />Get Directions
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Selected facility details */}
        <section className={styles.card} aria-labelledby="fc-detail">
          <div className={styles.sectionHead}>
            <h2 id="fc-detail" className={styles.heading}><span className={styles.headingIcon}><Info size={22} aria-hidden="true" /></span>Facility Details</h2>
          </div>
          {selected ? (
            <div className={cx(styles.inner, styles.detailPanel)}>
              <div className={styles.detailMain}>
                {selected.isDemo !== false && <span className={cx(styles.badge, styles.badgeGold)}>DEMO LISTING — NOT VERIFIED</span>}
                <h3>{selected.name}</h3>
                <p className={styles.small}>{selected.categoryLabel}{selected.specialist ? ` · ${selected.specialist}` : ""}</p>
                <Detail icon={<MapPin size={15} aria-hidden="true" />} unavailable={!selected.address}>{selected.address ?? "Address information pending verification."}</Detail>
                <Detail icon={<Clock size={15} aria-hidden="true" />} unavailable={!selected.timing}>{selected.timing ? `Opening hours: ${selected.timing}` : "Opening hours: contact for details."}</Detail>
                <Detail icon={<Phone size={15} aria-hidden="true" />} unavailable={!selected.phone}>{selected.phone ? `${selected.isDemo !== false ? "Sample contact: " : ""}${selected.phone}` : "Contact information pending verification."}</Detail>
                <Detail icon={<ShieldAlert size={15} aria-hidden="true" />}><b>Verification status:</b> Not verified</Detail>
              </div>
              <div className={styles.detailSide}>
                <button type="button" className={cx(styles.btn, styles.btnDir)} onClick={() => onGetDirections(selected)}>
                  <Navigation size={16} aria-hidden="true" />Get Directions
                </button>
                {onSelectFacility && <button type="button" className={styles.link} onClick={() => onSelectFacility(null)}>Close details</button>}
              </div>
            </div>
          ) : (
            <p className={cx(styles.inner, styles.empty)}>Select “View Details” on a listing to see its information here.</p>
          )}
        </section>

        {/* Urgent-care notice */}
        <section className={cx(styles.card, styles.notice, styles.noticeWarn)} role="note" aria-labelledby="fc-urgent">
          <AlertTriangle size={26} aria-hidden="true" />
          <div>
            <b id="fc-urgent" className={styles.noticeTitle}>Need urgent medical attention?</b>
            <p>If you are experiencing severe or rapidly worsening symptoms, seek appropriate urgent medical care. DermaSathiAI does not dispatch emergency services.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
