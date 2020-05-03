// ===== Utility functions for testing match trees and game matrix solutions =====

// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');


// Constants
const RAND_STRAT_COMPARISONS : number = 20;


// Takes in a payoff matrix, and a strategy for each player, and returns the expected value.
function getExpectedValue(payoffs : number[][], p0Strategy : number[], p1Strategy : number[]) : number {
  let numRows : number = p0Strategy.length;
  let numCols : number = p1Strategy.length;
  // Check for well-formed payoff matrix
  if ((payoffs.length != numRows) || numRows < 1 || numCols < 1) {
    throw new Error("Payoffs matrix empty or malformed");
  }
  for (let r = 0; r < numRows; r++) {
    if (payoffs[r].length != numCols) {
      throw new Error("Payoffs matrix empty or malformed");
    }
  }

  // Get expected value
  let expectedVal : number = 0;
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      expectedVal += p0Strategy[r] * p1Strategy[c] * payoffs[r][c];
    }
  }

  return expectedVal;
}


// Takes in a payoff matrix, and a (supposedly optimal) strategy for each player.
// Then randomly picks alternative strategies and asserts that the expected outcome is worse.
function assertOptimalStrategy(payoffs : number[][], p0Strategy : number[], p1Strategy : number[]) : void {
  let numRows : number = p0Strategy.length;
  let numCols : number = p1Strategy.length;
  // Check for well-formed payoff matrix
  if ((payoffs.length != numRows) || numRows < 1 || numCols < 1) {
    throw new Error("Payoffs matrix empty or malformed");
  }
  for (let r = 0; r < numRows; r++) {
    if (payoffs[r].length != numCols) {
      throw new Error("Payoffs matrix empty or malformed");
    }
  }

  // Check the "optimal" expectedVal
  let optExpectedVal : number = getExpectedValue(payoffs, p0Strategy, p1Strategy);

  // Loop: Choose a random alternative strat and assert that this one is better (for each player)
  for (let strat = 0; strat < RAND_STRAT_COMPARISONS; strat++) {
    let randP0Strat = getRandomStrat(p0Strategy.length);
    let altP0ExpectedVal = getExpectedValue(payoffs, randP0Strat, p1Strategy);

    let randP1Strat = getRandomStrat(p1Strategy.length);
    let altP1ExpectedVal = getExpectedValue(payoffs, p0Strategy, randP1Strat);

    const NEAR_OPTIMAL_EPSILON : number = 0.0000001;
    if (altP0ExpectedVal > optExpectedVal + NEAR_OPTIMAL_EPSILON) {
      throw new Error("Strategy asserted to be optimal appears non-optimal");
    } else if (altP1ExpectedVal < optExpectedVal - NEAR_OPTIMAL_EPSILON) {
      throw new Error("Strategy asserted to be optimal appears non-optimal");
    }
  }

  if (S.VERBOSITY > 7) {
    console.log("Optimal strategy verification passed");
  }
}


// Returns a random strategy of length len
function getRandomStrat(length : number) : number[] {
  let nonnormalized : number[] = HN_Utility.tabulate(length, (i) => Math.random());
  let sum : number = nonnormalized.reduce((total, num) => total + num);
  let strat : number[] = nonnormalized.map(i => i / sum);
  return strat;
}



// ===== MODULE EXPORTS =====
module.exports.getExpectedValue = getExpectedValue;
module.exports.assertOptimalStrategy = assertOptimalStrategy;
