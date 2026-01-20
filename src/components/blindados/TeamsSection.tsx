"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  Zap,
  Target,
  Trophy,
  MessageSquare,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  TrendingUp,
  Award,
  Star,
  Activity,
  Settings,
  Eye,
  EyeOff,
  Play,
  Pause,
  X,
  Check,
  Send,
  Image as ImageIcon,
  Smile,
  Hash,
  AtSign,
  Filter,
  Search,
  LayoutGrid,
  List
} from 'lucide-react';

type TeamsSectionTab = 'visao-geral' | 'membros' | 'feed' | 'equipes' | 'ranking' | 'metas';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  status: 'online' | 'away' | 'busy' | 'offline';
  isInFlow: boolean;
  currentFlow?: string;
  joinedAt: string;
  totalFocusTime: number;
  tasksCompleted: number;
  permissions: {
    canCreateTeams: boolean;
    canInviteMembers: boolean;
    canViewReports: boolean;
    canManageSettings: boolean;
  };
}

interface Team {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  members: TeamMember[];
  createdAt: string;
  tasksCompleted: number;
  activeFlows: number;
}

interface FeedPost {
  id: string;
  author: TeamMember;
  content: string;
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  tags: string[];
  images?: string[];
}

interface RankingEntry {
  position: number;
  member: TeamMember;
  focusTime: number;
  streak: number;
  points: number;
  change: 'up' | 'down' | 'same';
}

interface Goal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  deadline: string;
  assignedTo: TeamMember[];
  status: 'on-track' | 'at-risk' | 'behind' | 'completed';
  type: 'individual' | 'team' | 'organization';
}

const mockMembers: TeamMember[] = [
  {
    id: '1',
    name: 'João Marcelo',
    email: 'joao@ponto.school',
    avatar: 'JM',
    role: 'owner',
    status: 'online',
    isInFlow: true,
    currentFlow: 'Deep Work Session',
    joinedAt: '2024-01-15',
    totalFocusTime: 12500,
    tasksCompleted: 145,
    permissions: { canCreateTeams: true, canInviteMembers: true, canViewReports: true, canManageSettings: true }
  },
  {
    id: '2',
    name: 'Maria Silva',
    email: 'maria@ponto.school',
    avatar: 'MS',
    role: 'admin',
    status: 'online',
    isInFlow: false,
    joinedAt: '2024-02-20',
    totalFocusTime: 8900,
    tasksCompleted: 98,
    permissions: { canCreateTeams: true, canInviteMembers: true, canViewReports: true, canManageSettings: false }
  },
  {
    id: '3',
    name: 'Pedro Santos',
    email: 'pedro@ponto.school',
    avatar: 'PS',
    role: 'member',
    status: 'away',
    isInFlow: false,
    joinedAt: '2024-03-10',
    totalFocusTime: 5400,
    tasksCompleted: 67,
    permissions: { canCreateTeams: false, canInviteMembers: false, canViewReports: true, canManageSettings: false }
  },
  {
    id: '4',
    name: 'Ana Costa',
    email: 'ana@ponto.school',
    avatar: 'AC',
    role: 'member',
    status: 'busy',
    isInFlow: true,
    currentFlow: 'Sprint Planning',
    joinedAt: '2024-03-25',
    totalFocusTime: 4200,
    tasksCompleted: 52,
    permissions: { canCreateTeams: false, canInviteMembers: false, canViewReports: true, canManageSettings: false }
  },
  {
    id: '5',
    name: 'Lucas Oliveira',
    email: 'lucas@ponto.school',
    avatar: 'LO',
    role: 'guest',
    status: 'offline',
    isInFlow: false,
    joinedAt: '2024-04-01',
    totalFocusTime: 1800,
    tasksCompleted: 23,
    permissions: { canCreateTeams: false, canInviteMembers: false, canViewReports: false, canManageSettings: false }
  }
];

