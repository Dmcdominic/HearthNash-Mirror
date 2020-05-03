#!/usr/bin/env node

// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");

import IO_Utility = require('../lib/IO_Utility.js');
import RawData_Utility = require('../lib/RawData_Utility.js');
import Data_Pipeline = require('../lib/Data_Pipeline.js');



// --- Testing - command line args ---
// console.log("process.argv:");
// console.log(process.argv);
// console.log("\n");

// TODO - command line args for:
//   - IO_Utility.rmTransientDirs()
//   - Data_Pipeline.fullRealMetaProcessing()
//   - Data_Pipeline.fullRealMetaProcessAndArchive()



// Clear the temporary data directories, then reprocess them.
IO_Utility.rmTransientDirs();
Data_Pipeline.fullRealMetaProcessing();


// Run the full real meta processing over several sample sizes, archiving all results.
// Data_Pipeline.fullRealMetaProcessAndArchive();
