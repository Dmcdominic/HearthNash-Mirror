// ===== Utility functions for reading and writing files =====

// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");

import fs = require('fs-extra');


// ---- Constants ----

// Data directories
const dataDir : string = "Data/";
const metaInfoDir : string = dataDir + "MetaInfo/";
const matchTreeDir : string = dataDir + "MatchTree/";
const analysisDir : string = dataDir + "Analysis/";
const archivedDir : string = dataDir + "Archived/";
const condensedAnalysisDir : string = analysisDir + "Condensed/";

const metaTypeDirPrefix : string = "MetaType_";
const formatDirPrefix : string = "Format_";

// File extensions
const extMetaInfo : string = ".HNMetaInfo.json";
const extMatchTree : string = ".HNMatchTree.json";
const extAnalysisResults : string = ".HNAnalysisResults.csv";
const extAnalysisMetadata : string = ".HNAnalysisMetadata.json";
const extCondensedResults : string = ".HNCondensedResults.csv";



// ---- HearthNash file IO interface ----


// Writes metaInfo to file.
// Returns the path to the file.
function saveMetaInfo(MetaInfo : Formats.metaInfo, index : number) : string {
    let dir : string = metaInfoDir + metaTypeDirPrefix + MetaInfo.metaType + "/";
    let filename : string = metaTypeDirPrefix + MetaInfo.metaType + "_Index_" + index;
    let path : string = dir + filename + extMetaInfo;
    saveWithJSON(MetaInfo, path);
    return path;
}

// Writes a match tree (matchRoot) to file.
// Returns the path to the file.
function saveMatchTree(matchRoot : HearthNash.matchRoot, index : number) : string {
    let dir : string = matchTreeDir + metaTypeDirPrefix + matchRoot.MetaInfo.metaType + "/" +
        formatDirPrefix + matchRoot.FormatSettings.name + "/";
    let filename : string = formatDirPrefix + matchRoot.FormatSettings.name + "_" +
        metaTypeDirPrefix + matchRoot.MetaInfo.metaType + "_Index_" +
        index;
    let path : string = dir + filename + extMatchTree;
    let matchJson = serializeMatchTree(matchRoot);
    saveWithJSON(matchJson, path);
    return path;
}

// Writes an MResults object (a metric analysis) to file as *2* separate files.
// One is a .csv containing only the results.
// The other is a .json containing all of the metadata.
// Returns the path used for both files, *not including* the extension used for each.
function saveAnalysis(mResults : Metrics.MResults, index : number) : string {
    let dir : string = analysisDir + mResults.metricInfo.title + "/" +
        metaTypeDirPrefix + mResults.metaType + "/" +
        formatDirPrefix + mResults.FormatSettings.name + "/";
    let filename : string = formatDirPrefix + mResults.FormatSettings.name + "_" +
        metaTypeDirPrefix + mResults.metaType + "_" +
        mResults.metricInfo.title + "_Index_" + index;
    let resultsPath : string = dir + filename + extAnalysisResults;
    let metadataPath : string = dir + filename + extAnalysisMetadata;
    let resultsCSV = mResultsToResultsCSV(mResults);
    saveString(resultsCSV, resultsPath);
    saveWithJSON(mResults, metadataPath);
    return dir + filename;
}

// Loads a metaInfo object from file.
function loadMetaInfo(path : string) : Formats.metaInfo {
    return loadJSON(path);
}

// Loads a match tree (matchRoot) from file.
function loadMatchTree(path : string) : HearthNash.matchRoot {
    return deserializeMatchTree(<HearthNash.vertex[]>loadJSON(path));
}

// Returns an array of paths to saved metaInfo files.
// If metaType is defined, will only include objects with the corresponding metaType.
function getPathsMetaInfo(metaType : number = null) : string[] {
    // If we're given a metaType, simply check the corresponding directory.
    if (metaType != null) {
        let directoryPath : string = metaInfoDir + metaTypeDirPrefix + metaType;
        return getFilesInDir(directoryPath, extMetaInfo);
    }

    // If we're not given a metaType, need to check all the subdirs of metaInfoDir.
    let metaSubdirs : string[] = getSubdirs(metaInfoDir);
    let paths : string[] = [];
    metaSubdirs.forEach(subdir => paths = paths.concat(getFilesInDir(subdir, extMetaInfo)));
    return paths;
}

// Returns an array of paths to saved metaInfo files.
// If metaType is defined, will only include objects with the corresponding metaType.
function getPathsMatchTrees(metaType : number, formatName : string) : string[] {
    // Simply return all files in the corresponding directory (with the right extension).
    let directoryPath : string = matchTreeDir + metaTypeDirPrefix + metaType + "/" +
        formatDirPrefix + formatName + "/";
    return getFilesInDir(directoryPath, extMatchTree);
}