const mockTeams: Team[] = [
  {
    id: '1',
    name: 'Desenvolvimento',
    description: 'Equipe de desenvolvimento de produto',
    color: '#00f6ff',
    icon: '💻',
    members: mockMembers.slice(0, 3),
    createdAt: '2024-01-20',
    tasksCompleted: 234,
    activeFlows: 2
  },
  {
    id: '2',
    name: 'Marketing',
    description: 'Equipe de marketing e growth',
    color: '#7c3aed',
    icon: '📈',
    members: mockMembers.slice(2, 5),
    createdAt: '2024-02-15',
    tasksCompleted: 156,
    activeFlows: 1
  },
  {
    id: '3',
    name: 'Design',
    description: 'Equipe de design e UX',
    color: '#f59e0b',
    icon: '🎨',
    members: mockMembers.slice(1, 4),
    createdAt: '2024-03-01',
    tasksCompleted: 89,
    activeFlows: 0
  }
];

const mockPosts: FeedPost[] = [
  {
    id: '1',
    author: mockMembers[0],
    content: '🚀 Acabamos de lançar a nova versão do Blindados! Agora com sistema completo de equipes e ranking. Bora testar e me contem o que acharam!',
    createdAt: '2025-01-20T10:30:00',
    likes: 12,
    comments: 5,
    shares: 3,
    isLiked: false,
    tags: ['#lançamento', '#novidades', '#blindados']
  },
  {
    id: '2',
    author: mockMembers[1],
    content: 'Completei minha meta semanal de 20 horas de foco! 💪 Quem mais está acompanhando o ranking?',
    createdAt: '2025-01-20T09:15:00',
    likes: 8,
    comments: 3,
    shares: 1,
    isLiked: true,
    tags: ['#produtividade', '#metas']
  },
  {
    id: '3',
    author: mockMembers[3],
    content: 'Dica do dia: usem a técnica Pomodoro com intervalos de 25/5 minutos. Minha produtividade aumentou 40% desde que comecei! ⏰',
    createdAt: '2025-01-19T16:45:00',
    likes: 15,
    comments: 7,
    shares: 4,
    isLiked: false,
    tags: ['#dica', '#pomodoro', '#foco']
  }
];

const mockRanking: RankingEntry[] = [
  { position: 1, member: mockMembers[0], focusTime: 12500, streak: 15, points: 2450, change: 'same' },
  { position: 2, member: mockMembers[1], focusTime: 8900, streak: 12, points: 1890, change: 'up' },
  { position: 3, member: mockMembers[3], focusTime: 4200, streak: 8, points: 1234, change: 'up' },
  { position: 4, member: mockMembers[2], focusTime: 5400, streak: 5, points: 987, change: 'down' },
  { position: 5, member: mockMembers[4], focusTime: 1800, streak: 3, points: 456, change: 'same' }
];

const mockGoals: Goal[] = [
  {
    id: '1',
    title: '1000 horas de foco coletivo',
    description: 'Meta da organização para o trimestre',
    targetValue: 1000,
    currentValue: 678,
    deadline: '2025-03-31',
    assignedTo: mockMembers,
    status: 'on-track',
    type: 'organization'
  },
  {
    id: '2',
    title: '50 tarefas completadas',
    description: 'Meta individual semanal',
    targetValue: 50,
    currentValue: 42,
    deadline: '2025-01-26',
    assignedTo: [mockMembers[0]],
    status: 'on-track',
    type: 'individual'
  },
  {
    id: '3',
    title: 'Sprint de desenvolvimento',
    description: 'Completar todas as features do sprint',
    targetValue: 15,
    currentValue: 8,
    deadline: '2025-01-24',
    assignedTo: mockMembers.slice(0, 3),
    status: 'at-risk',
    type: 'team'
  }
];

const tabs: { id: TeamsSectionTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'visao-geral', label: 'Visão Geral', icon: LayoutGrid },
  { id: 'membros', label: 'Membros', icon: Users },
  { id: 'feed', label: 'Feed', icon: MessageSquare },
  { id: 'equipes', label: 'Equipes', icon: Users },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'metas', label: 'Metas', icon: Target }
];

