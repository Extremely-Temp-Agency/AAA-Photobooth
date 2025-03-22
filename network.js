class PlayerManager {
    constructor(selectElement) {
        this.selectElement = selectElement;
        this.isOverlay1Active = true;
        this.selectedPlayer = null;
        this.updateInterval = null;
        this.initializePlayerUpdates();
    }

    async updatePlayers() {
        try {
            const response = await fetch('https://alleycat-server-bun.onrender.com/api/players?rows=100&page=1');
            const data = await response.json();
            
            // Store current selection
            const currentValue = this.selectElement.value;
            
            // Clear existing options
            this.selectElement.innerHTML = '';
            
            // Filter and sort players
            const players = data.data
                .filter(player => this.isOverlay1Active ? player.hunter === 0 : player.hunter === 1)
                .sort((a, b) => a.name.localeCompare(b.name));
            
            // Add players to dropdown
            players.forEach(player => {
                const option = document.createElement('option');
                option.value = player.id;
                option.text = player.name;
                option.dataset.allegiance = player.allegiance;  // Store allegiance in dataset
                this.selectElement.appendChild(option);
            });
            
            // Restore selection if it still exists
            if (currentValue && Array.from(this.selectElement.options).some(opt => opt.value === currentValue)) {
                this.selectElement.value = currentValue;
            }
            
            // Update selected player info
            this.updateSelectedPlayerInfo();
        } catch (error) {
            console.error('Error fetching players:', error);
            this.selectElement.innerHTML = '<option value="">Error loading players</option>';
        }
    }

    updateSelectedPlayerInfo() {
        const selectedOption = this.selectElement.options[this.selectElement.selectedIndex];
        if (selectedOption) {
            this.selectedPlayer = {
                id: selectedOption.value,
                name: selectedOption.text,
                allegiance: selectedOption.dataset.allegiance
            };
        } else {
            this.selectedPlayer = null;
        }
    }

    initializePlayerUpdates() {
        // Initial update
        this.updatePlayers();
        
        // Set up interval for updates
        this.updateInterval = setInterval(() => this.updatePlayers(), 30000);
        
        // Add change listener
        this.selectElement.addEventListener('change', () => {
            this.updateSelectedPlayerInfo();
            if (this.selectedPlayer) {
                this.onPlayerSelectedCallback?.(this.selectedPlayer);
            }
        });
    }

    setOverlayState(isOverlay1Active) {
        this.isOverlay1Active = isOverlay1Active;
        this.updatePlayers();
    }

    onPlayerSelected(callback) {
        this.onPlayerSelectedCallback = callback;
    }

    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Export the PlayerManager class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlayerManager };
} 