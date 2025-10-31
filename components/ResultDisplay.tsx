import React, { useState, useEffect, useMemo } from 'react';
import { LandmarkInfo } from '../types';
import { AudioPlayer } from '../utils/audioPlayer';
import { PlayIcon, PauseIcon } from './icons';

interface ResultDisplayProps {
  info: LandmarkInfo;
  onReset: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ info, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(true);

  const audioPlayer = useMemo(() => new AudioPlayer(info.audioBase64), [info.audioBase64]);

  useEffect(() => {
    let isMounted = true;
    const loadAudio = async () => {
      await audioPlayer.load();
      if(isMounted) setIsLoadingAudio(false);
    };

    loadAudio();
    audioPlayer.onEnded(() => {
        if(isMounted) setIsPlaying(false);
    });
    
    return () => { isMounted = false; audioPlayer.stop() };
  }, [audioPlayer]);

  const togglePlay = () => {
    if (isPlaying) {
      audioPlayer.stop();
      setIsPlaying(false);
    } else {
      audioPlayer.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="w-full">
      <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-lg border-2 border-gray-700">
        <img src={info.imageUrl} alt={info.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 md:p-6 flex flex-col justify-end">
          <h2 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">{info.name}</h2>
          <div className="mt-4 max-h-48 overflow-y-auto pr-2">
            <p className="text-gray-200 text-sm md:text-base leading-relaxed">{info.history}</p>
          </div>
        </div>
        <div className="absolute top-4 right-4">
          <button
            onClick={togglePlay}
            disabled={isLoadingAudio}
            className="w-12 h-12 bg-cyan-500/80 hover:bg-cyan-500 text-white rounded-full flex items-center justify-center transition-all disabled:bg-gray-500 disabled:cursor-not-allowed backdrop-blur-sm"
            aria-label={isPlaying ? "Pause narration" : "Play narration"}
          >
            {isLoadingAudio ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            ) : isPlaying ? (
              <PauseIcon />
            ) : (
              <PlayIcon />
            )}
          </button>
        </div>
      </div>
      
      {info.sources && info.sources.length > 0 && (
          <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Sources:</h3>
              <div className="flex flex-wrap gap-2">
                  {info.sources.map((source, index) => source.web && (
                      <a 
                        key={index} 
                        href={source.web.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-cyan-300 px-3 py-1 rounded-full transition-colors truncate"
                        title={source.web.title}
                      >
                          {source.web.title || new URL(source.web.uri).hostname}
                      </a>
                  ))}
              </div>
          </div>
      )}

      <div className="mt-8 text-center">
        <button
          onClick={onReset}
          className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-5 rounded-lg transition-colors"
        >
          Analyze Another Photo
        </button>
      </div>
    </div>
  );
};

export default ResultDisplay;