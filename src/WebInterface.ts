// Front end functionality for web-interface.html
//   - Gets bundled into HNBundle.js by browserify


// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");
import WI_Utility = require("../lib/WebInterface_Utility.js");
import $ = require("jquery");



// Initialization
$(document).ready(function() {
    // Add listeners
    resetWinrateListeners();
    $("#generateMatchTreeBtn").unbind().click(generateMatchTree);
    $("#matchTreeRoot").unbind().click(ascendToRoot);
    // Set up Format Settings Presets Dropdown
    initFormatPresetsDropdown();
    // Set up Save CSV listener
    $("#saveCSV").unbind().click(saveCSV);
    let loadCSVInput = document.getElementById("loadCSV");
    loadCSVInput.addEventListener('change', loadCSV);
});


// ===== META SETTINGS =====

// Add a listener to each winrate matrix cell, to update the rest of the matrix
function resetWinrateListeners() : void {
    let n : number = getInterfaceWinrateMatrixSize();
    for (let r=0; r < n; r++) {
        for (let c=0; c < n; c++) {
            let cell : HTMLInputElement = <HTMLInputElement>document.getElementById('deckWinrate' + r + '_' + c);
            cell.addEventListener('input', onWinrateCellEdited);
            cell.addEventListener('propertyChange', onWinrateCellEdited);
        }
    }
    $("#minus1Deck").unbind().click(onMinus1DeckClicked);
    $("#plus1Deck").unbind().click(onPlus1DeckClicked);

    for (let i=0; i < n; i++) {
        let inputField : HTMLInputElement = <HTMLInputElement>(document.getElementById('deckName' + i));
        inputField.addEventListener('input', onDeckNameEdited);
        inputField.addEventListener('propertyChange', onDeckNameEdited);
    }
}


// Called when a winrate cell is edited by the user.
function onWinrateCellEdited() : void {
    let winrates : number[][] = readWinrateMatrix(); // As decimal
    setWinrateMatrix(winrates);
}


// Set the values in the winrate matrix, using a *decimal* winrates input (not as percentage yet).
function setWinrateMatrix(winrates : number[][], overrideUsrInput : boolean = false) : void {
    WI_Utility.toPercentMatrix(winrates); // Now as percent
    // Update all the cells
    let n : number = getInterfaceWinrateMatrixSize();
    for (let r=0; r < n; r++) {
        for (let c=0; c < n; c++) {
            if (c < r && !overrideUsrInput) {
                continue;
            }
            let cell : HTMLInputElement = <HTMLInputElement>document.getElementById('deckWinrate' + r + '_' + c);
            cell.value = (winrates[r][c]).toString();
        }
    }
}



// Called when a deck name field is edited by the user.
function onDeckNameEdited() : void {
    let n : number = getInterfaceWinrateMatrixSize();
    for (let i=0; i < n; i++) {
        $("#deckNameTop" + i).text(<string>($("#deckName" + i).val()));
    }
}


// Called when the -1 Deck button is clicked
function onMinus1DeckClicked() : void {
    remove1Deck();
}
// Removes 1 deck (1 row and column) from the winrates matrix
function remove1Deck() : void {
    if ($("#winratesTableBody").children().length > 1) {
        $("#winratesTableBody").children().last().remove();
        $("#theadRow").children().last().remove();
        $(".winratesRow").each(function() { $(this).children().last().remove(); });
    }
}


// Called when the +1 Deck button is clicked
function onPlus1DeckClicked() : void {
    add1Deck();
    // Then reset the listeners and validate the deck name/winrate values
    resetWinrateListeners();
    onWinrateCellEdited();
    onDeckNameEdited();
}
// Adds 1 deck (1 row and column) to the winrate matrix
function add1Deck() : void {
    let newRow = $("#winratesTableBody").children().last().clone();
    let lastRowIndex : number = parseInt(newRow.prop("id").replace("winratesRow", ""));
    let newRowIndex : number = lastRowIndex + 1;
    newRow.prop("id", "winratesRow" + newRowIndex);
    newRow.appendTo($("#winratesTableBody"));

    // Update the id of each important descendent
    newRow.find("#P0_CheckDeck" + lastRowIndex).prop("id", "P0_CheckDeck" + newRowIndex).prop("checked", false);
    newRow.find("#P1_CheckDeck" + lastRowIndex).prop("id", "P1_CheckDeck" + newRowIndex).prop("checked", false);
    newRow.find("#deckName" + lastRowIndex).prop("id", "deckName" + newRowIndex).val("Deck " + newRowIndex);
    for (let i=0; i < newRowIndex; i++) {
        let elem = newRow.find("#deckWinrate" + lastRowIndex + "_" + i);
        elem.prop("id", "deckWinrate" + newRowIndex + "_" + i);
        elem.prop("disabled", false);
        elem.val("50");
    }

    // Clone the last element of each row, and update each id
    let newDeckNameTop = $("#theadRow").children().last().clone();
    newDeckNameTop.prop("id", "deckNameTop" + newRowIndex);
    newDeckNameTop.appendTo($("#theadRow"));
    for (let i=0; i <= newRowIndex; i++) {
        let origRow = $("#winratesRow" + i);
        let newDeckWinrateTr = origRow.children().last().clone();
        newDeckWinrateTr.appendTo(origRow);
        let newDeckWinrate = newDeckWinrateTr.find("#deckWinrate" + i + "_" + lastRowIndex);
        newDeckWinrate.prop("id", "deckWinrate" + i + "_" + newRowIndex);
        newDeckWinrate.prop("disabled", true);
        newDeckWinrate.val("50");
    }
}


