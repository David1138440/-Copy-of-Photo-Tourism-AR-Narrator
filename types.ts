export interface LandmarkInfo {
  name: string;
  history: string;
  sources: GroundingChunk[];
  audioBase64: string;
  imageUrl: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}
