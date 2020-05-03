// ===== Utility functions to assist with metrics =====

// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");


// ==== Winrate Matrix Sets ====

// An enum for different meta types, corresponding to winrate set options
const META_TYPE = {
    PURE_RANDOM: 0,
    LEGEND_RANK10: 1,
    RANK11_Rank20: 2
}

// Returns a set of winrate matrices with dimensions n x n, based on the META_TYPE option passed in.
//   metaType must be a META_TYPE enum.
function getWinrateMatrixSet(n : number, numMatrices : number, metaType : number) : number[][][] {
    switch (metaType) {
        case META_TYPE.PURE_RANDOM:
            return HN_Utility.tabulate(numMatrices, (i) => getPureRandomWinrateMatrix(n));
        default:
            throw new Error("No getWinrateMatrixSet() case for metaType: " + metaType);
    }
}

// Returns a completely random winrate matrix, with dimensions n x n.
//   (In row-major order)
function getPureRandomWinrateMatrix(n : number) : number[][] {
    let winrates : number[][] = [];
    for (let r = 0; r < n; r++) {
        winrates.push([]);
        for (let c = 0; c < n; c++) {
            if (c == r) {
                winrates[r].push(0.5);
            } else if (c > r) {
                winrates[r].push(HN_Utility.pseudorandom());
            } else {
                winrates[r].push(1 - winrates[c][r]);
            }
        }
    }
    return winrates;
}


// Sums two probability distributions together, and places the result in the first distribution
function sumDistrInPlace(distrDest : number[], distr2 : number[], factor : number = 1) : void{
    if (distrDest.length != distr2.length) {
        throw new Error("Distributions are of unequal length.");
    }
    for (let i=0; i < distrDest.length; i++) {
        distrDest[i] += distr2[i] * factor;
    }
}



// ===== MODULE EXPORTS =====
module.exports.META_TYPE = META_TYPE;
module.exports.getWinrateMatrixSet = getWinrateMatrixSet;
module.exports.sumDistrInPlace = sumDistrInPlace;
