import { GoogleGenAI } from '@google/genai';
import { InterviewState, InterviewQuestionAnswer, InterviewInconsistency } from '../src/types.ts';

// Helper to get Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

// Clean JSON response string
function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
}

function normalizeCountryName(value?: string | null): string {
  const cleaned = value?.trim().replace(/\s+/g, ' ') || '';
  const normalized = cleaned.toLowerCase().replace(/[.,]/g, '');
  const aliases: Record<string, string> = {
    india: 'India',
    'republic of india': 'India',
    bharat: 'India',
    ind: 'India',
    'united states': 'United States',
    'united states of america': 'United States',
    usa: 'United States',
    us: 'United States',
    america: 'United States',
    'united kingdom': 'United Kingdom',
    uk: 'United Kingdom',
    britain: 'United Kingdom',
    gbr: 'United Kingdom',
  };
  return aliases[normalized] || cleaned;
}

/**
 * Initialize a new interview state for a case
 */
export function initInterviewState(caseContext: any): InterviewState {
  const destination = normalizeCountryName(caseContext?.destination || caseContext?.ocrResult?.issuingCountry);
  const nationality = normalizeCountryName(caseContext?.nationality || caseContext?.ocrResult?.nationality || caseContext?.profile?.nationality);
  const origin = normalizeCountryName(caseContext?.origin || caseContext?.profile?.countryOfResidence);
  const visaType = caseContext?.ocrResult?.visaType || caseContext?.visaType || '';
  const travelType = caseContext?.travelType || '';
  const caseId = caseContext?.caseId || '';

  const openingQuestion = destination
    ? `Why are you visiting ${destination} today?`
    : 'Please declare the primary purpose of your travel.';

  return {
    sessionId: caseContext?.sessionId || `interview_${Date.now()}`,
    caseId,
    travelType,
    nationality,
    origin,
    destination,
    visaType,
    visaConditions: caseContext?.visaConditions || '',
    declaredPurpose: caseContext?.declaredPurpose || undefined,
    detectedPurpose: undefined,
    expectedStay: undefined,
    accommodation: undefined,
    travelCompanions: undefined,
    hostOrContact: undefined,
    destinationCities: [],
    returnOrOnwardTravel: undefined,
    employmentInfo: undefined,
    educationInfo: undefined,
    businessInfo: undefined,
    eventInfo: undefined,
    questionsAsked: [],
    missingInformation: ['purpose', 'destinationCity', 'expectedStay', 'accommodation'],
    potentialInconsistencies: [],
    clarificationsRequested: [],
    currentQuestion: openingQuestion,
    questionCount: 1,
    maxQuestions: 5,
    status: 'IN_PROGRESS',
    consistencyRating: 'HIGH',
    recommendation: 'NO_SIGNIFICANT_INCONSISTENCIES',
  };
}

/**
 * Local deterministic reasoning engine (used as fallback or for instant offline evaluation)
 */
