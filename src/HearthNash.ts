// ===== Primary functionality for HearthNash match tree generation =====

// Dependencies
import Formats = require('../lib/Formats.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");


// Use a Match tree to determine the optimal strategies and victory probabilities
function evaluateMatch(decks : number[][], FormatSettings : Formats.formatSettings, MetaInfo : Formats.metaInfo) : matchRoot {
    Formats.GFormatSettings = FormatSettings;
    Formats.GMetaInfo = MetaInfo;

    // Check for well-formed input
    if (decks.length !== 2) {
        throw new Error("Must input a list of decks for each player.");
    }

    // Check that each player has the right number of decks
    if (decks[S.P0].length !== FormatSettings.decksPerPlayer || decks[S.P1].length !== FormatSettings.decksPerPlayer) {
        throw new Error("Each player must start with FormatSettings.decksPerPlayer total decks.");
    }

    // Check that the decks for each player are found in the winrate matrix
    let numDecks : number = Formats.GMetaInfo.winrates.length;
    for (let d = 0; d < decks[S.P0].length; d++) {
        if (decks[S.P0][d] < 0 || decks[S.P0][d] >= numDecks) {
            throw new Error("Deck index exceeds winrate matrix size.")
        }
    }
    for (let d = 0; d < decks[S.P1].length; d++) {
        if (decks[S.P1][d] < 0 || decks[S.P1][d] >= numDecks) {
            throw new Error("Deck index exceeds winrate matrix size.")
        }
    }

    // Generate the tree
    let root = new matchRoot([0, 0], decks, FormatSettings, MetaInfo);
    root.generateChildren();
    return root;
}


// A single vertex in a match tree.
// The tree descends level-by-level as follows:
//      protect -> ban -> [deck choice -> game]* -> outcome
// null indicates none, or DoesNotApply.
// undefined indicates that it must still be defined.
class vertex {
    vertexType : string = "vertex";
    // Current gamestate - Determined immediately upon vertex instantiation.
    wins : number[];
    decksRemaining : number[][];

    // Strategy data - Determined by the generateChildren() method, following instantiation.
    children : vertex[];
    optimalStrategies : number[][];
    victoryProbabilities : number[];

    constructor(wins : number[], decksRemaining : number[][]) {
        // Current gamestate
        this.wins = wins;
        this.decksRemaining = decksRemaining;

        // Strategy data - Initialized as undefined.
        //    Populated in generateChildren()
        this.children = undefined;
        this.optimalStrategies = undefined;
        this.victoryProbabilities = undefined;
    }

    // Each child class should override this, to generate their children and
    //     determine the resulting expected values for each player
    generateChildren() : void {
        throw new Error("generateChildren() not overridden for vertex: " + this);
    }
}


// The root of a match.
class matchRoot extends vertex {
    vertexType : string = "matchRoot";
    FormatSettings : Formats.formatSettings;
    MetaInfo : Formats.metaInfo;
    constructor(wins : number[], decksRemaining : number[][], inFormatSettings : Formats.formatSettings, inMetaInfo : Formats.metaInfo) {
        super(wins, decksRemaining);
        this.FormatSettings = inFormatSettings;
        this.MetaInfo = inMetaInfo;
    }

    generateChildren() {
        resetMemoizers();

        let child : vertex = null;
        if (this.FormatSettings.protectsTotal > 0) {
            child = newProtectVertex(this.wins, this.decksRemaining);
        } else if (this.FormatSettings.bansTotal > 0) {
            child = newBanVertex(this.wins, this.decksRemaining, [[],[]]);
        } else {
            child = newDeckChoiceVertex(this.wins, this.decksRemaining, null, null);
        }
        child.generateChildren();

        this.children = [child];
        this.optimalStrategies = null;
        this.victoryProbabilities = child.victoryProbabilities;
    }
}


// A vertex representing both players' choice of their own decks to protect.
class protectVertex extends vertex {
    vertexType : string = "protectVertex";
    generateChildren() {
        if (this.children !== undefined) {
            return;
        }
        this.children = [];
        let p0PossibleProtects = HN_Utility.subsets(this.decksRemaining[S.P0], Formats.GFormatSettings.protectsTotal);
        let p1PossibleProtects = HN_Utility.subsets(this.decksRemaining[S.P1], Formats.GFormatSettings.protectsTotal);

        // Create a child vertex for each possible protect combination
        let childrenMatrix : vertex[][] = [];
        for (let i=0; i < p0PossibleProtects.length; i++) {
            childrenMatrix.push([]);
            // Pick the protection set for player 0
            let p0Protection = p0PossibleProtects[i];
            for (let j=0; j < p1PossibleProtects.length; j++) {
                // Pick the protection set for player 1
                let p1Protection = p1PossibleProtects[j];

                // Create a new corresponding child vertex
                let newChild = newBanVertex(this.wins, HN_Utility.deepCopyArray(this.decksRemaining), [p0Protection, p1Protection]);
                newChild.generateChildren();
                childrenMatrix[i].push(newChild);
                this.children.push(newChild);
            }
        }

        let payoffs : number[][] = childrenMatrix.map(row => row.map(v => v.victoryProbabilities[S.P0]));
        let solution = HN_Utility.solveNxM(payoffs);

        this.optimalStrategies = [solution.p0Strategy, solution.p1Strategy];
        this.victoryProbabilities = [solution.expectedValue, 1 - solution.expectedValue];
    }
}


// A vertex representing both players' choice of their opponent's decks to ban.
class banVertex extends vertex {
    vertexType : string = "banVertex";
    decksProtected : number[][];
    constructor(wins : number[], decksRemaining : number[][], decksProtected : number[][]) {
        super(wins, decksRemaining);
        this.decksProtected = decksProtected;
    }

    generateChildren() {
        if (this.children !== undefined) {
            return;
        }
        this.children = [];
        let p0BannableDecks = HN_Utility.removeManyFromArray(this.decksRemaining[S.P0], this.decksProtected[S.P0]);
        let p1BannableDecks = HN_Utility.removeManyFromArray(this.decksRemaining[S.P1], this.decksProtected[S.P1]);

        let p0PossibleBans = HN_Utility.subsets(p1BannableDecks, Formats.GFormatSettings.bansTotal);
        let p1PossibleBans = HN_Utility.subsets(p0BannableDecks, Formats.GFormatSettings.bansTotal);

        // Create a child vertex for each possible ban combination
        let childrenMatrix : vertex[][] = [];
        for (let i=0; i < p0PossibleBans.length; i++) {
            childrenMatrix.push([]);
            // Pick the ban set for player 0
            let p0Ban = p0PossibleBans[i];
            for (let j=0; j < p1PossibleBans.length; j++) {
                // Pick the ban set for player 1
                let p1Ban = p1PossibleBans[j];

                // Create a new corresponding child vertex
                let p0DecksAfterBans = HN_Utility.removeManyFromArray(this.decksRemaining[S.P0], p1Ban);
                let p1DecksAfterBans = HN_Utility.removeManyFromArray(this.decksRemaining[S.P1], p0Ban);
                let newChild = newDeckChoiceVertex(this.wins, [p0DecksAfterBans, p1DecksAfterBans], null, null);
                newChild.generateChildren();
                childrenMatrix[i].push(newChild);
                this.children.push(newChild);
            }
        }

        let payoffs : number[][] = childrenMatrix.map(row => row.map(v => v.victoryProbabilities[S.P0]));
        let solution = HN_Utility.solveNxM(payoffs);

        this.optimalStrategies = [solution.p0Strategy, solution.p1Strategy];
        this.victoryProbabilities = [solution.expectedValue, 1 - solution.expectedValue];
    }
}


// A vertex representing a probabilistic game in a match tree.
class gameVertex extends vertex {
    vertexType : string = "gameVertex";
    currentDecks : number[];
    constructor(wins : number[], decksRemaining : number[][], currentDecks : number[]) {
        super(wins, decksRemaining);
        this.currentDecks = currentDecks;
    }

    generateChildren() {
        if (this.children !== undefined) {
            return;
        }
        this.optimalStrategies = null;
        this.victoryProbabilities = [ 0, 0 ];
        this.children = [];

        // For each player, create a child for the case where that player wins
        for (let winner = 0; winner < 2; winner++) {
            let loser = (winner === S.P0) ? S.P1 : S.P0;
            let wins = HN_Utility.deepCopyArray(this.wins);
            wins[winner]++;

            // Determine the previous decks and decks remaining
            let previousDecks = HN_Utility.deepCopyArray(this.currentDecks);
            let decksRemaining = HN_Utility.deepCopyArray(this.decksRemaining);
            if (Formats.GFormatSettings.removeWinnerDeck) {
                decksRemaining[winner] = HN_Utility.removeFromArray(decksRemaining[winner], this.currentDecks[winner]);
            }
            if (Formats.GFormatSettings.removeLoserDeck) {
                decksRemaining[loser] = HN_Utility.removeFromArray(decksRemaining[loser], this.currentDecks[loser]);
            }

            // Instantiate the child and generate its subsequent children,
            //   depending on if someone has won yet or not.
            let child : vertex;
            if (wins[winner] >= Formats.GFormatSettings.gamesToWin) {
                child = newOutcomeVertex(wins, decksRemaining, winner);
            } else {
                child = newDeckChoiceVertex(wins, decksRemaining, previousDecks, winner);
            }

            child.generateChildren();
            this.children.push(child);

            // Determine expected value
            let probability = Formats.GMetaInfo.winrates[this.currentDecks[winner]][this.currentDecks[loser]];
            this.victoryProbabilities[winner] += child.victoryProbabilities[winner] * probability;
            this.victoryProbabilities[loser] += child.victoryProbabilities[loser] * probability;
        }
    }
}


// A vertex representing both players' choice among their remaining decks.
class deckChoiceVertex extends vertex {
    vertexType : string = "deckChoiceVertex";
    previousDecks : number[];
    previousGameWinner : number;
    constructor(wins : number[], decksRemaining : number[][], previousDecks : number[], previousGameWinner : number) {
        super(wins, decksRemaining);
        this.previousDecks = previousDecks;
        this.previousGameWinner = previousGameWinner;
    }

    generateChildren() {
        if (this.children !== undefined) {
            return;
        }
        // First check if each player is even allowed to switch decks
        this.children = [];
        let childrenMatrix : vertex[][] = [];

        let p0CantSwitch = ((this.previousGameWinner == S.P0 && !Formats.GFormatSettings.winnerCanSwitch) || (this.previousGameWinner == S.P1 && !Formats.GFormatSettings.loserCanSwitch));
        let p1CantSwitch = ((this.previousGameWinner == S.P1 && !Formats.GFormatSettings.winnerCanSwitch) || (this.previousGameWinner == S.P0 && !Formats.GFormatSettings.loserCanSwitch));
        let p0DeckOptions = p0CantSwitch ? [ this.previousDecks[S.P0] ] : this.decksRemaining[S.P0];
        let p1DeckOptions = p1CantSwitch ? [ this.previousDecks[S.P1] ] : this.decksRemaining[S.P1];

        // Create a child vertex for each possible deck choice combination
        for (let i=0; i < p0DeckOptions.length; i++) {
            childrenMatrix.push([]);
            // Pick the deck for player 0
            let p0Deck = p0DeckOptions[i];
            for (let j=0; j < p1DeckOptions.length; j++) {
                // Pick the deck for player 1
                let p1Deck = p1DeckOptions[j];
                // Create a new corresponding child vertex
                let newChild = newGameVertex(this.wins, HN_Utility.deepCopyArray(this.decksRemaining), [p0Deck, p1Deck]);
                newChild.generateChildren();
                childrenMatrix[i].push(newChild);
                this.children.push(newChild);
            }
        }

        let payoffs : number[][] = childrenMatrix.map(row => row.map(v => v.victoryProbabilities[S.P0]));
        let solution = HN_Utility.solveNxM(payoffs);
        if (S.VERBOSITY > 5) {
            console.log("Payoffs:");
            console.log(payoffs);
            console.log("Solution:");
            console.log(solution);
        }

        this.optimalStrategies = [solution.p0Strategy, solution.p1Strategy];
        this.victoryProbabilities = [solution.expectedValue, 1 - solution.expectedValue];
    }
}


// A vertex representing that one of the players has won and the match is over.
class outcomeVertex extends vertex {
    vertexType : string = "outcomeVertex";
    winner : number;
    constructor(wins : number[], decksRemaining : number[][], winner : number) {
        super(wins, decksRemaining);
        this.winner = winner;
    }

    generateChildren() {
        if (this.children !== undefined) {
            return;
        }
        this.children = null;
        this.optimalStrategies = null;

        this.victoryProbabilities = [0, 0];
        this.victoryProbabilities[this.winner] = 1;
    }
}


// ===== Memoization =====

// Globals
var Gslice = Array.prototype.slice;
var GMemoProt : Object;
var GMemoBan : Object;
var GMemoGame : Object;
var GMemoDeck : Object;
var GMemoOutcome : Object;
function resetMemoizers() {
    GMemoProt = {};
    GMemoBan = {};
    GMemoGame = {};
    GMemoDeck = {};
    GMemoOutcome = {};
}

// Memoized vertex constructors
function newProtectVertex(wins : number[], decksRemaining : number[][]) : protectVertex {
    let args = Gslice.call(arguments);
    if (args in GMemoProt) {
        return GMemoProt[args];
    }
    return GMemoProt[args] = new protectVertex(wins, decksRemaining);
}
function newBanVertex(wins : number[], decksRemaining : number[][], decksProtected : number[][]) : banVertex {
    let args = Gslice.call(arguments);
    if (args in GMemoBan) {
        return GMemoBan[args];
    }
    return GMemoBan[args] = new banVertex(wins, decksRemaining, decksProtected);
}
function newGameVertex(wins : number[], decksRemaining : number[][], currentDecks : number[]) : gameVertex {
    let args = Gslice.call(arguments);
    if (args in GMemoGame) {
        return GMemoGame[args];
    }
    return GMemoGame[args] = new gameVertex(wins, decksRemaining, currentDecks);
}
function newDeckChoiceVertex(wins : number[], decksRemaining : number[][], previousDecks : number[], previousGameWinner : number) : deckChoiceVertex {
    let args = Gslice.call(arguments);
    if (args in GMemoDeck) {
        return GMemoDeck[args];
    }
    return GMemoDeck[args] = new deckChoiceVertex(wins, decksRemaining, previousDecks, previousGameWinner);
}
function newOutcomeVertex(wins : number[], decksRemaining : number[][], winner : number) : outcomeVertex {
    let args = Gslice.call(arguments);
    if (args in GMemoOutcome) {
        return GMemoOutcome[args];
    }
    return GMemoOutcome[args] = new outcomeVertex(wins, decksRemaining, winner);
}



// ===== MODULE EXPORTS =====
module.exports.evaluateMatch = evaluateMatch;
module.exports.matchRoot = matchRoot;
module.exports.vertex = vertex;
module.exports.gameVertex = gameVertex;
module.exports.outcomeVertex = outcomeVertex;
