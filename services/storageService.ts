
import { createClient } from '@supabase/supabase-js';
import { UserMemory, ChatMessage, SandboxConfig, TerminalLog, Task } from '../types';

// Initialize Supabase only if env vars are present
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const USER_ID_KEY = 'astra_user_id';

// Helper to get or create a persistent anonymous user ID
const getUserId = () => {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
};

export interface UserSessionData {
  memory: UserMemory;
  tasks: Task[];
  messages: ChatMessage[];
  sandboxConfig: SandboxConfig;
  terminalLogs: TerminalLog[];
  customCSS?: string;
}

export const storageService = {
  // Load data from Supabase (if available) or LocalStorage
  async loadSession(): Promise<UserSessionData | null> {
    const userId = getUserId();
    const localMemory = localStorage.getItem('astra_memory');
    const localTasks = localStorage.getItem('astra_tasks');
    const localCSS = localStorage.getItem('astra_css');
    
    // Default initial state
    let data: UserSessionData = {
      memory: localMemory ? JSON.parse(localMemory) : { facts: [] },
      tasks: localTasks ? JSON.parse(localTasks) : [],
      messages: [],
      sandboxConfig: {
        systemInstruction: "You are a helpful test assistant.",
        temperature: 1,
        topK: 40,
        topP: 0.95,
        examples: []
      },
      terminalLogs: [],
      customCSS: localCSS || ''
    };

    if (supabase) {
      try {
        const { data: remoteData, error } = await supabase
          .from('user_sessions')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (remoteData && !error) {
          return {
            memory: remoteData.memory || data.memory,
            tasks: remoteData.tasks || data.tasks,
            messages: remoteData.chat_history || [],
            sandboxConfig: remoteData.sandbox_config || data.sandboxConfig,
            terminalLogs: remoteData.terminal_logs || [],
            customCSS: remoteData.custom_css || data.customCSS
          };
        }
      } catch (e) {
        console.warn('Supabase load failed, falling back to local', e);
      }
    }

    return data;
  },

  // Save data to Supabase (fire and forget) and LocalStorage
  async saveSession(data: Partial<UserSessionData>) {
    const userId = getUserId();

    // Always update local storage for offline support
    if (data.memory) {
      localStorage.setItem('astra_memory', JSON.stringify(data.memory));
    }
    if (data.tasks) {
      localStorage.setItem('astra_tasks', JSON.stringify(data.tasks));
    }
    if (data.customCSS !== undefined) {
      localStorage.setItem('astra_css', data.customCSS);
    }

    if (supabase) {
      try {
        // We structure the payload to match DB columns
        const payload: any = { user_id: userId, updated_at: new Date().toISOString() };
        if (data.memory) payload.memory = data.memory;
        if (data.tasks) payload.tasks = data.tasks;
        if (data.messages) payload.chat_history = data.messages;
        if (data.sandboxConfig) payload.sandbox_config = data.sandboxConfig;
        if (data.terminalLogs) payload.terminal_logs = data.terminalLogs;
        if (data.customCSS !== undefined) payload.custom_css = data.customCSS;

        await supabase
          .from('user_sessions')
          .upsert(payload, { onConflict: 'user_id' });
      } catch (e) {
        console.warn('Supabase save failed', e);
      }
    }
  }
};
