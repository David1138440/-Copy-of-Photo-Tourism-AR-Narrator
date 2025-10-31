import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadIcon, CameraIcon, SwitchCameraIcon, MicrophoneIcon, FlashOnIcon, FlashOffIcon, CloseIcon } from './icons';

interface ImageUploaderProps {
  onImageUpload: (file: File, prompt?: string) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  const [mode, setMode] = useState<'upload' | 'camera'>('camera');
  const [isDragging, setIsDragging] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechApiSupported, setSpeechApiSupported] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isFlashSupported, setIsFlashSupported] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null); // Using `any` for SpeechRecognition for cross-browser compatibility

  useEffect(() => {
    // FIX: Cast window to `any` to access non-standard `SpeechRecognition` properties.
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechApiSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setTranscript(prev => prev + finalTranscript);
      };
      
      recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecording(false);
      }
      
      recognition.onend = () => {
          // Check ref to avoid stopping on purpose being treated as an error
          if (recognitionRef.current) {
              setIsRecording(false);
          }
      }
      recognitionRef.current = recognition;
    } else {
        setSpeechApiSupported(false);
    }

    return () => {
        if(recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    };
  }, []);

  useEffect(() => {
    if (mode !== 'camera') {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      if (isRecording) {
        recognitionRef.current?.stop();
        setIsRecording(false);
      }
      return;
    }

    const startCamera = async (currentFacingMode: 'environment' | 'user') => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      // Reset flash state for new camera stream
      setIsFlashSupported(false);
      setIsFlashOn(false);

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacingMode }
        });

        const videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
            const capabilities = videoTrack.getCapabilities();
            // Check if torch is supported. It is generally only supported in environment (back) camera.
            // FIX: The 'torch' property is not in the default MediaTrackCapabilities type. Casting to 'any' to access it.
            if ((capabilities as any).torch && currentFacingMode === 'environment') {
                setIsFlashSupported(true);
            }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
        setStream(newStream);
        setCameraError(null);
      } catch (err) {
        console.error("Error accessing camera:", err);
        let message = "Could not start video source. Please check camera permissions.";
        if (err instanceof DOMException) {
            switch(err.name) {
                case 'NotAllowedError':
                    message = "Camera permission denied. Please allow camera access in your browser settings.";
                    break;
                case 'NotFoundError':
                case 'DevicesNotFoundError':
                    message = `Could not find a ${currentFacingMode} camera.`;
                    break;
                case 'NotReadableError':
                case 'TrackStartError':
                    message = "Camera is already in use by another application.";
                    break;
                case 'OverconstrainedError':
                case 'ConstraintNotSatisfiedError':
                     message = `The ${currentFacingMode} camera does not support the required settings.`;
                     break;
                default:
                    message = "An unknown error occurred while accessing the camera."
            }
        }
        setCameraError(message);
        
        // Fallback logic from back to front camera
        if (currentFacingMode === 'environment') {
          setFacingMode('user');
        } else {
            // If even front camera fails, switch back to upload mode
            setMode('upload');
        }
      }
    };

    startCamera(facingMode);

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode, facingMode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragIn = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.items?.length > 0) setIsDragging(true); }, []);
  const handleDragOut = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      onImageUpload(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [onImageUpload]);

  const handleSwitchCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleToggleFlash = useCallback(async () => {
    if (!stream || !isFlashSupported) return;

    const videoTrack = stream.getVideoTracks()[0];
    try {
        await videoTrack.applyConstraints({
            advanced: [{ torch: !isFlashOn }]
        });
        setIsFlashOn(prev => !prev);
    } catch (err) {
        console.error("Could not toggle flash:", err);
    }
  }, [stream, isFlashOn, isFlashSupported]);
  
  const handleToggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setTranscript(''); // Clear previous question
      recognitionRef.current.start();
    }
    setIsRecording(!isRecording);
  };

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onImageUpload(file, transcript);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  }, [onImageUpload, transcript]);

  if (mode === 'camera') {
    return (
      <div className="w-full flex flex-col items-center">
        <div className="w-full relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-gray-700">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
          <canvas ref={canvasRef} className="hidden"></canvas>
          
          <button
            onClick={() => setMode('upload')}
            className="absolute top-3 left-3 p-2 rounded-full text-white transition-all bg-black/40 hover:bg-black/60 backdrop-blur-sm shadow-md"
            aria-label="Close camera"
          >
            <CloseIcon />
          </button>
          
          {/* Flash Button */}
          {isFlashSupported && !cameraError && (
            <button 
              onClick={handleToggleFlash} 
              className={`absolute top-3 right-3 p-2 rounded-full text-white transition-all backdrop-blur-sm shadow-md ${isFlashOn ? 'bg-yellow-400/80 text-black' : 'bg-black/40 hover:bg-black/60'}`} 
              aria-label={isFlashOn ? 'Turn flash off' : 'Turn flash on'}
            >
              {isFlashOn ? <FlashOnIcon /> : <FlashOffIcon />}
            </button>
          )}

          {transcript && (
              <div className="absolute bottom-16 sm:bottom-0 left-0 right-0 bg-black/50 p-2 text-center text-sm text-white backdrop-blur-sm">
                  {transcript}
              </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
              <p className="text-red-400 text-center">{cameraError}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between w-full max-w-sm mt-4">
           {speechApiSupported ? (
                <button 
                  onClick={handleToggleRecording} 
                  className={`p-3 rounded-full transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-700/50 hover:bg-gray-700 text-gray-300'}`} 
                  aria-label={isRecording ? 'Stop recording' : 'Start recording question'}
                >
                    <MicrophoneIcon />
                </button>
           ) : <div className="w-12 h-12" /> /* Placeholder for alignment */}
           <button 
             onClick={handleCapture} 
             className="w-16 h-16 rounded-full bg-white/90 hover:bg-white ring-4 ring-white/30 ring-offset-4 ring-offset-gray-800 transition-all focus:outline-none"
             aria-label="Capture photo"
             disabled={!!cameraError}
            ></button>
           <button onClick={handleSwitchCamera} className="text-gray-300 hover:text-white transition-colors p-3 rounded-full bg-gray-700/50 hover:bg-gray-700" aria-label="Switch camera" disabled={!!cameraError}>
             <SwitchCameraIcon />
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <label
        htmlFor="dropzone-file"
        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700/50 hover:bg-gray-700 transition-colors ${isDragging ? 'border-cyan-400 bg-cyan-900/50' : ''}`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadIcon />
          <p className="mb-2 text-sm text-gray-400">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">PNG, JPG, or WEBP (MAX. 10MB)</p>
        </div>
        <input id="dropzone-file" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
      </label>
      <div className="flex items-center my-4 w-full">
        <span className="flex-grow bg-gray-700 h-px"></span>
        <span className="mx-4 text-gray-500 text-sm">OR</span>
        <span className="flex-grow bg-gray-700 h-px"></span>
      </div>
      <button 
        onClick={() => setMode('camera')}
        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center"
      >
        <CameraIcon />
        <span className="ml-2">Use Camera</span>
      </button>
    </div>
  );
};

export default ImageUploader;