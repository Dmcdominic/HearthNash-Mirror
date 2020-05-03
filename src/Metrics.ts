// ===== Metrics for HearthNash data collection and analysis =====

// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Test_Utility = require("../lib/Test_Utility.js");

import IO_Utility = require("../lib/IO_Utility.js");


// A class for storing results with metadata
class MResults {
    metricInfo : MetricInfo;
    version : string;
    FormatSettings : Formats.formatSettings;
    metaType : number;
    numMatches : number;
    results : number[][];
    constructor(metricInfo : MetricInfo, version : string, FormatSettings : Formats.formatSettings, metaType : number, numMatches : number, results : number[][]) {
        this.metricInfo = metricInfo;
        this.version = version;
        this.FormatSettings = FormatSettings;
        this.metaType = metaType;
        this.numMatches = numMatches;
        this.results = results;
    }
}

// A class for storing info about a particular metric
class MetricInfo {
    title : string;
    xAxis : string;
    yAxis : string;
    constructor(title : string, xAxis : string, yAxis : string) {
        this.title = title;
        this.xAxis = xAxis;
        this.yAxis = yAxis;
    }
}


// ===== metric base class =====


// A class to be extended for different metrics
class metric {
    // Each class should set this to its specific info.
    static metricInfo : MetricInfo;
    static propertyName : string;

    // Each child class should override this, to measure and return the value
    // for that metric given a single match.
    static measureMatch(MatchRoot : HearthNash.matchRoot) : any {
        throw new Error("measureMatch() not overridden for metric: " + this);
    }
    // Override this, to take a measurement set, which is an array of measureMatch()
    // results (as below), and averages the results to a 1D array (agnostically speaking).
    static flattenMeasurementSet(measurementSet : any[]) : number[][] {
        throw new Error("flattenMeasurementSet() not overridden for metric: " + this);
    }

    // Uses measureMatch() to analyze all match trees for a given metaType and format,
    //   then saves the resulting MResults object to file and returns its path.
    // FormatSettings - The format settings to simulate
    // metaType - Type of winrate matrix set to use.
    static measureTreesFromFile(FormatSettings : Formats.formatSettings, metaType : number, index : number) : string {
        console.log("Processing metric: " + this.metricInfo.title + " for metaType: " + metaType + ", on format: " + FormatSettings.name);
        let measurementSet : any[] = [];
        let treePaths : string[] = IO_Utility.getPathsMatchTrees(metaType, FormatSettings.name);

        for (let i = 0; i < treePaths.length; i++) {
            let path : string = treePaths[i];
            let MatchRoot : HearthNash.matchRoot = IO_Utility.loadMatchTree(path);
            measurementSet.push(this.measureMatch(MatchRoot));
        }
        let flattenedResults : number[][] = this.flattenMeasurementSet(measurementSet);
        let mResults : MResults = new MResults(this.metricInfo, S.VERSION, FormatSettings, metaType, treePaths.length, flattenedResults);
        return IO_Utility.saveAnalysis(mResults, index);
    }

    // Uses measureMatch() and Metrics_Utility.getWinrateMatrixSetSet() to measure a large set of matches,
    //   and return the full results as an array.
    // FormatSettings - The format settings to simulate
    // numMatches - Number of matches to simulate and measure.
    // metaType - Type of winrate matrix set to use.
    // TODO - integrate some other options, like deck overlap, etc? (for now, assumed no deck overlap)
    static measureMatchSet(FormatSettings : Formats.formatSettings, numMatches : number, metaType : number) : MResults {
        let decksPP = FormatSettings.decksPerPlayer;
        let winratesSet = Metrics_Utility.getWinrateMatrixSet(decksPP * 2, numMatches, metaType);
        let decks : number[][] = [HN_Utility.tabulate(decksPP, (i) => i), HN_Utility.tabulate(decksPP, (i) => decksPP + i)];
        let measurementSet : any[] = new Array(numMatches);

        for (let i = 0; i < numMatches; i++) {
            // winrates
            let MetaInfo : Formats.metaInfo = new Formats.metaInfo(winratesSet[i]);
            let MatchRoot : HearthNash.matchRoot = HearthNash.evaluateMatch(decks, FormatSettings, MetaInfo);
            measurementSet[i] = this.measureMatch(MatchRoot);
        }
        let flattenedResults : number[][] = this.flattenMeasurementSet(measurementSet);
        return new MResults(this.metricInfo, S.VERSION, FormatSettings, metaType, numMatches, flattenedResults);
    }
}