export function TeamsSection() {
  const [activeTab, setActiveTab] = useState<TeamsSectionTab>('visao-geral');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [posts, setPosts] = useState(mockPosts);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [teams, setTeams] = useState(mockTeams);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newTeamIcon, setNewTeamIcon] = useState('💻');
  const [newTeamColor, setNewTeamColor] = useState('#00f6ff');

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    const newTeam: Team = {
      id: Date.now().toString(),
      name: newTeamName,
      description: newTeamDescription,
      color: newTeamColor,
      icon: newTeamIcon,
      members: [mockMembers[0]],
      createdAt: new Date().toISOString(),
      tasksCompleted: 0,
      activeFlows: 0
    };
    setTeams([...teams, newTeam]);
    setNewTeamName('');
    setNewTeamDescription('');
    setNewTeamIcon('💻');
    setNewTeamColor('#00f6ff');
    setShowCreateTeamModal(false);
  };

  const visibleTabs = 4;
  const canScrollLeft = carouselIndex > 0;
  const canScrollRight = carouselIndex < tabs.length - visibleTabs;

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (direction === 'left' && canScrollLeft) {
      setCarouselIndex(prev => prev - 1);
    } else if (direction === 'right' && canScrollRight) {
      setCarouselIndex(prev => prev + 1);
    }
  };

  const handleLikePost = (postId: string) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, likes: post.isLiked ? post.likes - 1 : post.likes + 1, isLiked: !post.isLiked }
        : post
    ));
  };

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;
    const newPost: FeedPost = {
      id: Date.now().toString(),
      author: mockMembers[0],
      content: newPostContent,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      shares: 0,
      isLiked: false,
      tags: []
    };
    setPosts([newPost, ...posts]);
    setNewPostContent('');
  };

  const getStatusColor = (status: TeamMember['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
    }
  };

  const getRoleBadge = (role: TeamMember['role']) => {
    switch (role) {
      case 'owner': return { label: 'Dono', color: 'bg-gradient-to-r from-yellow-500 to-amber-600', icon: Crown };
      case 'admin': return { label: 'Admin', color: 'bg-gradient-to-r from-purple-500 to-violet-600', icon: Shield };
      case 'member': return { label: 'Membro', color: 'bg-gradient-to-r from-blue-500 to-cyan-600', icon: Users };
      case 'guest': return { label: 'Convidado', color: 'bg-gradient-to-r from-gray-500 to-slate-600', icon: Eye };
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Agora';
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const getGoalStatusColor = (status: Goal['status']) => {
    switch (status) {
      case 'on-track': return 'text-green-400 bg-green-500/10';
      case 'at-risk': return 'text-yellow-400 bg-yellow-500/10';
      case 'behind': return 'text-red-400 bg-red-500/10';
      case 'completed': return 'text-blue-400 bg-blue-500/10';
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#00f6ff]/10 to-[#00f6ff]/5 rounded-2xl p-6 border border-[#00f6ff]/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-[#00f6ff]/20">
              <Users className="w-6 h-6 text-[#00f6ff]" />
            </div>
            <span className="text-2xl font-bold text-white">{mockMembers.length}</span>
          </div>
          <p className="text-white/60 text-sm">Membros Ativos</p>
          <p className="text-[#00f6ff] text-xs mt-1">+2 esta semana</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#7c3aed]/10 to-[#7c3aed]/5 rounded-2xl p-6 border border-[#7c3aed]/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-[#7c3aed]/20">
              <Zap className="w-6 h-6 text-[#7c3aed]" />
            </div>
            <span className="text-2xl font-bold text-white">{mockMembers.filter(m => m.isInFlow).length}</span>
          </div>
          <p className="text-white/60 text-sm">Em Flow Agora</p>
          <p className="text-[#7c3aed] text-xs mt-1">Produtividade máxima!</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl p-6 border border-green-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-green-500/20">
              <Target className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-2xl font-bold text-white">385</span>
          </div>
          <p className="text-white/60 text-sm">Tarefas Concluídas</p>
          <p className="text-green-400 text-xs mt-1">+45 hoje</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-2xl p-6 border border-amber-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-amber-500/20">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <span className="text-2xl font-bold text-white">{formatTime(mockMembers.reduce((acc, m) => acc + m.totalFocusTime, 0))}</span>
          </div>
          <p className="text-white/60 text-sm">Tempo Total de Foco</p>
          <p className="text-amber-400 text-xs mt-1">Esta semana</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-[#0a0f1f] rounded-2xl p-6 border border-white/10"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Membros em Flow</h3>
            <span className="text-xs text-white/40">Atualizando em tempo real</span>
          </div>
          <div className="space-y-4">
            {mockMembers.filter(m => m.isInFlow).map(member => (
              <div key={member.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-[#00f6ff]/20">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center text-[#010516] font-bold">
                    {member.avatar}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${getStatusColor(member.status)} border-2 border-[#0a0f1f]`} />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{member.name}</p>
                  <p className="text-[#00f6ff] text-sm flex items-center gap-2">
                    <Play className="w-3 h-3" />
                    {member.currentFlow}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-[#00f6ff]">
                    <Activity className="w-4 h-4" />
                    <span className="text-sm font-medium">Em foco</span>
                  </div>
                </div>
              </div>
            ))}
            {mockMembers.filter(m => m.isInFlow).length === 0 && (
              <div className="text-center py-8 text-white/40">
                <Pause className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum membro em flow no momento</p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-[#0a0f1f] rounded-2xl p-6 border border-white/10"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Top 3 Ranking</h3>
            <button 
              onClick={() => setActiveTab('ranking')}
              className="text-xs text-[#00f6ff] hover:underline"
            >
              Ver todos
            </button>
          </div>
          <div className="space-y-4">
            {mockRanking.slice(0, 3).map((entry, index) => (
              <div key={entry.member.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-gray-400 text-black' :
                  'bg-amber-700 text-white'
                }`}>
                  {entry.position}
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center text-[#010516] font-bold text-sm">
                  {entry.member.avatar}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">{entry.member.name}</p>
                  <p className="text-white/40 text-xs">{entry.points} pts</p>
                </div>
                <div className={`text-sm ${
                  entry.change === 'up' ? 'text-green-400' :
                  entry.change === 'down' ? 'text-red-400' :
                  'text-white/40'
                }`}>
                  {entry.change === 'up' ? '↑' : entry.change === 'down' ? '↓' : '—'}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );

  const renderMembers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Buscar membros..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#00f6ff]/50 w-64"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-[#00f6ff]/20 text-[#00f6ff]' : 'text-white/40 hover:text-white'}`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-[#00f6ff]/20 text-[#00f6ff]' : 'text-white/40 hover:text-white'}`}
          >
            <List className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00f6ff] to-[#7c3aed] rounded-xl text-[#010516] font-medium hover:opacity-90 transition-opacity ml-4">
            <UserPlus className="w-4 h-4" />
            Convidar
          </button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
        {mockMembers.filter(m => 
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.email.toLowerCase().includes(searchQuery.toLowerCase())
        ).map((member) => {
          const roleBadge = getRoleBadge(member.role);
          const RoleIcon = roleBadge.icon;

          if (viewMode === 'list') {
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 p-4 bg-[#0a0f1f] rounded-xl border border-white/10 hover:border-[#00f6ff]/30 transition-colors"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center text-[#010516] font-bold">
                    {member.avatar}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${getStatusColor(member.status)} border-2 border-[#0a0f1f]`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{member.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs text-white ${roleBadge.color}`}>
                      {roleBadge.label}
                    </span>
                  </div>
                  <p className="text-white/40 text-sm">{member.email}</p>
                </div>
                {member.isInFlow && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#00f6ff]/10 border border-[#00f6ff]/30">
                    <Play className="w-3 h-3 text-[#00f6ff]" />
                    <span className="text-[#00f6ff] text-sm">{member.currentFlow}</span>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-white font-medium">{formatTime(member.totalFocusTime)}</p>
                  <p className="text-white/40 text-xs">{member.tasksCompleted} tarefas</p>
                </div>
                <button className="p-2 text-white/40 hover:text-white transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0a0f1f] rounded-2xl p-6 border border-white/10 hover:border-[#00f6ff]/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center text-[#010516] font-bold text-xl">
                    {member.avatar}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${getStatusColor(member.status)} border-2 border-[#0a0f1f]`} />
                </div>
                <button className="p-2 text-white/40 hover:text-white transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
              
              <h4 className="text-white font-semibold mb-1">{member.name}</h4>
              <p className="text-white/40 text-sm mb-3">{member.email}</p>
              
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs text-white flex items-center gap-1 ${roleBadge.color}`}>
                  <RoleIcon className="w-3 h-3" />
                  {roleBadge.label}
                </span>
                {member.isInFlow && (
                  <span className="px-2 py-1 rounded-full text-xs bg-[#00f6ff]/10 text-[#00f6ff] border border-[#00f6ff]/30 flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    Em Flow
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                <div>
                  <p className="text-white/40 text-xs">Tempo de Foco</p>
                  <p className="text-white font-medium">{formatTime(member.totalFocusTime)}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Tarefas</p>
                  <p className="text-white font-medium">{member.tasksCompleted}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-white/40 text-xs mb-2">Permissões</p>
                <div className="flex flex-wrap gap-1">
                  {member.permissions.canCreateTeams && (
                    <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-white/60">Criar equipes</span>
                  )}
                  {member.permissions.canInviteMembers && (
                    <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-white/60">Convidar</span>
                  )}
                  {member.permissions.canViewReports && (
                    <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-white/60">Ver relatórios</span>
                  )}
                  {member.permissions.canManageSettings && (
                    <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-white/60">Config.</span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const renderFeed = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0a0f1f] rounded-2xl p-6 border border-white/10"
      >
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center text-[#010516] font-bold flex-shrink-0">
            JM
          </div>
          <div className="flex-1">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="O que está acontecendo na equipe?"
              className="w-full bg-transparent text-white placeholder:text-white/40 resize-none focus:outline-none min-h-[80px]"
            />
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <button className="p-2 text-white/40 hover:text-[#00f6ff] transition-colors rounded-lg hover:bg-white/5">
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button className="p-2 text-white/40 hover:text-[#00f6ff] transition-colors rounded-lg hover:bg-white/5">
                  <Smile className="w-5 h-5" />
                </button>
                <button className="p-2 text-white/40 hover:text-[#00f6ff] transition-colors rounded-lg hover:bg-white/5">
                  <Hash className="w-5 h-5" />
                </button>
                <button className="p-2 text-white/40 hover:text-[#00f6ff] transition-colors rounded-lg hover:bg-white/5">
                  <AtSign className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={handleCreatePost}
                disabled={!newPostContent.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00f6ff] to-[#7c3aed] rounded-xl text-[#010516] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Publicar
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="space-y-4">
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#0a0f1f] rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center text-[#010516] font-bold flex-shrink-0">
                {post.author.avatar}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white font-semibold">{post.author.name}</span>
                  <span className="text-white/40">·</span>
                  <span className="text-white/40 text-sm">{formatDate(post.createdAt)}</span>
                </div>
                <p className="text-white/90 mb-3 whitespace-pre-wrap">{post.content}</p>
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map(tag => (
                      <span key={tag} className="text-[#00f6ff] text-sm hover:underline cursor-pointer">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-6 pt-3 border-t border-white/5">
                  <button 
                    onClick={() => handleLikePost(post.id)}
                    className={`flex items-center gap-2 transition-colors ${post.isLiked ? 'text-red-400' : 'text-white/40 hover:text-red-400'}`}
                  >
                    <Heart className={`w-5 h-5 ${post.isLiked ? 'fill-current' : ''}`} />
                    <span className="text-sm">{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-2 text-white/40 hover:text-[#00f6ff] transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm">{post.comments}</span>
                  </button>
                  <button className="flex items-center gap-2 text-white/40 hover:text-green-400 transition-colors">
                    <Share2 className="w-5 h-5" />
                    <span className="text-sm">{post.shares}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderTeams = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">Suas Equipes</h3>
        <button
          onClick={() => setShowCreateTeamModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00f6ff] to-[#7c3aed] rounded-xl text-[#010516] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nova Equipe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team, index) => (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#0a0f1f] rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-4">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${team.color}20`, border: `1px solid ${team.color}40` }}
              >
                {team.icon}
              </div>
              <button className="p-2 text-white/40 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                <Settings className="w-5 h-5" />
              </button>
            </div>

            <h4 className="text-white font-semibold text-lg mb-1">{team.name}</h4>
            <p className="text-white/40 text-sm mb-4">{team.description}</p>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex -space-x-2">
                {team.members.slice(0, 4).map((member) => (
                  <div 
                    key={member.id}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center text-[#010516] text-xs font-bold border-2 border-[#0a0f1f]"
                  >
                    {member.avatar}
                  </div>
                ))}
                {team.members.length > 4 && (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-bold border-2 border-[#0a0f1f]">
                    +{team.members.length - 4}
                  </div>
                )}
              </div>
              <span className="text-white/40 text-sm">{team.members.length} membros</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
              <div>
                <p className="text-white/40 text-xs">Tarefas</p>
                <p className="text-white font-medium">{team.tasksCompleted}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Em Flow</p>
                <p className="text-white font-medium flex items-center gap-1">
                  {team.activeFlows}
                  {team.activeFlows > 0 && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                </p>
              </div>
            </div>
          </motion.div>
        ))}

        <motion.button
          onClick={() => setShowCreateTeamModal(true)}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: teams.length * 0.1 }}
          className="bg-[#0a0f1f] rounded-2xl p-6 border border-dashed border-white/20 hover:border-[#00f6ff]/50 transition-all flex flex-col items-center justify-center min-h-[280px] group"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-[#00f6ff]/10 transition-colors">
            <Plus className="w-6 h-6 text-white/40 group-hover:text-[#00f6ff]" />
          </div>
          <p className="text-white/40 group-hover:text-white transition-colors">Criar nova equipe</p>
        </motion.button>
      </div>
    </div>
  );

  const renderRanking = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {mockRanking.slice(0, 3).map((entry, index) => (
          <motion.div
            key={entry.member.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`relative rounded-2xl p-6 border ${
              index === 0 
                ? 'bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/30'
                : index === 1
                ? 'bg-gradient-to-br from-gray-400/10 to-gray-400/5 border-gray-400/30'
                : 'bg-gradient-to-br from-amber-700/10 to-amber-700/5 border-amber-700/30'
            }`}
          >
            <div className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              index === 0 ? 'bg-yellow-500 text-black' :
              index === 1 ? 'bg-gray-400 text-black' :
              'bg-amber-700 text-white'
            }`}>
              {entry.position}
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center text-[#010516] font-bold text-2xl mb-4">
                {entry.member.avatar}
              </div>
              <h4 className="text-white font-semibold text-lg">{entry.member.name}</h4>
              <p className="text-white/40 text-sm mb-4">{getRoleBadge(entry.member.role).label}</p>
              
              <div className="flex items-center gap-1 mb-4">
                <Trophy className={`w-5 h-5 ${
                  index === 0 ? 'text-yellow-500' :
                  index === 1 ? 'text-gray-400' :
                  'text-amber-700'
                }`} />
                <span className="text-2xl font-bold text-white">{entry.points}</span>
                <span className="text-white/40 text-sm">pts</span>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t border-white/10">
                <div>
                  <p className="text-white/40 text-xs">Tempo de Foco</p>
                  <p className="text-white font-medium">{formatTime(entry.focusTime)}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Sequência</p>
                  <p className="text-white font-medium flex items-center gap-1">
                    <Zap className="w-4 h-4 text-amber-400" />
                    {entry.streak} dias
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[#0a0f1f] rounded-2xl border border-white/10 overflow-hidden"
      >
        <div className="p-6 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white">Ranking Completo</h3>
        </div>
        <div className="divide-y divide-white/5">
          {mockRanking.map((entry, index) => (
            <motion.div
              key={entry.member.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                entry.position <= 3 
                  ? entry.position === 1 ? 'bg-yellow-500 text-black' :
                    entry.position === 2 ? 'bg-gray-400 text-black' :
                    'bg-amber-700 text-white'
                  : 'bg-white/10 text-white'
              }`}>
                {entry.position}
              </div>
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center text-[#010516] font-bold">
                  {entry.member.avatar}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${getStatusColor(entry.member.status)} border-2 border-[#0a0f1f]`} />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{entry.member.name}</p>
                <p className="text-white/40 text-sm">{getRoleBadge(entry.member.role).label}</p>
              </div>
              <div className="text-center px-4">
                <p className="text-white font-medium">{formatTime(entry.focusTime)}</p>
                <p className="text-white/40 text-xs">Foco</p>
              </div>
              <div className="text-center px-4">
                <p className="text-white font-medium flex items-center gap-1">
                  <Zap className="w-4 h-4 text-amber-400" />
                  {entry.streak}
                </p>
                <p className="text-white/40 text-xs">Sequência</p>
              </div>
              <div className="text-center px-4">
                <p className="text-white font-bold text-lg">{entry.points}</p>
                <p className="text-white/40 text-xs">Pontos</p>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                entry.change === 'up' ? 'bg-green-500/10 text-green-400' :
                entry.change === 'down' ? 'bg-red-500/10 text-red-400' :
                'bg-white/5 text-white/40'
              }`}>
                {entry.change === 'up' ? <TrendingUp className="w-4 h-4" /> :
                 entry.change === 'down' ? <TrendingUp className="w-4 h-4 rotate-180" /> :
                 '—'}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const renderMetas = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">Metas e Objetivos</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00f6ff] to-[#7c3aed] rounded-xl text-[#010516] font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          Nova Meta
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {['organization', 'team', 'individual'].map((type) => (
          <div key={type} className="bg-[#0a0f1f] rounded-2xl p-4 border border-white/10">
            <h4 className="text-white/60 text-sm uppercase tracking-wider mb-3">
              {type === 'organization' ? 'Organização' : type === 'team' ? 'Equipe' : 'Individual'}
            </h4>
            <p className="text-2xl font-bold text-white">
              {mockGoals.filter(g => g.type === type).length}
            </p>
            <p className="text-white/40 text-sm">metas ativas</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {mockGoals.map((goal, index) => (
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#0a0f1f] rounded-2xl p-6 border border-white/10"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-white font-semibold text-lg">{goal.title}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${getGoalStatusColor(goal.status)}`}>
                    {goal.status === 'on-track' ? 'No prazo' :
                     goal.status === 'at-risk' ? 'Em risco' :
                     goal.status === 'behind' ? 'Atrasada' : 'Concluída'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/60">
                    {goal.type === 'organization' ? 'Organização' : goal.type === 'team' ? 'Equipe' : 'Individual'}
                  </span>
                </div>
                <p className="text-white/40 text-sm">{goal.description}</p>
              </div>
              <button className="p-2 text-white/40 hover:text-white transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60 text-sm">Progresso</span>
                <span className="text-white font-medium">
                  {goal.currentValue} / {goal.targetValue}
                  <span className="text-white/40 ml-1">({Math.round((goal.currentValue / goal.targetValue) * 100)}%)</span>
                </span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(goal.currentValue / goal.targetValue) * 100}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    goal.status === 'on-track' ? 'bg-gradient-to-r from-green-500 to-green-400' :
                    goal.status === 'at-risk' ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                    goal.status === 'behind' ? 'bg-gradient-to-r from-red-500 to-red-400' :
                    'bg-gradient-to-r from-blue-500 to-blue-400'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/40" />
                <span className="text-white/40 text-sm">Prazo: {new Date(goal.deadline).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {goal.assignedTo.slice(0, 3).map((member) => (
                    <div 
                      key={member.id}
                      className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00f6ff] to-[#7c3aed] flex items-center justify-center text-[#010516] text-xs font-bold border-2 border-[#0a0f1f]"
                    >
                      {member.avatar}
                    </div>
                  ))}
                  {goal.assignedTo.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-bold border-2 border-[#0a0f1f]">
                      +{goal.assignedTo.length - 3}
                    </div>
                  )}
                </div>
                <span className="text-white/40 text-sm">{goal.assignedTo.length} responsáveis</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'visao-geral': return renderOverview();
      case 'membros': return renderMembers();
      case 'feed': return renderFeed();
      case 'equipes': return renderTeams();
      case 'ranking': return renderRanking();
      case 'metas': return renderMetas();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-white/10 bg-[#010516]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Equipes</h2>
            <p className="text-white/40 text-sm">Gerencie sua equipe e acompanhe a produtividade</p>
          </div>
        </div>

        <div className="relative flex items-center">
          <button
            onClick={() => scrollCarousel('left')}
            disabled={!canScrollLeft}
            className={`absolute left-0 z-10 p-2 rounded-full bg-[#010516] border border-white/10 transition-all ${
              canScrollLeft ? 'text-white hover:border-[#00f6ff]/50' : 'text-white/20 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 overflow-hidden mx-10">
            <motion.div
              className="flex gap-2"
              animate={{ x: -carouselIndex * 140 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-[#00f6ff]/20 to-[#7c3aed]/20 text-[#00f6ff] border border-[#00f6ff]/30'
                        : 'bg-white/5 text-white/60 border border-transparent hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </motion.div>
          </div>

          <button
            onClick={() => scrollCarousel('right')}
            disabled={!canScrollRight}
            className={`absolute right-0 z-10 p-2 rounded-full bg-[#010516] border border-white/10 transition-all ${
              canScrollRight ? 'text-white hover:border-[#00f6ff]/50' : 'text-white/20 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showCreateTeamModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateTeamModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#0a0f1f] rounded-2xl border border-white/10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#00f6ff]/10">
                    <Users className="w-5 h-5 text-[#00f6ff]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Nova Equipe</h3>
                    <p className="text-white/40 text-sm">Crie uma nova equipe de trabalho</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateTeamModal(false)}
                  className="p-2 text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">Nome da Equipe</label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Ex: Desenvolvimento"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#00f6ff]/50"
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-sm mb-2">Descrição</label>
                  <textarea
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="Descreva o propósito da equipe..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#00f6ff]/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-sm mb-2">Ícone</label>
                  <div className="flex gap-2">
                    {['💻', '📈', '🎨', '📊', '🚀', '💡', '🎯', '⚡'].map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setNewTeamIcon(icon)}
                        className={`w-10 h-10 rounded-xl bg-white/5 border transition-colors text-lg ${newTeamIcon === icon ? 'border-[#00f6ff] bg-[#00f6ff]/10' : 'border-white/10 hover:border-[#00f6ff]/50'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-white/60 text-sm mb-2">Cor</label>
                  <div className="flex gap-2">
                    {['#00f6ff', '#7c3aed', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#8b5cf6'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTeamColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-colors ${newTeamColor === color ? 'border-white scale-110' : 'border-white/20 hover:border-white'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                <button
                  onClick={() => setShowCreateTeamModal(false)}
                  className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateTeam}
                  disabled={!newTeamName.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[#00f6ff] to-[#7c3aed] rounded-xl text-[#010516] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  Criar Equipe
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
