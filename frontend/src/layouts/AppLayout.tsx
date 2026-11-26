import React, { useEffect, useState, useRef } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAppMode, APP_INTERFACE_LANGUAGES, type LanguageCode } from "../context/AppModeContext";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../services/apiClient";
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference";
import { HealthcareLoader } from "../components/common/HealthcareLoader";
import { 
  Home,
  Scan,
  Stethoscope,
  Pill,
  FileText,
  History,
  Sparkles,
  MapPin,
  Globe,
  Bell,
  Search,
  X,
  User,
  Heart,
  Menu,
  Clock,
  Sun,
  Download
} from "lucide-react";
import styles from "./AppLayout.module.css";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface SearchResult {
  id: string;
  label: string;
  path: string;
  category: string;
}

const SEARCH_ROUTES: SearchResult[] = [
  { id: "home", label: "Home", path: "/", category: "Navigation" },
  { id: "skin-assessment", label: "Skin Analysis", path: "/skin-assessment", category: "Health Tools" },
  { id: "symptoms", label: "Symptoms", path: "/symptoms", category: "Health Tools" },
  { id: "reminders", label: "Medicines", path: "/reminders", category: "Health Tools" },
  { id: "reports", label: "Reports & Prescriptions", path: "/reports", category: "Health Tools" },
  { id: "visit-summary", label: "Visit Dossier", path: "/visit-summary", category: "Health Tools" },
  { id: "health-history", label: "Health History", path: "/health-history", category: "Health Tools" },
  { id: "lifestyle", label: "Wellness & Ayurveda", path: "/lifestyle", category: "Health Tools" },
  { id: "nearby-care", label: "Find Care", path: "/nearby-care", category: "Health Tools" },
  { id: "settings", label: "Settings", path: "/settings", category: "Settings" },
  { id: "login", label: "Sign In", path: "/login", category: "Account" },
  { id: "signup", label: "Sign Up", path: "/signup", category: "Account" },
];

/**
 * Route-aware full-page background. One mechanism owned by the layout so the
 * atmosphere covers the whole `.mainArea` (header + scrolling content) and is
 * independent of each page's inner max-width. Verified against public/assets.
 */
const PAGE_BACKGROUNDS: Record<string, string> = {
  "/": "/assets/dashboard-background.png",
  "/skin-assessment": "/assets/scan-lesion-background-image.jpg",
  "/symptoms": "/assets/symptoms-background-image.jpg",
  "/reminders": "/assets/reminders-background-image.jpg",
  "/reports": "/assets/reports-ocr-background-image.jpg",
  "/visit-summary": "/assets/visit-dossier-background.jpg",
  "/health-history": "/assets/health-history-background.jpg",
  "/lifestyle": "/assets/ayurveda-background.jpg",
  "/nearby-care": "/assets/find-care-background.jpg",
  "/settings": "/assets/health-history-background.jpg",
};

