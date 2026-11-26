from __future__ import annotations

from app.schemas.wellness import WellnessGuidanceRequest, LifestyleGuidanceResponse, HerbGuidance


# These entries describe traditional use only. They deliberately avoid claims
# that a herb diagnoses, treats, cures, or is proven to improve a skin disease.
HERB_KNOWLEDGE = {
    "aloe": HerbGuidance(
        herb_name="Aloe vera",
        sanskrit_name="Kumari (Aloe vera)",
        skin_benefits="Aloe-containing products are used traditionally for a cooling, soothing skin-care feel. Evidence for treating a specific skin disease is limited.",
        usage_guidance="Do not apply homemade preparations to broken, infected, or severely inflamed skin. A fragrance-free commercial product may still cause irritation; check ingredients and test a small area first.",
        safety_precautions="Stop use if burning, redness, swelling, or itching develops. Avoid the yellow latex/sap and do not ingest aloe products for skin concerns without clinician advice."
    ),
    "turmeric": HerbGuidance(
        herb_name="Turmeric",
        sanskrit_name="Haridra (Curcuma longa)",
        skin_benefits="Turmeric has a long history of culinary and traditional topical use. This history does not establish that it treats acne, eczema, infection, pigmentation, or another skin condition.",
        usage_guidance="Normal culinary use as part of a balanced diet is different from concentrated supplements or topical pastes. Avoid applying kitchen mixtures to irritated or broken skin.",
        safety_precautions="Topical turmeric can stain and may irritate or trigger contact allergy. Concentrated supplements may interact with medicines; discuss them with a pharmacist or clinician first."
    ),
}


class WellnessService:
    @staticmethod
    def get_guidance(req: WellnessGuidanceRequest) -> LifestyleGuidanceResponse:
        concern = req.skin_concern.lower().strip()
        season = (req.season or "unspecified").lower()

        user_dosha = (req.dosha_predominance or "").strip().casefold()
        if user_dosha in {"vata", "pitta", "kapha", "mixed"}:
            perspective = f"You selected the traditional {user_dosha.title()} framework. This is a user-selected traditional lens, not a medical diagnosis or a verified assessment of constitution."
            herbs = [HERB_KNOWLEDGE["aloe"]] if user_dosha == "vata" else [HERB_KNOWLEDGE["turmeric"]] if user_dosha == "kapha" else [HERB_KNOWLEDGE["aloe"], HERB_KNOWLEDGE["turmeric"]]
        elif any(term in concern for term in ("dry", "flake", "scal")):
            perspective = "A traditional Ayurveda lens may describe dryness using Vata-related qualities. This is a traditional framework, not a medical diagnosis or a confirmed dosha assessment."
            herbs = [HERB_KNOWLEDGE["aloe"]]
        elif any(term in concern for term in ("red", "heat", "itch", "burn")):
            perspective = "A traditional Ayurveda lens may discuss redness or heat using Pitta-related concepts. This is a traditional framework, not a medical diagnosis or proof of the cause."
            herbs = [HERB_KNOWLEDGE["aloe"], HERB_KNOWLEDGE["turmeric"]]
        else:
            perspective = "A traditional Ayurveda lens may discuss oiliness or congestion using Kapha-related concepts. This is a traditional framework, not a medical diagnosis or proof of the cause."
            herbs = [HERB_KNOWLEDGE["turmeric"]]

        preference = (req.dietary_preference or "unspecified").casefold()
        if "vegan" in preference:
            protein_examples = "dal, beans, chickpeas, tofu, nuts, or seeds"
        elif "vegetarian" in preference:
            protein_examples = "dal, beans, chickpeas, dairy foods if tolerated, nuts, or seeds"
        else:
            protein_examples = "dal, beans, eggs, fish, poultry, nuts, or seeds according to your preferences"

        diet = [
            f"Aim for varied, regular meals with vegetables, fruit, whole grains, and protein sources such as {protein_examples}.",
            "Drink fluids regularly and adapt food choices to your preferences, allergies, medical conditions, and clinician advice.",
            "Avoid restrictive elimination diets or high-dose supplements for a skin concern unless a qualified clinician recommends them."
        ]
        lifestyle = [
            "Use a gentle, fragrance-free cleanser and a suitable moisturiser; avoid aggressive scrubbing or frequent product changes.",
            "Use broad-spectrum sun protection and seek shade when outdoors; adapt protection to your skin and local conditions.",
            "Keep a simple record of products and symptoms so you can notice possible irritants without assuming they are the cause."
        ]
        prevention = [
            "Traditional herbs and home preparations are not substitutes for an established diagnosis or prescribed treatment.",
            "Do not put herbal mixtures on open, infected, blistered, or severely inflamed skin, near the eyes, or on mucosal areas.",
            "Stop any product that causes irritation; a small-area test cannot guarantee that a product is safe for everyone.",
            "Arrange clinical review for persistent, worsening, spreading, painful, bleeding, or unexplained skin changes."
        ]

        return LifestyleGuidanceResponse(
            concern_analysis=f"You described: '{req.skin_concern}'. Season supplied: {season}. This summary is based only on the information provided.",
            ayurvedic_perspective=perspective,
            dietary_recommendations=diet,
            lifestyle_practices=lifestyle,
            traditional_topical_care=herbs,
            evidence_based_prevention=prevention,
            cautionary_note=(
                "Ayurvedic concepts and herbs are presented as traditional wellness information. "
                "Evidence varies and is limited for treating specific skin diseases. Do not ingest medicinal herbs, "
                "use concentrated extracts, or replace prescribed care based on this guidance."
            ),
        )
