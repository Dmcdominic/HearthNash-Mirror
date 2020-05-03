// ===== Utility functions such as array operations and the game matrix solver =====

// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");


// Deep copies a nested array
// From: https://blog.andrewray.me/how-to-clone-a-nested-array-in-javascript/
function deepCopyArray(arr : any[]) : any[] {
    if (Array.isArray(arr)) {
        let copy = arr.slice(0);
        for (let i=0; i < copy.length; i++) {
            copy[i] = deepCopyArray(copy[i]);
        }
        return copy;
    } else if( typeof arr === 'object' ) {
        throw 'Cannot clone array containing an object!';
    } else {
        return arr;
    }
}

// Removes all instances of an element from an array
function removeFromArray(arr : any[], remove : any) : any[] {
    return arr.filter(function(elem) {
        return elem != remove;
    });
}
// Removes all instances of all elements in an "exclusion" array from a starting array
function removeManyFromArray(arr : any[], exclusions : any[]) : any[] {
    return arr.filter(function(elem) {
        return !(exclusions.indexOf(elem) >= 0);
        // return !(exclusions.includes(elem));
    });
}

// Returns a new array with length <total>, where element 0 <= i < total is f(i)
function tabulate(total : number, f) : any[] {
    let newArray = new Array(total);
    for (let i = 0; i < total; i++) {
        newArray[i] = f(i);
    }
    return newArray;
}


// Returns the set of all possible subsets of a certain size
function subsets(set : any[], size : number, minIndex : number = 0) : any[][] {
    let setLength = set.length - minIndex;
    if (size === 0) {
        return [[]];
    } else if (size < 0 || size > setLength) {
        return [];
    }

    let nextItem = set[minIndex];
    let included : any[][] = subsets(set, size - 1, minIndex + 1);
    let excluded : any[][] = subsets(set, size, minIndex + 1);
    for (let i = 0; i < included.length; i++) {
        included[i].unshift(nextItem);
    }
    return included.concat(excluded);
}