export const AppLayout: React.FC = () => {
  const { language, setLanguage, t } = useAppMode();
  const { user, logout, isInitializing } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotionPreference();

  const [routeLoading, setRouteLoading] = useState(false);
  const prevPathRef = useRef(location.pathname);


  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [searchHighlightIndex, setSearchHighlightIndex] = useState(-1);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Native PWA install prompt (iOS uses manual Add to Home Screen guidance).
  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => {
      const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setIsInstalled(displayMode.matches || iosStandalone);
    };
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallHelpOpen(false);
    };
    const userAgent = navigator.userAgent;
    setIsIOSDevice(/iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    updateInstalled();
    displayMode.addEventListener("change", updateInstalled);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      displayMode.removeEventListener("change", updateInstalled);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // Close drawers/menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
    setSearchResultsOpen(false);
  }, [location.pathname]);

  // Brief route-transition loader. Fires only when the pathname actually
  // changes (not on ordinary rerenders), clears its timer on unmount, and is
  // skipped entirely when the OS requests reduced motion.
  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;
    if (reduceMotion) return;
    setRouteLoading(true);
    const timer = window.setTimeout(() => setRouteLoading(false), 620);
    return () => window.clearTimeout(timer);
  }, [location.pathname, reduceMotion]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchResultsOpen(false);
      }
    };
    if (notificationsOpen || userMenuOpen || searchResultsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [notificationsOpen, userMenuOpen, searchResultsOpen]);

  // Hide account-creation routes once authenticated, and while restoring a session.
  const filteredResults = SEARCH_ROUTES.filter((result) => {
    if ((user || isInitializing) && (result.id === "login" || result.id === "signup")) {
      return false;
    }
    return (
      result.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Keyboard navigation for search results
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchResultsOpen(false);
      setSearchQuery("");
      setSearchHighlightIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchHighlightIndex((prev) =>
        prev >= filteredResults.length - 1 ? 0 : prev + 1
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchHighlightIndex((prev) =>
        prev <= 0 ? filteredResults.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredResults[searchHighlightIndex]) {
        navigate(filteredResults[searchHighlightIndex].path);
        setSearchResultsOpen(false);
        setSearchQuery("");
        setSearchHighlightIndex(-1);
      } else if (filteredResults[0]) {
        navigate(filteredResults[0].path);
        setSearchResultsOpen(false);
        setSearchQuery("");
        setSearchHighlightIndex(-1);
      }
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setSearchResultsOpen(e.target.value.length > 0);
    setSearchHighlightIndex(-1);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResultsOpen(false);
    setSearchHighlightIndex(-1);
  };

  const selectSearchResult = (result: SearchResult) => {
    navigate(result.path);
    setSearchResultsOpen(false);
    setSearchQuery("");
    setSearchHighlightIndex(-1);
  };

  // Nav items from Reference 1
  const sidebarNavItems = [
    { path: "/", label: t("nav_home"), icon: Home, iconColor: "#059669" },
    { path: "/skin-assessment", label: t("nav_skin"), icon: Scan, iconColor: "#0d9488" },
    { path: "/symptoms", label: t("nav_symptoms"), icon: Stethoscope, iconColor: "#7c3aed" },
    { path: "/reminders", label: t("nav_reminders"), icon: Pill, iconColor: "#d97706" },
    { path: "/reports", label: t("nav_reports"), icon: FileText, iconColor: "#0284c7" },
    { path: "/visit-summary", label: t("nav_visit"), icon: History, iconColor: "#0891b2" },
    { path: "/health-history", label: t("nav_history"), icon: Clock, iconColor: "#0e7490" },
    { path: "/lifestyle", label: t("nav_lifestyle"), icon: Sparkles, iconColor: "#16a34a" },
    { path: "/nearby-care", label: t("nav_nearby_care"), icon: MapPin, iconColor: "#be185d" },
    { path: "/settings", label: t("nav_settings"), icon: Globe, iconColor: "#6b7280" },
  ];

  const handleInstallApp = async () => {
    if (!installPrompt) {
      setInstallHelpOpen(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setIsInstalled(true);
      setInstallPrompt(null);
    } catch (error) {
      console.error("PWA installation prompt failed:", error);
      setInstallHelpOpen(true);
    }
  };

  const handleLanguageSelect = async (nextLanguage: LanguageCode) => {
    setLanguage(nextLanguage);
    if (user) {
      try {
        await apiFetch("/api/v1/auth/me", {
          method: "PUT",
          body: JSON.stringify({ preferred_language: nextLanguage }),
        });
      } catch (error) {
        console.error("Could not sync preferred language with profile:", error);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setUserMenuOpen(false);
      setMobileMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Sign-out failed:", error);
    }
  };

  const currentNavItem =
    sidebarNavItems.find(
      (item) =>
        location.pathname === item.path ||
        (item.path !== "/" && location.pathname.startsWith(item.path))
    ) ?? sidebarNavItems[0];

  return (
    <div className={styles.appShell}>
      {/* Accessible skip link */}
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>
      {/* 1. Left Light Luminous Sidebar (Desktop & Large Tablet) */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHerbs} aria-hidden="true" />
        {/* Brand Header */}
        <div className={styles.sidebarHeader}>
          <Link to="/" className={styles.brandLink}>
            <div className={styles.brandLotusIcon}>
              <img src="/assets/dermasathi-brand-mark.png" alt="" width={44} height={36} />
            </div>
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>{t("app_name")}</span>
              <span className={styles.brandSubtitle}>{t("tagline")}</span>
            </div>
          </Link>
        </div>

        {/* Sidebar Navigation */}
        <nav className={styles.sidebarNav} aria-label="Main Navigation">
          {sidebarNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                style={{ ["--nav-color" as string]: item.iconColor } as React.CSSProperties}
              >
                <div className={styles.navIconWrap}>
                  <Icon size={18} />
                </div>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Botanical Tagline */}
        <div className={styles.sidebarFooter}>
          <div className={styles.footerTagline}>
            <p>Better skin.</p>
            <p>Better health.</p>
            <p>Together.</p>
            <div className={styles.footerHeart}>
              <Heart size={14} color="#0d9488" />
            </div>
          </div>
          {/* Subtle decorative watercolor leaf motif */}
          <div className={styles.botanicalGraphic} aria-hidden="true">
            <svg width="120" height="90" viewBox="0 0 120 90" fill="none" opacity="0.22">
              <path d="M0 90C20 60 50 40 85 45C60 65 30 85 0 90Z" fill="#0d9488" />
              <path d="M40 90C60 65 90 50 120 52C95 72 70 88 40 90Z" fill="#14b8a6" />
              <path d="M10 90C45 50 85 20 120 10C90 40 50 70 10 90Z" fill="#2dd4bf" />
            </svg>
          </div>
        </div>
      </aside>

      {/* 2. Main Area (Header + Main Content Canvas) */}
      <div className={styles.mainArea}>
        {/* Route-aware full-page atmosphere. Sits behind the header and the
            scrolling content, spanning the whole main area. */}
        <div
          className={styles.routeBackground}
          style={{ backgroundImage: `url(${PAGE_BACKGROUNDS[location.pathname] ?? PAGE_BACKGROUNDS["/"]})` }}
          aria-hidden="true"
        />

        {/* Top Header Bar */}
        <header className={styles.topHeader}>
          {/* Mobile hamburger menu toggle & brand for small screens */}
          <div className={styles.mobileHeaderLeft}>
            <button
              type="button"
              className={styles.hamburgerBtn}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <Link to="/" className={styles.mobileBrand}>
              <img src="/assets/dermasathi-brand-mark.png" alt="" width={26} height={26} />
              <span className={styles.mobileBrandTitle}>{t("app_name")}</span>
            </Link>
          </div>

          {/* Left: Personalized Greeting & Health Matter Notice */}
          <div className={styles.greetingSection}>
            <div className={styles.greetingSun}>
              <Sun size={20} color="#f59e0b" />
            </div>
            <div className={styles.greetingText}>
              <span className={styles.greetingTitle}>{currentNavItem.label}</span>
              <span className={styles.greetingSub}>Your health matters. We're here for you.</span>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className={styles.searchSection}>
            <div className={styles.searchBar} ref={searchRef}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder={t("search_placeholder")}
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                className={styles.searchInput}
                aria-label={t("search_aria_label")}
                autoComplete="off"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  className={styles.searchClearBtn}
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {searchResultsOpen && searchQuery.length > 0 && (
              <div className={styles.searchDropdown}>
                <div className={styles.searchDropdownHeader}>
                  <strong>{t("search_results")}</strong>
                  <span className={styles.searchCount}>{filteredResults.length} found</span>
                </div>
                <div className={styles.searchResultsList}>
                  {filteredResults.map((result, idx) => (
                    <button
                      key={result.id}
                      type="button"
                      className={`${styles.searchResultItem} ${searchHighlightIndex === idx ? styles.searchResultActive : ""}`}
                      onClick={() => selectSearchResult(result)}
                    >
                      <span className={styles.searchResultCategory}>{result.category}</span>
                      <span className={styles.searchResultLabel}>{result.label}</span>
                      <span className={styles.searchResultPath}>{result.path}</span>
                    </button>
                  ))}
                  {filteredResults.length === 0 && (
                    <div className={styles.searchEmpty}>
                      <span>{t("search_no_results")}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Actions (Language, Notifications, Status, User Avatar) */}
          <div className={styles.headerActions}>
            {/* Language Selector Pill */}
            <div className={styles.langPillWrap}>
              <label htmlFor="header-lang-select" className="sr-only">{t("select_language")}</label>
              <select
                id="header-lang-select"
                value={language}
                onChange={(e) => void handleLanguageSelect(e.target.value as LanguageCode)}
                aria-label={t("select_language")}
              >
                {APP_INTERFACE_LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>{item.name}</option>
                ))}
              </select>
            </div>

            {!isInstalled && (
              <button type="button" className={styles.installAppBtn} onClick={() => void handleInstallApp()} aria-label="Install DermaSathiAI app" title="Install DermaSathiAI">
                <Download size={16} aria-hidden="true" />
                <span className={styles.installAppLabel}>Install</span>
              </button>
            )}

            {/* Notifications Bell */}
            <div className={styles.notifWrap} ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={styles.iconCircleBtn}
                title={t("notifications")}
                aria-label={t("notifications")}
              >
                <Bell size={18} />
                <span className={styles.notifDot} />
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    className={styles.notifDropdown}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                  >
                    <div className={styles.notifDropdownHeader}>
                      <strong>{t("care_notifications")}</strong>
                      <span className={styles.notifCountBadge}>2 Active</span>
                    </div>
                    <div className={styles.notifList}>
                      <Link to="/reminders" className={styles.notifItem}>
                        <div className={styles.notifIconCircle}>
                          <Clock size={14} color="#0d9488" />
                        </div>
                        <div className={styles.notifContent}>
                          <strong>{t("topical_therapy_due")}</strong>
                          <p>{t("mometasone_reminder")}</p>
                        </div>
                      </Link>
                      <Link to="/skin-assessment" className={styles.notifItem}>
                        <div className={styles.notifIconCircle}>
                          <Scan size={14} color="#0284c7" />
                        </div>
                        <div className={styles.notifContent}>
                          <strong>{t("longitudinal_follow_up")}</strong>
                          <p>{t("day_5_comparison")}</p>
                        </div>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {!user && !isInitializing && <Link to="/login" className={styles.headerSignIn}>Sign in</Link>}

            {/* The account label is read from the signed-in /auth/me profile. */}
            {user && (
              <span className={styles.headerUserName} title={user.full_name}>
                {user.full_name}
              </span>
            )}

            {/* User Profile Avatar with Dropdown */}
            <div className={styles.userWrap} ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={styles.userAvatarBtn}
                aria-label={user ? `${user.full_name} account menu` : "Guest account menu"}
                title={user ? user.full_name : "Account"}
              >
                <div className={styles.avatarImgCircle}>
                  {user?.full_name?.trim()
                    ? user.full_name.trim().slice(0, 1).toUpperCase()
                    : <User size={18} color="#ffffff" />}
                </div>
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    className={styles.userDropdown}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                  >
                    <div className={styles.userDropdownHeader}>
                      <strong>{user?.full_name || (isInitializing ? "Restoring your session…" : "Guest session")}</strong>
                      <span>{user?.email || (isInitializing ? "Checking your account" : t("account_menu_hint"))}</span>
                    </div>
                    <div className={styles.userLinks}>
                      {user ? (
                        <button type="button" className={styles.userLink} onClick={() => void handleSignOut()}>Sign Out</button>
                      ) : isInitializing ? (
                        <span className={styles.userLink} aria-disabled="true">Restoring session…</span>
                      ) : (
                        <>
                          <Link to="/login" className={styles.userLink}>Sign In</Link>
                          <Link to="/signup" className={styles.userLink}>Create Account</Link>
                        </>
                      )}
                      <Link to="/settings" className={styles.userLink}>{t("platform_settings")}</Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* 3. Main Outlet Canvas */}
        <main id="main-content" className={styles.contentCanvas}>
          <Outlet />
        </main>
      </div>

      {/* 4. Mobile Slide-out Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className={styles.mobileBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              className={styles.mobileDrawer}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.drawerHeader}>
                <div className={styles.brandText}>
                  <span className={styles.brandTitle}>{t("app_name")}</span>
                  <span className={styles.brandSubtitle}>{t("tagline")}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className={styles.closeDrawerBtn}
                  aria-label="Close Navigation"
                >
                  <X size={20} />
                </button>
              </div>

              <div className={styles.drawerNavList}>
                {sidebarNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`${styles.drawerNavItem} ${isActive ? styles.drawerNavActive : ""}`}
                    >
                      <Icon size={18} color={isActive ? item.iconColor : "var(--color-text-tertiary)"} fill={isActive ? item.iconColor : "var(--color-text-tertiary)"} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className={styles.drawerFooter}>
                {user ? (
                  <div className={styles.drawerAuthRow}>
                    <span className={styles.drawerAuthBtn} title={user.email}>{user.full_name}</span>
                    <button
                      type="button"
                      className={styles.drawerAuthBtnPrimary}
                      onClick={() => void handleSignOut()}
                    >
                      Sign Out
                    </button>
                  </div>
                ) : isInitializing ? (
                  <div className={styles.drawerAuthRow}>
                    <span className={styles.drawerAuthBtn}>Restoring session…</span>
                  </div>
                ) : (
                  <div className={styles.drawerAuthRow}>
                    <Link to="/login" className={styles.drawerAuthBtn}>Sign In</Link>
                    <Link to="/signup" className={styles.drawerAuthBtnPrimary}>Sign Up</Link>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Mobile Bottom Dock (Primary Mobile Actions) */}
      <nav className={styles.mobileDock} aria-label="Mobile Navigation Dock">
        <div className={styles.dockInner}>
          <Link to="/" className={`${styles.dockItem} ${location.pathname === "/" ? styles.dockActive : ""}`}>
            <Home size={18} />
            <span>{t("nav_home")}</span>
          </Link>
          <Link to="/skin-assessment" className={`${styles.dockItem} ${location.pathname === "/skin-assessment" ? styles.dockActive : ""}`}>
            <Scan size={18} />
            <span>{t("nav_skin")}</span>
          </Link>
          <Link to="/symptoms" className={`${styles.dockItem} ${location.pathname === "/symptoms" ? styles.dockActive : ""}`}>
            <Stethoscope size={18} />
            <span>{t("nav_symptoms")}</span>
          </Link>
          <Link to="/reminders" className={`${styles.dockItem} ${location.pathname === "/reminders" ? styles.dockActive : ""}`}>
            <Pill size={18} />
            <span>{t("nav_reminders")}</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={styles.dockItem}
          >
            <Menu size={18} />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* 6. Brief route-transition loader (skipped under reduced motion) */}
      <AnimatePresence>
        {routeLoading && (
          <motion.div
            className={styles.routeLoader}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            aria-live="polite"
            aria-label="Opening workspace"
          >
            <HealthcareLoader label="Opening workspace" size={76} />
          </motion.div>
        )}
      </AnimatePresence>

      {installHelpOpen && (
        <div className={styles.installHelpBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setInstallHelpOpen(false);
        }}>
          <section className={styles.installHelpDialog} role="dialog" aria-modal="true" aria-labelledby="install-help-title">
            <button type="button" className={styles.installHelpClose} onClick={() => setInstallHelpOpen(false)} aria-label="Close install instructions">×</button>
            <Download size={28} aria-hidden="true" />
            <h2 id="install-help-title">Install DermaSathiAI</h2>
            {isIOSDevice ? (
              <p>Open this page in Safari, tap the Share icon, then choose <strong>Add to Home Screen</strong>.</p>
            ) : (
              <p>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. In Chrome or Edge, you may also see an install icon in the address bar.</p>
            )}
            <button type="button" className={styles.installHelpDone} onClick={() => setInstallHelpOpen(false)}>Got it</button>
          </section>
        </div>
      )}
    </div>
  );
};

export default AppLayout;