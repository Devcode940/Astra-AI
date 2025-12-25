
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, Menu, X, Sparkles, Image as ImageIcon, Volume2, VolumeX, Trash2, Brain,
  Search, ExternalLink, ChevronRight, Maximize2, Settings2, Info, User, Zap,
  Code, FileText, Check, Copy, Paperclip, AlertCircle, LayoutList, ShieldAlert,
  Ghost, Microscope, Palette, Binary, LineChart, PencilRuler, ChevronDown, ChevronUp, Box, Sliders, Play, Plus, Terminal as TerminalIcon, Cloud, ListTodo, CheckCircle2, Circle, Star, Bookmark, ClipboardCopy, Loader2
} from 'lucide-react';
import Prism from 'prismjs';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

import { ChatMessage, MessageRole, AstraModel, AstraAgent, ImageGenConfig, UserMemory, ImageStyle, SandboxConfig, FewShotExample, TerminalLog, Task } from './types';
import { geminiService } from './services/geminiService';
import { pdfService } from './services/pdfService';
import { storageService } from './services/storageService';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [model, setModel] = useState<string>(AstraModel.FLASH);
  const [activeAgent, setActiveAgent] = useState<AstraAgent>(AstraAgent.GENERAL);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Sandbox State
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [sandboxMessages, setSandboxMessages] = useState<ChatMessage[]>([]);
  const [sandboxConfig, setSandboxConfig] = useState<SandboxConfig>({
    systemInstruction: "You are a helpful test assistant.",
    temperature: 1,
    topK: 40,
    topP: 0.95,
    examples: []
  });
  const [sandboxInput, setSandboxInput] = useState("");
  
  // Terminal State
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  
  // Tasks State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskInput, setNewTaskInput] = useState("");

  // Custom CSS State
  const [customCSS, setCustomCSS] = useState("");
  const [isCSSEditorOpen, setIsCSSEditorOpen] = useState(false);

  // Bookmarks State
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);

  // Agent Quick Select Menu State
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);

  // Code Modal State
  const [expandedCode, setExpandedCode] = useState<{code: string, lang: string} | null>(null);

  const [imageConfig, setImageConfig] = useState<ImageGenConfig>({
    aspectRatio: "1:1",
    quality: "standard",
    style: "None"
  });
  const [memory, setMemory] = useState<UserMemory>({ facts: [] });
  const [pendingImage, setPendingImage] = useState<{ data: string, mimeType: string } | null>(null);
  const [pendingPdf, setPendingPdf] = useState<{ name: string, text: string } | null>(null);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const sandboxScrollRef = useRef<HTMLDivElement>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Session Data (Supabase/Local)
  useEffect(() => {
    const loadData = async () => {
      const data = await storageService.loadSession();
      if (data) {
        setMemory(data.memory);
        setTasks(data.tasks || []);
        setMessages(data.messages || []);
        if (data.sandboxConfig) setSandboxConfig(data.sandboxConfig);
        if (data.terminalLogs) setTerminalLogs(data.terminalLogs);
        if (data.customCSS) setCustomCSS(data.customCSS);
      }
    };
    loadData();
  }, []);

  // Sync Changes to Storage
  useEffect(() => {
    // Debounce saves slightly to avoid hammering the DB
    const timeout = setTimeout(() => {
      storageService.saveSession({
        memory,
        tasks,
        messages,
        sandboxConfig,
        terminalLogs,
        customCSS
      });
    }, 2000);
    return () => clearTimeout(timeout);
  }, [memory, tasks, messages, sandboxConfig, terminalLogs, customCSS]);

  // Inject Custom CSS
  useEffect(() => {
    const styleId = 'astra-custom-css';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = customCSS;
  }, [customCSS]);

  // Terminal Event Listener
  useEffect(() => {
    const handleTerminalEvent = (e: any) => {
       const log: TerminalLog = {
          id: Date.now().toString(),
          command: e.detail.command,
          output: e.detail.output,
          timestamp: Date.now()
       };
       setTerminalLogs(prev => [...prev, log]);
       if (!isTerminalOpen) setIsTerminalOpen(true);
    };
    
    window.addEventListener('astra-terminal', handleTerminalEvent);
    return () => window.removeEventListener('astra-terminal', handleTerminalEvent);
  }, [isTerminalOpen]);

  // Task Event Listener
  useEffect(() => {
    const handleTaskEvent = (e: any) => {
      const { action, task, id } = e.detail;
      
      if (action === 'add') {
        const newTask: Task = {
          id: Date.now().toString().slice(-6),
          text: task,
          completed: false
        };
        setTasks(prev => [...prev, newTask]);
      } else if (action === 'remove') {
        setTasks(prev => prev.filter(t => t.id !== id));
      } else if (action === 'toggle' || action === 'complete') {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
      }
    };

    window.addEventListener('astra-task-event', handleTaskEvent);
    return () => window.removeEventListener('astra-task-event', handleTaskEvent);
  }, []);

  // Smooth Scrolling Logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isBookmarksOpen]);
  
  // Sandbox Scrolling
  useEffect(() => {
    if (sandboxScrollRef.current) {
      sandboxScrollRef.current.scrollTo({
        top: sandboxScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [sandboxMessages]);
  
  // Terminal Scrolling
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTo({
        top: terminalScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [terminalLogs, isTerminalOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const data = readerEvent.target?.result as string;
        setPendingImage({ data, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      setIsExtractingFile(true);
      pdfService.extractText(file).then(text => {
        setPendingPdf({ name: file.name, text });
      }).catch(err => {
         alert("Could not extract text from PDF: " + err.message);
      }).finally(() => setIsExtractingFile(false));
    } else {
      setIsExtractingFile(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setPendingPdf({ name: file.name, text });
        setIsExtractingFile(false);
      };
      reader.onerror = () => setIsExtractingFile(false);
      reader.readAsText(file);
    }
  };

  const addTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskInput.trim()) return;
    const newTask: Task = {
      id: Date.now().toString().slice(-6),
      text: newTaskInput,
      completed: false
    };
    setTasks(prev => [...prev, newTask]);
    setNewTaskInput("");
  };

  const toggleBookmark = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isBookmarked: !m.isBookmarked } : m));
  };

  const handleCopyContext = (index: number) => {
    const currentMsg = messages[index];
    const prevMsg = messages[index - 1];
    
    let textToCopy = "";
    if (prevMsg && prevMsg.role !== currentMsg.role) {
      textToCopy += `[${prevMsg.role.toUpperCase()}]: ${prevMsg.text}\n\n`;
    }
    textToCopy += `[${currentMsg.role.toUpperCase()}]: ${currentMsg.text}`;
    
    navigator.clipboard.writeText(textToCopy);
    alert("Context copied to clipboard!");
  };

  const handleSendMessage = async (e?: React.FormEvent, isSandbox = false) => {
    if (e) e.preventDefault();
    const currentInput = isSandbox ? sandboxInput : input;
    
    if ((!currentInput.trim() && !pendingImage && !pendingPdf) || isGenerating) return;

    const currentPendingImage = pendingImage;
    const currentPendingPdf = pendingPdf;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: currentInput || (currentPendingImage ? "Analyzing image..." : currentPendingPdf ? `Analyzing ${currentPendingPdf.name}...` : ""),
      timestamp: Date.now(),
      image: currentPendingImage?.data,
      pdfName: currentPendingPdf?.name,
      isVision: !!currentPendingImage
    };

    if (isSandbox) {
       setSandboxMessages(prev => [...prev, userMessage]);
       setSandboxInput('');
    } else {
       setMessages(prev => [...prev, userMessage]);
       setInput('');
       setPendingImage(null);
       setPendingPdf(null);
    }
    
    setIsGenerating(true);

    const isImgGen = !isSandbox && (currentInput.toLowerCase().includes('generate image') || currentInput.toLowerCase().includes('create a picture'));

    if (isImgGen && !currentPendingImage && !currentPendingPdf) {
      const generatingMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        text: `Generating your ${imageConfig.quality} quality image (${imageConfig.aspectRatio}, ${imageConfig.style})...`,
        isGenerating: true,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, generatingMsg]);
      try {
        const imageUrl = await geminiService.generateImage(currentInput, imageConfig);
        setMessages(prev => prev.map(m => m.id === generatingMsg.id ? { ...m, text: 'Here is your generated image:', image: imageUrl || '', isGenerating: false } : m));
      } catch (err: any) {
        setMessages(prev => prev.map(m => m.id === generatingMsg.id ? { ...m, text: err.message, isGenerating: false, isError: true } : m));
      }
      setIsGenerating(false);
      return;
    }

    const modelMessageId = (Date.now() + 1).toString();
    const newModelMessage: ChatMessage = {
      id: modelMessageId,
      role: MessageRole.MODEL,
      text: '',
      isGenerating: true,
      timestamp: Date.now()
    };
    
    if (isSandbox) {
       setSandboxMessages(prev => [...prev, newModelMessage]);
    } else {
       setMessages(prev => [...prev, newModelMessage]);
    }

    try {
      let fullText = '';
      let groundingLinks: { uri: string; title: string }[] = [];
      const stream = geminiService.streamChat(
          currentInput, 
          isSandbox ? sandboxMessages : messages, 
          { 
            model, 
            agent: activeAgent,
            thinking: isThinkingEnabled,
            isViewMode,
            isCodeMode,
            image: currentPendingImage || undefined,
            pdfText: currentPendingPdf?.text,
            memory: isSandbox ? [] : memory.facts,
            tasks: isSandbox ? [] : tasks, // Pass tasks context
            sandboxConfig: isSandbox ? sandboxConfig : undefined
          }
      );

      for await (const chunk of stream) {
        if (chunk.text) {
          fullText += chunk.text;
          if (isSandbox) {
             setSandboxMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, text: fullText } : m));
          } else {
             setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, text: fullText } : m));
          }
        }
        const chunks = (chunk as any).candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          const links = chunks.filter((c: any) => c.web).map((c: any) => ({ uri: c.web.uri, title: c.web.title }));
          if (links.length > 0) groundingLinks = [...groundingLinks, ...links];
        }
      }

      if (isSandbox) {
         setSandboxMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, isGenerating: false, groundingLinks } : m));
      } else {
         const updatedMessages = [...messages, userMessage, { ...newModelMessage, text: fullText, isGenerating: false, groundingLinks }];
         setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, isGenerating: false, groundingLinks } : m));
         // Update memory only in main chat
         setTimeout(async () => {
            const newFacts = await geminiService.updateMemory(updatedMessages);
            if (newFacts.length > 0) {
              setMemory(prev => {
                const filtered = newFacts.filter((f: string) => !prev.facts.includes(f));
                if (filtered.length === 0) return prev;
                const updated = { facts: [...prev.facts, ...filtered] };
                // Storage service handles the save now via the useEffect
                return updated;
              });
            }
          }, 1000);
      }

      if (isAudioEnabled && !isSandbox) await geminiService.speakText(fullText);

    } catch (error: any) {
      console.error(error);
      const updateError = (prev: ChatMessage[]) => prev.map(m => m.id === modelMessageId ? { ...m, text: error.message, isGenerating: false, isError: true } : m);
      if (isSandbox) setSandboxMessages(updateError);
      else setMessages(updateError);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setShowResetConfirm(false);
    // Explicitly clear via storage service
    storageService.saveSession({ messages: [] });
  };

  const getModelLabel = () => {
    if (isSandboxOpen) return 'Training Sandbox (Test Mode)';
    if (isThinkingEnabled) return 'Gemini 3 Pro (Thinking)';
    if (isCodeMode) return 'Gemini 3 Pro (Coding)';
    if (isViewMode) return 'Astra View (Concise)';
    return `${model === AstraModel.PRO ? 'Gemini 3 Pro' : model === AstraModel.FLASH ? 'Gemini 3 Flash' : 'Gemini 2.5 Flash Lite'} • ${activeAgent}`;
  };

  // Helper to separate thought from text
  const parseMessageContent = (text: string) => {
    // Regex matches <thinking>...</thinking> but handles partial/streaming content roughly
    const thoughtMatch = text.match(/<thinking>([\s\S]*?)(?:<\/thinking>|$)/);
    if (thoughtMatch) {
      return {
        thought: thoughtMatch[1].trim(),
        content: text.replace(/<thinking>[\s\S]*?<\/thinking>/, '').replace(/<thinking>[\s\S]*/, '').trim()
      };
    }
    return { thought: null, content: text };
  };

  const renderContent = (text: string) => {
    const { thought, content } = parseMessageContent(text);

    return (
      <>
        {thought && (
          <details className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl overflow-hidden group" open>
            <summary className="px-4 py-2 cursor-pointer flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider bg-amber-500/5 hover:bg-amber-500/10 transition-colors select-none">
              <Brain size={14} className="group-open:text-amber-300" /> 
              <span>Critical Analysis</span>
              <ChevronDown size={14} className="ml-auto transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 pt-2 text-amber-200/90 text-sm font-mono whitespace-pre-wrap leading-relaxed border-t border-amber-500/10">
              {thought}
            </div>
          </details>
        )}
        
        {content.split(/(```[\s\S]*?```)/g).map((part, i) => {
          if (part.startsWith('```')) {
            const match = part.match(/```(\w*)\n([\s\S]*?)```/);
            const lang = match?.[1] || 'text';
            const code = match?.[2] || part.slice(3, -3);
            return <CodeBlock key={i} code={code} lang={lang} onExpand={() => setExpandedCode({code, lang})} />;
          }
          return <span key={i} className="whitespace-pre-wrap">{part}</span>;
        })}
      </>
    );
  };

  const agentIcons = {
    [AstraAgent.GENERAL]: <Sparkles size={16} />,
    [AstraAgent.RESEARCHER]: <Microscope size={16} />,
    [AstraAgent.CREATIVE]: <Palette size={16} />,
    [AstraAgent.CODER]: <Binary size={16} />,
    [AstraAgent.ANALYST]: <LineChart size={16} />,
    [AstraAgent.ARCHITECT]: <PencilRuler size={16} />,
  };

  const agentDescriptions = {
    [AstraAgent.GENERAL]: "Helpful, concise, and balanced assistance for everyday tasks.",
    [AstraAgent.RESEARCHER]: "Deep dives with citations and Google Search grounding.",
    [AstraAgent.CREATIVE]: "Poetic, artistic, and imaginative storytelling.",
    [AstraAgent.CODER]: "Code generation, terminal access, and software logic.",
    [AstraAgent.ANALYST]: "Data extraction, summarization, and logical deduction.",
    [AstraAgent.ARCHITECT]: "System design, software architecture, and high-level planning.",
  };

  const imageStyles: ImageStyle[] = ["None", "Photorealistic", "Anime", "Digital Art", "Oil Painting", "Pixel Art", "3D Render", "Watercolor", "Sketch"];

  const displayedMessages = isBookmarksOpen ? messages.filter(m => m.isBookmarked) : messages;

  return (
    <div className={`flex h-screen w-full overflow-hidden transition-colors duration-500 ${isViewMode ? 'bg-slate-950 text-slate-300' : 'bg-slate-950 text-f8fafc'}`}>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf,text/*,.txt,.md,.json,.csv" className="hidden" />
      
      {/* Vercel Analytics */}
      <Analytics />
      <SpeedInsights />

      {/* Code Expansion Modal */}
      {expandedCode && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-5xl h-[85vh] bg-[#0d1117] border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
               <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
                  <span className="text-sm font-bold text-indigo-400 font-mono uppercase tracking-wider">{expandedCode.lang} Preview</span>
                  <div className="flex gap-2">
                     <button 
                        onClick={() => {
                           navigator.clipboard.writeText(expandedCode.code);
                           alert("Code copied!");
                        }}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                     >
                        <Copy size={14} /> Copy Code
                     </button>
                     <button onClick={() => setExpandedCode(null)} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-800 rounded-lg transition-colors">
                        <X size={16} />
                     </button>
                  </div>
               </div>
               <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                  <pre className="text-sm font-mono leading-relaxed text-indigo-100/90">
                     <code dangerouslySetInnerHTML={{ __html: Prism.highlight(expandedCode.code, Prism.languages[expandedCode.lang] || Prism.languages.javascript, expandedCode.lang)}} />
                  </pre>
               </div>
            </div>
         </div>
      )}

      {/* Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl scale-in-center">
              <div className="flex flex-col items-center text-center space-y-4">
                 <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500">
                    <Trash2 size={32} />
                 </div>
                 <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white">Clear Conversation?</h3>
                    <p className="text-sm text-slate-400">This will permanently delete your current chat history and reset the session.</p>
                 </div>
                 <div className="flex gap-3 w-full pt-4">
                    <button 
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 px-4 py-3 rounded-2xl bg-slate-800 text-slate-100 font-bold hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={resetChat}
                      className="flex-1 px-4 py-3 rounded-2xl bg-rose-600 text-white font-bold hover:bg-rose-500 transition-colors shadow-lg shadow-rose-900/20"
                    >
                      Reset
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* CSS Editor Modal */}
      {isCSSEditorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[80vh]">
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                 <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
                    <Palette size={20} /> Custom CSS
                 </h3>
                 <button onClick={() => setIsCSSEditorOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <div className="flex-1 p-0 relative">
                 <textarea 
                    value={customCSS}
                    onChange={(e) => setCustomCSS(e.target.value)}
                    className="w-full h-full bg-slate-950 p-4 font-mono text-xs text-emerald-300 focus:outline-none resize-none"
                    placeholder="/* Enter custom CSS here to override styles */&#10;body {&#10;  background-color: #000;&#10;}"
                    spellCheck={false}
                 />
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
                 <span className="text-xs text-slate-500">Changes apply immediately</span>
                 <button 
                    onClick={() => setIsCSSEditorOpen(false)}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-500 transition-colors"
                 >
                    Done
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Terminal Panel (Popup) */}
      <div className={`fixed bottom-0 right-0 lg:right-4 lg:w-[600px] w-full bg-slate-900 border-t border-x border-slate-700 rounded-t-2xl shadow-2xl z-50 transition-transform duration-300 flex flex-col ${isTerminalOpen ? 'translate-y-0 h-80' : 'translate-y-[calc(100%-40px)] h-80'}`}>
         <div 
           className="h-10 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 cursor-pointer hover:bg-slate-750"
           onClick={() => setIsTerminalOpen(!isTerminalOpen)}
         >
            <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
               <TerminalIcon size={16} className="text-emerald-400" />
               <span className="font-bold">Astra Terminal</span>
               {terminalLogs.length > 0 && <span className="bg-slate-700 px-1.5 rounded-md text-[10px] text-slate-400">{terminalLogs.length}</span>}
            </div>
            <div className="flex items-center gap-2">
               <button onClick={(e) => { e.stopPropagation(); setTerminalLogs([]); }} className="p-1 hover:text-rose-400 text-slate-500"><Trash2 size={14} /></button>
               {isTerminalOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>
         </div>
         <div ref={terminalScrollRef} className="flex-1 bg-[#0d1117] p-4 font-mono text-xs overflow-y-auto custom-scrollbar">
            {terminalLogs.length === 0 ? (
               <div className="text-slate-600 italic">No active terminal sessions...</div>
            ) : (
               terminalLogs.map((log) => (
                  <div key={log.id} className="mb-4">
                     <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <span className="text-emerald-500 font-bold">$</span>
                        <span className="text-slate-300">{log.command}</span>
                        <span className="text-[10px] opacity-50 ml-auto">{new Date(log.timestamp).toLocaleTimeString()}</span>
                     </div>
                     <pre className="text-slate-400 whitespace-pre-wrap pl-4 border-l-2 border-slate-800">{log.output}</pre>
                  </div>
               ))
            )}
         </div>
      </div>

      {/* Sidebar */}
      <aside className={`fixed lg:relative z-40 h-full w-80 bg-slate-900/50 border-r border-slate-800 backdrop-blur-xl transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-ml-80'}`}>
        <div className="flex flex-col h-full p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">Astra AI</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-slate-500 hover:text-white"><X size={20} /></button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            
            {/* Sandbox Toggle */}
            <div className="space-y-2">
              <button 
                onClick={() => setIsSandboxOpen(!isSandboxOpen)}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all border ${isSandboxOpen ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-lg shadow-indigo-900/20' : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-800'}`}
              >
                <div className="flex items-center gap-3">
                  <Box size={18} className={isSandboxOpen ? 'text-indigo-400' : 'text-slate-400'} /> 
                  <span className="text-sm font-bold">LLM Training Sandbox</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-all ${isSandboxOpen ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isSandboxOpen ? 'right-0.5' : 'left-0.5'}`}></div>
                </div>
              </button>
            </div>

            {/* Agent Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase px-2 tracking-widest">Select Agent</label>
              <div className="grid grid-cols-1 gap-1">
                {Object.values(AstraAgent).map((agent) => (
                  <div key={agent} className="relative group">
                     <button 
                        onClick={() => { setActiveAgent(agent); setIsCodeMode(false); setIsSandboxOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border ${activeAgent === agent ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'}`}
                     >
                        <div className={`${activeAgent === agent ? 'text-indigo-400' : 'text-slate-500'}`}>
                        {agentIcons[agent]}
                        </div>
                        <span className="text-sm font-semibold">{agent}</span>
                     </button>
                     {/* Tooltip */}
                     <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-48 p-2 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700">
                        {agentDescriptions[agent]}
                     </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks Section */}
            <div className="space-y-2">
               <div className="flex items-center justify-between px-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Active Tasks</label>
                  <span className="text-[10px] bg-slate-800 px-1.5 rounded-md text-slate-400">{tasks.filter(t => !t.completed).length}</span>
               </div>
               <div className="bg-slate-900/40 rounded-2xl p-3 border border-slate-800/50 space-y-3">
                  <form onSubmit={addTask} className="flex gap-2">
                     <input 
                       value={newTaskInput}
                       onChange={(e) => setNewTaskInput(e.target.value)}
                       placeholder="Add a new task..."
                       className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                     />
                     <button type="submit" className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/20"><Plus size={14} /></button>
                  </form>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                     {tasks.length === 0 ? (
                        <div className="text-[10px] text-slate-600 italic text-center py-2">No tasks created.</div>
                     ) : (
                        tasks.map(task => (
                           <div key={task.id} className="flex items-center gap-2 group">
                              <button 
                                onClick={() => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))}
                                className={`flex-shrink-0 transition-colors ${task.completed ? 'text-emerald-500' : 'text-slate-600 hover:text-slate-400'}`}
                              >
                                 {task.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                              </button>
                              <span className={`text-xs truncate flex-1 transition-all ${task.completed ? 'text-slate-600 line-through decoration-slate-700' : 'text-slate-300'}`}>{task.text}</span>
                              <button 
                                onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                                className="text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                 <X size={12} />
                              </button>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>

            {/* Memory System */}
            <div className="space-y-2">
              <div className="flex justify-between px-2"><label className="text-xs font-semibold text-slate-500 uppercase">Personal Cloud</label> <button onClick={() => { setMemory({facts:[]}); storageService.saveSession({ memory: {facts:[]} }); }} className="text-[10px] text-rose-500 font-bold">WIPE</button></div>
              <div className="min-h-[60px] max-h-[140px] overflow-y-auto bg-slate-900/40 rounded-2xl p-3 border border-slate-800/50 space-y-2 custom-scrollbar">
                {memory.facts.length === 0 ? <div className="text-[10px] text-slate-600 italic text-center py-4">Context engine warming up...</div> : memory.facts.map((f, i) => <div key={i} className="text-[10px] text-slate-400 bg-slate-800/50 px-2 py-2 rounded-xl border border-slate-700/30 break-words">{f}</div>)}
              </div>
            </div>

            {/* Custom CSS Button */}
            <div className="space-y-2">
              <button 
                onClick={() => setIsCSSEditorOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-slate-400 hover:bg-slate-800 hover:text-indigo-400 border border-transparent hover:border-indigo-500/20"
              >
                <div className="text-slate-500 group-hover:text-indigo-400">
                  <Palette size={16} />
                </div>
                <span className="text-sm font-semibold">Custom Interface</span>
              </button>
            </div>

            {/* Bookmarks Toggle */}
            <div className="space-y-2">
               <button 
                  onClick={() => setIsBookmarksOpen(!isBookmarksOpen)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border ${isBookmarksOpen ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'text-slate-400 border-transparent hover:bg-slate-800'}`}
               >
                  <div className={isBookmarksOpen ? 'text-amber-400' : 'text-slate-500'}>
                     <Bookmark size={16} />
                  </div>
                  <span className="text-sm font-semibold">Saved Messages</span>
               </button>
            </div>

            {/* Intel Model Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase px-2 tracking-widest">Intelligence Model</label>
              <div className="space-y-1">
                {[
                  { id: AstraModel.LITE, icon: <Zap size={16} />, label: 'Flash Lite (Fast)' },
                  { id: AstraModel.FLASH, icon: <Sparkles size={16} />, label: 'Flash 3.0 (Global)' },
                  { id: AstraModel.PRO, icon: <Brain size={16} />, label: 'Pro 3.0 (Complex)' }
                ].map((m) => (
                  <button 
                    key={m.id}
                    onClick={() => { setModel(m.id); if(m.id !== AstraModel.PRO) setIsThinkingEnabled(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center justify-between group ${model === m.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    <span className="flex items-center gap-2 font-medium text-sm">{m.icon} {m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modes Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase px-2 tracking-widest">Enhanced Tools</label>
              <button 
                onClick={() => { setIsCodeMode(!isCodeMode); setIsSandboxOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${isCodeMode ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <div className="flex items-center gap-3"><Code size={16} /> <span className="text-sm font-medium">Code Mode</span></div>
                <div className={`w-8 h-4 rounded-full relative transition-all ${isCodeMode ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isCodeMode ? 'right-0.5' : 'left-0.5'}`}></div>
                </div>
              </button>
              <button 
                onClick={() => setIsViewMode(!isViewMode)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${isViewMode ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <div className="flex items-center gap-3"><LayoutList size={16} /> <span className="text-sm font-medium">View Mode</span></div>
                <div className={`w-8 h-4 rounded-full relative transition-all ${isViewMode ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isViewMode ? 'right-0.5' : 'left-0.5'}`}></div>
                </div>
              </button>
              <button 
                onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${isThinkingEnabled ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <div className="flex items-center gap-3"><Brain size={16} /> <span className="text-sm font-medium">Deep Thought</span></div>
                <div className={`w-8 h-4 rounded-full relative transition-all ${isThinkingEnabled ? 'bg-amber-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isThinkingEnabled ? 'right-0.5' : 'left-0.5'}`}></div>
                </div>
              </button>
            </div>

            {/* Image Gen Controls */}
            <div className="space-y-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/50">
              <div className="flex items-center gap-2 px-1"><Settings2 size={14} className="text-indigo-400" /> <label className="text-xs font-semibold text-slate-300 uppercase">Image Config</label></div>
              
              <div className="space-y-2">
                <div>
                   <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Aspect Ratio</label>
                   <div className="grid grid-cols-3 gap-1">
                    {(["1:1", "4:3", "16:9"] as const).map(ratio => (
                      <button key={ratio} onClick={() => setImageConfig(prev => ({ ...prev, aspectRatio: ratio }))} className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${imageConfig.aspectRatio === ratio ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}>{ratio}</button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Quality</label>
                  <div className="flex gap-1">
                    <button onClick={() => setImageConfig(prev => ({ ...prev, quality: 'standard' }))} className={`flex-1 px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${imageConfig.quality === 'standard' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}>Standard</button>
                    <button onClick={() => setImageConfig(prev => ({ ...prev, quality: 'high' }))} className={`flex-1 px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${imageConfig.quality === 'high' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}>HD</button>
                  </div>
                </div>

                <div>
                   <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Art Style</label>
                   <select 
                    value={imageConfig.style}
                    onChange={(e) => setImageConfig(prev => ({ ...prev, style: e.target.value as ImageStyle }))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                   >
                     {imageStyles.map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                </div>
              </div>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-800/50">
            <button onClick={() => setShowResetConfirm(true)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors text-sm font-bold"><Trash2 size={16} /> <span>Reset Workspace</span></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className={`h-16 flex items-center justify-between px-6 border-b transition-all duration-500 ${isViewMode ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-slate-800/50 bg-slate-950/80'} backdrop-blur-xl z-30`}>
          <div className="flex items-center gap-4">
            {!isSidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors"><Menu size={20} /></button>}
            <div className="flex flex-col">
              <h2 className={`font-bold text-sm tracking-wide uppercase transition-colors duration-500 ${isViewMode ? 'text-emerald-400' : 'text-slate-100'}`}>{getModelLabel()}</h2>
              <span className={`text-[10px] font-bold tracking-widest flex items-center gap-1 ${isViewMode ? 'text-emerald-500' : 'text-indigo-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isViewMode ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div> 
                {isViewMode ? 'Density Engine Active' : 'Neural Link Active'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative">
               <button 
                  onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 rounded-full border border-slate-800 transition-colors"
               >
                  <div className="text-slate-500">{agentIcons[activeAgent]}</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{activeAgent}</span>
                  <ChevronDown size={12} className="text-slate-600" />
               </button>

               {isAgentMenuOpen && (
                  <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAgentMenuOpen(false)}></div>
                  <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                     <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Switch Agent</div>
                     {Object.values(AstraAgent).map((agent) => (
                        <button
                           key={agent}
                           onClick={() => { setActiveAgent(agent); setIsAgentMenuOpen(false); setIsCodeMode(false); setIsSandboxOpen(false); }}
                           className={`flex items-start gap-3 px-3 py-2 rounded-lg transition-all text-left ${activeAgent === agent ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                        >
                           <div className="mt-0.5">{agentIcons[agent]}</div>
                           <div>
                              <div className="text-xs font-bold">{agent}</div>
                              <div className="text-[10px] opacity-70 leading-tight">{agentDescriptions[agent]}</div>
                           </div>
                        </button>
                     ))}
                  </div>
                  </>
               )}
             </div>
             {isCodeMode && (
               <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 rounded-full border border-cyan-500/20">
                  <Code size={14} className="text-cyan-400" />
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Code Mode</span>
               </div>
             )}
             {isSandboxOpen && (
               <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                  <Box size={14} className="text-indigo-400" />
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Training Mode</span>
               </div>
             )}
          </div>
        </header>

        {isSandboxOpen ? (
          // SANDBOX UI
          <div className="flex-1 flex overflow-hidden">
             {/* Training Config Panel */}
             <div className="w-1/2 border-r border-slate-800 p-6 overflow-y-auto custom-scrollbar bg-slate-900/30">
                <h3 className="text-lg font-bold text-indigo-400 mb-6 flex items-center gap-2"><Sliders size={20} /> Model Training Configuration</h3>
                
                {/* System Prompt */}
                <div className="mb-6 space-y-2">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Instruction (Persona)</label>
                   <textarea 
                     value={sandboxConfig.systemInstruction}
                     onChange={(e) => setSandboxConfig(prev => ({...prev, systemInstruction: e.target.value}))}
                     className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 custom-scrollbar resize-none"
                     placeholder="Define how the AI should behave..."
                   />
                </div>

                {/* Parameters */}
                <div className="mb-6 space-y-4">
                   <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Temperature: {sandboxConfig.temperature}</label>
                      <input 
                        type="range" min="0" max="2" step="0.1" 
                        value={sandboxConfig.temperature}
                        onChange={(e) => setSandboxConfig(prev => ({...prev, temperature: parseFloat(e.target.value)}))}
                        className="w-32 accent-indigo-500"
                      />
                   </div>
                   <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top K: {sandboxConfig.topK}</label>
                      <input 
                        type="range" min="1" max="64" step="1" 
                        value={sandboxConfig.topK}
                        onChange={(e) => setSandboxConfig(prev => ({...prev, topK: parseInt(e.target.value)}))}
                        className="w-32 accent-indigo-500"
                      />
                   </div>
                   <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top P: {sandboxConfig.topP}</label>
                      <input 
                        type="range" min="0" max="1" step="0.05" 
                        value={sandboxConfig.topP}
                        onChange={(e) => setSandboxConfig(prev => ({...prev, topP: parseFloat(e.target.value)}))}
                        className="w-32 accent-indigo-500"
                      />
                   </div>
                </div>

                {/* Few-Shot Examples */}
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Training Data (Few-Shot Examples)</label>
                      <button 
                        onClick={() => setSandboxConfig(prev => ({...prev, examples: [...prev.examples, {input: '', output: ''}]}))}
                        className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-lg font-bold flex items-center gap-1"
                      >
                         <Plus size={12} /> Add Example
                      </button>
                   </div>
                   <div className="space-y-3">
                      {sandboxConfig.examples.map((ex, idx) => (
                         <div key={idx} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-2 relative group">
                            <button 
                               onClick={() => setSandboxConfig(prev => ({...prev, examples: prev.examples.filter((_, i) => i !== idx)}))}
                               className="absolute top-2 right-2 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                               <X size={14} />
                            </button>
                            <input 
                              placeholder="User Input"
                              value={ex.input}
                              onChange={(e) => {
                                 const newEx = [...sandboxConfig.examples];
                                 newEx[idx].input = e.target.value;
                                 setSandboxConfig(prev => ({...prev, examples: newEx}));
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                            />
                            <textarea 
                              placeholder="Ideal Model Response"
                              value={ex.output}
                              onChange={(e) => {
                                 const newEx = [...sandboxConfig.examples];
                                 newEx[idx].output = e.target.value;
                                 setSandboxConfig(prev => ({...prev, examples: newEx}));
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none resize-none h-20 custom-scrollbar"
                            />
                         </div>
                      ))}
                      {sandboxConfig.examples.length === 0 && (
                         <div className="text-center py-6 border border-dashed border-slate-700 rounded-xl text-slate-600 text-xs">
                            No training examples added. Add examples to guide the model's style.
                         </div>
                      )}
                   </div>
                </div>
             </div>

             {/* Test Chat Area */}
             <div className="w-1/2 flex flex-col bg-slate-950">
                <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/50">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Test Playground</span>
                   <button onClick={() => setSandboxMessages([])} className="text-xs text-rose-500 hover:text-rose-400 font-bold flex items-center gap-1"><Trash2 size={12} /> Clear Test</button>
                </div>
                
                <div ref={sandboxScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                   {sandboxMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2">
                         <Box size={32} className="opacity-50" />
                         <span className="text-sm">Ready to test configuration.</span>
                      </div>
                   )}
                   {sandboxMessages.map((msg) => (
                     <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-xl text-sm ${msg.role === MessageRole.USER ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                           {msg.text}
                        </div>
                     </div>
                   ))}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900">
                   <form onSubmit={(e) => handleSendMessage(e, true)} className="flex gap-2">
                      <input 
                         value={sandboxInput}
                         onChange={(e) => setSandboxInput(e.target.value)}
                         placeholder="Test your prompt..."
                         className="flex-1 bg-slate-800 border-none rounded-lg px-4 py-3 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500"
                      />
                      <button type="submit" disabled={isGenerating || !sandboxInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-lg disabled:opacity-50 transition-colors">
                         {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={20} />}
                      </button>
                   </form>
                </div>
             </div>
          </div>
        ) : (
          // MAIN CHAT UI (Existing)
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 scroll-smooth custom-scrollbar">
              {displayedMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-700">
                  <div className={`w-28 h-28 rounded-[3rem] flex items-center justify-center shadow-2xl transition-all duration-500 ${isViewMode ? 'bg-emerald-600/20 text-emerald-400 shadow-emerald-500/20 border-emerald-500/20' : 'bg-indigo-600/20 text-indigo-400 shadow-indigo-500/20 border-indigo-500/20'} border`}>
                    <Sparkles size={56} className="animate-pulse" />
                  </div>
                  <div className="space-y-4">
                    <h1 className={`text-5xl font-black tracking-tight transition-colors duration-500 ${isViewMode ? 'text-emerald-100' : 'text-white'}`}>Limitless Intelligence.</h1>
                    <p className="text-slate-400 text-xl max-w-md mx-auto leading-relaxed">
                      Switch between specialized agents for deep research, coding, or creative writing.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                      {Object.values(AstraAgent).slice(1).map(agent => (
                        <button 
                          key={agent} 
                          onClick={() => setActiveAgent(agent)}
                          className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/40 text-xs font-bold text-slate-300 hover:border-indigo-500/50 hover:text-indigo-400 transition-all flex items-center gap-2"
                        >
                          {agentIcons[agent]} <span>{agent}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                displayedMessages.map((msg, idx) => (
                  <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500 group relative`}>
                    <div className={`max-w-[85%] lg:max-w-[75%] space-y-2`}>
                      {msg.pdfName && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-wider text-indigo-400 w-fit">
                          <Paperclip size={12} /> <span>{msg.pdfName}</span>
                        </div>
                      )}
                      <div className={`p-5 rounded-[2rem] text-[15px] leading-relaxed relative border transition-all duration-300
                        ${msg.role === MessageRole.USER 
                          ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-900/30 border-indigo-500/20' 
                          : msg.isError 
                            ? 'bg-rose-500/10 border-rose-500/50 text-rose-100 shadow-lg shadow-rose-950/20'
                            : isCodeMode
                              ? 'bg-slate-900 border-cyan-500/20 text-slate-300'
                              : isViewMode
                                ? 'bg-slate-900 border-emerald-500/20 text-slate-300'
                                : 'bg-slate-900/80 border-slate-800/50 text-slate-200 backdrop-blur-sm'}
                      `}>
                        {msg.isError && (
                          <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-rose-500/20 rounded-full text-rose-300 font-black text-[10px] uppercase tracking-widest w-fit border border-rose-500/30">
                            <ShieldAlert size={14} /> <span>System Fault Detected</span>
                          </div>
                        )}
                        <div>
                          {renderContent(msg.text)}
                          {msg.isGenerating && (
                             <div className="flex items-center gap-2 mt-2 text-indigo-400">
                                <Loader2 size={16} className="animate-spin" />
                                <span className="text-xs font-bold animate-pulse">Processing...</span>
                             </div>
                          )}
                        </div>
                        {msg.image && (
                          <div className="mt-4 rounded-2xl overflow-hidden border border-slate-800 group relative shadow-2xl">
                            <img src={msg.image} className="w-full h-auto max-h-[500px] object-cover transition-transform duration-700 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><Maximize2 className="text-white" /></div>
                          </div>
                        )}
                      </div>
                      
                      {/* Message Actions */}
                      <div className={`flex items-center gap-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                         <div className={`text-[10px] text-slate-500 font-bold uppercase tracking-tighter`}>
                           {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </div>
                         <button 
                           onClick={() => toggleBookmark(msg.id)}
                           className={`p-1.5 rounded-full hover:bg-slate-800 transition-colors ${msg.isBookmarked ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
                           title="Bookmark Message"
                         >
                            <Star size={14} fill={msg.isBookmarked ? "currentColor" : "none"} />
                         </button>
                         {msg.role === MessageRole.USER && (
                           <button
                             onClick={() => handleCopyContext(idx)}
                             className="p-1.5 rounded-full text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                             title="Copy Message & Context"
                           >
                              <ClipboardCopy size={14} />
                           </button>
                         )}
                      </div>

                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="p-4 lg:p-8 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative group">
                {(pendingImage || pendingPdf) && (
                  <div className={`absolute -top-24 left-4 p-2 border rounded-2xl animate-in slide-in-from-bottom-4 shadow-2xl flex items-center gap-3 bg-slate-900 ${isViewMode ? 'border-emerald-500/50' : 'border-indigo-500/50'}`}>
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center bg-slate-950">
                      {pendingImage ? <img src={pendingImage.data} className="w-full h-full object-cover" /> : <FileText className={isViewMode ? 'text-emerald-400' : 'text-indigo-400'} size={32} />}
                    </div>
                    <div className="pr-4">
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${isViewMode ? 'text-emerald-400' : 'text-indigo-400'}`}>{pendingImage ? 'Neural Vision' : 'Asset Upload'}</div>
                      <div className="text-xs text-slate-400 max-w-[150px] truncate">{pendingImage ? 'Captured image' : pendingPdf?.name}</div>
                    </div>
                    <button type="button" onClick={() => { setPendingImage(null); setPendingPdf(null); }} className="p-2 bg-slate-800 rounded-full hover:text-rose-500 transition-colors"><X size={14} /></button>
                  </div>
                )}

                <div className={`flex items-end gap-2 p-3 bg-slate-900/90 border rounded-[2.5rem] focus-within:ring-8 shadow-2xl transition-all duration-300
                  ${isViewMode ? 'border-emerald-500/30 focus-within:border-emerald-500/50 focus-within:ring-emerald-500/5' : 'border-slate-800 focus-within:border-indigo-500/50 focus-within:ring-indigo-500/5'} 
                  ${isGenerating ? 'opacity-70 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-3 transition-all rounded-full ${isViewMode ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800'}`}><Paperclip size={20} /></button>
                    {isExtractingFile && <div className={`w-5 h-5 border-2 rounded-full animate-spin ml-2 ${isViewMode ? 'border-emerald-500/20 border-t-emerald-500' : 'border-indigo-500/20 border-t-indigo-500'}`}></div>}
                  </div>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                    placeholder={pendingPdf ? "Question the document..." : isCodeMode ? "Generate code for..." : `Task the ${activeAgent}...`}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-slate-100 placeholder-slate-500 resize-none max-h-40 py-3 text-[15px] scrollbar-none"
                    rows={1}
                  />
                  <button disabled={(!input.trim() && !pendingImage && !pendingPdf) || isGenerating} type="submit" className={`p-3 rounded-full flex items-center justify-center min-w-[54px] h-[54px] transition-all duration-300
                    ${(input.trim() || pendingImage || pendingPdf) && !isGenerating 
                      ? isViewMode ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/30 hover:scale-105 active:scale-95' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95' 
                      : 'bg-slate-800 text-slate-600'}`}>
                    {isGenerating ? <div className="w-6 h-6 border-[3px] border-white/20 border-t-white rounded-full animate-spin"></div> : <Send size={22} />}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .animate-blink { animation: blink 0.8s infinite; }
        
        .scale-in-center {
          animation: scale-in-center 0.3s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
        }
        @keyframes scale-in-center {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        /* PrismJS custom theme overrides if needed */
        pre[class*="language-"] {
           background: transparent !important;
           text-shadow: none !important;
           margin: 0 !important;
           padding: 0 !important;
        }
        code[class*="language-"], pre[class*="language-"] {
           color: #e2e8f0 !important;
           font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
        }
      `}</style>
    </div>
  );
};

const CodeBlock = ({ code, lang, onExpand }: { code: string, lang: string, onExpand?: () => void }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, isExpanded]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-5 rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-950 group shadow-2xl">
      <div className="flex justify-between items-center px-5 py-2.5 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center gap-2">
           <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></div>
           <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
           <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
           <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{lang || 'Code'}</span>
        </div>
        <div className="flex items-center gap-2">
          {onExpand && (
             <button onClick={onExpand} className="text-slate-500 hover:text-indigo-400 transition-all p-1 hover:bg-slate-800 rounded" title="Maximize">
                <Maximize2 size={14} />
             </button>
          )}
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-slate-500 hover:text-indigo-400 transition-all p-1 hover:bg-slate-800 rounded">
             {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={copyToClipboard} className="text-slate-500 hover:text-indigo-400 transition-all flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800">
            {copied ? <><Check size={14} /> <span className="text-[10px] font-bold">Copied</span></> : <><Copy size={14} /> <span className="text-[10px] font-bold">Copy</span></>}
          </button>
        </div>
      </div>
      {isExpanded && (
        <pre className="p-5 overflow-x-auto custom-scrollbar text-sm font-mono leading-relaxed text-indigo-100/90 selection:bg-indigo-500/30">
          <code ref={codeRef} className={`language-${lang || 'javascript'}`}>{code}</code>
        </pre>
      )}
    </div>
  );
};

export default App;
