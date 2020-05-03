// ===== Utility functions for parsing and processing raw data such as the HSReplay winrate data =====

// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");

import IO_Utility = require('../lib/IO_Utility.js');




// --- Constants ---
const REDUCED_ARCHETYPES_TOTAL : number = 10;

const RAW_MATCHUP_DATA_PATHS = {}
RAW_MATCHUP_DATA_PATHS[Metrics_Utility.META_TYPE.LEGEND_RANK10] = 'Raw_HSReplay_Data/archetype_matchups_ranked_standard_Legend-Rank10_March5_2020.json';
RAW_MATCHUP_DATA_PATHS[Metrics_Utility.META_TYPE.RANK11_Rank20] = 'Raw_HSReplay_Data/archetype_matchups_ranked_standard_Rank11-Rank20_March5_2020.json';

const ARCHETYPE_NAMES_PATH = 'Raw_HSReplay_Data/archetype_names.json';



// --- Data access functions ---


// Processes all raw data to metaInfo objects (and saves them to file).
function processAllRawData() {
    console.log("===== Processing All Raw Data =====");
    let dataPathsKeys : string[] = Object.keys(RAW_MATCHUP_DATA_PATHS);
    for (let k=0; k < dataPathsKeys.length; k++) {
        let metaType : number = parseInt(dataPathsKeys[k]);
        console.log("Processing and saving raw data for metaType: " + metaType);
        saveRawDataToMetaInfo(metaType, REDUCED_ARCHETYPES_TOTAL, 0);
    }
}


// Reads raw matchup data at the given path, trims it down to 'numDecks' decks,
//   and then saves it as a metaInfo object to file and returns the path.
function saveRawDataToMetaInfo(metaType : number, numDecks : number, index : number) : string {
    let path : string = RAW_MATCHUP_DATA_PATHS[metaType];
    let realMetaInfo : Formats.metaInfo = dataPathToMetaInfo(path, metaType, numDecks);
    return IO_Utility.saveMetaInfo(realMetaInfo, index);
}


// Reads the raw matchup data from a path, trims it down to 'numDecks' decks,
//   then converts it to a metaInfo object.
function dataPathToMetaInfo(path : string, metaType : number, numDecks : number) : Formats.metaInfo {
    let data : object = IO_Utility.loadJSON(path);
    let archetypeNames = IO_Utility.loadJSON(ARCHETYPE_NAMES_PATH);

    let matchups_data = data["series"]["data"];
    let trimmed_data = trimMatchupData(matchups_data, numDecks);
    let remainingArchetypes = Object.keys(trimmed_data);
    let remainingArchetypeNames = remainingArchetypes.map((id) => getArchetype(archetypeNames, parseInt(id)));

    return matchupsDataToMetaInfo(trimmed_data, archetypeNames, metaType);
}


// Turn a matchups "data" object (which maps archetype id's to a dictionary between
//   matchup and winrate data) into a corresponding metaInfo object.
//   See archetype_matchups*.json file (from HSReplay) for formatting.
function matchupsDataToMetaInfo(matchups_data : object, archetypeNames : object, metaType : number) : Formats.metaInfo {
    let archIDs : string[] = Object.keys(matchups_data);
    let winrates : number[][] = [];
    let deckArchetypes : Formats.deckArchetype[] = [];
    for (let i=0; i < archIDs.length; i++) {
        winrates.push([]);
        deckArchetypes.push(getArchetype(archetypeNames, parseInt(archIDs[i])));
        for (let j=0; j < archIDs.length; j++) {
            // Assert that this matchup has winrate data at all.
            if (!matchups_data[archIDs[i]][archIDs[j]]) {
                throw new Error("No matchup data found between two archetypes.");
            }
            winrates[i].push(matchups_data[archIDs[i]][archIDs[j]]["win_rate"] / 100);
        }
    }
    return new Formats.metaInfo(winrates, deckArchetypes, matchups_data, metaType);
}


// Trims the data from a raw matchups data object down to 'numDecks' decks
//   by iteratively removing the deck with the lowest average total_games size.
function trimMatchupData(matchups_data : object, numDecks : number) : object {
    let keys : string[] = Object.keys(matchups_data);
    while (keys.length > numDecks) {
        let min_avg : number = 0;
        let min_key : number = undefined;
        for (let i=0; i < keys.length; i++) {
            // The key is the archetype index
            let archetypeTotalGames : number = 0;
            for (let j=0; j < keys.length; j++) {
                if (matchups_data[keys[i]][keys[j]] !== undefined) {
                    archetypeTotalGames += matchups_data[keys[i]][keys[j]]["total_games"];
                }
            }
            let archetypeAvgGames : number = archetypeTotalGames / keys.length;
            if (min_key === undefined || archetypeAvgGames < min_avg) {
                min_key = i;
                min_avg = archetypeAvgGames;
            }
        }
        // Remove min key from keys, and from properties of each subproperty
        let archetypeToDelete : string = keys[min_key];
        delete matchups_data[archetypeToDelete];
        keys = Object.keys(matchups_data);
        for (let i=0; i < keys.length; i++) {
            delete matchups_data[keys[i]][archetypeToDelete];
        }
    }
    return matchups_data;
}


// Returns the archetype with the given ID, or null if it doesn't exist.
// Needs the archetypeNames object passed in.
function getArchetype(archetypeNames, id : number) : object {
    let sameID = archetypeNames.filter((archetype) => archetype.id === id);
    if (sameID.length > 0) {
        return sameID[0];
    }
    console.error("No archetype found for ID: " + id);
    return null;
}



// ===== MODULE EXPORTS =====
module.exports.RAW_MATCHUP_DATA_PATHS = RAW_MATCHUP_DATA_PATHS;
module.exports.processAllRawData = processAllRawData;
module.exports.saveRawDataToMetaInfo = saveRawDataToMetaInfo;
