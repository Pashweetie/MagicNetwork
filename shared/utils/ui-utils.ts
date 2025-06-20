// Shared UI utility functions to reduce duplication across components

export class UIUtils {
  static showToast(message: string, type: 'success' | 'error' | 'warning' = 'success', duration: number = 2000) {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : 
                   type === 'error' ? 'bg-red-600' : 'bg-yellow-600';
    
    toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), duration);
  }

  static disableVoteButtons(containerSelector: string) {
    const container = document.querySelector(containerSelector);
    if (container) {
      const voteButtons = container.querySelectorAll('button[title*="Vote"]');
      voteButtons.forEach(btn => (btn as HTMLButtonElement).disabled = true);
    }
  }

  static updateConfidenceDisplay(theme: string, newConfidence: number) {
    const confidenceElement = document.querySelector(`[data-theme="${theme}"] .confidence-display`);
    if (confidenceElement) {
      confidenceElement.textContent = `${newConfidence}%`;
    }
  }

  static createLoadingState(message: string = 'Loading...') {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        <span className="ml-2 text-slate-400">{message}</span>
      </div>
    );
  }

  static createErrorState(message: string = 'Failed to load data') {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400">{message}</p>
      </div>
    );
  }

  static createEmptyState(title: string, subtitle?: string, icon?: React.ReactNode) {
    return (
      <div className="text-center py-8">
        {icon && <div className="w-12 h-12 text-slate-600 mx-auto mb-4">{icon}</div>}
        <p className="text-slate-400">{title}</p>
        {subtitle && <p className="text-sm text-slate-500 mt-2">{subtitle}</p>}
      </div>
    );
  }
}

// Shared vote handling logic
export class VoteHandler {
  static async handleVote(
    cardId: string,
    endpoint: string,
    voteData: any,
    userHasVoted: {[key: string]: boolean},
    setUserHasVoted: (fn: (prev: any) => any) => void,
    voteKey: string
  ) {
    if (userHasVoted[voteKey]) {
      UIUtils.showToast('You have already voted on this item', 'warning');
      return;
    }

    try {
      const response = await fetch(`/api/cards/${cardId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteData)
      });
      
      if (response.ok) {
        const result = await response.json();
        setUserHasVoted(prev => ({ ...prev, [voteKey]: true }));
        
        const button = document.activeElement as HTMLButtonElement;
        if (button) {
          button.className += ' bg-green-600 text-white';
          button.disabled = true;
        }
        
        UIUtils.showToast(result.message || 'Vote recorded successfully');
        return result;
      }
    } catch (error) {
      console.error('Vote failed:', error);
      UIUtils.showToast('Failed to record vote', 'error');
    }
  }
}