// Reads the winrate matrix from the web interface.
// Converts it to a decimal matrix and legitimizes it before returning the result.
function readWinrateMatrix() : number[][] {
    // First, determine the size of the matrix.
    let n : number = getInterfaceWinrateMatrixSize();

    // Now read off the values.
    let winrates : number[][] = [];
    for (let r=0; r < n; r++) {
        winrates.push([]);
        for (let c=0; c < n; c++) {
            let cell : HTMLInputElement = <HTMLInputElement>document.getElementById('deckWinrate' + r + '_' + c);
            let value : number = Number(cell.value);
            winrates[r].push(value);
        }
    }
    WI_Utility.fromPercentMatrix(winrates); // Convert to decimal
    WI_Utility.legitimizeWinrateMatrix(winrates); // Legitimize
    return winrates;
}
// Reads the winrate matrix, including the deck names
function readWinrateMatrixDeckNames() : any[][] {
    let winrates : any[][] = readWinrateMatrix();
    let n = winrates.length;
    let deckNames : string[] = [];
    for (let i=0; i < n; i++) {
        let inputField : HTMLInputElement = <HTMLInputElement>(document.getElementById('deckName' + i));
        deckNames.push(inputField.value);
        winrates[i].unshift(inputField.value);
    }
    deckNames.unshift("");
    winrates.unshift(deckNames);
    return winrates;
}


// Returns the size of the winrate matrix on the web interface currently.
function getInterfaceWinrateMatrixSize() : number {
    return $(".winratesRow").length;
}


// Reads the Meta Settings (winrates and decks) and returns them in a metaInfo object
function readMetaSettings() : Formats.metaInfo {
    let winrates : number[][] = readWinrateMatrix();
    let n = winrates.length;
    let deckNames : string[] = [];
    for (let i=0; i < n; i++) {
        let inputField : HTMLInputElement = <HTMLInputElement>(document.getElementById('deckName' + i));
        deckNames.push(inputField.value);
    }
    let deckArchetypes : Formats.deckArchetype[] = HN_Utility.tabulate(n, (i) => new Formats.deckArchetype(null, deckNames[i], null));
    return new Formats.metaInfo(winrates, deckArchetypes);
}


// Read the starting decks for each player and returns them as a number[][].
function readStartingDecks() : number[][] {
    let decks : number[][] = [[],[]];
    let n : number = getInterfaceWinrateMatrixSize();
    for (let p=0; p < 2; p++) {
        for (let d=0; d < n; d++) {
            let checkbox : HTMLInputElement = <HTMLInputElement>(document.getElementById('P' + p + "_CheckDeck" + d));
            if (checkbox.checked) {
                decks[p].push(d);
            }
        }
    }
    return decks;
}



// ===== FORMAT SETTINGS =====

// Read the Format Settings from the web interface and returns them in a formatSettings object.
function readFormatSettings() : Formats.formatSettings {
    let rWD : boolean = $("#removeWinnerDeck").prop("checked");
    let rLD : boolean = $("#removeLoserDeck").prop("checked");
    let wCS : boolean = $("#winnerCanSwitch").prop("checked");
    let lCS : boolean = $("#loserCanSwitch").prop("checked");
    let protects : number = Number($("#protects").val());
    let bans : number = Number($("#bans").val());
    let gamesToWin : number = Number($("#gamesToWin").val());
    let decksPerPlayer : number = Number($("#decksPerPlayer").val());
    return new Formats.formatSettings(rWD, rLD, wCS, lCS, protects, bans, gamesToWin, decksPerPlayer);
}