function localAdaptiveReasoning(
  currentState: InterviewState,
  passengerAnswer: string,
  caseContext: any
): {
  extracted: Record<string, any>;
  inconsistency: InterviewInconsistency | null;
  nextQuestion: string | null;
  shouldComplete: boolean;
  completionReason?: string;
} {
  const ans = passengerAnswer.trim().toLowerCase();
  const extracted: Record<string, any> = {};
  let inconsistency: InterviewInconsistency | null = null;
  let nextQuestion: string | null = null;
  let shouldComplete = false;

  // 1. Detect Purpose
  if (ans.includes('wedding')) {
    extracted.purpose = 'Friend/Family Wedding';
    extracted.event = 'Wedding';
    extracted.relationship = 'Friend';
  } else if (ans.includes('tourism') || ans.includes('sightseeing') || ans.includes('holiday') || ans.includes('vacation')) {
    extracted.purpose = 'Tourism';
  } else if (ans.includes('work') || ans.includes('job') || ans.includes('employment') || ans.includes('join company')) {
    extracted.purpose = 'Employment / Work';
  } else if (ans.includes('business') || ans.includes('conference') || ans.includes('meeting')) {
    extracted.purpose = 'Business Conference / Meeting';
  } else if (ans.includes('study') || ans.includes('university') || ans.includes('course')) {
    extracted.purpose = 'Education / Studies';
  } else if (ans.includes('visit') && (ans.includes('friend') || ans.includes('family') || ans.includes('parents') || ans.includes('relative'))) {
    extracted.purpose = 'Family & Friend Visit';
    extracted.relationship = ans.includes('friend') ? 'Friend' : 'Family';
  }

  // 2. Detect Cities
  const cities = ['bengaluru', 'bangalore', 'delhi', 'mumbai', 'hyderabad', 'chennai', 'kolkata', 'jaipur', 'agra', 'goa', 'pune', 'kochi'];
  for (const c of cities) {
    if (ans.includes(c)) {
      const proper = c.charAt(0).toUpperCase() + c.slice(1);
      extracted.destinationCity = proper;
      break;
    }
  }

  // 3. Detect Duration
  const daysMatch = ans.match(/(\d+)\s*(days|day)/i);
  const weeksMatch = ans.match(/(\d+)\s*(weeks|week)/i);
  const monthsMatch = ans.match(/(\d+)\s*(months|month)/i);
  if (daysMatch) {
    extracted.duration = `${daysMatch[1]} Days`;
    extracted.durationDays = parseInt(daysMatch[1], 10);
  } else if (weeksMatch) {
    const w = parseInt(weeksMatch[1], 10);
    extracted.duration = `${w} Weeks (${w * 7} Days)`;
    extracted.durationDays = w * 7;
  } else if (monthsMatch) {
    const m = parseInt(monthsMatch[1], 10);
    extracted.duration = `${m} Months (${m * 30} Days)`;
    extracted.durationDays = m * 30;
  } else if (ans.includes('two weeks')) {
    extracted.duration = '2 Weeks (14 Days)';
    extracted.durationDays = 14;
  } else if (ans.includes('ten days') || ans.includes('10 days')) {
    extracted.duration = '10 Days';
    extracted.durationDays = 10;
  } else if (ans.includes('three months') || ans.includes('3 months')) {
    extracted.duration = '3 Months';
    extracted.durationDays = 90;
  } else if (ans.includes('six months') || ans.includes('6 months')) {
    extracted.duration = '6 Months';
    extracted.durationDays = 180;
  }

  // 4. Detect Accommodation
  if (ans.includes('hotel') || ans.includes('taj') || ans.includes('marriott') || ans.includes('hyatt') || ans.includes('resort')) {
    extracted.accommodation = ans.includes('taj') ? 'Taj Hotel' : 'Hotel';
  } else if (ans.includes("friend's") || ans.includes('friend apartment') || ans.includes('friend house') || ans.includes('stay with friend')) {
    extracted.accommodation = "Friend's Apartment";
  } else if (ans.includes('airbnb') || ans.includes('guest house') || ans.includes('hostel')) {
    extracted.accommodation = 'Rental / Guest House';
  }

  // 5. Inconsistency Detection (Priority 1)
  // Check A: Visa vs Stated Purpose (e.g. Tourist Visa vs Work/Employment)
  const currentVisa = (currentState.visaType || caseContext?.visaType || '').toLowerCase();
  const currentPurpose = (extracted.purpose || currentState.detectedPurpose || '').toLowerCase();

  if (currentVisa.includes('tourist') && (currentPurpose.includes('work') || currentPurpose.includes('employment') || ans.includes('work for') || ans.includes('take up employment'))) {
    inconsistency = {
      field: 'Visa Purpose Mismatch',
      issue: 'Passenger declared intention to work while holding a Tourist Visa',
      severity: 'HIGH',
      resolved: false,
      details: 'Declared employment activity conflicts with standard Tourist Visa conditions prohibiting work.',
    };
    nextQuestion = `Your visa information indicates a tourist visit, while you mentioned that you plan to work during your stay. Could you clarify the purpose and expected duration of your visit?`;
  }

  // Check B: Duration Contradiction (e.g. Earlier 10 days, now 3 months or 6 months)
  const previousStay = currentState.expectedStay;
  if (previousStay && extracted.duration) {
    const prevDays = currentState.expectedStay.toLowerCase();
    if ((prevDays.includes('10 days') || prevDays.includes('14 days') || prevDays.includes('week')) && (ans.includes('month') || (extracted.durationDays && extracted.durationDays > 60))) {
      inconsistency = {
        field: 'Stay Duration Discrepancy',
        issue: 'Substantial discrepancy between initial declared stay and updated duration',
        severity: 'MEDIUM',
        resolved: false,
        details: `Initial declaration was ${previousStay}, subsequent answer indicates ${extracted.duration}.`,
      };
      nextQuestion = `Earlier you mentioned staying for around ${previousStay}, but you now mentioned ${extracted.duration}. Could you clarify your intended duration of stay?`;
    }
  }

  // If clarification was already requested and passenger explained (e.g. "I actually meant I'm attending a two-day business conference")
  const wasClarifying = currentState.currentQuestion.toLowerCase().includes('clarify');
  if (wasClarifying) {
    if (ans.includes('conference') || ans.includes('attend') || ans.includes('actually meant') || ans.includes('mistake') || ans.includes('visit')) {
      // Marked as clarified
      if (currentState.potentialInconsistencies.length > 0) {
        currentState.potentialInconsistencies[currentState.potentialInconsistencies.length - 1].resolved = true;
      }
      if (ans.includes('conference')) {
        extracted.purpose = 'Business Conference';
        nextQuestion = 'Which organization or institution is hosting the conference?';
        return { extracted, inconsistency: null, nextQuestion, shouldComplete: false };
      }
    }
  }

  // If Priority 1 inconsistency question was selected, return it immediately
  if (inconsistency && nextQuestion) {
    return { extracted, inconsistency, nextQuestion, shouldComplete: false };
  }

  // Priority 2: Clarify Stated Purpose context
  const effectivePurpose = extracted.purpose || currentState.detectedPurpose;
  const effectiveCity = extracted.destinationCity || (currentState.destinationCities.length > 0 ? currentState.destinationCities[0] : null);
  const effectiveStay = extracted.duration || currentState.expectedStay;
  const effectiveAccommodation = extracted.accommodation || currentState.accommodation;

  if (effectivePurpose?.includes('Wedding')) {
    if (!effectiveCity) {
      nextQuestion = 'Which city will the wedding take place in?';
    } else if (!currentState.eventInfo && !ans.includes('saturday') && !ans.includes('next') && !ans.includes('date')) {
      nextQuestion = 'When is the wedding scheduled to take place?';
    } else if (!effectiveStay) {
      nextQuestion = 'How long do you plan to stay in India?';
    } else if (!effectiveAccommodation) {
      nextQuestion = 'Where will you stay during your visit?';
    } else {
      shouldComplete = true;
    }
  } else if (effectivePurpose?.includes('Tourism')) {
    if (!effectiveCity) {
      nextQuestion = 'Which cities or regions in India do you plan to visit?';
    } else if (!effectiveStay) {
      nextQuestion = 'How long do you plan to stay in India?';
    } else if (!effectiveAccommodation) {
      nextQuestion = 'Where will you be staying during your travels?';
    } else if (!currentState.returnOrOnwardTravel) {
      nextQuestion = 'Do you have return or onward flight arrangements booked?';
    } else {
      shouldComplete = true;
    }
  } else if (effectivePurpose?.includes('Business') || effectivePurpose?.includes('Conference')) {
    if (!effectiveCity) {
      nextQuestion = 'Which city will the business meetings or conference take place in?';
    } else if (!currentState.businessInfo && !extracted.organizationOrCompany) {
      nextQuestion = 'Which company or organization are you meeting with?';
    } else if (!effectiveStay) {
      nextQuestion = 'How long will your business visit in India last?';
    } else if (!effectiveAccommodation) {
      nextQuestion = 'Where will you be staying during your stay?';
    } else {
      shouldComplete = true;
    }
  } else if (effectivePurpose?.includes('Friend') || effectivePurpose?.includes('Family')) {
    if (!effectiveCity) {
      nextQuestion = 'Which city does your contact or friend live in?';
    } else if (!effectiveStay) {
      nextQuestion = 'How long do you plan to stay with them?';
    } else if (!effectiveAccommodation) {
      nextQuestion = 'Will you be staying at their residence or at commercial accommodation?';
    } else {
      shouldComplete = true;
    }
  } else {
    // Broad fallback if purpose was vague
    if (!effectivePurpose) {
      nextQuestion = 'Could you describe the main activities you have planned during your visit?';
    } else if (!effectiveCity) {
      nextQuestion = 'Which city will be your primary destination in India?';
    } else if (!effectiveStay) {
      nextQuestion = 'What is the expected duration of your visit?';
    } else if (!effectiveAccommodation) {
      nextQuestion = 'Where do you plan to stay during your time here?';
    } else {
      shouldComplete = true;
    }
  }

  // Check if we gathered enough core details without contradictions
  if (effectivePurpose && effectiveCity && effectiveStay && (effectiveAccommodation || currentState.questionCount >= 5)) {
    shouldComplete = true;
  }

  return {
    extracted,
    inconsistency,
    nextQuestion: shouldComplete ? null : nextQuestion,
    shouldComplete,
    completionReason: shouldComplete ? 'Sufficient information collected across travel purpose, destination, duration, and accommodation.' : undefined,
  };
}

