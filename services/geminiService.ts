import { GoogleGenAI, Modality, Type } from '@google/genai';
import { GroundingChunk } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
        }
    };
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const analyzeImageAndFetchHistory = async (file: File, userPrompt?: string) => {
  const imagePart = await fileToGenerativePart(file);

  // Step 1: Always identify the landmark first to get a clean name for the title.
  const landmarkModel = 'gemini-2.5-flash';
  const landmarkNamePrompt = "Identify the primary landmark in this photo. Respond with only the name of the landmark. If it's not a famous landmark, say 'Unknown'.";
  
  const landmarkResult = await ai.models.generateContent({
      model: landmarkModel,
      contents: [{ parts: [imagePart, { text: landmarkNamePrompt }] }],
  });
  
  const landmarkName = landmarkResult.text.trim();
  if (landmarkName.toLowerCase() === 'unknown' || landmarkName.length < 3) {
      throw new Error("Could not recognize a famous landmark in the image.");
  }
  
  // Step 2: Fetch history or answer the user's question with Search Grounding.
  const historyModel = 'gemini-2.5-flash';
  const historyPrompt = userPrompt 
    ? `Regarding the landmark "${landmarkName}", answer the user's question: "${userPrompt}". Provide a concise, engaging answer under 150 words.`
    : `Provide a concise, engaging history of ${landmarkName}. Focus on its origin, significance, and one interesting fact. Keep it under 150 words.`;

  const historyResult = await ai.models.generateContent({
    model: historyModel,
    contents: [{ parts: [{ text: historyPrompt }] }],
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const historyText = historyResult.text;
  const groundingChunks = historyResult.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  return {
    name: landmarkName,
    text: historyText,
    sources: groundingChunks as GroundingChunk[]
  };
};


export const generateNarration = async (textToNarrate: string): Promise<string> => {
  const ttsModel = 'gemini-2.5-flash-preview-tts';
  const result = await ai.models.generateContent({
    model: ttsModel,
    contents: [{ parts: [{ text: `Narrate this history in a clear and engaging tone: ${textToNarrate}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' } // A calm and clear voice
        }
      }
    }
  });

  const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) {
    throw new Error('Failed to generate audio narration.');
  }

  return audioData;
};