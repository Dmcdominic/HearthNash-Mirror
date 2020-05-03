// ===== Functions to get data from raw matchup json all the way to analysis results =====

// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");

import IO_Utility = require('../lib/IO_Utility.js');
import RawData_Utility = require("../lib/RawData_Utility.js");



// --- Constants ---
const DEFAULT_TREES_PER_INFO : number = 30;
const ARCHIVE_SAMPLE_SIZES : number[] = [ 1, 5, 10, 20, 40 ];
const ARCHIVE_ITERATIONS : number = 10;


// --- Functions ---

// Processes all raw matchup data (from HSReplay) to metaInfo objects, and saves them to file.
//   Processes all of those metaInfo objects into matchTrees for every single core format.
function fullRealMetaProcessing(numTreesPerInfo : number = null) {
    // Raw data to metaInfo
    RawData_Utility.processAllRawData();
    // metaInfo to match trees
    processAllMetaInfoToMatchTrees(numTreesPerInfo);
    // Match trees to metrics
    processAllRealDataMetrics();
}


// Processes all raw matchup data through the pipeline, then saves a copy of the
//   analyses to an archive, and repeats (for multiple sample sizes).
function fullRealMetaProcessAndArchive(iterations : number = null) : void {
    iterations = (iterations ? iterations : ARCHIVE_ITERATIONS);
    console.log("Processing and Archiving All Real Data Over " + iterations + " Iterations");
    console.log("Sample sizes: " + ARCHIVE_SAMPLE_SIZES + "\n");
    for (let i=0; i < iterations; i++) {
        for (let s = 0; s < ARCHIVE_SAMPLE_SIZES.length; s++) {
            let sampleSize : number = ARCHIVE_SAMPLE_SIZES[s];
            console.log("===== Processing and Archiving All Real Data - Sample Size " + sampleSize + " - Iteration " + i + " =====");
            IO_Utility.rmTransientDirs();
            fullRealMetaProcessing(sampleSize);
            IO_Utility.cpAnalysisDir(sampleSize, i);
        }
    }
}


// Processes the metaInfo saved to file for ALL metaTypes corresponding to real data,
//   generates the corresponding match trees under every format, and saves them to file.
function processAllMetaInfoToMatchTrees(numTreesPerInfo : number = null) {
    console.log("===== Processing All metaInfo to Match Trees =====");
    let dataPathsKeys : string[] = Object.keys(RawData_Utility.RAW_MATCHUP_DATA_PATHS);
    for (let k=0; k < dataPathsKeys.length; k++) {
        let metaType : number = parseInt(dataPathsKeys[k]);
        console.log("Processing metaInfo for metaType: " + dataPathsKeys[k]);
        processMetaInfoToMatchTrees(metaType, numTreesPerInfo);
    }
}


