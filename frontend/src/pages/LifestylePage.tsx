import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppMode } from "../context/AppModeContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiClient } from "../services/api";
import type { WellnessGuidanceResponse } from "../types/api";
import { AyurvedaLotusScene } from "../components/three/ayurveda/AyurvedaLotusScene";
import AyurvedaExperience, {
  type EvidenceCard,
  type FoundationItem,
  type GuideLanguage,
  type GuideMessage,
  type HerbItem,
  type RoutineItem,
} from "../components/ayurveda/AyurvedaExperience";

interface AyurvedaTip {
  id: string;
  category: string;
  title: string;
  summary: string;
  actionableStep: string;
  evidenceType: "traditional" | "scientific" | "both";
  evidenceSource: string;
  caution?: string;
}

/* Existing application content. Kept verbatim as the single source of truth; the component adds
   no references of its own. The source labels are carried forward from the app and are not
   independently verified here. */
const AYURVEDA_DATA: AyurvedaTip[] = [
  {
    id: "a-1",
    category: "Ayurvedic Foundations",
    title: "Pitta Pacification & Cooling Regimens",
    summary: "Classical Ayurveda associates erythematous, burning skin sensations with aggravated Pitta dosha — an excess of internal metabolic heat. Cooling regimens aim to restore balance.",
    actionableStep: "Favor cooling foods such as coriander, cucumber, coconut water, and fennel tea. Limit highly spicy, fermented, or excessively acidic foods.",
    evidenceType: "traditional",
    evidenceSource: "Ministry of AYUSH Traditional Dermatology Compendium",
    caution: "Traditional knowledge — not a substitute for clinical diagnosis or treatment.",
  },
  {
    id: "a-2",
    category: "Herbal Knowledge",
    title: "Neem & Sandalwood Barrier Calming",
    summary: "Neem (Azadirachta indica) and Sandalwood have been traditionally used for their astringent and calming properties on superficial skin irritation.",
    actionableStep: "Perform a 24-hour patch test on your inner wrist before applying any botanical paste to inflamed skin. Discontinue if redness worsens.",
    evidenceType: "traditional",
    evidenceSource: "Ethnobotanical Studies in Dermatological Wellness",
    caution: "Botanical actives can cause contact sensitivity — always patch test first.",
  },
  {
    id: "a-3",
    category: "Lifestyle & Daily Routines",
    title: "Dinacharya — Morning Skin Ritual",
    summary: "Ayurvedic daily routine (Dinacharya) emphasizes gentle cleansing with lukewarm water and light oil massage (Abhyanga) to support epidermal barrier function.",
    actionableStep: "Use gentle, fragrance-free cleansers. Avoid hot water that strips natural lipids. Pat skin dry — never rub.",
    evidenceType: "traditional",
    evidenceSource: "Charaka Samhita — Daily Routine Chapter",
    caution: "Oil massage may not suit acne-prone or oily skin types.",
  },
  {
    id: "a-4",
    category: "Preventive Wellness",
    title: "Sleep & Circadian Rhythm Support",
    summary: "Adequate sleep supports skin repair cycles. Nocturnal capillary dilation can worsen evening itching in sensitive skin.",
    actionableStep: "Keep sleeping quarters cool (19°C–21°C). Wear breathable cotton sleepwear. Wash pillowcases weekly with fragrance-free detergent.",
    evidenceType: "scientific",
    evidenceSource: "Journal of Investigative Dermatology — Circadian Skin Studies",
    caution: "General wellness guidance — not medical treatment.",
  },
  {
    id: "a-5",
    category: "Sun Defense",
    title: "Broad-Spectrum Mineral Photoprotection",
    summary: "Zinc oxide and titanium dioxide reflect UVA and UVB photons without chemical penetration, reducing erythema risk in reactive skin.",
    actionableStep: "Apply SPF 30+ broad-spectrum sunscreen 15 minutes before sun exposure. Re-apply every 2 hours if outdoors.",
    evidenceType: "scientific",
    evidenceSource: "Skin Cancer Foundation & WHO Ultraviolet Guidelines",
    caution: "Sunscreen is one part of sun protection — also use hats and shade.",
  },
  {
    id: "a-6",
    category: "Evidence & Safety",
    title: "Traditional vs Scientific Evidence",
    summary: "Ayurvedic wellness practices offer supportive care traditions. Some have corresponding scientific study; many remain traditional knowledge without clinical validation.",
    actionableStep: "Always consult a qualified dermatologist before modifying prescription treatments. Inform your clinician about any herbal products you use.",
    evidenceType: "both",
    evidenceSource: "Integrative Dermatology Review",
    caution: "Never discontinue prescribed medication without medical supervision.",
  },
];