/**
 * Main adaptive processing loop:
 * Processes passenger answer, updates state, checks inconsistencies,
 * and generates the next context-aware question.
 */
export async function processPassengerAnswerAndGenerateNext(
  currentState: InterviewState,
  passengerAnswer: string,
  caseContext: any
): Promise<InterviewState> {
  const currentQNum = currentState.questionCount;
  const currentQuestionText = currentState.currentQuestion;

  // Strict enforcement: Never exceed 5 questions
  if (currentQNum >= 5) {
    const hasUnresolved = currentState.potentialInconsistencies.some((i) => !i.resolved);
    const completedRecord: InterviewQuestionAnswer = {
      questionNumber: currentQNum,
      question: currentQuestionText,
      answer: passengerAnswer,
      timestamp: new Date().toISOString(),
    };

    return {
      ...currentState,
      questionsAsked: [...currentState.questionsAsked, completedRecord],
      currentQuestion: '',
      status: hasUnresolved ? 'REVIEW_REQUIRED' : 'COMPLETED_MAX_REACHED',
      consistencyRating: hasUnresolved ? 'POTENTIAL_MISMATCH' : 'HIGH',
      recommendation: hasUnresolved ? 'ADDITIONAL_OFFICER_REVIEW_REQUIRED' : 'NO_SIGNIFICANT_INCONSISTENCIES',
      finalSummary: hasUnresolved
        ? 'Maximum limit of 5 questions reached with unresolved travel information inconsistencies. Sent to authorized officer.'
        : 'Target limit of 5 questions reached. Sufficient pre-screening information recorded.',
    };
  }

  // Attempt Gemini API for intelligent context reasoning
  const ai = getGeminiClient();
  let extractedInfo: Record<string, any> = {};
  let detectedInconsistency: InterviewInconsistency | null = null;
  let nextQuestionText: string | null = null;
  let shouldCompleteEarly = false;
  let summaryNotes = '';

  if (ai) {
    try {
      const prompt = `You are the BorderSecure AI Immigration Pre-Screening Assistant operating an automated, adaptive pre-screening interview at border control.
Analyze the passenger's answer in the context of the entire interview history and case records.

CASE RECORDS:
- Case ID: ${currentState.caseId || 'IM-20492'}
- Nationality: ${currentState.nationality}
- Origin: ${currentState.origin}
- Destination: ${currentState.destination}
- Visa Type: ${currentState.visaType}
- Visa Conditions: ${currentState.visaConditions || 'Employment strictly prohibited on Tourist visa'}
- Declared Purpose at Enrollment: ${currentState.declaredPurpose || 'Not specified'}

PREVIOUS QUESTIONS & ANSWERS:
${currentState.questionsAsked.map((qa) => `Q${qa.questionNumber}: "${qa.question}"\nA: "${qa.answer}"`).join('\n') || 'None (This is Question 1)'}

CURRENT QUESTION ASKED (Question ${currentQNum} of 5):
"${currentQuestionText}"

PASSENGER'S ANSWER:
"${passengerAnswer}"

CURRENT EXTRACTED STATE:
- Purpose: ${currentState.detectedPurpose || 'Unconfirmed'}
- Destination Cities: ${currentState.destinationCities.join(', ') || 'Unconfirmed'}
- Duration / Expected Stay: ${currentState.expectedStay || 'Unconfirmed'}
- Accommodation: ${currentState.accommodation || 'Unconfirmed'}
- Host/Contact: ${currentState.hostOrContact || 'Unconfirmed'}

CRITICAL RULES:
1. Genuinely Adaptive: The next question MUST depend strictly on what the passenger just said. DO NOT follow a generic questionnaire.
2. Memory: NEVER repeat questions if the answer was already provided (even if given naturally inside an earlier answer).
3. Country equivalence: Treat officially equivalent country labels as the same country. For example, "India", "Republic of India", "Bharat", and "IND" must not be flagged as a destination or nationality mismatch.
4. Priority 1 (Resolve Inconsistencies): If passenger statement conflicts with visa (e.g. tourist visa but coming to work) or previous statements (e.g. earlier said 10 days, now says 3 months), generate a polite, professional clarification question.
5. Priority 2 (Clarify Purpose): E.g., if wedding -> ask which city the wedding is in. E.g., if conference -> ask which organization or company.
6. Priority 3 (Missing Info): Ask for duration, accommodation, destination only if not already provided.
7. Terminology: NEVER say "lying", "deceptive", or "guilty". Use "Potential Inconsistency", "Information Mismatch", or "Clarification Required".
8. No Emotion Analysis: Analyze content only, not stress or accent.
9. Maximum Questions: 5. The interview should ask up to 5 focused questions (e.g. 1. Purpose, 2. Duration, 3. Cities, 4. Accommodation/Host, 5. Return ticket/clarification). The interview may finish early (e.g. after 3 or 4 questions) if core purpose, destination, duration, and accommodation are established and no unresolved inconsistencies remain.

Return a valid JSON object strictly conforming to this schema:
{
  "extractedInfo": {
    "purpose": string or null,
    "relationship": string or null,
    "event": string or null,
    "destinationCity": string or null,
    "duration": string or null,
    "durationDays": number or null,
    "accommodation": string or null,
    "hostOrContact": string or null,
    "organizationOrCompany": string or null
  },
  "inconsistency": {
    "detected": boolean,
    "field": string or null,
    "issue": string or null,
    "severity": "LOW" | "MEDIUM" | "HIGH",
    "details": string or null
  } or null,
  "shouldCompleteEarly": boolean,
  "completionReason": string or null,
  "nextQuestion": string or null,
  "consistencyRating": "HIGH" | "MEDIUM" | "POTENTIAL_MISMATCH"
}`;

      let geminiRes: any = null;
      for (const model of CANDIDATE_MODELS) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout on model ${model}`)), 12000)
          );
          const callPromise = ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });
          geminiRes = await Promise.race([callPromise, timeoutPromise]);
          if (geminiRes) break;
        } catch (e: any) {
          console.warn(`[Interview Gemini Model ${model}]:`, e?.message || e);
        }
      }

      if (geminiRes?.text) {
        const parsed = JSON.parse(cleanJsonString(geminiRes.text));
        extractedInfo = parsed.extractedInfo || {};
        if (parsed.inconsistency && parsed.inconsistency.detected) {
          detectedInconsistency = {
            field: parsed.inconsistency.field || 'Information Discrepancy',
            issue: parsed.inconsistency.issue || 'Discrepancy detected in traveler response',
            severity: parsed.inconsistency.severity || 'MEDIUM',
            resolved: false,
            details: parsed.inconsistency.details || 'Clarification required during pre-screening.',
          };
        }
        shouldCompleteEarly = Boolean(parsed.shouldCompleteEarly);
        nextQuestionText = parsed.nextQuestion || null;
        summaryNotes = parsed.completionReason || '';
      }
    } catch (apiErr) {
      console.warn('[Interview AI Error, falling back to local engine]:', apiErr);
    }
  }

  // If Gemini was offline or didn't yield a question, use our deterministic local engine
  if (!nextQuestionText && !shouldCompleteEarly) {
    const local = localAdaptiveReasoning(currentState, passengerAnswer, caseContext);
    extractedInfo = { ...extractedInfo, ...local.extracted };
    if (local.inconsistency) {
      detectedInconsistency = local.inconsistency;
    }
    shouldCompleteEarly = local.shouldComplete;
    nextQuestionText = local.nextQuestion;
    summaryNotes = local.completionReason || summaryNotes;
  }

  // Update cumulative interview state
  const updatedDestinationCities = [...currentState.destinationCities];
  if (extractedInfo.destinationCity && !updatedDestinationCities.includes(extractedInfo.destinationCity)) {
    updatedDestinationCities.push(extractedInfo.destinationCity);
  }

  const updatedInconsistencies = [...currentState.potentialInconsistencies];
  if (detectedInconsistency) {
    updatedInconsistencies.push(detectedInconsistency);
  }

  const questionRecord: InterviewQuestionAnswer = {
    questionNumber: currentQNum,
    question: currentQuestionText,
    answer: passengerAnswer,
    timestamp: new Date().toISOString(),
    extractedInfo,
    inconsistencyDetected: Boolean(detectedInconsistency),
    inconsistencyDetail: detectedInconsistency ? detectedInconsistency.issue : undefined,
  };

  const updatedQuestionsAsked = [...currentState.questionsAsked, questionRecord];
  const nextQNum = currentQNum + 1;

  // Determine completion conditions
  const hasUnresolvedInconsistencies = updatedInconsistencies.some((i) => !i.resolved);

  // Check if interview should finish now (Max 5 questions)
  if (shouldCompleteEarly || !nextQuestionText || nextQNum > 5) {
    const isOverLimit = nextQNum > 5;
    const finalStatus = hasUnresolvedInconsistencies
      ? 'REVIEW_REQUIRED'
      : isOverLimit
      ? 'COMPLETED_MAX_REACHED'
      : 'COMPLETED_SUFFICIENT_INFO';

    const recommendation = hasUnresolvedInconsistencies
      ? 'ADDITIONAL_OFFICER_REVIEW_REQUIRED'
      : 'NO_SIGNIFICANT_INCONSISTENCIES';

    return {
      ...currentState,
      detectedPurpose: extractedInfo.purpose || currentState.detectedPurpose,
      expectedStay: extractedInfo.duration || currentState.expectedStay,
      accommodation: extractedInfo.accommodation || currentState.accommodation,
      hostOrContact: extractedInfo.hostOrContact || currentState.hostOrContact,
      destinationCities: updatedDestinationCities,
      questionsAsked: updatedQuestionsAsked,
      potentialInconsistencies: updatedInconsistencies,
      currentQuestion: '',
      questionCount: currentQNum,
      maxQuestions: 5,
      status: finalStatus,
      consistencyRating: hasUnresolvedInconsistencies ? 'POTENTIAL_MISMATCH' : 'HIGH',
      recommendation,
      finalSummary: summaryNotes || (hasUnresolvedInconsistencies
        ? 'Information inconsistency detected during pre-screening. Referred to authorized officer.'
        : `Pre-screening interview completed in ${currentQNum} questions. Sufficient travel information collected with no significant anomalies.`),
    };
  }

  // Advance to next question (Guaranteed <= 5)
  return {
    ...currentState,
    detectedPurpose: extractedInfo.purpose || currentState.detectedPurpose,
    expectedStay: extractedInfo.duration || currentState.expectedStay,
    accommodation: extractedInfo.accommodation || currentState.accommodation,
    hostOrContact: extractedInfo.hostOrContact || currentState.hostOrContact,
    destinationCities: updatedDestinationCities,
    questionsAsked: updatedQuestionsAsked,
    potentialInconsistencies: updatedInconsistencies,
    currentQuestion: nextQuestionText,
    questionCount: nextQNum,
    status: 'IN_PROGRESS',
    consistencyRating: hasUnresolvedInconsistencies ? 'POTENTIAL_MISMATCH' : 'HIGH',
    recommendation: hasUnresolvedInconsistencies ? 'ADDITIONAL_OFFICER_REVIEW_REQUIRED' : 'NO_SIGNIFICANT_INCONSISTENCIES',
  };
}
