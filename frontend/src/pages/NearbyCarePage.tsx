import React, { useState } from "react";
import { useToast } from "../context/ToastContext";
import FindCareExperience, {
  type CareFacility,
  type LocationStatus,
} from "../components/find-care/FindCareExperience";

const CATEGORIES = [
  { key: "all", label: "All Facilities" },
  { key: "dermatology", label: "Dermatology Clinics" },
  { key: "general", label: "Multi-Specialty" },
  { key: "urgent", label: "Urgent & Emergency" },
  { key: "ayurveda", label: "Ayurveda Centers" },
];


export const NearbyCarePage: React.FC = () => {
  const { info } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [specialtyQuery, setSpecialtyQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

  // Never present invented facility names, addresses, phone numbers or opening times
  // as real providers. Actual local results are opened in the user's map provider.
  const facilities: CareFacility[] = [];

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      info("This browser does not provide geolocation. Enter a city or area instead.");
      return;
    }
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus("granted");
        info("Location received. Use live map search to find nearby facilities.");
      },
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "idle");
        info(error.code === error.PERMISSION_DENIED ? "Location permission was denied. Enter a city or area instead." : "Could not determine your location. Enter a city or area instead.");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  };

  const openLiveMapSearch = () => {
    const categoryTerms: Record<string, string> = {
      all: "healthcare clinics and hospitals",
      dermatology: "dermatologist skin clinic",
      general: "multispecialty hospital",
      urgent: "urgent care hospital emergency department",
      ayurveda: "Ayurveda clinic",
    };
    const service = specialtyQuery.trim() || searchQuery.trim() || categoryTerms[activeCategory] || categoryTerms.all;
    const where = coordinates
      ? `${coordinates.latitude},${coordinates.longitude}`
      : locationQuery.trim();
    const query = where ? `${service} near ${where}` : service;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <FindCareExperience
      backgroundSrc="/assets/find-care-background.jpg"
      facilities={facilities}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      locationQuery={locationQuery}
      onLocationQueryChange={setLocationQuery}
      specialtyQuery={specialtyQuery}
      onSpecialtyQueryChange={setSpecialtyQuery}
      categories={CATEGORIES}
      activeCategory={activeCategory}
      onCategoryChange={setActiveCategory}
      selectedFacilityId={selectedFacilityId}
      onSelectFacility={setSelectedFacilityId}
      onGetDirections={() => openLiveMapSearch()}
      onRequestLocation={requestLocation}
      onSearchLiveMap={openLiveMapSearch}
      locationStatus={locationStatus}
      onClearFilters={() => {
        setSearchQuery("");
        setLocationQuery("");
        setSpecialtyQuery("");
        setActiveCategory("all");
        setCoordinates(null);
        setLocationStatus("idle");
      }}
    />
  );
};

export default NearbyCarePage;