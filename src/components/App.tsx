import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Zap,
  Folder,
  SquareTerminal,
  Bug,
  Image as ImageIcon,
  ChevronDown,
  FolderOpen,
  GitBranch,
  PanelLeft,
  FolderPlus,
  CircleDashed
} from 'lucide-react';

const ClonkLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M10 2H6C3.79086 2 2 3.79086 2 6V10C2 10.5523 2.44772 11 3 11H10C10.5523 11 11 10.5523 11 10V3C11 2.44772 10.5523 2 10 2Z" />
    <path d="M21 2H14C13.4477 2 13 2.44772 13 3V10C13 10.5523 13.4477 11 14 11H21C21.5523 11 22 10.5523 22 10V6C22 3.79086 20.2091 2 18 2H21Z" />
    <path d="M11 14H3C2.44772 14 2 14.4477 2 15V18C2 20.2091 3.79086 22 6 22H10C10.5523 22 11 21.5523 11 21V14Z" />
    <path d="M22 14H14C13.4477 14 13 14.4477 13 15V21C13 21.5523 13.4477 22 14 22H18C20.2091 22 22 20.2091 22 18V14Z" />
  </svg>
);

export default function App() {
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const isVisible = isPinned || isHovered;

  return (
    <div className="h-screen w-screen flex bg-[#0a0a0a] font-sans text-white overflow-hidden relative">
      
      {/* Fixed Window Controls */}
      <div className="absolute top-0 left-0 h-12 flex items-center px-4 gap-2 z-40 pointer-events-none">
        <div className="w-3 h-3 rounded-full bg-[#ff5f56] pointer-events-auto cursor-pointer"></div>
        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] pointer-events-auto cursor-pointer"></div>
        <div className="w-3 h-3 rounded-full bg-[#27c93f] pointer-events-auto cursor-pointer"></div>
      </div>

      {/* Hover Trigger Area */}
      {!isPinned && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-8 z-20 cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
        />
      )}

      {/* Spacer for Pinned Sidebar */}
      <motion.div 
        initial={false}
        animate={{ width: isPinned ? 260 : 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.2 }}
        className="flex-shrink-0 h-full"
      />

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{ x: isVisible ? 0 : -260 }}
        transition={{ type: "spring", bounce: 0, duration: 0.2 }}
        onMouseLeave={() => {
          if (!isPinned) setIsHovered(false);
        }}
        className="absolute left-0 top-0 bottom-0 w-[260px] bg-[#0f0f0f] border-r border-[#1a1a1a] flex flex-col z-30"
      >
        {/* Window Controls & Toggle */}
        <div className="h-12 flex items-center px-4 justify-end">
          <button 
            onClick={() => {
              setIsPinned(!isPinned);
              setIsHovered(false);
            }}
            className={`transition-colors ${isPinned ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-200 hover:text-white'}`}
          >
            <PanelLeft size={16} />
          </button>
        </div>

        {/* Logo */}
        <div className="px-4 py-2">
          <ClonkLogo className="w-7 h-7 text-white" />
        </div>

        {/* New Chat Button */}
        <div className="px-4 py-3">
          <button className="w-full flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] rounded-lg text-sm text-neutral-200 transition-colors shadow-sm">
            <Plus size={16} />
            New Chat
          </button>
        </div>

        {/* Skills */}
        <div className="px-4 py-2">
          <button className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
            <Zap size={16} />
            Skills
          </button>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar mt-4">
          {/* Chats Section */}
          <div className="px-4 mb-6">
            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 mb-2 tracking-wider">
              CHATS
              <button className="hover:text-neutral-300 transition-colors">
                <FolderPlus size={14} />
              </button>
            </div>
            <div className="space-y-0.5">
              <SidebarItem icon={<Folder size={14} />} label="atomic-clock-6049f6" />
              <div className="pl-6 space-y-0.5">
                <SidebarItem label="Chat 18" active />
                <SidebarItem label="run this p..." />
                <SidebarItem label="hi" />
              </div>
              <SidebarItem icon={<Folder size={14} />} label="cali-1" />
              <SidebarItem icon={<Folder size={14} />} label="clonkcity" />
              <SidebarItem icon={<Folder size={14} />} label="figma-test-mcp" />
              <SidebarItem icon={<Folder size={14} />} label="gemini-video-gen" />
              <SidebarItem icon={<Folder size={14} />} label="ralph102" />
              <SidebarItem icon={<Folder size={14} />} label="vibeguide" />
            </div>
          </div>

          {/* Terminals Section */}
          <div className="px-4 mb-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-500 mb-2 tracking-wider">
              <SquareTerminal size={12} />
              TERMINALS
            </div>
            <div className="space-y-0.5">
              <SidebarItem label="gemini-video-gen" />
              <SidebarItem label="atomic-clock-6049f6" active bg="bg-[#222]" />
            </div>
          </div>
        </div>

        {/* Bottom Sidebar */}
        <div className="mt-auto p-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <button className="flex items-center gap-2 hover:text-neutral-300 transition-colors">
              <div className="w-2 h-2 rounded-full bg-neutral-600"></div>
              What's new
            </button>
            <span className="text-xs text-neutral-600">v0.1.50</span>
          </div>
          <button className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <Bug size={16} />
          </button>
          <div className="flex items-center gap-3 cursor-pointer group hover:bg-[#1a1a1a] p-1.5 -ml-1.5 rounded-lg transition-colors">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Paulius&backgroundColor=b6e3f4" 
              alt="Paulius" 
              className="w-6 h-6 rounded-full bg-neutral-800"
            />
            <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">Paulius</span>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0a0a]">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" 
             style={{
               backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
               backgroundSize: '32px 32px',
             }}>
        </div>
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/60 to-[#0a0a0a] pointer-events-none"></div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full px-8 z-10 -mt-16">
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-10">
            <div className="mb-6 opacity-80">
              <ClonkLogo className="w-14 h-14 text-neutral-400" />
            </div>
            <h1 className="text-[44px] font-medium text-neutral-100 tracking-tight">Let's clonk</h1>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-10">
            <button className="bg-transparent hover:bg-[#1a1a1a] border border-[#333] rounded-full py-2.5 px-5 flex items-center gap-2 text-sm text-neutral-200 transition-colors">
              <Plus size={16} />
              New Project
            </button>
            <button className="bg-transparent hover:bg-[#1a1a1a] border border-transparent hover:border-[#333] rounded-full py-2.5 px-5 flex items-center gap-2 text-sm text-neutral-400 transition-colors">
              <FolderOpen size={16} />
              Existing Project
            </button>
          </div>

          {/* Input Area */}
          <div className="w-full bg-[#111] border border-[#282828] rounded-2xl p-5 shadow-2xl shadow-black/30 focus-within:border-[#444] transition-colors relative group">
            <textarea 
              className="w-full bg-transparent text-neutral-200 placeholder-neutral-600 resize-none outline-none text-[15px] min-h-[100px]"
              placeholder="Describe what you want to build..."
            />
            
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="text-neutral-500 hover:text-neutral-300 transition-colors p-1.5 rounded-lg hover:bg-[#222]">
                  <ImageIcon size={18} />
                </button>
                <div className="h-4 w-px bg-[#282828]"></div>
                <button className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors p-1.5 rounded-lg hover:bg-[#222]">
                  <div className="w-5 h-5 bg-[#e87b35]/20 rounded flex items-center justify-center">
                    <span className="text-xs">👾</span>
                  </div>
                  <ChevronDown size={14} className="opacity-50" />
                </button>
                <div className="h-4 w-px bg-[#282828]"></div>
                <button className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors p-1.5 rounded-lg hover:bg-[#222]">
                  <CircleDashed size={16} className="text-[#e0443e]" />
                  Full-Stack
                </button>
              </div>
            </div>
          </div>

          {/* Suggestions */}
          <div className="w-full grid grid-cols-2 gap-4 mt-6">
            <SuggestionCard 
              icon={
                <div className="w-4 h-4 border-2 border-current rounded-full border-t-transparent animate-spin"></div>
              }
              iconBg="bg-[#1a2b4c]"
              iconColor="text-[#4a8cff]"
              title="3D Solar System"
              description="Build an interactive Three.js solar ..."
            />
            <SuggestionCard 
              icon={<PanelLeft size={16} />}
              iconBg="bg-[#2563eb]"
              iconColor="text-white"
              title="Kanban SaaS Landing Pag..."
              description="Modern landing page for a kanban..."
            />
          </div>
        </div>

        {/* Bottom Right Actions (Absolute) */}
        <div className="absolute bottom-6 right-6 flex gap-6 z-10">
          <button className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
            <FolderOpen size={16} />
            New Project
          </button>
          <button className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
            <GitBranch size={16} />
            Clone Repository
          </button>
        </div>

      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, bg }: { icon?: React.ReactNode, label: string, active?: boolean, bg?: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer text-[13px] transition-colors
      ${active ? (bg || 'text-neutral-200 font-medium') : 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200'}
      ${bg && active ? bg : ''}
    `}>
      {icon && <span className="text-neutral-500">{icon}</span>}
      {!icon && <span className="w-3.5"></span>}
      <span className="truncate">{label}</span>
    </div>
  );
}

function SuggestionCard({ icon, iconBg, iconColor, title, description }: { icon: React.ReactNode, iconBg: string, iconColor: string, title: string, description: string }) {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] hover:border-[#333] rounded-xl p-4 cursor-pointer transition-all hover:bg-[#161616] group flex items-center gap-4">
      <div className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-neutral-200 truncate">{title}</h3>
        <p className="text-[13px] text-neutral-500 truncate mt-0.5">{description}</p>
      </div>
    </div>
  );
}