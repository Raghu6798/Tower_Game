class TowerGameState {
    constructor() {
        this.codename = "";
        this.floor = 1;
        this.level = 1;
        this.xp = 0;
        this.className = "Unregistered Aspirant";
        this.history = [];
        this.leaderboard = [];
        
        // Addictive Reward Loop State
        this.shards = 0;
        this.upgrades = {
            xpBoost: 0,       // Level of upgrade: each level adds +15% XP
            hintDiscount: 0,  
            visorStyle: "cyber-cyan" // Custom visor color skin unlocked
        };
        
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem("tower_game_state");
            if (saved) {
                const parsed = JSON.parse(saved);
                this.codename = parsed.codename || "";
                this.floor = parsed.floor || 1;
                this.level = parsed.level || 1;
                this.xp = parsed.xp || 0;
                this.className = parsed.className || "Unregistered Aspirant";
                this.history = parsed.history || [];
                
                // Load reward variables
                this.shards = parsed.shards || 0;
                this.upgrades = parsed.upgrades || {
                    xpBoost: 0,
                    hintDiscount: 0,
                    visorStyle: "cyber-cyan"
                };
            }
            
            const savedLeaderboard = localStorage.getItem("tower_game_leaderboard");
            if (savedLeaderboard) {
                this.leaderboard = JSON.parse(savedLeaderboard);
            } else {
                this.leaderboard = [
                    { codename: "NEON_VIPER", floor: 87, level: 32, className: "Quantum Cryptographer" },
                    { codename: "ZERO_COOL", floor: 54, level: 21, className: "Aether Hacker" },
                    { codename: "CRASH_OVERRIDE", floor: 29, level: 12, className: "Logic Sentinel" },
                    { codename: "ACID_BURN", floor: 12, level: 5, className: "Void Infiltrator" }
                ];
                this.saveLeaderboard();
            }
        } catch (e) {
            console.error("Failed to load state registers:", e);
        }
    }

    save() {
        try {
            const stateToSave = {
                codename: this.codename,
                floor: this.floor,
                level: this.level,
                xp: this.xp,
                className: this.className,
                history: this.history,
                shards: this.shards,
                upgrades: this.upgrades
            };
            localStorage.setItem("tower_game_state", JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to save state registers:", e);
        }
    }

    saveLeaderboard() {
        try {
            localStorage.setItem("tower_game_leaderboard", JSON.stringify(this.leaderboard));
        } catch (e) {
            console.error("Failed to save leaderboard registers:", e);
        }
    }

    login(codename) {
        this.codename = codename.trim().toUpperCase() || "ASPIRANT_X";
        this.save();
    }

    addXP(amount) {
        // Apply XP Boost from Upgrades
        const boostMultiplier = 1 + (this.upgrades.xpBoost * 0.15);
        const actualXP = Math.round(amount * boostMultiplier);
        
        this.xp += actualXP;
        let requiredXp = this.level * 100;
        let leveledUp = false;
        
        while (this.xp >= requiredXp) {
            this.xp -= requiredXp;
            this.level += 1;
            leveledUp = true;
            requiredXp = this.level * 100;
        }
        
        // Award shards upon leveling up
        if (leveledUp) {
            this.shards += this.level * 15;
        }
        
        this.save();
        return {
            leveledUp,
            newLevel: this.level,
            earnedXP: actualXP
        };
    }

    addShards(amount) {
        this.shards += amount;
        this.save();
    }

    purchaseUpgrade(type, cost) {
        if (this.shards >= cost) {
            this.shards -= cost;
            if (type === "xpBoost" || type === "hintDiscount") {
                this.upgrades[type] += 1;
            } else if (typeof type === "string") {
                this.upgrades.visorStyle = type;
            }
            this.save();
            return true;
        }
        return false;
    }

    recordAnswer(floor, question, answer, isCorrect) {
        this.history.push({
            floor,
            question,
            answer,
            isCorrect,
            timestamp: Date.now()
        });
        this.save();
    }

    registerClass(className) {
        this.className = className;
        this.save();
    }

    submitHighScore() {
        if (!this.codename) return;
        
        const existingIdx = this.leaderboard.findIndex(entry => entry.codename === this.codename);
        if (existingIdx !== -1) {
            if (this.floor > this.leaderboard[existingIdx].floor) {
                this.leaderboard[existingIdx] = {
                    codename: this.codename,
                    floor: this.floor,
                    level: this.level,
                    className: this.className
                };
            }
        } else {
            this.leaderboard.push({
                codename: this.codename,
                floor: this.floor,
                level: this.level,
                className: this.className
            });
        }

        this.leaderboard.sort((a, b) => {
            if (b.floor !== a.floor) return b.floor - a.floor;
            return b.level - a.level;
        });

        this.leaderboard = this.leaderboard.slice(0, 10);
        this.saveLeaderboard();
    }

    reset() {
        this.codename = "";
        this.floor = 1;
        this.level = 1;
        this.xp = 0;
        this.className = "Unregistered Aspirant";
        this.history = [];
        this.shards = 0;
        this.upgrades = {
            xpBoost: 0,
            hintDiscount: 0,
            visorStyle: "cyber-cyan"
        };
        this.save();
    }
}

export const state = new TowerGameState();