// Solves an N x M game.
// Algorithm source - https://www.math.ucla.edu/~tom/Game_Theory/mat.pdf [Section 4.5]
function solveNxM(payoffs : number[][]) {
    // ----- SETUP -----
    let numRows : number = payoffs.length;
    let numCols : number = payoffs[0].length;
    // Check for well-formed payoff matrix
    if (numRows < 1 || numCols < 1) {
        throw new Error("Payoffs matrix empty or malformed");
    }
    for (let r = 1; r < numRows; r++) {
        if (payoffs[r].length != numCols) {
            throw new Error("Payoffs matrix empty or malformed");
        }
    }

    // Each element is a tuple [isRow : boolean, index : number]
    //  - isRow is true iff it is a row label (and false iff it is a col label)
    //  - index is the 0-indexed label for the row/col
    let row_labels : [boolean, number][] = tabulate(numRows, (i) => [true, i]);
    let col_labels : [boolean, number][] = tabulate(numCols, (i) => [false, i]);

    // ----- STEP 1 -----
    // Add a constant to ensure non-negative values.
    let matrix = deepCopyArray(payoffs);
    let min_val = 0;
    // Determine the minimum (non-positive) entry
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            min_val = Math.min(min_val, matrix[r][c]);
        }
    }
    // Add at least enough to every entry to make them positive
    let fixed_val_to_add = 1 - min_val;
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            matrix[r][c] += fixed_val_to_add;
        }
    }

    // ----- STEP 2 -----
    // Create the tableau
    for (let r = 0; r < numRows; r++) {
        matrix[r].push(1);
    }

    let lowerBorder : number[] = tabulate(numCols, (i) => -1);
    lowerBorder.push(0);
    matrix.push(lowerBorder);

    if (S.VERBOSITY > 9) {
        logArray(matrix, "Before pivot:");
    }

    // ----- STEPS 3-6 LOOP -----
    let p = -1, q = 0; // Pivot row and column indices
    while (q >= 0) {
        // ----- STEP 3 -----
        // Select the pivot row (column q has been chosen)
        let candidate_rows : number[] = new Array();
        let ratios : number[] = new Array();
        for (let r = 0; r < numRows; r++) {
            // --- b --- The pivot itself must be positive
            const POSITIVE_PIVOT_EPSILON = 0.0000000001;
            if (matrix[r][q] > POSITIVE_PIVOT_EPSILON) {
                candidate_rows.push(r);
                if (Math.abs(matrix[r][numCols]) < POSITIVE_PIVOT_EPSILON) {
                    matrix[r][numCols] = 0;
                }
                ratios.push(matrix[r][numCols] / matrix[r][q]);
            }
        }
        if (candidate_rows.length < 1) {
            console.log(matrix);
            throw new Error("No candidate rows found. This indicates an implementation error, or unexpected payoff input.");
        }
        // --- c --- Pick the row with the smallest ratio
        p = candidate_rows[0];
        let min_ratio = ratios[0];
        for (let i = 0; i < candidate_rows.length; i++) {
            if (ratios[i] < min_ratio) {
                p = candidate_rows[i];
                min_ratio = ratios[i];
            }
        }
        if (min_ratio < 0) {
            throw new Error("Negative ratio found: " + min_ratio + ". This indicates an implementation error, or unexpected payoff input.");
        }

        // ----- STEP 4 -----
        // Carry out the pivot
        let newMatrix = deepCopyArray(matrix);
        let invPivot = 1 / matrix[p][q];
        for (let r = 0; r < numRows + 1; r++) {
            for (let c = 0; c < numCols + 1; c++) {
                if (r == p && c == q) { // --- d ---
                    newMatrix[r][c] = invPivot;
                } else if (r == p) { // --- b ---
                    newMatrix[r][c] = matrix[r][c] * invPivot;
                } else if (c == q) { // --- c ---
                    newMatrix[r][c] = matrix[r][c] * invPivot * (-1);
                } else { // --- a ---
                    newMatrix[r][c] = matrix[r][c] - (matrix[r][q] * matrix[p][c] * invPivot);
                }
            }
        }
        matrix = newMatrix;

        if (S.VERBOSITY > 9) {
            logArray(matrix, "After pivot:");
        }

        // ----- STEP 5 -----
        // Exchange the row and column label
        let p_label : [boolean, number] = row_labels[p];
        row_labels[p] = col_labels[q];
        col_labels[q] = p_label;

        // ----- STEP 6 -----
        // Repeat 3-6, iff there are any negative numbers in lower border row
        q = -1;
        for (let c = 0; c < numCols; c++) {
            if (matrix[numRows][c] < 0) {
                // --- (3) a --- Pick a column with a negative number in bottom border
                q = c;
                break;
            }
        }
    }

    // ----- STEP 7 -----
    // Read the expected value and optimal strategies from the resulting matrix
    let invBorderCorner : number = 1 / matrix[numRows][numCols];
    let expectedValue : number = invBorderCorner - fixed_val_to_add; // --- a ---

    let p0Strategy : number[] = tabulate(numRows, (i) => 0);
    let p1Strategy : number[] = tabulate(numCols, (i) => 0);
    for (let c = 0; c < numCols; c++) { // --- b ---
        let label : [boolean, number] = col_labels[c];
        if (label[0]) {
            p0Strategy[label[1]] = matrix[numRows][c] * invBorderCorner;
        }
    }
    for (let r = 0; r < numRows; r++) { // --- c ---
        let label : [boolean, number] = row_labels[r];
        if (!label[0]) {
            p1Strategy[label[1]] = matrix[r][numCols] * invBorderCorner;
        }
    }

    if (S.VERIFY) {
        // Verify that each strategy sums to approx. 1
        const SUM_CHECK_EPSILON : number = 0.0000001;
        let p0Sum = 0, p1Sum = 0;
        for (let i = 0; i < p0Strategy.length; i++) {
            p0Sum += p0Strategy[i];
        }
        for (let i = 0; i < p1Strategy.length; i++) {
            p1Sum += p1Strategy[i];
        }
        if (Math.abs(p0Sum - 1) > SUM_CHECK_EPSILON || Math.abs(p1Sum - 1) > SUM_CHECK_EPSILON) {
            throw new Error("A resulting strategy did not sum to 1. \np0Sum: " + p0Sum + "\np1Sum: " + p1Sum);
        }

        // Assert that the resulting strategies are optimal, if S.VERIFY is enabled
        Test_Utility.assertOptimalStrategy(payoffs, p0Strategy, p1Strategy);
    }

    // Outcome is one (out of possibly many) optimal strategy for each player
    return {
        expectedValue: expectedValue,
        p0Strategy: p0Strategy,
        p1Strategy: p1Strategy
    };
}

