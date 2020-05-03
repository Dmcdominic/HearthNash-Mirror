// Helper functions for WebInterface.js to use.


// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");


// Constants
const WINRATE_DECIMAL_PLACES : number = 5;



// Takes in a winrates matrix as decimals and converts the values to percentages.
function toPercentMatrix(winrates : number[][]) : void {
    multiply2DMatrix(winrates, 100);
}
// Takes in a winrates matrix as percentages and converts the values to decimals.
function fromPercentMatrix(winrates : number[][]) : void{
    multiply2DMatrix(winrates, 0.01);
}
// Multiplies all elements of a 2D number matrix by a constant factor.
function multiply2DMatrix(matrix : number[][], factor : number) : void {
    for (let r=0; r < matrix.length; r++) {
        for (let c=0; c < matrix[r].length; c++) {
            matrix[r][c] *= factor;
        }
    }
    roundMatrix(matrix);
}


// Takes in a (decimal) winrates matrix with cells to the left of the diagonal filled in with
//   user input, and returns the full matrix such that decks have symmetric winrates.
function legitimizeWinrateMatrix(winrates : number[][]) : void {
    let n : number = winrates.length;
    if (n < 1) {
        throw new Error("winrates matrix must be non-empty.");
    }

    for (let r = 0; r < n; r++) {
        if (winrates[r].length !== n) {
            throw new Error("winrates matrix is not a square matrix.");
        }
        for (let c = 0; c < r; c++) {
            let elem : number = winrates[r][c];
            if (elem < 0 || elem > 1) {
                throw new Error("each winrate must fall in the range [0, 1]");
            }
            winrates[c][r] = 1 - elem;
        }
        winrates[r][r] = 0.5;
    }
    roundMatrix(winrates);
}


// Rounds a winrate matrix to the desired number of decimal places
function roundMatrix(matrix : number[][]) : void {
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
            matrix[r][c] = +(matrix[r][c]).toFixed(WINRATE_DECIMAL_PLACES);
        }
    }
}


// Rounds a single number to a certain number of decimal places
function roundNumber(num : number, places : number) : number {
    return +(num).toFixed(places);
}


// ===== STRING DISPLAY UTIL =====

// Returns a string that describes a vertex succinctly.
// Useful for displaying on a parent or child vertex button.
function vertexVerboseName(vertex : HearthNash.vertex, matchRoot : HearthNash.matchRoot) : string {
    let txt : string = "";
    if (vertex.vertexType === "protectVertex") {
        txt = "Protect Phase";
    } else if (vertex.vertexType === "banVertex") {
        txt = "Ban Phase";
        // if (matchRoot.MetaInfo.protectsTotal > 0) {
        //     txt += " (P0 Protects: " + listArrayElemsDeckNames(vertex.decksProtected[0], matchRoot);
        //     txt += ". P1 Protects: " + listArrayElemsDeckNames(vertex.decksProtected[1], matchRoot);
        //     txt += ")";
        // }
    } else if (vertex.vertexType === "gameVertex") {
        txt = "Game";
        // txt = "Game (P0: " + deckName(vertex.currentDecks[0], matchRoot) + ", P1: " + deckName(vertex.currentDecks[1], matchRoot) + ")";
    } else if (vertex.vertexType === "deckChoiceVertex") {
        if (vertex.previousGameWinner === null) {
            txt = "Deck Choice Phase";
        } else {
            txt = "Deck Choice Phase (Previous Winner: P" + vertex.previousGameWinner + ")";
        }
    } else if (vertex.vertexType === "outcomeVertex") {
        txt = "Outcome: P" + vertex.winner + " Wins";
    } else {
        throw new Error("No vertexVerboseName() case for vertexType: " + vertex.vertexType);
    }
    return txt;
}


