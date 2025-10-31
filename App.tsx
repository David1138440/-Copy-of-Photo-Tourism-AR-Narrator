import React, { useState, useCallback } from 'react';
import { analyzeImageAndFetchHistory, generateNarration } from './services/geminiService';
import ImageUploader from './components/ImageUploader';
import ResultDisplay from './components/ResultDisplay';
import Spinner from './components/Spinner';
import { LandmarkInfo } from './types';

type AppStep = 'UPLOAD' | 'PROCESSING' | 'RESULT' | 'ERROR';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('UPLOAD');
  const [processingMessage, setProcessingMessage] = useState('');
  const [landmarkInfo, setLandmarkInfo] = useState<LandmarkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleImageUpload = useCallback(async (file: File, userPrompt?: string) => {
    setStep('PROCESSING');
    setError(null);
    setLandmarkInfo(null);
    
    const localImageUrl = URL.createObjectURL(file);
    setImageUrl(localImageUrl);

    try {
      const analysisMessage = userPrompt ? 'Analyzing photo and your question...' : 'Identifying landmark...';
      setProcessingMessage(`Step 1/3: ${analysisMessage}`);
      const landmarkName = await analyzeImageAndFetchHistory(file, userPrompt);

      if (!landmarkName || !landmarkName.text) {
          throw new Error("Could not identify a landmark in the photo or answer the question. Please try a clearer image or a different question.");
      }

      setProcessingMessage('Step 2/3: Generating narration...');
      const audioContent = await generateNarration(landmarkName.text);
      
      setProcessingMessage('Step 3/3: Finalizing...');

      setLandmarkInfo({
        name: landmarkName.name,
        history: landmarkName.text,
        sources: landmarkName.sources,
        audioBase64: audioContent,
        imageUrl: localImageUrl,
      });
      setStep('RESULT');
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Analysis failed: ${errorMessage}`);
      setStep('ERROR');
    }
  }, []);

  const handleReset = () => {
    if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
    }
    setStep('UPLOAD');
    setError(null);
    setLandmarkInfo(null);
    setImageUrl(null);
    setProcessingMessage('');
  };

  const renderContent = () => {
    switch (step) {
      case 'UPLOAD':
        return <ImageUploader onImageUpload={handleImageUpload} />;
      case 'PROCESSING':
        return <Spinner message={processingMessage} />;
      case 'RESULT':
        return landmarkInfo && <ResultDisplay info={landmarkInfo} onReset={handleReset} />;
      case 'ERROR':
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-500 mb-4">An Error Occurred</h2>
            <p className="text-red-300 bg-red-900/50 p-4 rounded-lg">{error}</p>
            <button
              onClick={handleReset}
              className="mt-6 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <header className="text-center mb-8 w-full max-w-4xl">
        <div className="w-48 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 mx-auto rounded"></div>
        <h1 className="sr-only">Photo Tourism AR Narrator</h1>
        <p className="text-gray-300 mt-4 text-lg max-w-2xl mx-auto">
          Upload a photo of a landmark. AI will identify it, narrate its history, and show you its story.
        </p>
      </header>
      <main className="w-full max-w-4xl bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-700">
        {renderContent()}
      </main>
      <footer className="mt-8 text-center text-gray-500 text-sm">
        <p>Powered by Gemini API</p>
      </footer>
    </div>
  );
};

export default App;