// Initialize the Format Settings Presets Dropdown options
function initFormatPresetsDropdown() : void {
    let samplePresetLink = $("#samplePresetLink");
    let presetDropdownLinks = $("#presetDropdownLinks");
    let coreFormatKeys : string[] = Object.keys(Formats.CORE_FORMATS);
    for (let f=0; f < coreFormatKeys.length; f++) {
        let newPresetLink = samplePresetLink.clone();
        let format = Formats.CORE_FORMATS[coreFormatKeys[f]];
        newPresetLink.text(format.name);
        newPresetLink.click(function() { setFormatSettings(format); });
        newPresetLink.appendTo(presetDropdownLinks);
        newPresetLink.removeAttr("hidden");
    }
}

// Populate the Format Settings options with a certain formatSettings object
function setFormatSettings(FormatSettings : Formats.formatSettings) : void {
    $("#removeWinnerDeck").prop("checked", FormatSettings.removeWinnerDeck);
    $("#removeLoserDeck").prop("checked", FormatSettings.removeLoserDeck);
    $("#winnerCanSwitch").prop("checked", FormatSettings.winnerCanSwitch);
    $("#loserCanSwitch").prop("checked", FormatSettings.loserCanSwitch);
    $("#protects").val(FormatSettings.protectsTotal);
    $("#bans").val(FormatSettings.bansTotal);
    $("#gamesToWin").val(FormatSettings.gamesToWin);
    $("#decksPerPlayer").val(FormatSettings.decksPerPlayer);
}


// ===== MATCH TREE EXPLORER =====

// Global variable to be accessed from the Match Tree Explorer functions
var CurrentMatchRoot : HearthNash.matchRoot = null;
var CurrentMatchVertex : HearthNash.vertex = null;
var sampleChildBtn = null;


// Returns the tree dpeth of CurrentMatchVertex in the Match Tree Explorer
function getCurrentTreeDepth() : number {
    return $("#explorerParents").children().length - 1;
}


// Generate the match tree based on the user's meta and format settings,
//   and set it up to be explored in the Match Tree Explorer.
function generateMatchTree() : void {
    let errorText = $("#generateMTBErrorText");
    errorText.attr("hidden","");
    try {
        let MetaInfo : Formats.metaInfo = readMetaSettings();
        let FormatSettings : Formats.formatSettings = readFormatSettings();
        let decks : number[][] = readStartingDecks();
        CurrentMatchRoot = HearthNash.evaluateMatch(decks, FormatSettings, MetaInfo);
    } catch (err) {
        errorText.text(err);
        errorText.removeAttr("hidden");
        return;
    }
    console.log(CurrentMatchRoot);
    // Display the match tree root
    $(".hide-before-generation").show();
    let matchTreeRootBtn = $("#matchTreeRoot");
    matchTreeRootBtn.show();
    clearAllParentsButRoot();
    ascendToParent(CurrentMatchRoot, 0);
}


// Ascend to the Match Tree Root
function ascendToRoot() : void {
    ascendToParent(CurrentMatchRoot, 0);
}


// Ascend in the Match Tree Explorer to a vertex of particular depth (lower than the current depth)
function ascendToParent(vertex : HearthNash.vertex, depth : number) : void {
    // Trim the parent vertex buttons that are below the desired depth.
    let currentDepth : number = getCurrentTreeDepth();
    if (currentDepth < depth) {
        throw new Error("Somehow tried to ascend to a parent vertex which is LOWER in the tree...");
    }
    while (currentDepth > depth) {
        $("#explorerParents").children().last().remove();
        currentDepth--;
    }
    // Display that vertex
    updateCurrentMatchVertex(vertex);
}


// Choose a particular vertex in a match tree to display in the explorer
function displayNextTreeChild(childIndex : number) : void {
    // Get the child and the players' options that it corresponds to
    let child : HearthNash.vertex = CurrentMatchVertex.children[childIndex];
    let vertexOptionsByChild : string[] = WI_Utility.vertexOptionsByChild(CurrentMatchVertex, CurrentMatchRoot);
    let thisChildOpts : string = (vertexOptionsByChild) ? (" (" + vertexOptionsByChild[childIndex] + ")") : "";
    // Append a button for the childIndex child of the current vertex to the parent list.
    let newBtn = $("#matchTreeRoot").clone();
    newBtn.removeProp("id");
    newBtn.appendTo($("#explorerParents"));
    newBtn.click(function(){ ascendToParent(child, $(newBtn).index()); });
    newBtn.text(WI_Utility.vertexVerboseName(child, CurrentMatchRoot) + thisChildOpts);
    // Display the children of the childIndex child
    updateCurrentMatchVertex(child);
}


