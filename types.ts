
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export enum AstraAgent {
  GENERAL = 'General',
  RESEARCHER = 'Researcher',
  CREATIVE = 'Creative',
  CODER = 'Coder',
  ANALYST = 'Analyst',
  ARCHITECT = 'Architect',
  NODEJS_EXPERT = 'Node.js Expert'
}

export interface GroundingLink {
  uri: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  image?: string; 
  isGenerating?: boolean;
  groundingLinks?: GroundingLink[];
  thought?: string;
  isVision?: boolean;
  pdfName?: string;
  isError?: boolean;
  isBookmarked?: boolean;
}

export type ImageStyle = "None" | "Photorealistic" | "Anime" | "Digital Art" | "Oil Painting" | "Pixel Art" | "3D Render" | "Watercolor" | "Sketch";

export interface ImageGenConfig {
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  quality: "standard" | "high";
  style: ImageStyle;
}

export interface UserMemory {
  facts: string[];
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface FewShotExample {
  input: string;
  output: string;
}

export interface SandboxConfig {
  systemInstruction: string;
  temperature: number;
  topK: number;
  topP: number;
  examples: FewShotExample[];
}

export interface TerminalLog {
  id: string;
  command: string;
  output: string;
  timestamp: number;
}

export interface AppState {
  messages: ChatMessage[];
  isSidebarOpen: boolean;
  currentModel: string;
  activeAgent: AstraAgent;
  isAudioEnabled: boolean;
  isThinkingEnabled: boolean;
  isViewMode: boolean;
  isCodeMode: boolean;
  isSandboxOpen: boolean;
  imageConfig: ImageGenConfig;
  memory: UserMemory;
  tasks: Task[];
  sandboxConfig: SandboxConfig;
  terminalLogs: TerminalLog[];
  isTerminalOpen: boolean;
}

export enum AstraModel {
  FLASH = 'gemini-3-flash-preview',
  LITE = 'gemini-2.5-flash-lite-latest',
  PRO = 'gemini-3-pro-preview',
  IMAGE_FLASH = 'gemini-2.5-flash-image',
  IMAGE_PRO = 'gemini-3-pro-image-preview',
  TTS = 'gemini-2.5-flash-preview-tts'
}
