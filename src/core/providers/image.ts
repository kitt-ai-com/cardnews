export interface ImagePrompt {
  text: string;
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
  variations?: number;
}

export interface ImageAsset {
  path: string;
  prompt: ImagePrompt;
  providerMeta: Record<string, unknown>;
  createdAt: string;
}

export interface ImageProvider {
  name: string;
  generate(prompt: ImagePrompt): Promise<ImageAsset>;
  estimateCost?(prompt: ImagePrompt): Promise<{ amount: number; currency: string }>;
}
