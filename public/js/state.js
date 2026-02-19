/**
 * Central State Manager for Apex Scout Manager
 * Implements a simple observable pattern to notify subscribers of state changes.
 */

class StateStore {
    constructor() {
        this.state = {
            currentUser: null,
            selectedTroopId: localStorage.getItem('selectedTroopId') || null,
            donations: [],
            events: [],
            paymentMethods: [],
            profile: null,
            scoutProfile: null,
            earnedBadges: [],
            availableBadges: [],
            cookieDashboardData: null,
            orderCardProducts: [],
            troopMembers: [],
            troopSalesData: null,
            troopGoals: [],
            currentBoothId: null,
            activeTab: 'profile',
            cookieDashboardTroopId: null // Legacy support
        };
        this.listeners = [];
    }

    getState() {
        return this.state;
    }

    setState(newState) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...newState };
        
        // Persist certain values
        if (newState.selectedTroopId !== undefined) {
            if (newState.selectedTroopId) {
                localStorage.setItem('selectedTroopId', newState.selectedTroopId);
            } else {
                localStorage.removeItem('selectedTroopId');
            }
        }

        this.notify(this.state, oldState);
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify(state, oldState) {
        this.listeners.forEach(listener => listener(state, oldState));
    }
}

export const store = new StateStore();