// ===== Individual metrics =====


// A metric for average match length
class matchLengthMetric extends metric {
    static metricInfo : MetricInfo = new MetricInfo("Match Length Distribution", "Match Length", "Probability");
    static propertyName : string = "matchLength";

    static measureMatch(MatchRoot : HearthNash.matchRoot) : number[][] {
        Formats.GMetaInfo = MatchRoot.MetaInfo;
        let distrLength = MatchRoot.FormatSettings.gamesToWin * 2;
        let lengthProbabilities : number[] = HN_Utility.tabulate(distrLength, (i) => 0);
        Metrics_Utility.sumDistrInPlace(lengthProbabilities, this.measureMatchV(MatchRoot, distrLength));
        HN_Utility.verifySum(lengthProbabilities, 1);
        let formattedResults = HN_Utility.tabulate(lengthProbabilities.length, (i) => [i, lengthProbabilities[i]]);
        return formattedResults;
    }

    // Recurses on match vertices to measure match length probability distribution.
    // Adds a property to each node once it has been computed to avoid recomputation.
    static measureMatchV(node : HearthNash.vertex, distrLength : number) : number[] {
        // First check if this node has already been computed
        if (node[this.propertyName]) {
            return node[this.propertyName];
        }

        // Outcome case
        if (node.vertexType === new HearthNash.outcomeVertex().vertexType) {
            let length = node.wins[S.P0] + node.wins[S.P1];
            if (length >= distrLength) {
                throw new Error("length exceeded preset lengthProbabilities array bounds");
            }
            node[this.propertyName] = HN_Utility.tabulate(distrLength, (i) => (i == length) ? 1 : 0);
            return node[this.propertyName];
        } else if (node.children === null || node.children.length === 0) {
            throw new Error("No children on HearthNash.vertex: " + node);
        }

        // Game case
        if (node.vertexType === new HearthNash.gameVertex().vertexType) {
            if (node.children.length !== 2) {
                throw new Error("Game vertex doesn't have exactly 2 children.");
            }
            let probability = Formats.GMetaInfo.winrates[node.currentDecks[S.P0]][node.currentDecks[S.P1]];
            node[this.propertyName] = HN_Utility.tabulate(distrLength, (i) => 0);
            Metrics_Utility.sumDistrInPlace(node[this.propertyName], this.measureMatchV(node.children[S.P0], distrLength), probability);
            Metrics_Utility.sumDistrInPlace(node[this.propertyName], this.measureMatchV(node.children[S.P1], distrLength), 1 - probability);
            return node[this.propertyName];
        }

        // Strategic (recursive) case
        let optimalStrats = node.optimalStrategies;
        if (optimalStrats) {
            let childCounter = 0;
            node[this.propertyName] = HN_Utility.tabulate(distrLength, (i) => 0);
            for (let i=0; i < optimalStrats[S.P0].length; i++) {
                let p0StratProb = optimalStrats[S.P0][i];
                for (let j=0; j < optimalStrats[S.P1].length; j++) {
                    Metrics_Utility.sumDistrInPlace(node[this.propertyName], this.measureMatchV(node.children[childCounter++], distrLength), p0StratProb * optimalStrats[S.P1][j]);
                }
            }
            if (childCounter != node.children.length) {
                throw new Error("Didn't iterate over all children based on optimal strats");
            }
            return node[this.propertyName];
        }

        // Default case - Exactly one child
        if (node.children.length !== 1) {
            console.log(node);
            throw new Error("Multiple children, but optimal strategies not accounted for.");
        }
        node[this.propertyName] = this.measureMatchV(node.children[0], distrLength);
        return node[this.propertyName];
    }

    static flattenMeasurementSet(measurementSet : number[][][]) : number[][] {
        let numMatches = measurementSet.length;
        let flattenedMeasure = HN_Utility.tabulate(measurementSet[0].length, (i) => [i, 0]);
        for (let j=0; j < measurementSet[0].length; j++) {
            for (let i=0; i < measurementSet.length; i++) {
                flattenedMeasure[j][1] += measurementSet[i][j][1];
            }
            flattenedMeasure[j][1] /= numMatches;
        }
        return flattenedMeasure;
    }
}