// Verifies that the elements in a number array sum to the expected val
function verifySum(array : number[], expectedSum : number) {
    if (S.VERIFY) {
        let sum = 0;
        for (let i=0; i < array.length; i++) {
            sum += array[i];
        }
        const SUM_CHECK_EPSILON = 0.00000001;
        if (Math.abs(sum - expectedSum) > SUM_CHECK_EPSILON) {
            throw new Error("Array expected to sum to: " + expectedSum);
        }
    }
}

// Logs a 2D array to the console, along with optional prefix message
function logArray(arr : any[][], msg = "") : void {
    if (msg) {
        console.log(msg);
    }
    let N = arr.length;
    let M = arr[0].length;
    for (let r = 0; r < N; ++r) {
        let row = "";
        for (let c = 0; c < M; ++c) {
            if (row != "") row += ", ";
            row += arr[r][c].toString();
        }
        console.log((r == 0 ? "[[ " : " [ ") + row + (r + 1 == N ? " ]]" : " ],"));
    }
}


// ==== String utilities ====
function formatSettingsToString(FS : Formats.formatSettings) : string {
    if (FS.name) return FS.name;

    return b2s(FS.removeWinnerDeck) + b2s(FS.removeLoserDeck) + " " +
    b2s(FS.winnerCanSwitch) + b2s(FS.loserCanSwitch) +
    " - " +
    "P" + FS.protectsTotal + "B" + FS.bansTotal +
    " G" + FS.gamesToWin + "D" + FS.decksPerPlayer;
}
function b2s(bool : boolean) : string {
    return bool ? 'T' : 'F';
}

function mResultsToTitle(mResults : Metrics.MResults, preName : boolean) : string {
    let prefixStr : string = preName ? mResults.metricInfo.title + " " : "";
    return prefixStr + "(" + formatSettingsToString(mResults.FormatSettings) + " / M" + mResults.metaType + ") [n=" + mResults.numMatches + "]";
}


// ==== Timer utilities ====
function diff_seconds(date2 : Date, date1 : Date) : number {
    let diff = (date2.getTime() - date1.getTime()) / 1000;
    return Math.abs(Math.round(diff));
}


// ==== General utilities ====

// Returns true iff each object's properties (with depth of 1) are equal.
// Source - http://adripofjavascript.com/blog/drips/object-equality-in-javascript.html
function shallowObjectEquivalence(obj1 : Object, obj2 : Object) : boolean {
    if (obj1 === null || obj2 === null) {
        return obj1 === obj2;
    }

    let props1 = Object.getOwnPropertyNames(obj1);
    let props2 = Object.getOwnPropertyNames(obj2);

    // If number of properties is different, objects are not equivalent
    if (props1.length != props2.length) {
        return false;
    }

    for (let i = 0; i < props1.length; i++) {
        let propName = props1[i];
        // If values of same property are not equal, objects are not equivalent
        if (obj1[propName] !== obj2[propName]) {
            return false;
        }
    }

    // Otherwise, objects are equivalent
    return true;
}


// ==== Random Number Utilities ====
const MT_SEED = 93413731;
import MersenneTwister = require('mersenne-twister');
let MT_Generator = new MersenneTwister(MT_SEED);

// Returns a pseudorandom number on [0, 1) real interval (same interval as Math.random)
// See https://www.npmjs.com/package/mersenne-twister
function pseudorandom() : number {
    return MT_Generator.random();
}
// Returns a random int on [0, 4294967295] interval.
function pseudorandom_int() : number {
    return MT_Generator.random_int();
}

// Returns a random element from an array.
function randArrayElement(array : any[], generator = null) : any {
    generator = (generator ? generator : MT_Generator);
    return array[Math.floor(array.length * generator.random())];
}

// Returns a new Mersenne Twister with the given seed,
//   or chooses a random seed for you if none is supplied.
function getTwister(seed : number) : object {
    return new MersenneTwister(seed ? seed : MT_Generator.random_int());
}



// ===== MODULE EXPORTS =====
module.exports.deepCopyArray = deepCopyArray;
module.exports.removeFromArray = removeFromArray;
module.exports.removeManyFromArray = removeManyFromArray;
module.exports.tabulate = tabulate;
module.exports.subsets = subsets;
module.exports.solveNxM = solveNxM;
module.exports.verifySum = verifySum;
module.exports.mResultsToTitle = mResultsToTitle;
module.exports.diff_seconds = diff_seconds;
module.exports.pseudorandom = pseudorandom;
module.exports.pseudorandom_int = pseudorandom_int;
module.exports.randArrayElement = randArrayElement;
module.exports.getTwister = getTwister;