// Duplicates the whole Analysis directory
function cpAnalysisDir(sampleSize : number, index : number) {
    let srcDir : string = analysisDir;
    let destDir : string = archivedDir + "Samples_" + sampleSize + "/Analysis_Index_" + index + "/";
    console.log("--- Copying the Analysis directory to " + destDir + "  ---");
    cpDir(srcDir, destDir);
}

// Deletes the whole Data directory
function rmTransientDirs() : void {
    console.log("===== Removing the MetaInfo, MatchTree, and Analysis directories =====");
    fs.removeSync(metaInfoDir);
    fs.removeSync(matchTreeDir);
    fs.removeSync(analysisDir);
}



// ---- Serialization of tree structure ----


// Turns a matchRoot into a list of vertices with unique IDs.
// Each ID is the vertex's index in the list.
// The matchRoot sits at index vertexList.length - 1.
function serializeMatchTree(MatchRoot : HearthNash.matchRoot) : HearthNash.vertex[] {
    let vertexList = [];
    extendVertexList(MatchRoot, vertexList);
    vertexList.map(vertex => convertToChildrenIDs(vertex));
    return vertexList;
}

// Turns a vertexList object (parsed from serialized tree json) into a matchRoot.
function deserializeMatchTree(vertexList : HearthNash.vertex[]) : HearthNash.matchRoot {
    vertexList.map(vertex => convertFromChildrenIDs(vertex, vertexList));
    return vertexList[vertexList.length - 1];
}

// Adds nextVertex and all its children to acc (if they aren't ID'ed already),
//   and gives them each a unique ID corresponding to their index in acc.
function extendVertexList(nextVertex : HearthNash.vertex, acc : HearthNash.vertex[]) : void {
    if (nextVertex.ID !== undefined) {
        return;
    }

    if (nextVertex.children !== undefined && nextVertex.children !== null) {
        nextVertex.children.forEach(child => extendVertexList(child, acc));
    }

    nextVertex.ID = acc.length;
    acc.push(nextVertex);
}

// Replaces each vertex's children property with a childrenIDs property,
//   which holds a list of vertex ID's corresonding to vertexList indices.
function convertToChildrenIDs(nextVertex : HearthNash.vertex) : void {
    if (nextVertex.children) {
        nextVertex.childrenIDs = nextVertex.children.map(child => child.ID);
    }
    delete nextVertex.children;
}

// Replaces each vertex's childrenIDs property with the children property,
//   which is the original list of references to its child vertices.
function convertFromChildrenIDs(nextVertex : HearthNash.vertex, vertexList : HearthNash.vertex[]) : void {
    if (nextVertex.childrenIDs) {
        nextVertex.children = nextVertex.childrenIDs.map(childID => vertexList[childID]);
    }
    delete nextVertex.childrenIDs;
    delete nextVertex.ID;
}



// ---- Condense Utilities ----


// Gets the analysis results of a certain metric analysis for a certain meta type,
//    condenses them into one csv, then saves it to the analysis directory.
function condenseRealDataMetrics(metricInfo : Metrics.MetricInfo, metaType : number) : void {
    let analysisResults : Metrics.MResults[] = getAnalysisResults(metricInfo, metaType);
    let condensedArray : string[][] = [];
    for (let i=0; i < analysisResults.length; i++) {
        condensedArray.push([]);
        let mResults : Metrics.MResults = analysisResults[i];
        condensedArray[i].push(mResults.FormatSettings.name);
        for (let j=0; j < mResults.results.length; j++) {
            condensedArray[i].push(mResults.results[j][1]);
        }
    }
    let CSV : string = array2DToCSV(condensedArray);
    // Save it to the corresponding subdirectory of the analysis dir
    let dir : string = analysisDir + metricInfo.title + "/" + metaTypeDirPrefix + metaType + "/";
    let filename : string = "Metric_" + metricInfo.title + "_MetaType_" + metaType;
    let path : string = dir + filename + extCondensedResults;
    saveString(CSV, path);
    // Also save it to the condensed directory
    dir = condensedAnalysisDir;
    path = dir + filename + extCondensedResults;
    saveString(CSV, path);
}


// Returns an array of all the results of a certain metric analysis for a certain meta type.
function getAnalysisResults(metricInfo : Metrics.MetricInfo, metaType : number) : Metrics.MResults[] {
    let dir : string = analysisDir + metricInfo.title + "/" + metaTypeDirPrefix + metaType + "/";
    let subdirs : string[] = getSubdirs(dir);
    let mResults : Metrics.MResults[] = [];
    for (let i=0; i < subdirs.length; i++) {
        let subdir : string = subdirs[i];
        let fileNames : string[] = getFilesInDir(subdir, ".json");
        for (let j=0; j < fileNames.length; j++) {
            mResults.push(loadJSON(fileNames[j]));
        }
    }
    return mResults;
}



// ---- CSV Utilities ----


