"use strict";

const DEBUG = false;

const FRACTION_OF_DEGREE_XS = 0.001;
const FRACTION_OF_DEGREE_S = 0.002;
const FRACTION_OF_DEGREE_M = 0.003;
const FRACTION_OF_DEGREE_L = 0.005;
const FRACTION_OF_DEGREE_XL = 0.008;
const WEIGHT = 2;

// Moving these to globals, since I need to access them from map click handler.
let fracOfDegreeHoriz = 0;
let fracOfDegreeVert = 0;
let fracLabel = '';

const segmentMap = new Map();

var defLat = 41.010418;
var defLon = -73.920776;
var map = L.map('map').setView([defLat, defLon], 16);
const token = getToken();

var myLayer = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=' + token, {
    maxZoom: 18,
    id: 'mapbox/streets-v11', // You can use other styles like 'mapbox/satellite-v9'
    tileSize: 512,
    zoomOffset: -1,
    accessToken: token
}).addTo(map);

myLayer.on('tileerror', function(error, tile) {
    console.log('[XX] Tile loading error:', error);
    console.log('Failed tile:', tile);
    console.log('Check map token!');
});
  


// Draw center marker
L.marker([defLat, defLon]).addTo(map);

function getToken() {
    // -- FOR LOCAL EXECUTION --
    // Remember, this variable comes from secret_do_not_upload_to_github.js, which is not on GitHub, only local.
    // That script is included before *this* script in the index.html file.
    if (typeof mapBoxToken !== 'undefined') {
        return mapBoxToken;
    } 

    // -- FOR EXECUTION ON GITHUB PAGES --    
    // Since no secrets file, we don't have mapBoxToken defined. Try to construct token from query string.
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const otherPart = urlParams.get('a');
    if (otherPart !== null && otherPart !== '') {
        return 'pk.eyJ1Ijoicm1hbWJvMTMiLCJhIjoiY203cGQ2YXloMG1uMjJqcTRpemZ4dmF6NCJ9.' + otherPart;
    }
    const longMsg = `
        [XX] Can't load map due to incomplete Map Box token. 
        To load map, complete the token by passing the suffix after the last '.' in the token.
        Use query string param 'a' like so '?a=PUT_TOKEN_SUFFIX_HERE'.
    `
    console.error(longMsg);
    return '********* [XX] BLAH BLAH THIS TOKEN IS INVALID *********';
}

function populateForm(preset) {
    const latLonInput = document.getElementById('latlon');
    latLonInput.value = preset;
    document.getElementById('submitBtnId').click();
}

function drawCircle(lat, lon, radius) {
    var circle = L.circle([lat, lon], {
        color: 'red',
        fillOpacity: 0.1,
        radius: radius,
        weight: WEIGHT,
    });
    circle.addTo(map);
    return circle;
}

// I use "segment" to refer to the shape defined by lower-left corner and N deg east & N deg north.
// Technically it's not a square; not sure what this shape is called in cartography.
function drawSegment(lat, lon, degreesVert, degreesHoriz) {
    var lowerLeft = [lat, lon];
    var lowerRight = [lat, lon + degreesHoriz];
    var upperRight = [lat + degreesVert, lon + degreesHoriz];
    var upperLeft = [lat + degreesVert, lon];
    var segment = L.polygon([lowerLeft, lowerRight, upperRight, upperLeft, lowerLeft], {
        color: 'green',
        fillOpacity: 0.2,
        weight: 1,
    }).addTo(map);
    return segment;
}

// Example rounding PI to nearest 0.0001: 3.1415
// Example rounding PI to nearest 0.05: 3.1
function roundDownToNearestFractionOfDegree(numberToRoundDown, fractionOfDegree) {
    return Math.floor(numberToRoundDown / fractionOfDegree) * fractionOfDegree;
}

function isOverlap(circle, sw, se, ne, nw) {
    var center = circle.getLatLng();
    var radius = circle.getRadius();
    if (center.distanceTo(sw) <= radius
        || center.distanceTo(se) <= radius
        || center.distanceTo(ne) <= radius
        || center.distanceTo(nw) <= radius
    ) {
        return true;
    } else {
        return false;
    }
}

