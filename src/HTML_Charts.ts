// ===== FUNCTIONALITY FOR CHARTS =====
// Google charts histogram docs:
//   https://developers.google.com/chart/interactive/docs/gallery/histogram

// Dependencies
import Formats = require('../lib/Formats.js');
import HearthNash = require('../lib/HearthNash.js');
import S = require('../lib/HN_Settings.js');
import HN_Utility = require('../lib/HN_Utility.js');
import Metrics_Utility = require('../lib/Metrics_Utility.js');
import Metrics = require('../lib/Metrics.js');
import Test_Utility = require("../lib/Test_Utility.js");


// Let typescript know what's up
declare var google : any;
declare var $ : any;

// Settings
const CHART_CALLBACK_DELAY = 100; // in milliseconds

// Globals
var GChartsLoaded : boolean = false;
var GChartQueue : IArguments[] = [];

// Load the Visualization API and the corechart package.
google.charts.load('current', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.charts.setOnLoadCallback(onChartsLoad);
// This sets the charts enabled flag, and draws any charts pending in the queue
function onChartsLoad() : void {
    GChartsLoaded = true;
    while (GChartQueue.length > 0) {
        let nextChart = GChartQueue.pop();
        drawColChart.apply(this, nextChart);
    }
}


// Draws the appropriate chart for a given Metrics.MResults
function drawChart(mResults : Metrics.MResults) : void {
    let title = HN_Utility.mResultsToTitle(mResults, true);
    let axes = [mResults.metricInfo.xAxis, mResults.metricInfo.yAxis];
    drawColChart(title, axes, axes, mResults.results);
}
// Draws the appropriate chart to compare two or more Metrics.MResults
function drawComparisonChart(mResultsArr : Metrics.MResults[]) : void {
    let title : string = mResultsArr[0].metricInfo.title + " " + HN_Utility.mResultsToTitle(mResultsArr[0], false);
    for (let i=1; i < mResultsArr.length; i++) {
        if (mResultsArr[i].metricInfo.title !== mResultsArr[0].metricInfo.title) {
            throw new Error("Different metrics not compatible for comparison.");
        }
        title += " vs " + HN_Utility.mResultsToTitle(mResultsArr[i], false);
    }
    let axes : string[] = [mResultsArr[0].metricInfo.xAxis, mResultsArr[0].metricInfo.yAxis];
    let headers : string[] = HN_Utility.tabulate(mResultsArr.length, (i) => HN_Utility.mResultsToTitle(mResultsArr[i], false));
    headers.unshift(axes[0]);
    let rawDataArray = HN_Utility.tabulate(mResultsArr.length, (i) => mResultsArr[i].results);
    drawComparisonColChart(title, axes, headers, rawDataArray);
}

// Creates and populates a data table, instantiates the column chart,
//   then passes in the data and draws it.
function drawColChart(title : string, axisTitles : string[], headers : string[], rawData : any[][]) : void {
    // If charts haven't loaded yet, queue this one
    if (!GChartsLoaded) {
        GChartQueue.push(arguments);
        return;
    }

    // Create the data table.
    let fullArray = [headers].concat(rawData);
    let data = google.visualization.arrayToDataTable(fullArray);

    // Set chart options
    let options = {
        title: title,
        legend: { position: 'none' },
        hAxis: {
            title: axisTitles[0]
        },
        vAxis: {
          title: axisTitles[1]
        }
    };

    // Instantiate and draw our chart, passing in some options.
    let chartDiv = document.createElement("div");
    $(chartDiv).addClass("google_chart");
    $("#charts_parent").append(chartDiv);

    let chart = new google.visualization.ColumnChart(chartDiv);
    chart.draw(data, options);
}

// Draws a column chart with side-by-side columns for multiple data sets
function drawComparisonColChart(title : string, axisTitles : string[], headers : string[], rawDataArrays : any[][][]) : void {
  // if (S.VERIFY) {
    // Assert that arrays within rawDataArrays are of the same length, and have consistent x-axes
    let xLen = rawDataArrays[0].length;
    for (let i=0; i < rawDataArrays.length; i++) {
      if (rawDataArrays[i].length !== xLen) {
        throw new Error("Length of data arrays not consisent.");
      }
      for (let r=0; r < rawDataArrays[i].length; r++) {
        if (rawDataArrays[i][r][0] !== rawDataArrays[0][r][0]) {
          throw new Error("Data array x-axes do not line up.");
        }
      }
    }
  // }

  // Merge rawDataArrays and then pass to drawColChart
  let mergedArray : any[][] = new Array(xLen);
  for (let r=0; r < xLen; r++) {
    mergedArray[r] = new Array(rawDataArrays.length + 1);
    mergedArray[r][0] = rawDataArrays[0][r][0];
    for (let i=0; i < rawDataArrays.length; i++) {
      mergedArray[r][i + 1] = rawDataArrays[i][r][1];
    }
  }

  console.log("Merged Array:");
  console.log(mergedArray);
  drawColChart(title, axisTitles, headers, mergedArray);
}



// ===== MODULE EXPORTS =====
module.exports.drawChart = drawChart;
module.exports.drawComparisonChart = drawComparisonChart;
