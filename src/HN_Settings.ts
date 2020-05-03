// ===== Settings and constants for HearthNash =====

// Dependencies
// None

// Version number, as per Semantic Versioning - https://semver.org/
// Recommended to keep this aligned with package.json version.
const VERSION : string = "0.1.4";

// Defines how detailed the debug info logged to the console should be. Range: [0, 10]
const VERBOSITY : number = 0;

// Enabling this macro will run verifications throughout the code, such as assertOptimalStrategy()
const VERIFY : boolean = false;

// Enabling this macro will allow format settings to be constructed which give players excess decks.
const ALLOW_EXCESS_DECKS : boolean = false;



// ==== Constants ====
const P0 : number = 0;
const P1 : number = 1;



// ===== MODULE EXPORTS =====
module.exports.VERSION = VERSION;
module.exports.VERBOSITY = VERBOSITY;
module.exports.VERIFY = VERIFY;
module.exports.ALLOW_EXCESS_DECKS = ALLOW_EXCESS_DECKS;
module.exports.P0 = P0;
module.exports.P1 = P1;
