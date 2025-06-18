// Component-specific style classes
export const componentStyles = {
  // Badge and tag styles
  badge: {
    primary: "text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded",
    success: "text-xs text-green-300 bg-green-900/30 px-2 py-1 rounded",
    warning: "text-xs text-yellow-300 bg-yellow-900/30 px-2 py-1 rounded",
    secondary: "text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded"
  },
  
  // Button styles (extending shadcn)
  button: {
    outline: "text-slate-300 border-slate-600 hover:bg-slate-700",
    ghost: "text-slate-400 hover:text-white hover:bg-slate-800"
  },
  
  // Loading states
  loading: {
    skeleton: "aspect-[5/7] bg-slate-700 rounded animate-pulse",
    spinner: "w-8 h-8 animate-spin text-white",
    container: "flex items-center justify-center py-12"
  },
  
  // Theme and recommendation sections
  recommendations: {
    header: "flex items-center justify-between",
    icon: "w-5 h-5 mr-2",
    iconColors: {
      theme: "text-purple-400",
      synergy: "text-yellow-400",
      similarity: "text-blue-400"
    },
    description: "text-sm text-slate-300 leading-relaxed",
    cardGrid: "grid grid-cols-2 sm:grid-cols-4 gap-3"
  }
};