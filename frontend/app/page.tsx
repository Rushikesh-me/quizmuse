'use client';
import type React from 'react';
import QuizComponent from '@/components/quiz/QuizComponent';
import { useToast } from '@/hooks/use-toast';
import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowUp,
  Loader2,
  Trophy,
  MessageSquare,
  Upload,
  FileText,
  ChevronLeft,
  Bot,
  User,
  Menu,
} from 'lucide-react';
import { ChatMessage } from '@/components/chat-message';
import { client } from '@/lib/langgraph-client';
import {
  PDFDocument,
  RetrieveDocumentsNodeUpdates,
} from '@/types/graphTypes';
import { UnifiedTOCSection } from '@/types/tocTypes';

export default function Home() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      sources?: PDFDocument[];
    }>
  >([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastRetrievedDocsRef = useRef<PDFDocument[]>([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'quiz'>('chat');
  const [selectedSection, setSelectedSection] = useState<UnifiedTOCSection | null>(null);
  const [tocData, setTocData] = useState<UnifiedTOCSection[]>([]);
  const [isTocLoading, setIsTocLoading] = useState(false);
  const [tocView, setTocView] = useState<'session' | 'individual'>('session');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fetchTOC = async (view: 'session' | 'individual' = 'session', filename?: string) => {
    if (!threadId) return;
    
    setIsTocLoading(true);
    try {
      const requestBody: any = { 
        threadId, 
        view 
      };
      
      if (view === 'individual' && filename) {
        requestBody.filename = filename;
      }

      const response = await fetch('/api/toc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch TOC');
      }

      const data = await response.json();
      setTocData(data.data?.toc || []);
      setTocView(view);
    } catch (error) {
      // Don't show error toast for TOC generation as it's automatic
    } finally {
      setIsTocLoading(false);
    }
  };

  // Open sidebar by default when files are uploaded
  useEffect(() => {
    if (files.length > 0 && window.innerWidth <= 768) {
      setSidebarOpen(true);
    }
  }, [files.length]);


  useEffect(() => {
    const initThread = async () => {
      if (threadId) return;
      try {
        const thread = await client.createThread();
        setThreadId(thread.thread_id);
      } catch (error) {
        toast({
          title: 'Error',
          description:
            'Error creating thread. Please make sure you have set the LANGGRAPH_API_URL environment variable correctly. ' +
            error,
          variant: 'destructive',
        });
      }
    };
    initThread();
  }, []);

  // Heartbeat system for session tracking
  useEffect(() => {
    if (!threadId) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: threadId }),
        });
      } catch (error) {
        // Heartbeat failed silently
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval for heartbeats (every 30 seconds)
    const heartbeatInterval = setInterval(sendHeartbeat, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeatInterval);
      // Send final cleanup request
      fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: threadId }),
      }).catch(() => {});
    };
  }, [threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarOpen && window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const toggle = document.querySelector('.mobile-sidebar-toggle');
        if (sidebar && !sidebar.contains(event.target as Node) && !toggle?.contains(event.target as Node)) {
          setSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId || isLoading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMessage = input.trim();
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, sources: undefined },
      { role: 'assistant', content: '', sources: undefined },
    ]);
    setInput('');
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    lastRetrievedDocsRef.current = [];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          threadId,
          selectedSection, // Include selected section for context
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value);
        const lines = chunkStr.split('\n').filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const sseString = line.slice('data: '.length);
          let sseEvent: any;
          try {
            sseEvent = JSON.parse(sseString);
          } catch (err) {
            continue;
          }

          const { event, data } = sseEvent;

          if (event === 'messages/partial') {
            if (Array.isArray(data)) {
              const lastObj = data[data.length - 1];
              if (lastObj?.type === 'ai') {
                const partialContent = lastObj.content ?? '';
                if (
                  typeof partialContent === 'string' &&
                  !partialContent.startsWith('{')
                ) {
                  setMessages((prev) => {
                    const newArr = [...prev];
                    if (
                      newArr.length > 0 &&
                      newArr[newArr.length - 1].role === 'assistant'
                    ) {
                      newArr[newArr.length - 1].content = partialContent;
                      newArr[newArr.length - 1].sources =
                        lastRetrievedDocsRef.current;
                    }
                    return newArr;
                  });
                }
              }
            }
          } else if (event === 'updates' && data) {
            if (
              data &&
              typeof data === 'object' &&
              'retrieveDocuments' in data &&
              data.retrieveDocuments &&
              Array.isArray(data.retrieveDocuments.documents)
            ) {
              const retrievedDocs = (data as RetrieveDocumentsNodeUpdates)
                .retrieveDocuments.documents as PDFDocument[];
              lastRetrievedDocsRef.current = retrievedDocs;
              // Retrieved documents for context
            } else {
              lastRetrievedDocsRef.current = [];
            }
          } else {
            // Unknown SSE event
          }
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          'Failed to send message. Please try again.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });
      setMessages((prev) => {
        const newArr = [...prev];
        newArr[newArr.length - 1].content =
          'Sorry, there was an error processing your message.';
        return newArr;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;

    const nonPdfFiles = selectedFiles.filter(
      (file) => file.type !== 'application/pdf',
    );
    if (nonPdfFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload PDF files only',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      // Add sessionId for document isolation
      if (threadId) {
        formData.append('sessionId', threadId);
      }

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload files');
      }

      setFiles((prev) => [...prev, ...selectedFiles]);
      toast({
        title: 'Success',
        description: `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} uploaded successfully`,
        variant: 'default',
      });
      
      // Automatically fetch TOC after successful upload
      setTimeout(() => {
        fetchTOC();
      }, 1000); // Small delay to ensure ingestion is complete
    } catch (error) {
      toast({
        title: 'Upload failed',
        description:
          'Failed to upload files. Please try again.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files || []);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    handleFileUpload(droppedFiles);
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles(files.filter((file) => file !== fileToRemove));
    toast({
      title: 'File removed',
      description: `${fileToRemove.name} has been removed`,
      variant: 'default',
    });
  };

  // Show upload-only interface when no files are uploaded
  if (files.length === 0) {
  return (
      <div className="h-[calc(100vh-73px)] flex items-center justify-center bg-background overflow-hidden">
        <div className="text-center max-w-lg p-8">
          <div className="mb-6 flex justify-center">
            <Upload className="h-16 w-16 text-muted-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">QuizMuse</h1>
          <p className="text-lg text-muted-foreground mb-8 leading-normal">
            Upload your PDF documents to start chatting and creating quizzes
          </p>
          
          <div
            className={`border-2 border-dashed border-border rounded-xl p-8 bg-card transition-all duration-300 cursor-pointer ${
              isDragOver ? 'border-primary bg-primary/10 scale-[1.02]' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".pdf"
              multiple
              className="hidden"
            />
            <Button
              variant="outline"
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="mb-3 text-lg px-6 py-4"
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin loading-spinner" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
              {isUploading ? 'Uploading...' : 'Choose PDF files or drag and drop'}
            </Button>
            <p className="text-sm text-muted-foreground m-0">Supports multiple PDF files</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-73px)] bg-background">
      {/* Mobile Sidebar Toggle */}
      {!sidebarOpen && <button
        className="lg:hidden fixed top-5 left-4 z-[70] bg-card border border-border text-foreground cursor-pointer transition-all duration-200 shadow-lg w-8 h-8 flex items-center justify-center hover:bg-secondary hover:text-foreground"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu className="h-5 w-5" />
      </button>}

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-gray-900/80 transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Sidebar Panel */}
          <div className="fixed inset-y-0 left-0 flex w-full max-w-[calc(100%-2rem)]">
            <div className="relative flex w-full flex-col bg-card">
              {/* Close Button */}
              <div className="absolute left-full top-0 flex justify-center pt-5">
                <button 
                  type="button" 
                  onClick={() => setSidebarOpen(false)} 
                  className="lg:hidden right-0 fixed z-[70] bg-card border-t border-b border-r border-border text-foreground cursor-pointer transition-all duration-200 shadow-lg h-8 w-8 flex items-center justify-center hover:bg-secondary hover:text-foreground"
                >
                  <span className="sr-only">Close sidebar</span>
                  <ChevronLeft className="h-6 w-6" />
                </button>
              </div>
              
              {/* Mobile Sidebar Content */}
              <div className="flex grow flex-col gap-y-5 overflow-y-auto px-6 pb-2">
                <div className="flex h-16 shrink-0 items-center">
                  <Bot className="h-8 w-8 text-primary" />
                  <span className="ml-2 text-lg font-semibold text-foreground">QuizMuse</span>
                </div>
                
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    {/* Navigation Section */}
                    <li>
                      <ul role="list" className="-mx-2 space-y-1">
                        <li>
                          <button
                            onClick={() => {
                              setActiveView('chat');
                              setSidebarOpen(false);
                            }}
                            className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 w-full text-left ${
                              activeView === 'chat'
                                ? 'bg-accent text-accent-foreground'
                                : 'text-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                          >
                            <MessageSquare
                              aria-hidden="true"
                              className={`h-6 w-6 shrink-0 ${
                                activeView === 'chat' ? 'text-accent-foreground' : 'text-muted-foreground group-hover:text-foreground'
                              }`}
                            />
                            Chat
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={() => {
                              setActiveView('quiz');
                              setSidebarOpen(false);
                            }}
                            className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 w-full text-left ${
                              activeView === 'quiz'
                                ? 'bg-accent text-accent-foreground'
                                : 'text-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                          >
                            <Trophy
                              aria-hidden="true"
                              className={`h-6 w-6 shrink-0 ${
                                activeView === 'quiz' ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                              }`}
                            />
                            Quiz
                          </button>
                        </li>
                      </ul>
                    </li>

                    {/* Documents Section */}
                    <li>
                      <div className="text-xs font-semibold leading-6 text-muted-foreground">Documents</div>
                      <div className="mt-2 space-y-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileInputChange}
                          accept=".pdf"
                          multiple
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin loading-spinner" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Upload PDF
            </Button>

            {/* Uploaded Files List */}
            {files.length > 0 && (
                          <div className="max-h-32 overflow-y-auto space-y-1">
                {files.map((file, index) => (
                              <div key={`${file.name}-${index}`} className="flex items-center gap-2 p-2 bg-secondary rounded-md text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">{file.name}</span>
                    <button
                      onClick={() => handleRemoveFile(file)}
                                  className="flex items-center justify-center w-5 h-5 rounded-sm border-0 text-muted-foreground cursor-pointer transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
                    </li>

          {/* Table of Contents Section 
                    {tocData.length > 0 && (
                      <li>
                        <div className="text-xs font-semibold leading-6 text-muted-foreground">Table of Contents</div>
                        <ul role="list" className="-mx-2 mt-2 space-y-1 max-h-48 overflow-y-auto">
                          {tocData.map((section) => (
                            <li key={section.id}>
                  <button
                                onClick={() => {
                                  setSelectedSection(section);
                                  setSidebarOpen(false);
                                }}
                                className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 w-full text-left ${
                                  selectedSection?.id === section.id
                                    ? 'bg-secondary text-foreground border border-border'
                                    : 'text-foreground hover:bg-secondary hover:text-foreground'
                                }`}
                              >
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium ${
                                    selectedSection?.id === section.id
                                      ? 'border-border text-foreground bg-secondary'
                                      : 'border-border text-muted-foreground group-hover:border-border group-hover:text-foreground'
                                  }`}
                                >
                                  {section.pageNumber || '•'}
                                </span>
                                <span className="truncate text-xs">{section.title}</span>
                  </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    )}
                      */}
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6">
          <div className="flex h-16 shrink-0 items-center">
            <Bot className="h-8 w-8 text-primary" />
            <span className="ml-2 text-lg font-semibold text-foreground">QuizMuse</span>
                </div>
          
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              {/* Navigation Section */}
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <li>
                    <button
                      onClick={() => setActiveView('chat')}
                      className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 w-full text-left ${
                        activeView === 'chat'
                          ? 'bg-secondary text-foreground border border-border'
                          : 'text-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <MessageSquare
                        aria-hidden="true"
                        className={`h-6 w-6 shrink-0 ${
                          activeView === 'chat' ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                        }`}
                      />
                      Chat
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveView('quiz')}
                      className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 w-full text-left ${
                        activeView === 'quiz'
                          ? 'bg-secondary text-foreground border border-border'
                          : 'text-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <Trophy
                        aria-hidden="true"
                        className={`h-6 w-6 shrink-0 ${
                          activeView === 'quiz' ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                        }`}
                      />
                      Quiz
                    </button>
                  </li>
                </ul>
              </li>

              {/* Documents Section */}
              <li>
                <div className="text-xs font-semibold leading-6 text-muted-foreground">Documents</div>
                <div className="mt-2 space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept=".pdf"
                    multiple
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin loading-spinner" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload PDF
                  </Button>
                  
                  {/* Uploaded Files List */}
                  {files.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {files.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center gap-2 p-2 bg-secondary rounded-md text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">{file.name}</span>
                          <button
                            onClick={() => handleRemoveFile(file)}
                            className="flex items-center justify-center w-5 h-5 rounded-sm  border-0 text-muted-foreground cursor-pointer transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </li>

              {/* Table of Contents Section */}
              {/* {tocData.length > 0 && (
                <li>
                  <div className="text-xs font-semibold leading-6 text-muted-foreground">Table of Contents</div>
                  <ul role="list" className="-mx-2 mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {tocData.map((section) => (
                      <li key={section.id}>
                        <button
                          onClick={() => setSelectedSection(section)}
                          className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 w-full text-left ${
                            selectedSection?.id === section.id
                              ? 'bg-secondary text-foreground border border-border'
                              : 'text-foreground hover:bg-secondary hover:text-foreground'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium ${
                              selectedSection?.id === section.id
                                ? 'border-border text-foreground bg-secondary'
                                : 'border-border text-muted-foreground group-hover:border-border group-hover:text-foreground'
                            }`}
                          >
                            {section.pageNumber || '•'}
                          </span>
                          <span className="truncate text-xs">{section.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              )} */}
            </ul>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-72">
        <div className="h-[calc(100vh-73px)] flex flex-col">
        {activeView === 'chat' ? (
            <>
            {/* Chat Header */}
              {/* <div className="px-8 py-6 border-b border-border hidden lg:block">
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold m-0 text-foreground tracking-tight">QuizMuse</h2>
                  <p className="m-0 text-sm text-muted-foreground">
                {selectedSection 
                  ? `Chatting about selected section` 
                  : 'Ask questions about your documents'
                }
              </p>
              {selectedSection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSection(null)}
                      className="self-start"
                >
                  Clear Section Focus
                </Button>
              )}
            </div>
              </div> */}

            {/* Messages Area */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-6 flex flex-col gap-4">
              {messages.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold m-0 text-foreground tracking-tight">Start a conversation</h3>
                    <p className="m-0 text-sm text-muted-foreground">
                      Ask questions about your uploaded documents
                  </p>
                </div>
              )}

              {messages.map((message, i) => (
                <ChatMessage key={i} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
              <div className="px-8 py-6 border-t border-border bg-card">
                <form onSubmit={handleSubmit} className="w-full">
                  <div className="flex gap-3 items-center bg-background border border-border rounded-lg p-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      isUploading ? 'Uploading PDF...' : 'Ask a question...'
                    }
                      className="border-0  flex-1 text-sm font-sans text-foreground p-2 focus:outline-none focus:shadow-none focus:border-0 placeholder:text-muted-foreground"
                    disabled={isUploading || isLoading || !threadId}
                  />
                  <Button
                    type="submit"
                    size="sm"
                      className="rounded-lg w-10 h-10 inline-flex items-center justify-center bg-secondary text-foreground border border-border cursor-pointer transition-all duration-300 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={
                      !input.trim() || isUploading || isLoading || !threadId
                    }
                  >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin loading-spinner" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </form>
            </div>
            </>
        ) : (
            <div className="h-full">
            <QuizComponent
              threadId={threadId}
              tocData={tocData}
              onComplete={(score, total) => {
                // Quiz completed
              }}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
