// Utility functions for Meesho Shipping Optimizer v5.2.1

const OptimizerUtils = {
    // Generate random color (no white/very light colors)
    getRandomColor: function() {
        const r = Math.floor(Math.random() * 200) + 20;
        const g = Math.floor(Math.random() * 200) + 20;
        const b = Math.floor(Math.random() * 200) + 20;
        
        // Avoid too light colors
        if (r + g + b > 550) {
            return this.getRandomColor();
        }
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    },

    // Generate random gradient
    getRandomGradient: function(ctx, width, height) {
        const types = ['linear-h', 'linear-v', 'linear-d', 'radial'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        let gradient;
        switch (type) {
            case 'linear-h':
                gradient = ctx.createLinearGradient(0, 0, width, 0);
                break;
            case 'linear-v':
                gradient = ctx.createLinearGradient(0, 0, 0, height);
                break;
            case 'linear-d':
                gradient = ctx.createLinearGradient(0, 0, width, height);
                break;
            default:
                gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
        }
        
        gradient.addColorStop(0, this.getRandomColor());
        gradient.addColorStop(0.5, this.getRandomColor());
        gradient.addColorStop(1, this.getRandomColor());
        return gradient;
    },

    // File to data URL
    fileToDataUrl: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    },

    // Show notification with dark theme
    showNotification: function(message, type) {
        const existing = document.querySelector('.optimizer-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'optimizer-notification';
        
        const colors = {
            success: { bg: 'linear-gradient(135deg, #FFD700, #C9A227)', icon: '✓' },
            error: { bg: 'linear-gradient(135deg, #FFD700, #C9A227)', icon: '✕' },
            info: { bg: 'linear-gradient(135deg, #FFD700, #C9A227)', icon: 'ℹ' },
            warning: { bg: 'linear-gradient(135deg, #FFD700, #C9A227)', icon: '⚠' }
        };
        
        const style = colors[type] || colors.info;
        
        notification.style.cssText = `
            position: fixed;
            top: 12px;
            left: 12px;
            right: 12px;
            padding: 12px 14px;
            border-radius: 10px;
            color: #111;
            font-size: 12px;
            font-weight: 600;
            line-height: 1.35;
            z-index: 999999;
            max-width: none;
            box-shadow: 0 8px 24px rgba(0,0,0,0.18);
            background: ${style.bg};
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            animation: slideIn 0.3s ease;
            word-break: break-word;
        `;
        
        notification.innerHTML = `
            <span style="font-size:18px;">${style.icon}</span>
            <span>${message}</span>
        `;
        
        // Add animation style
        const styleEl = document.createElement('style');
        styleEl.textContent = '@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
        document.head.appendChild(styleEl);
        
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            notification.style.cssText += '@keyframes slideOut{to{transform:translateX(100%);opacity:0}}';
            setTimeout(() => {
                notification.remove();
                styleEl.remove();
            }, 300);
        }, 4000);
    },

    // Debounce function
    debounce: function(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    // Format currency
    formatCurrency: function(amount) {
        return '₹' + amount.toLocaleString('en-IN');
    }
};

// Export for use in other files
window.OptimizerUtils = OptimizerUtils;