// Sets CurrentMatchVertex to the newVertex, then updates the explorer children and vertex details
function updateCurrentMatchVertex(newVertex : HearthNash.vertex) : void {
    CurrentMatchVertex = newVertex;
    clearExplorerChildren();
    populateExplorerChildren();
    displayVertexDetails();
}


// Displays the details of the CurrentMatchVertex below the Match Tree Explorer.
function displayVertexDetails() : void {
    $("#vertexDetails").html(WI_Utility.vertexDetails(CurrentMatchVertex, CurrentMatchRoot));
}


// Populates the Match Tree Explorer children section with buttons for the children
//   of the CurrentMatchVertex.
function populateExplorerChildren() : void {
    let explorerChildren = $("#explorerChildren");
    let vertexOptionsByChild : string[] = WI_Utility.vertexOptionsByChild(CurrentMatchVertex, CurrentMatchRoot);
    if (CurrentMatchVertex.children) {
        for (let i=0; i < CurrentMatchVertex.children.length; i++) {
            let nextChild = CurrentMatchVertex.children[i];
            let thisChildOpts : string = (vertexOptionsByChild) ? (vertexOptionsByChild[i] + "<br>") : "";
            let newBtn = sampleChildBtn.clone();
            newBtn.removeProp("id");
            newBtn.show();
            newBtn.html(thisChildOpts + WI_Utility.vertexVerboseName(nextChild, CurrentMatchRoot) + " - " + WI_Utility.vertexWinProbabilityStr(nextChild));
            newBtn.click(function(){ displayNextTreeChild(i); });
            newBtn.appendTo(explorerChildren);
        }
    }
}


// Deletes all the DOM elements in the Match Tree Explorer children section.
function clearExplorerChildren() : void {
    if (!sampleChildBtn) {
        sampleChildBtn = $("#childSample");
    }
    let explorerChildren = document.getElementById("explorerChildren");
    while (explorerChildren.lastElementChild) {
        explorerChildren.removeChild(explorerChildren.lastElementChild);
    }
}


// Deletes all the DOM elements in the Match Tree Explorer parents section.
function clearAllParentsButRoot() : void {
    let explorerParents = $("#explorerParents");
    while (explorerParents.children().length > 1) {
        explorerParents.children().last().remove();
    }
}



// ===== CSV SAVING/LOADING =====


// Downloads the current winrate matrix, including deck names, as a csv
function saveCSV() : void {
    let winratesTxt : string = WI_Utility.array2DToCSV(readWinrateMatrixDeckNames());
    WI_Utility.download("HearthNash winrates.csv", winratesTxt);
}


// Loads the file given as input into the winrates matrix and deck names
function loadCSV() : void {
    let inputElem = <HTMLInputElement>(document.getElementById("loadCSV"));
    if (inputElem.files.length === 0) {
        console.error("No files given to loadCSV");
        return;
    }
    let file = inputElem.files[0];
    let winrates : any[][];
    let fr = new FileReader();
    fr.onload = function(e) {
        try {
            let fileTxt : string = <string>(e.target.result);
            let rows : string[] = fileTxt.split('\n');

            let winratesSize : number = rows[0].split(',').length - 1;
            rows.shift();

            // Update the number of decks in the interface
            while (winratesSize > getInterfaceWinrateMatrixSize()) {
                add1Deck();
            }
            while (winratesSize < getInterfaceWinrateMatrixSize()) {
                remove1Deck();
            }

            let newWinrates : any[][] = [];
            for (let r=0; r < winratesSize; r++) {
                let thisRow : any[] = rows[r].split(',');
                // Update the deck name
                $("#deckName" + r).val(thisRow[0]);
                thisRow.shift();
                // The rest are winrates
                newWinrates.push([]);
                for (let c=0; c < thisRow.length; c++) {
                    newWinrates[r][c] = parseFloat(thisRow[c]);
                }
            }

            // Now actually set the values of the winrate matrix in the interface
            setWinrateMatrix(newWinrates, true);
            // Then reset the listeners and validate the deck name/winrate values
            resetWinrateListeners();
            onWinrateCellEdited();
            onDeckNameEdited();
        } catch (err) {
            console.error("Error caught while trying to read CSV: " + err);
            let errorText = $("#generateMTBErrorText");
            errorText.text("Error caught while trying to read CSV: " + err);
            errorText.removeAttr("hidden");
            return;
        }
    };
    fr.readAsText(file);
}





// ===== MODULE EXPORTS =====
window['WI'] = this;
module.exports.onWinrateCellEdited = onWinrateCellEdited;