function constructTargetingString() {
    let kvTargetingString = 'geo_segment IN ['
    for (const [key, value] of segmentMap.entries()) {
        var corner = JSON.parse(key);
        var cornerRepresentation = fracLabel
        + (parseFloat(corner[0]).toFixed(3) * 1000).toString()
        + (parseFloat(corner[1]).toFixed(3) * 1000).toString();
        kvTargetingString += cornerRepresentation + ', ';
    }
    if (segmentMap.size > 0) {
        kvTargetingString = kvTargetingString.slice(0, -2); // Remove the last comma and space
    }
    kvTargetingString += ']';
    return kvTargetingString
}

function displayTargetingString(kvTargetingString) {
    let div = document.getElementById("outputContent");
    div.textContent = kvTargetingString;
}

const toggleCircleChk = document.getElementById('toggleCircle');
const radiusInput = document.getElementById('radius');
const circleAnchoringSelect = document.getElementById('circle_anchoring');
const textToGreyOut = document.getElementById('textToGreyOut');
radiusInput.disabled = !toggleCircleChk.checked;
circleAnchoringSelect.disabled = !toggleCircleChk.checked;
if (!toggleCircleChk.checked) {
    textToGreyOut.classList.add('grey-out');
}


// Add an event listener to the checkbox
toggleCircleChk.addEventListener('change', () => {
    // Disable or enable the radius field based on checkbox state
    radiusInput.disabled = !toggleCircleChk.checked;
    circleAnchoringSelect.disabled = !toggleCircleChk.checked;
    // Add or remove the "grey-out" class based on checkbox state
    if (toggleCircleChk.checked) {
        textToGreyOut.classList.remove('grey-out');
    } else {
        textToGreyOut.classList.add('grey-out');
    }
});