// Iterates over all metaInfo files that have been saved (for a given metaType),
//   and generates match trees for each one under each format, then saves those to file.
function processMetaInfoToMatchTrees(metaType : number, numTreesPerInfo : number = null) : void {
    numTreesPerInfo = (numTreesPerInfo ? numTreesPerInfo : DEFAULT_TREES_PER_INFO);
    let pathsToMetaInfo = IO_Utility.getPathsMetaInfo(metaType);

    // First, check what the max number of decks is that any format will need.
    let maxDecks : number = 3;
    let coreFormatKeys : string[] = Object.keys(Formats.CORE_FORMATS);
    for (let f=0; f < coreFormatKeys.length; f++) {
        let format = Formats.CORE_FORMATS[coreFormatKeys[f]];
        maxDecks = Math.max(maxDecks, format.decksPerPlayer);
    }

    // Now for each metaInfo object, and each format, generate the tree.
    for (let i=0; i < pathsToMetaInfo.length; i++) {
        let MetaInfo : Formats.metaInfo = IO_Utility.loadMetaInfo(pathsToMetaInfo[i]);
        if (maxDecks > MetaInfo.winrates.length) {
            throw new Error("Not enough decks in metaInfo object to satisfy all formats.");
        }

        let twister = HN_Utility.getTwister(MetaInfo.seed);
        let deckPool : number[] = HN_Utility.tabulate(MetaInfo.winrates.length, (i) => i);

        for (let t=0; t < numTreesPerInfo; t++) {
            // Pre-determine two random subsets for each possible number of decks.
            let deckSubsets : number[][][] = HN_Utility.tabulate(maxDecks + 1, (numDecks) => HN_Utility.subsets(deckPool, numDecks));
            let p0DeckSets : number[][] = HN_Utility.tabulate(maxDecks + 1, (numDecks) => HN_Utility.randArrayElement(deckSubsets[numDecks], twister));
            let p1DeckSets : number[][] = HN_Utility.tabulate(maxDecks + 1, (numDecks) => HN_Utility.randArrayElement(deckSubsets[numDecks], twister));
            // For each format, generate a match tree using those deck choices.
            for (let f=0; f < coreFormatKeys.length; f++) {
                let format = Formats.CORE_FORMATS[coreFormatKeys[f]];
                console.log("Generating match tree for metaType: " + MetaInfo.metaType + ", in format: " + format.name);
                let decks : number[][] = [p0DeckSets[format.decksPerPlayer], p1DeckSets[format.decksPerPlayer]];
                let matchRoot : HearthNash.matchRoot = HearthNash.evaluateMatch(decks, format, MetaInfo);
                IO_Utility.saveMatchTree(matchRoot, t);
            }
        }
    }
}


// Generates and saves to file the metrics on every format setting for every real data metaType
function processAllRealDataMetrics() {
    console.log("===== Processing All Real Data Metrics =====");
    let coreFormatKeys : string[] = Object.keys(Formats.CORE_FORMATS);
    let dataPathsKeys : string[] = Object.keys(RawData_Utility.RAW_MATCHUP_DATA_PATHS);
    for (let f=0; f < coreFormatKeys.length; f++) {
        let format = Formats.CORE_FORMATS[coreFormatKeys[f]];
        for (let k=0; k < dataPathsKeys.length; k++) {
            let metaType : number = parseInt(dataPathsKeys[k]);
            Metrics.matchLengthMetric.measureTreesFromFile(format, metaType, 0);
            Metrics.skillSensitivityWideMetric.measureTreesFromFile(format, metaType, 0);
            Metrics.skillSensitivityTallMetric.measureTreesFromFile(format, metaType, 0);
            // TODO - add other metrics here AND in condenseAllRealDataMetrics()
        }
    }
    // For each metric, condense the results into a single .csv
    condenseAllRealDataMetrics();
}


// For each metric, condense the results into a single .csv
function condenseAllRealDataMetrics() : void {
    console.log("===== Condensing All Real Data Metrics =====");
    let dataPathsKeys : string[] = Object.keys(RawData_Utility.RAW_MATCHUP_DATA_PATHS);
    for (let k=0; k < dataPathsKeys.length; k++) {
        let metaType : number = parseInt(dataPathsKeys[k]);
        IO_Utility.condenseRealDataMetrics(Metrics.matchLengthMetric.metricInfo, metaType);
        IO_Utility.condenseRealDataMetrics(Metrics.skillSensitivityWideMetric.metricInfo, metaType);
        IO_Utility.condenseRealDataMetrics(Metrics.skillSensitivityTallMetric.metricInfo, metaType);
        // TODO - add other metrics here AND in processAllRealDataMetrics
    }
}





// ===== MODULE EXPORTS =====
module.exports.fullRealMetaProcessing = fullRealMetaProcessing;
module.exports.processMetaInfoToMatchTrees = processMetaInfoToMatchTrees;
module.exports.fullRealMetaProcessAndArchive = fullRealMetaProcessAndArchive;
module.exports.condenseAllRealDataMetrics = condenseAllRealDataMetrics;