// Returns a string that includes all non-null properties of a vertex.
// Useful for displaying full data on the current vertex.
function vertexDetails(vertex : HearthNash.vertex, matchRoot : HearthNash.matchRoot) : string {
    let details : string = "";
    let keys : string[] = Object.keys(vertex);
    for (let key of keys) {
        if (key === "children" || key === "FormatSettings" || key === "MetaInfo") continue;
        let value = vertex[key];
        if (value === null || value === undefined) continue;
        if (key === "wins" || key === "victoryProbabilities") {
            details += "P0 " + key + ": " + value[0] + "<br>";
            details += "P1 " + key + ": " + value[1];
        } else if (key === "currentDecks" || key === "previousDecks") {
            details += "P0 " + key + ": " + deckName(value[0], matchRoot) + "<br>";
            details += "P1 " + key + ": " + deckName(value[1], matchRoot);
        } else if (key === "decksRemaining" || key === "optimalStrategies" || key === "decksProtected") {
            let namedDecks : boolean = (key === "decksRemaining" || key === "decksProtected");
            details += "P0 " + key + ": [";
            for (let i=0; i < value[0].length; i++) {
                let valueStr = namedDecks ? deckName(value[0][i], matchRoot) : value[0][i];
                details += valueStr + (i === value[0].length - 1 ? "" : ", ");
            }
            details += "]<br>P1 " + key + ": [";
            for (let i=0; i < value[1].length; i++) {
                let valueStr = namedDecks ? deckName(value[1][i], matchRoot) : value[1][i];
                details += valueStr + (i === value[1].length - 1 ? "" : ", ");
            }
            details += "]";
        } else if (Array.isArray(value)) {
            console.error("Array.isArray(value) case caught in vertexDetails...");
            details += key + ": " + value.toString();
        } else {
            details += key + ": " + value.toString();
        }
        details += "<br><br>";
    }
    // Include the players' options, if they apply
    let optionsByPlayer : string[][] = vertexOptionsByPlayer(vertex, matchRoot);
    if (optionsByPlayer) {
        details += "P0 options: [";
        for (let i=0; i < optionsByPlayer[0].length; i++) {
            let valueStr = optionsByPlayer[0][i];
            details += "(" + valueStr + (i === optionsByPlayer[0].length - 1 ? ")" : "), ");
        }
        details += "]<br>P1 options: [";
        for (let i=0; i < optionsByPlayer[1].length; i++) {
            let valueStr = optionsByPlayer[1][i];
            details += "(" + valueStr + (i === optionsByPlayer[1].length - 1 ? ")" : "), ");
        }
        details += "]";
        details += "<br><br>"
    }
    return details;
}


// Returns a pair of arrays, each containing the player's options at the given vertex.
// If there are no options (e.g. game vertex), returns null.
function vertexOptionsByPlayer(vertex : HearthNash.vertex, matchRoot : HearthNash.matchRoot) : string[][] {
    let options : string[][] = [[], []];
    if (vertex.vertexType === "protectVertex") {
        let p0PossibleProtects = HN_Utility.subsets(vertex.decksRemaining[S.P0], matchRoot.FormatSettings.protectsTotal);
        let p1PossibleProtects = HN_Utility.subsets(vertex.decksRemaining[S.P1], matchRoot.FormatSettings.protectsTotal);
        for (let i=0; i < p0PossibleProtects.length; i++) {
            let protectSet : number[] = p0PossibleProtects[i];
            let protectDeckNames = protectSet.map(deckI => deckName(deckI, matchRoot));
            options[S.P0].push("Protects: ");
            for (let j=0; j < protectDeckNames.length; j++) {
                options[S.P0][i] += protectDeckNames[j] + ((j === protectDeckNames.length - 1) ? "" : ", ");
            }
        }
        for (let i=0; i < p1PossibleProtects.length; i++) {
            let protectSet : number[] = p1PossibleProtects[i];
            let protectDeckNames = protectSet.map(deckI => deckName(deckI, matchRoot));
            options[S.P1].push("Protects: ");
            for (let j=0; j < protectDeckNames.length; j++) {
                options[S.P1][i] += protectDeckNames[j] + ((j === protectDeckNames.length - 1) ? "" : ", ");
            }
        }
    } else if (vertex.vertexType === "banVertex") {
        let p0BannableDecks = HN_Utility.removeManyFromArray(vertex.decksRemaining[S.P0], vertex.decksProtected[S.P0]);
        let p1BannableDecks = HN_Utility.removeManyFromArray(vertex.decksRemaining[S.P1], vertex.decksProtected[S.P1]);
        let p0PossibleBans = HN_Utility.subsets(p1BannableDecks, matchRoot.FormatSettings.bansTotal);
        let p1PossibleBans = HN_Utility.subsets(p0BannableDecks, matchRoot.FormatSettings.bansTotal);
        for (let i=0; i < p0PossibleBans.length; i++) {
            let banSet : number[] = p0PossibleBans[i];
            let banDeckNames = banSet.map(deckI => deckName(deckI, matchRoot));
            options[S.P0].push("Bans: ");
            for (let j=0; j < banDeckNames.length; j++) {
                options[S.P0][i] += banDeckNames[j] + ((j === banDeckNames.length - 1) ? "" : ", ");
            }
        }
        for (let i=0; i < p1PossibleBans.length; i++) {
            let banSet : number[] = p1PossibleBans[i];
            let banDeckNames = banSet.map(deckI => deckName(deckI, matchRoot));
            options[S.P1].push("Bans: ");
            for (let j=0; j < banDeckNames.length; j++) {
                options[S.P1][i] += banDeckNames[j] + ((j === banDeckNames.length - 1) ? "" : ", ");
            }
        }
    } else if (vertex.vertexType === "deckChoiceVertex") {
        let p0CantSwitch = ((vertex.previousGameWinner == S.P0 && !matchRoot.FormatSettings.winnerCanSwitch) || (vertex.previousGameWinner == S.P1 && !matchRoot.FormatSettings.loserCanSwitch));
        let p1CantSwitch = ((vertex.previousGameWinner == S.P1 && !matchRoot.FormatSettings.winnerCanSwitch) || (vertex.previousGameWinner == S.P0 && !matchRoot.FormatSettings.loserCanSwitch));
        let p0DeckOptions = p0CantSwitch ? [ vertex.previousDecks[S.P0] ] : vertex.decksRemaining[S.P0];
        let p1DeckOptions = p1CantSwitch ? [ vertex.previousDecks[S.P1] ] : vertex.decksRemaining[S.P1];
        options[S.P0] = p0DeckOptions.map(deck => "Picks: " + deckName(deck, matchRoot));
        options[S.P1] = p1DeckOptions.map(deck => "Picks: " + deckName(deck, matchRoot));
    } else {
        return null;
    }
    return options;
}


