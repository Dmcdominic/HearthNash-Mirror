// ===== Formats and MetaInfo - Classes and constants =====

// Dependencies
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");


// --- Globals ---
var GFormatSettings : formatSettings;
var GMetaInfo : metaInfo;


// --- Classes ---
// A class to store format settings
class formatSettings {
    name : string;
    removeWinnerDeck : boolean;
    removeLoserDeck : boolean;
    winnerCanSwitch : boolean;
    loserCanSwitch : boolean;
    protectsTotal : number;
    bansTotal : number;
    gamesToWin : number;
    decksPerPlayer : number;
    constructor(rWD : boolean, rLD : boolean, wCS : boolean, lCS : boolean, P : number, B : number, G : number, D : number, name : string) {
        this.removeWinnerDeck = rWD;
        this.removeLoserDeck = rLD;
        this.winnerCanSwitch = wCS;
        this.loserCanSwitch = lCS;
        this.protectsTotal = P; // Non-negative
        this.bansTotal = B; // Non-negative
        this.gamesToWin = G; // Strictly positive
        this.decksPerPlayer = D; // More specific restrictions (see evaluateMatch verification)
        this.name = name;
        this.validate();
    }

    // Checks that these format settings are consistent.
    validate() {
        // First some basic non-zero/non-negative checks.
        if (this.gamesToWin <= 0 || this.decksPerPlayer <= 0 || this.protectsTotal < 0 || this.bansTotal < 0) {
            throw new Error("formatSettings with name: " + this.name + " has invalid gamesToWin/decksPerPlayer/protectsTotal/bansTotal value.");
        }

        // Check that there are enough decks to protect and ban
        if (this.protectsTotal + this.bansTotal > this.decksPerPlayer) {
            throw new Error("formatSettings with name: " + this.name + " - Not enough decks were provided to fulfill protect + ban phases.");
        }

        // Check that there are enough decks so a player can't run out prematurely
        let maxWinsEach : number = this.gamesToWin - 1;
        let winElims : number = this.removeWinnerDeck ? maxWinsEach : 0;
        let lossElims : number = this.removeLoserDeck ? maxWinsEach : 0;
        let maxDeckElims : number = this.bansTotal + winElims + lossElims;
        if (maxDeckElims >= this.decksPerPlayer) {
            throw new Error("formatSettings with name: " + this.name + " - Not enough decks were provided to always allow the required number of games to win.");
        } else if (!S.ALLOW_EXCESS_DECKS && maxDeckElims + 1 !== this.decksPerPlayer) {
            throw new Error("formatSettings with name: " + this.name + " has excess decks per player, meaning that the both players may choose between more than 1 deck for the final game, which is unusual.\n");
        }
    }
}


// A class to store meta info, such as the winrate matrix
class metaInfo {
    winrates : number[][];
    deckArchetypes : deckArchetype[]; // Indexed for winrates matrix.
    fullMatchupsData : object;
    seed : number;
    version : string;
    metaType : number;
    constructor(winrates : number[][], deckArchetypes : deckArchetype[] = null, fullMatchupsData : object = null, metaType : number = -1) {
        this.winrates = winrates;
        this.deckArchetypes = deckArchetypes;
        this.fullMatchupsData = fullMatchupsData;
        this.seed = HN_Utility.pseudorandom_int();
        this.version = S.VERSION;
        this.metaType = metaType;
        // winrates[yourDeck][opposingDeck] = yourExpectedVal (probability to win match)
        // A valid winrate matrix has the following properties:
        //      - width = height = n
        //      - ALL values are in the range [0, 1]
        //   - winrates[a, b] + winrates[b, a] = 1 (for all 0 <= a, b < n)

        // Verify that winrates are well-formed (as described above)
        let n : number = winrates.length;
        if (n < 1) {
            throw new Error("winrates matrix must be non-empty.");
        }

        const SUM_TO_1_EPSILON = 0.0015;
        for (let r = 0; r < n; r++) {
            if (winrates[r].length !== n) {
                throw new Error("winrates is not a square matrix.");
            }
            for (let c = 0; c <= r; c++) {
                let elem : number = winrates[r][c];
                if (elem < 0 || elem > 1) {
                    throw new Error("winrates must fall in the range [0, 1]");
                } else if (Math.abs(elem + winrates[c][r] - 1) > SUM_TO_1_EPSILON) {
                    console.log(winrates);
                    console.log("c: " + c + "\nr: " + r);
                    throw new Error("winrates[a, b] and winrates[b, a] must sum to 1.");
                }
            }
        }

        // Verify that the length of deckArchetypes is the same as the length of winrates,
        // or if none was provided, fill it in with null values.
        if (this.deckArchetypes === null) {
            this.deckArchetypes = HN_Utility.tabulate(n, (i) => null);
        } else if (this.deckArchetypes.length !== n) {
            throw new Error("deckArchetypes must have the same length as winrates");
        }
    }
}