// Turns an MResults object into a csv (string).
function mResultsToResultsCSV(mResults : Metrics.MResults) : string {
    let CSV : string = "";
    CSV += objPropertiesToCSV(mResults.metricInfo, null, ",", ["title"]) + "\n";
    CSV += array2DToCSV(mResults.results);
    return CSV;
}

// Returns all the properties of a javascript object as a CSV string.
// Set keySep to null if the key should not be saved at all.
// Otherwise, keySep goes between each key and its stringified value.
// valSep goes after each stringified value.
function objPropertiesToCSV(obj : object, keySep : string, valSep : string, exclusions : string[] = []) : string {
    let CSV : string = "";
    let properties : string[] = Object.keys(obj);
    for (let i=0; i < properties.length; i++) {
        let key : string = properties[i];
        if (!exclusions.includes(key)) {
            let value : any = obj[key];
            let stringified : string = JSON.stringify(value);
            // stringified = stringified.replace(",", ";");
            if (keySep !== null) {
                CSV += key + keySep;
            }
            CSV += stringified;
            if (i != properties.length - 1) {
                CSV += valSep;
            }
        }
    }
    return CSV;
}

// Converts a 2D array to a CSV (string).
function array2DToCSV(arr : any[][]) : string {
    let CSV : string = "";
    if (!Array.isArray(arr)) throw new Error("Non-array passed to array2DToCSV()");
    for (let i=0; i < arr.length; i++) {
        CSV += array1DToCSV(arr[i]) + ((i == arr.length - 1) ? "" : "\n");
    }
    return CSV;
}
function array1DToCSV(arr : any[], separator : string = ",") {
    let CSV : string = "";
    if (!Array.isArray(arr)) throw new Error("Non-array passed to array1DToCSV()");
    for (let i=0; i < arr.length; i++) {
        CSV += arr[i] + ((i == arr.length - 1) ? "" : separator);
    }
    return CSV;
}



// ---- General file IO functions ----


// Writes a string to file.
function saveString(strToSave : string, path : string) : void {
    ensureDirExists(path);
    fs.writeFileSync(path, strToSave);
}

// Writes a javascript object to file by json.
function saveWithJSON(objToSave : object, path : string) : void {
    let json : string = JSON.stringify(objToSave);
    saveString(json, path);
}

// Reads the JSON saved at a certain path, parses it, and returns it as an object.
function loadJSON(path : string) : object {
    return JSON.parse(fs.readFileSync(path, {encoding: "utf8"}));
}

// Ensures that all directories in a path exist (but not the file itself)
// e.g. foo/bar/thing.txt will create ./foo/ and ./foo/bar/
function ensureDirExists(path : string) : void {
    let dirSplit = path.split("/");
    dirSplit.pop();
    ensureDirExistsSplit(dirSplit, ".");
}
function ensureDirExistsSplit(dirs : string[], root : string) : void {
    if (dirs.length === 0) {
        return;
    }
    let nextDir = dirs.shift();
    root += "/" + nextDir;
    if (!fs.existsSync(root)) {
        fs.mkdirSync(root);
    }
    ensureDirExistsSplit(dirs, root);
}

// Returns a list of (the full paths to) all files within a directory, *including subdirectories*.
//    This only includes direct children.
// If postfix is defined, will only returns paths that end with that postfix.
function getFilesInDir(directoryPath : string, postfix : string = null) : string[] {
    let paths : string[] = fs.readdirSync(directoryPath);
    if (postfix) {
        paths = paths.filter(path => path.endsWith(postfix));
    }
    paths = paths.map(path => directoryPath + "/" + path);
    return paths;
}

// Returns a list of all *direct subdirectories* within a directory.
function getSubdirs(directoryPath : string) : string[] {
    let paths = getFilesInDir(directoryPath);
    return paths.filter(path => fs.statSync(path).isDirectory());
}

// Makes a copy of directory A at directory B (using relative paths)
function cpDir(srcDirPath : string, destDirPath : string) : void {
    try {
        ensureDirExists(destDirPath);
        fs.copySync(srcDirPath, destDirPath);
    } catch (err) {
        console.error(err);
        console.error(err);
    }
}



// ===== MODULE EXPORTS =====
module.exports.saveMetaInfo = saveMetaInfo;
module.exports.saveMatchTree = saveMatchTree;
module.exports.saveAnalysis = saveAnalysis;
module.exports.loadMetaInfo = loadMetaInfo;
module.exports.loadMatchTree = loadMatchTree;
module.exports.getPathsMetaInfo = getPathsMetaInfo;
module.exports.getPathsMatchTrees = getPathsMatchTrees;
module.exports.cpAnalysisDir = cpAnalysisDir;
module.exports.rmTransientDirs = rmTransientDirs;
module.exports.condenseRealDataMetrics = condenseRealDataMetrics;
module.exports.loadJSON = loadJSON;
module.exports.getFilesInDir = getFilesInDir;