// A metric for sensitivity to skill level across all decks.
class skillSensitivityWideMetric extends metric {
    static metricInfo : MetricInfo = new MetricInfo("Skill Sensitivity (Wide)", "Epsilon Matchup Winrates", "Delta Match Victory Probability");
    static propertyName : string = "skillSensitivityWide";

    static epsilonMatchupWinrate : number[] = [0.0025, 0.005, 0.01, 0.02, 0.04, 0.08, 0.16];

    static measureMatch(MatchRoot : HearthNash.matchRoot) : number[][] {
        let deltaVictoryProbs : number[] = HN_Utility.tabulate(this.epsilonMatchupWinrate.length, (i) => 0);
        for (let i=0; i < this.epsilonMatchupWinrate.length; i++) {
            // Give P0 the skill boost
            deltaVictoryProbs[i] += this.deltaVictFromEpsilonSkill(MatchRoot, this.epsilonMatchupWinrate[i], S.P0) / 2;
            // Give P1 the skill boost
            deltaVictoryProbs[i] += this.deltaVictFromEpsilonSkill(MatchRoot, -1 * this.epsilonMatchupWinrate[i], S.P1) / 2;
        }
        // Format the results
        let formattedResults = HN_Utility.tabulate(deltaVictoryProbs.length, (i) => [this.epsilonMatchupWinrate[i], deltaVictoryProbs[i]]);
        return formattedResults;
    }

    // Generates a new match tree with a skill boost for one player, and returns their delta victory probability
    static deltaVictFromEpsilonSkill(MatchRoot : HearthNash.matchRoot, epsilon : number, player : number) : number {
        let winratesAdj : number[][] = this.adjustWinrates(MatchRoot.MetaInfo.winrates, epsilon);
        let newMetaInfo : Formats.metaInfo = new Formats.metaInfo(winratesAdj);
        let newStartingDecks : number[][] = HN_Utility.deepCopyArray(MatchRoot.decksRemaining);
        for (let i=0; i < newStartingDecks[S.P1].length; i++) {
            newStartingDecks[S.P1][i] += MatchRoot.MetaInfo.winrates.length;
        }
        let newMatchRoot : HearthNash.matchRoot = HearthNash.evaluateMatch(newStartingDecks, MatchRoot.FormatSettings, newMetaInfo);
        return newMatchRoot.victoryProbabilities[player] - MatchRoot.victoryProbabilities[player];
    }

    // Adjusts a winrate matrix using a given epsilon and returns the new matrix
    static adjustWinrates(winrates : number[][], epsilon : number) : number[][] {
        let newWinrates : number[][] = HN_Utility.tabulate(winrates.length * 2, (r) => HN_Utility.tabulate(winrates.length * 2, (c) => null));
        // Top left & bottom right quadrants
        for (let r=0; r < winrates.length; r++) {
            for (let c=0; c < winrates[r].length; c++) {
                newWinrates[r][c] = winrates[r][c];
                newWinrates[r + winrates.length][c + winrates.length] = winrates[r][c];
            }
        }
        // Top right and bottom left quadrants
        for (let r=0; r < winrates.length; r++) {
            for (let c=0; c < winrates[r].length; c++) {
                newWinrates[r][c + winrates.length] = winrates[r][c] + epsilon;
                newWinrates[r][c + winrates.length] = Math.max(0, Math.min(1, newWinrates[r][c + winrates.length]));
                newWinrates[r + winrates.length][c] = winrates[r][c] - epsilon;
                newWinrates[r + winrates.length][c] = Math.max(0, Math.min(1, newWinrates[r + winrates.length][c]));
            }
        }
        return newWinrates;
    }

    static flattenMeasurementSet(measurementSet : number[][][]) : number[][] {
        let numMatches = measurementSet.length;
        let flattenedMeasure = HN_Utility.tabulate(measurementSet[0].length, (i) => [this.epsilonMatchupWinrate[i], 0]);
        for (let j=0; j < measurementSet[0].length; j++) {
            for (let i=0; i < measurementSet.length; i++) {
                flattenedMeasure[j][1] += measurementSet[i][j][1];
            }
            flattenedMeasure[j][1] /= numMatches;
        }
        return flattenedMeasure;
    }
}


// A metric for sensitivity to skill level on a single deck.
class skillSensitivityTallMetric extends metric {
    static metricInfo : MetricInfo = new MetricInfo("Skill Sensitivity (Tall)", "Epsilon Matchup Winrates", "Delta Match Victory Probability");
    static propertyName : string = "skillSensitivityTall";