// A class to store the data of a single deck archetype.
// Explicitly identical to HSReplay's archetype_names JSON data.
class deckArchetype {
    id : number;
    name : string;
    class : string;
    constructor(id : number, name : string, _class : string) {
        this.id = id;
        this.name = name;
        this.class = _class;
    }
}



// --- Core Formats ---
const CORE_FORMATS = {
    // (removeWinnerDeck, removeLoserDeck, winnerCanSwitch, loserCanSwitch, protects, bans, gamesToWin, decksPerPlayer, name)
    ONE_GAME_NO_BAN : new formatSettings(true, false, true, true, 0, 0, 1, 1, "1 Game No Bans"),
    ONE_GAME_ONE_BAN : new formatSettings(true, false, true, true, 0, 1, 1, 2, "1 Game 1 Ban"),
    CONQUEST_BO3 : new formatSettings(true, false, true, true, 0, 1, 2, 3, "Conquest BO3"),
    CONQUEST_BO5 : new formatSettings(true, false, true, true, 0, 1, 3, 4, "Conquest BO5"),
    SHIELD_PHASE_CONQUEST_BO3 : new formatSettings(true, false, true, true, 1, 1, 2, 3, "Shield Phase Conquest BO3"),
    SHIELD_PHASE_CONQUEST_BO5 : new formatSettings(true, false, true, true, 1, 1, 3, 4, "Shield Phase Conquest BO5"),
    LAST_HERO_STANDING_BO3 : new formatSettings(false, true, false, true, 0, 1, 2, 3, "Last Hero Standing BO3"),
    LAST_HERO_STANDING_BO5 : new formatSettings(false, true, false, true, 0, 1, 3, 4, "Last Hero Standing BO5"),
    SHIELD_PHASE_LAST_HERO_STANDING_BO3 : new formatSettings(false, true, false, true, 1, 1, 2, 3, "Shield Phase Last Hero Standing BO3"),
    SHIELD_PHASE_LAST_HERO_STANDING_BO5 : new formatSettings(false, true, false, true, 1, 1, 3, 4, "Shield Phase Last Hero Standing BO5"),
    CONQUEST_NO_BANS_BO3 : new formatSettings(true, false, true, true, 0, 0, 2, 2, "Conquest No Bans BO3"),
    CONQUEST_NO_BANS_BO5 : new formatSettings(true, false, true, true, 0, 0, 3, 3, "Conquest No Bans BO5"),
    LAST_HERO_STANDING_NO_BANS_BO3 : new formatSettings(false, true, false, true, 0, 0, 2, 2, "Last Hero Standing No Bans BO3"),
    LAST_HERO_STANDING_NO_BANS_BO5 : new formatSettings(false, true, false, true, 0, 0, 3, 3, "Last Hero Standing No Bans BO5"),
    // Specialist is based on a sideboard system, and so is hard to represent here
}



// ===== MODULE EXPORTS =====
module.exports.GFormatSettings = GFormatSettings;
module.exports.GMetaInfo = GMetaInfo;
module.exports.formatSettings = formatSettings;
module.exports.metaInfo = metaInfo;
module.exports.deckArchetype = deckArchetype;
module.exports.CORE_FORMATS = CORE_FORMATS;