const FOUNDATIONS: FoundationItem[] = [
  {
    id: "pitta",
    title: "Pitta Pacification",
    description: "Cooling foods and habits to address excess internal heat associated with burning, reddened skin sensations.",
    tag: "Traditional Knowledge",
    icon: "pitta",
  },
  {
    id: "constitution",
    title: "Constitutional Balance",
    description: "Understanding Vata, Pitta, and Kapha influences on skin texture, moisture, and resilience.",
    tag: "Traditional Knowledge",
    icon: "constitution",
  },
];

const HERBS: HerbItem[] = [
  { name: "Neem", use: "Traditional astringent for superficial irritation", caution: "Patch test before use" },
  { name: "Sandalwood", use: "Cooling paste for irritated skin", caution: "Patch test before use" },
  { name: "Turmeric", use: "Brightening and calming properties", caution: "Patch test before use" },
  { name: "Aloe Vera", use: "Hydrating and soothing gel", caution: "Patch test before use" },
];

const ROUTINES: RoutineItem[] = [
  { time: "Morning", title: "Gentle Cleanse", description: "Lukewarm water, fragrance-free cleanser, pat dry.", icon: "sun" },
  { time: "Day", title: "Hydrate", description: "Drink water; use light moisturizer on damp skin.", icon: "droplet" },
  { time: "Evening", title: "Cool & Calm", description: "Cool sleeping environment; breathable cotton fabrics.", icon: "moon" },
];

const EVIDENCE_CARDS: EvidenceCard[] = AYURVEDA_DATA;

export const LifestylePage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useAppMode();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [guideLanguage, setGuideLanguage] = useState<GuideLanguage>(language);
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);

  useEffect(() => {
    setGuideLanguage(language);
  }, [language]);

  const submitWellnessQuestion = async (question: string, selectedLanguage: GuideLanguage) => {
    if (!isAuthenticated) {
      toast.warning("Sign in to use the private AI wellness guide.");
      return;
    }
    const userMessage: GuideMessage = { id: `user-${Date.now()}`, role: "user", text: question };
    setMessages((previous) => [...previous, userMessage]);
    setIsResponding(true);
    try {
      const result = await apiClient.post<WellnessGuidanceResponse>("/api/v1/wellness/guidance", {
        skin_concern: question,
        language: selectedLanguage,
        season: ["winter", "winter", "spring", "spring", "summer", "summer", "monsoon", "monsoon", "monsoon", "autumn", "autumn", "winter"][new Date().getMonth()],
        reported_symptoms: [], current_medications: [], known_allergies: [], relevant_conditions: [],
      }, { requireAuth: true });
      const assistantMessage: GuideMessage = result.ai_enhancement_status === "completed"
        ? {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            response: {
              directAnswer: result.direct_answer || result.concern_analysis,
              traditionalPerspective: result.ayurvedic_perspective || undefined,
              generalWellness: [
                ...result.additional_wellness_guidance,
                ...result.dietary_recommendations,
                ...result.lifestyle_practices,
              ],
              herbalKnowledge: result.traditional_topical_care.map((herb) =>
                `${herb.herb_name}: ${herb.skin_benefits} ${herb.usage_guidance} Safety: ${herb.safety_precautions}`
              ),
              safetyPrecautions: [result.evidence_note, result.medical_safety_note].filter((value): value is string => Boolean(value)),
              references: [],
              badges: result.evidence_note?.toLowerCase().includes("limited") ? ["traditional", "limited"] : ["traditional"],
            },
          }
        : {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: result.direct_answer || "The AI wellness service is temporarily unavailable. No personalized answer was generated. Please try again.",
          };
      setMessages((previous) => [...previous, assistantMessage]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The wellness guide could not respond.");
      setMessages((previous) => previous.filter((message) => message.id !== userMessage.id));
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <AyurvedaExperience
      backgroundSrc="/assets/ayurveda-background.jpg"
      lotusScene={
        <AyurvedaLotusScene
          style={{ width: "100%", height: "100%", minHeight: "240px" }}
        />
      }
      messages={messages}
      onSubmitQuestion={submitWellnessQuestion}
      isResponding={isResponding}
      guideStatus={isAuthenticated ? "ready" : "integration-pending"}
      selectedLanguage={guideLanguage}
      onLanguageChange={setGuideLanguage}
      showExampleConversation={false}
      voiceStatus="unavailable"
      foundations={FOUNDATIONS}
      herbs={HERBS}
      routines={ROUTINES}
      evidenceCards={EVIDENCE_CARDS}
      onStartSkinAssessment={() => navigate("/skin-assessment")}
    />
  );
};

export default LifestylePage;