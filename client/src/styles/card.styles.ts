// Card-related style classes organized by component
export const cardStyles = {
  // Card grid and tile styles
  tile: {
    container: "relative group cursor-pointer transform transition-all duration-200 hover:scale-105",
    image: "w-full aspect-[5/7] object-cover rounded-lg shadow-lg group-hover:shadow-xl",
    placeholder: "w-full aspect-[5/7] bg-slate-700 rounded-lg flex items-center justify-center",
    placeholderText: "text-xs text-slate-300 text-center p-2",
    overlay: "absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-200 rounded-lg flex items-end",
    overlayContent: "opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 w-full",
    overlayTitle: "text-white text-sm font-medium truncate",
    overlayMeta: "text-slate-300 text-xs truncate"
  },
  
  // Modal styles
  modal: {
    container: "max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700",
    title: "text-white text-xl",
    grid: "grid grid-cols-1 lg:grid-cols-2 gap-6",
    imageContainer: "flex justify-center",
    image: "rounded-lg shadow-lg max-w-full h-auto",
    imagePlaceholder: "bg-slate-600 rounded-lg w-full aspect-[3/4] flex items-center justify-center",
    imagePlaceholderText: "text-slate-400",
    details: "space-y-4",
    detailRow: "flex justify-between",
    detailLabel: "text-slate-400",
    detailValue: "text-white",
    manaCost: "text-white font-mono"
  },
  
  // Suggestion grid styles
  suggestions: {
    container: "space-y-4",
    title: "text-lg font-semibold text-white",
    subtitle: "text-sm text-slate-400",
    grid: "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3",
    emptyState: "text-slate-400 text-center py-8"
  }
};