import React, { useState, useEffect } from "react";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import MedicationSafetyExperience, {
  type MedicationDraft,
  type MedicationReminder,
} from "../components/medication-safety/MedicationSafetyExperience";
import { apiClient } from "../services/api";
import type { DrugSafetyResponse, MedicationReminderItem } from "../types/api";
import { useAppMode } from "../context/AppModeContext";
import styles from "./RemindersPage.module.css";

const DEFAULT_SAMPLES: MedicationReminder[] = [
  {
    id: "s-1",
    medicine: "[Sample Demo] Mometasone Topical Cream",
    dosage: "Apply thin layer to affected skin",
    time: "21:00",
    active: true,
    isDemo: true,
  },
  {
    id: "s-2",
    medicine: "[Sample Demo] Hydrating Ceramide Barrier Balm",
    dosage: "Liberal application after bath",
    time: "08:30",
    active: true,
    isDemo: true,
  },
  {
    id: "s-3",
    medicine: "[Sample Demo] Cetirizine 10mg",
    dosage: "1 tablet before bedtime for nocturnal itching",
    time: "21:30",
    active: true,
    isDemo: true,
  },
];

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const toFrontendReminder = (r: MedicationReminderItem): MedicationReminder => ({
  id: r.id,
  medicine: r.medicine_name,
  dosage: r.dosage,
  time: r.scheduled_time,
  active: r.status === "scheduled",
  isDemo: false,
});

export const RemindersPage: React.FC = () => {
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const { language } = useAppMode();
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const today = localDate();

  useEffect(() => {
    if (isAuthenticated && user) {
      loadReminders(today);
    } else {
      setReminders([...DEFAULT_SAMPLES]);
    }
  }, [isAuthenticated, user, today]);

  const loadReminders = async (date: string) => {
    setIsLoading(true);
    try {
      const data: MedicationReminderItem[] = await apiClient.get(
        `/api/v1/prescriptions/reminders/today?date=${date}`,
        { requireAuth: true }
      );
      setReminders(data.map(toFrontendReminder));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load reminders.";
      toast.error(msg);
      setReminders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (draft: MedicationDraft): Promise<boolean | void> => {
    if (!draft.medicine.trim()) {
      toast.error("Please enter a medicine or ointment name.");
      return false;
    }

    if (!isAuthenticated || !user) {
      const newRem: MedicationReminder = {
        id: Date.now().toString(),
        medicine: draft.medicine.trim(),
        dosage: draft.dosage.trim() || "As directed by your dermatologist",
        time: draft.time || "20:00",
        active: true,
        isDemo: true,
      };
      setReminders((prev) => [...prev, newRem]);
      setSaveMessage(`Demo-only reminder for ${newRem.medicine} at ${newRem.time}. Sign in to save it to your account.`);
      toast.info("This reminder is temporary demonstration data. Sign in to save reminders to PostgreSQL.");
      window.setTimeout(() => setSaveMessage(null), 3500);
      return;
    }

    setIsLoading(true);
    try {
      const created: MedicationReminderItem = await apiClient.post(
        "/api/v1/prescriptions/reminders",
        {
          medicine_name: draft.medicine.trim(),
          dosage: draft.dosage.trim() || "As directed by your dermatologist",
          scheduled_time: `${draft.time || "20:00"}:00`,
          scheduled_date: today,
          notes: null,
        },
        { requireAuth: true }
      );
      const rem: MedicationReminder = toFrontendReminder(created);
      setReminders((prev) => [...prev, rem]);
      setSaveMessage(`Reminder set for ${rem.medicine} at ${rem.time}`);
      toast.success(`Reminder set for ${rem.medicine} at ${rem.time}`);
      window.setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create reminder.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (id: string | number) => {
    const target = reminders.find((r) => r.id === id);
    if (!target) return;
    if (!isAuthenticated || !user) {
      setReminders((prev) => prev.map((r) => r.id === id ? { ...r, active: !r.active } : r));
      return;
    }
    try {
      if (target.active) {
        await apiClient.patch(`/api/v1/prescriptions/reminders/${id}/action`, { action: "skipped" }, { requireAuth: true });
        setReminders((prev) => prev.map((r) => r.id === id ? { ...r, active: false } : r));
        toast.info("This dose was marked as skipped. Do not take a double dose to make up for it.");
      } else {
        const created: MedicationReminderItem = await apiClient.post("/api/v1/prescriptions/reminders", {
          medicine_name: target.medicine,
          dosage: target.dosage || "As directed by your clinician",
          scheduled_time: `${target.time.slice(0, 5)}:00`,
          scheduled_date: today,
          notes: "Reactivated from the reminders screen",
        }, { requireAuth: true });
        setReminders((prev) => [...prev, toFrontendReminder(created)]);
        toast.success("A new reminder has been scheduled. The previous dose record was preserved.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update reminder.");
    }
  };

  const handleDelete = async (id: string | number) => {
    const target = reminders.find((r) => r.id === id);
    if (!target) return;

    if (!isAuthenticated || !user) {
      setReminders((prev) => prev.filter((r) => r.id !== id));
      toast.info(`Removed ${target.medicine}`);
      return;
    }

    try {
      await apiClient.delete(`/api/v1/prescriptions/reminders/${id}`, {
        requireAuth: true,
      });
      setReminders((prev) => prev.filter((r) => r.id !== id));
      toast.info(`Removed ${target.medicine}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete reminder.";
      toast.error(msg);
    }
  };

  const handleLoadSamples = () => {
    setReminders([...DEFAULT_SAMPLES]);
    toast.info("Loaded reference daily medication reminders (Sample Demonstration)");
  };

  const handleClearAll = async () => {
    if (isAuthenticated && user) {
      try {
        await Promise.all(reminders.filter((item) => !item.isDemo).map((item) => apiClient.delete(`/api/v1/prescriptions/reminders/${item.id}`, { requireAuth: true })));
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Some reminders could not be removed.");
        await loadReminders(today);
        return;
      }
    }
    setReminders([]);
    toast.info("Cleared the reminders shown for today.");
  };

  const handleCheckSafety = async (medications: string[], allergies: string[]): Promise<DrugSafetyResponse> => {
    if (!isAuthenticated || !user) throw new Error("Sign in to run a private medication safety review.");
    return apiClient.post<DrugSafetyResponse>("/api/v1/medications/check-safety", {
      medications, allergies, patient_conditions: [], language,
    }, { requireAuth: true });
  };

  return (
    <div className={styles.pageContainer} aria-busy={isLoading}>
      <MedicationSafetyExperience
        reminders={reminders}
        backgroundSrc="/assets/reminders-background-image.jpg"
        onAdd={handleAdd}
        onToggle={handleToggle}
        onDelete={handleDelete}
        errors={{ medicine: undefined }}
        successMessage={saveMessage}
        onLoadSamples={handleLoadSamples}
        onClearAll={handleClearAll}
        onCheckSafety={isAuthenticated && user ? handleCheckSafety : undefined}
      />
    </div>
  );
};

export default RemindersPage;