// Returns a single flattened array containing a description of the player options that lead to each
//   child of the given vertex. If there are no options (e.g. game vertex), returns null.
function vertexOptionsByChild(vertex : HearthNash.vertex, matchRoot : HearthNash.matchRoot) : string[] {
    let optionsByPlayer : string[][] = vertexOptionsByPlayer(vertex, matchRoot);
    if (!optionsByPlayer) {
        return null;
    }
    let optionsByChild : string[] = [];
    for (let i=0; i < optionsByPlayer[S.P0].length; i++) {
        for (let j=0; j < optionsByPlayer[S.P1].length; j++) {
            optionsByChild.push("P0 " + optionsByPlayer[S.P0][i] + ". P1 " + optionsByPlayer[S.P1][j] + ".");
        }
    }
    return optionsByChild;
}


// Returns a string that summarizes the win probability at a vertex.
function vertexWinProbabilityStr(vertex : HearthNash.vertex) : string {
    return roundNumber(vertex.victoryProbabilities[0] * 100, WINRATE_DECIMAL_PLACES) + "% win for P0";
}


// Returns the name of a deck of a given index, according to the MetaInfo in the MatchRoot.
function deckName(index : number, matchRoot : HearthNash.matchRoot) : string {
    return matchRoot.MetaInfo.deckArchetypes[index].name;
}

// Returns the number of deck archetypes available in the MetaInfo of a given MatchRoot.
function getNumberOfArchetypes(matchRoot : HearthNash.matchRoot) : number {
    return matchRoot.MetaInfo.deckArchetypes.length;
}


// Returns a string which is a list of the elements of array.
function listArrayElems(array : any[]) : string {
    if (array.length === 0) {
        return "none";
    }
    let txt : string = "";
    for (let i=0; i < array.length; i++) {
        txt += array[i] + (i === array.length - 1 ? "" : ", ");
    }
    return txt;
}


// Returns a string which is a list of the elements of an array of deck indices,
//   with indices converted to deck names.
function listArrayElemsDeckNames(array : number[], matchRoot : HearthNash.matchRoot) : string {
    if (array.length === 0) {
        return "none";
    }
    let txt : string = "";
    for (let i=0; i < array.length; i++) {
        let name : string = deckName(array[i], matchRoot);
        txt += name + (i === array.length - 1 ? "" : ", ");
    }
    return txt;
}



// ===== MODULE EXPORTS =====
module.exports.toPercentMatrix = toPercentMatrix;
module.exports.fromPercentMatrix = fromPercentMatrix;
module.exports.legitimizeWinrateMatrix = legitimizeWinrateMatrix;
module.exports.vertexVerboseName = vertexVerboseName;
module.exports.vertexDetails = vertexDetails;
module.exports.vertexOptionsByPlayer = vertexOptionsByPlayer;
module.exports.vertexOptionsByChild = vertexOptionsByChild;
module.exports.vertexWinProbabilityStr = vertexWinProbabilityStr;
module.exports.deckName = deckName;
module.exports.listArrayElems = listArrayElems;
module.exports.listArrayElemsDeckNames = listArrayElemsDeckNames;
