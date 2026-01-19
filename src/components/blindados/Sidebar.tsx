"use client";

import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  Shield,
  LogOut,
  User
} from 'lucide-react';

interface SidebarProps {
  onExport: () => void;
  activeSection: 'flows' | 'visoes';
  onSectionChange: (section: 'flows' | 'visoes') => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onSignOut?: () => void;
  userName?: string;
}

export function Sidebar({ 
  onExport, 
  activeSection, 
  onSectionChange,
  collapsed,
  onCollapsedChange,
  onSignOut,
  userName
}: SidebarProps) {
  const menuItems = [
    { id: 'flows' as const, label: 'Flows', icon: LayoutDashboard },
    { id: 'visoes' as const, label: 'Visões', icon: Eye },
  ];

  return (
    <motion.aside
      initial={{ width: 240 }}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-screen bg-[#010516] border-r border-[#00f6ff]/10"
    >
      <div className="flex items-center gap-3 px-4 py-6 border-b border-[#00f6ff]/10">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f6ff]/20 to-[#00f6ff]/5 border border-[#00f6ff]/30"
        >
          <Shield className="w-5 h-5 text-[#00f6ff]" />
        </motion.div>
        
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-lg font-bold text-white tracking-wide">
              Blindados
            </h1>
            <p className="text-[10px] text-[#00f6ff]/60 uppercase tracking-widest">
              Productivity Suite
            </p>
          </motion.div>
        )}
      </div>

      {userName && (
        <div className="px-3 py-3 border-b border-[#00f6ff]/10">
          <div className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-[#010516]" />
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="overflow-hidden"
              >
                <p className="text-sm text-white font-medium truncate">{userName}</p>
                <p className="text-xs text-white/40">Online</p>
              </motion.div>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const accentColor = item.id === 'visoes' ? '#b91c1c' : '#00f6ff';
          
          return (
            <motion.button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative w-full flex items-center gap-3 px-3 py-3 rounded-xl
                transition-all duration-300 group
                ${isActive 
                  ? item.id === 'visoes' 
                    ? 'bg-[#b91c1c]/10 text-[#b91c1c]' 
                    : 'bg-[#00f6ff]/10 text-[#00f6ff]' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                  style={{ backgroundColor: accentColor }}
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              
              <Icon className={`w-5 h-5 ${isActive ? (item.id === 'visoes' ? 'text-[#b91c1c]' : 'text-[#00f6ff]') : ''}`} />
              
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-medium"
                >
                  {item.label}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-[#00f6ff]/10 space-y-1">
        <motion.button
          onClick={onExport}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all duration-300"
        >
          <Download className="w-5 h-5" />
          {!collapsed && <span className="text-sm font-medium">Exportar Dados</span>}
        </motion.button>

        {onSignOut && (
          <motion.button
            onClick={onSignOut}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="text-sm font-medium">Sair</span>}
          </motion.button>
        )}
      </div>

      <motion.button
        onClick={() => onCollapsedChange(!collapsed)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="absolute -right-3 top-20 w-6 h-6 flex items-center justify-center rounded-full bg-[#010516] border border-[#00f6ff]/30 text-[#00f6ff] hover:bg-[#00f6ff]/10 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </motion.button>
    </motion.aside>
  );
}
