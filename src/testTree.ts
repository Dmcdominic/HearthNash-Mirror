// ===== Testing and open workspace =====

// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");


// Format settings and match info setup.
let winrates = [ [ 0.5,  0.6,  0.4,  0.55 ],
                 [ 0.4,  0.5,  0.6, 0.55 ],
                 [ 0.6,  0.4,  0.5, 0.55 ],
                 [ 0.45, 0.45, 0.45,  0.5 ]];

let FormatSettings = new Formats.formatSettings();
let MetaInfo = new Formats.metaInfo(winrates);
FormatSettings.protectsTotal = 1;
FormatSettings.bansTotal = 1;
FormatSettings.gamesToWin = 2;
FormatSettings.decksPerPlayer = 3;


// Test the match tree generation
console.log("\n\n===== STARTING FULL MATCH TEST ======\n");
let fullMatchTest = HearthNash.evaluateMatch([[1, 2, 3], [0, 1, 2]], FormatSettings, MetaInfo);
console.log("Full Match Test results:");
console.log(fullMatchTest);


// Metrics testing
console.log("\n\n===== STARTING METRICS TESTING ======\n");
let numMatches = 10;

let startTime = new Date();
let mResults : Metrics.MResults = Metrics.matchLengthMetric.measureMatchSet(Formats.CORE_FORMATS.SHIELD_PHASE_CONQUEST_BO5, numMatches, Metrics_Utility.META_TYPE.PURE_RANDOM);
console.log(mResults);
// drawChart(mResults);

let endTime = new Date();
console.log("Time for first metrics test: " + HN_Utility.diff_seconds(endTime, startTime) + " second(s)");


console.log("\n\n===== METRICS TESTING 2 ======\n");
startTime = new Date();
// let fS = new Formats.formatSettings(true, false, true, true, 0, 0, 2, 3);
let mResults2 : Metrics.MResults = Metrics.matchLengthMetric.measureMatchSet(Formats.CORE_FORMATS.LAST_HERO_STANDING_BO5, numMatches, Metrics_Utility.META_TYPE.PURE_RANDOM);
console.log(mResults2);
// drawChart(mResults2);

endTime = new Date();
console.log("Time for second metrics test: " + HN_Utility.diff_seconds(endTime, startTime) + " second(s)\n");


// console.log("\n\n===== COMPARISON =====\n");
// drawComparisonChart([mResults, mResults2]);