// Form submission event listener
document.getElementById('mapForm').addEventListener('submit', function (event) {
    event.preventDefault();

    const latLonStr = document.getElementById('latlon').value;
    const values = latLonStr.split(',');
    var lat = parseFloat(values[0]);
    var lon = parseFloat(values[1]);

    var seg_size = document.getElementById('seg_size').value;
    fracOfDegreeHoriz = FRACTION_OF_DEGREE_M;
    fracLabel = 'M';
    if (seg_size == 'x-small') {
        fracOfDegreeHoriz = FRACTION_OF_DEGREE_XS;
        fracLabel = 'XS';
    } else if (seg_size == 'small') {
        fracOfDegreeHoriz = FRACTION_OF_DEGREE_S;
        fracLabel = 'S';
    } else if (seg_size == 'large') {
        fracOfDegreeHoriz = FRACTION_OF_DEGREE_L;
        fracLabel = 'L';
    } else if (seg_size == 'x-large') {
        fracOfDegreeHoriz = FRACTION_OF_DEGREE_XL;
        fracLabel = 'XL';
    }

    fracOfDegreeVert = fracOfDegreeHoriz;
    // Make geo segments more square-ish?
    if (document.getElementById('squareSegs').checked) {
        var verticalSquishFactor = parseFloat(Math.abs(Math.cos(lat * Math.PI / 180)).toFixed(2)); // Length of 1 degree of longitude is proportional to cos(latitude)
        fracOfDegreeVert = fracOfDegreeHoriz * verticalSquishFactor;
    }
    console.log('Frac of degree (horiz, vert): ' + fracOfDegreeHoriz.toString() + ' ' + fracOfDegreeVert.toString());

    // Point positioning relative to nearest geo segment.
    var circle_anchoring = document.getElementById('circle_anchoring').value;
    if (circle_anchoring == 'center') {
        lat = roundDownToNearestFractionOfDegree(lat, fracOfDegreeVert) + fracOfDegreeVert / 2;
        lon = roundDownToNearestFractionOfDegree(lon, fracOfDegreeHoriz) + fracOfDegreeHoriz / 2;
    } else if (circle_anchoring == 'corner') {
        lat = roundDownToNearestFractionOfDegree(lat, fracOfDegreeVert);
        lon = roundDownToNearestFractionOfDegree(lon, fracOfDegreeHoriz);
    }

    // Clear existing layers
    map.eachLayer(function (layer) {
        if (!layer._url) { // Don't remove the tile layer
            map.removeLayer(layer);
        }
    });

    // Recenter the map on the new coordinates
    map.setView([lat, lon], 16);
    L.marker([lat, lon]).addTo(map);

    // REMEMBER to reinitialize the set of segments.
    segmentMap.clear();

    // Draw the circle and its approximation with geo segments?
    if (toggleCircleChk.checked) {
        var radius = parseFloat(document.getElementById('radius').value);
        var circle = drawCircle(lat, lon, radius);
        if (DEBUG) {
            L.rectangle(circle.getBounds(), {color: "blue", weight: 1, fillOpacity: 0.1, dashArray: "5, 5"}).addTo(map);
        }

        // Get the longitude (west) and latitude (south) that's the nearest fracOfDegreeHoriz left of 
        // and the nearest fracOfDegreeVert below the bounding square. Then increment toward the right
        // and toward the top by the corresponding fracOfDegree[direction] until just beyond the bounding rect.
        var south = circle.getBounds().getSouth();
        var southAdj = roundDownToNearestFractionOfDegree(south, fracOfDegreeVert);
        // Draw tiles that overlap the circle
        while (southAdj < circle.getBounds().getNorth()) {
            var west = circle.getBounds().getWest();
            var westAdj = roundDownToNearestFractionOfDegree(west, fracOfDegreeHoriz);
            while (westAdj < circle.getBounds().getEast()) {
                var sw = L.latLng(southAdj, westAdj);
                var se = L.latLng(southAdj, westAdj + fracOfDegreeHoriz);
                var ne = L.latLng(southAdj + fracOfDegreeVert, westAdj + fracOfDegreeHoriz);
                var nw = L.latLng(southAdj + fracOfDegreeVert, westAdj);
                if (isOverlap(circle, sw, se, ne, nw)) {
                    let key = JSON.stringify([southAdj.toFixed(5), westAdj.toFixed(5)]);
                    let segment = drawSegment(southAdj, westAdj, fracOfDegreeVert, fracOfDegreeHoriz);
                    segmentMap.set(key, segment);
                }
                westAdj += fracOfDegreeHoriz;
            }
            southAdj += fracOfDegreeVert;
        }
    } else {
        // Draw the segment that contains the lat/lon.
        const southAdj = roundDownToNearestFractionOfDegree(lat, fracOfDegreeVert);
        const westAdj = roundDownToNearestFractionOfDegree(lon, fracOfDegreeHoriz);
        const southAdjFixed = southAdj.toFixed(5);
        const westAdjFixed = westAdj.toFixed(5);
        const key = JSON.stringify([southAdjFixed, westAdjFixed]);
        let segment = drawSegment(southAdj, westAdj, fracOfDegreeVert, fracOfDegreeHoriz);
        segmentMap.set(key, segment);
    }
    // Update the output div with the targeting string
    displayTargetingString(constructTargetingString());
    console.log('Segments in set: ' + segmentMap.size);
});  

map.on('click', function(event) {
    if (fracLabel === '') { 
        return; // Don't do anything if form hasn't been submitted yet.
    }
    const lat = event.latlng.lat;
    const lon = event.latlng.lng;
    
    // Determine if the click is within a geo segment
    const southAdj = roundDownToNearestFractionOfDegree(lat, fracOfDegreeVert);
    const westAdj = roundDownToNearestFractionOfDegree(lon, fracOfDegreeHoriz);
    const southAdjFixed = southAdj.toFixed(5);
    const westAdjFixed = westAdj.toFixed(5);
    const key = JSON.stringify([southAdjFixed, westAdjFixed]);
    if (segmentMap.has(key)) {
        // Remove the segment from map and from the set
        let segment = segmentMap.get(key);
        map.removeLayer(segment);
        segmentMap.delete(key);
        console.log('Removed segment at ' + key);
    } else {
        // Draw the segment on the map and add it to the set
        let segment = drawSegment(southAdj, westAdj, fracOfDegreeVert, fracOfDegreeHoriz);
        segmentMap.set(key, segment);
        console.log('Added segment at ' + key);
    }

    // Update the output div with the new targeting string
    displayTargetingString(constructTargetingString());
    console.log('Segments in set: ' + segmentMap.size);
});