    static epsilonMatchupWinrate : number[] = [0.0025, 0.005, 0.01, 0.02, 0.04, 0.08, 0.16];

    static measureMatch(MatchRoot : HearthNash.matchRoot) : number[][] {
        let deltaVictoryProbs : number[] = HN_Utility.tabulate(this.epsilonMatchupWinrate.length, (i) => 0);
        for (let i=0; i < this.epsilonMatchupWinrate.length; i++) {
            // Give P0 the skill boost
            for (let deck of MatchRoot.decksRemaining[S.P0]) {
                deltaVictoryProbs[i] += this.deltaVictFromEpsilonSkill(MatchRoot, this.epsilonMatchupWinrate[i], S.P0, deck) / (2 * MatchRoot.decksRemaining[S.P0].length);
            }
            // Give P1 the skill boost
            for (let deck of MatchRoot.decksRemaining[S.P1]) {
                deltaVictoryProbs[i] += this.deltaVictFromEpsilonSkill(MatchRoot, this.epsilonMatchupWinrate[i], S.P1, deck) / (2 * MatchRoot.decksRemaining[S.P1].length);
            }
        }
        // Format the results
        let formattedResults = HN_Utility.tabulate(deltaVictoryProbs.length, (i) => [this.epsilonMatchupWinrate[i], deltaVictoryProbs[i]]);
        return formattedResults;
    }

    // Generates a new match tree with a skill boost for one player, and returns their delta victory probability
    static deltaVictFromEpsilonSkill(MatchRoot : HearthNash.matchRoot, epsilon : number, player : number, deck : number) : number {
        let winratesAdj : number[][] = this.adjustWinrates(MatchRoot.MetaInfo.winrates, epsilon, player, deck);
        let newMetaInfo : Formats.metaInfo = new Formats.metaInfo(winratesAdj);
        let newStartingDecks : number[][] = HN_Utility.deepCopyArray(MatchRoot.decksRemaining);
        for (let i=0; i < newStartingDecks[S.P1].length; i++) {
            newStartingDecks[S.P1][i] += MatchRoot.MetaInfo.winrates.length;
        }
        let newMatchRoot : HearthNash.matchRoot = HearthNash.evaluateMatch(newStartingDecks, MatchRoot.FormatSettings, newMetaInfo);
        return newMatchRoot.victoryProbabilities[player] - MatchRoot.victoryProbabilities[player];
    }

    // Adjusts a winrate matrix using a given epsilon and returns the new matrix
    static adjustWinrates(winrates : number[][], epsilon : number, player : number, deck : number) : number[][] {
        let winLen : number = winrates.length;
        if (player === S.P1) {
            deck += winLen;
        }
        let newWinrates : number[][] = HN_Utility.tabulate(winLen * 2, (r) => HN_Utility.tabulate(winLen * 2, (c) => null));
        // Set all 4 quadrants at once
        for (let r=0; r < winLen * 2; r++) {
            for (let c=0; c < winLen * 2; c++) {
                newWinrates[r][c] = winrates[r % winLen][c % winLen];
                // Check for the row/col corresponding to player and deck
                if (c === deck) {
                    newWinrates[r][c] -= epsilon;
                }
                if (r === deck) {
                    newWinrates[r][c] += epsilon;
                }
                newWinrates[r][c] = Math.max(0, Math.min(1, newWinrates[r][c]));
            }
        }
        return newWinrates;
    }

    static flattenMeasurementSet(measurementSet : number[][][]) : number[][] {
        let numMatches = measurementSet.length;
        let flattenedMeasure = HN_Utility.tabulate(measurementSet[0].length, (i) => [this.epsilonMatchupWinrate[i], 0]);
        for (let j=0; j < measurementSet[0].length; j++) {
            for (let i=0; i < measurementSet.length; i++) {
                flattenedMeasure[j][1] += measurementSet[i][j][1];
            }
            flattenedMeasure[j][1] /= numMatches;
        }
        return flattenedMeasure;
    }
}




// ===== MODULE EXPORTS =====
module.exports.MResults = MResults;
module.exports.matchLengthMetric = matchLengthMetric;
module.exports.skillSensitivityWideMetric = skillSensitivityWideMetric;
module.exports.skillSensitivityTallMetric = skillSensitivityTallMetric;
