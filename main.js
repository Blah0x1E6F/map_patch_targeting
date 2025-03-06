"use strict";

const FRACTION_OF_DEGREE_XS = 0.001;
const FRACTION_OF_DEGREE_S = 0.002;
const FRACTION_OF_DEGREE_MED = 0.003;
const FRACTION_OF_DEGREE_L = 0.005;
const FRACTION_OF_DEGREE_XL = 0.008;
const WEIGHT = 2;

var defLat = 41.010418;
var defLon = -73.920776;
var map = L.map('map').setView([defLat, defLon], 16);
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=' + mapBoxToken, {
    maxZoom: 18,
    id: 'mapbox/streets-v11', // You can use other styles like 'mapbox/satellite-v9'
    tileSize: 512,
    zoomOffset: -1,
    accessToken: mapBoxToken
}).addTo(map);

L.marker([defLat, defLon]).addTo(map);

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

// Form submission event listener
document.getElementById('mapForm').addEventListener('submit', function (event) {
    event.preventDefault();

    const latLonStr = document.getElementById('latlon').value;
    const values = latLonStr.split(',');
    var lat = parseFloat(values[0]);
    var lon = parseFloat(values[1]);

    var radius = parseFloat(document.getElementById('radius').value);

    var seg_size = document.getElementById('seg_size').value;
    var fracOfDegreeHoriz = FRACTION_OF_DEGREE_MED;
    var fracLabel = 'M';
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

    var fracOfDegreeVert = fracOfDegreeHoriz;
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

    var circle = drawCircle(lat, lon, radius);
    var marker = L.marker([lat, lon]).addTo(map);

    // Get the longitude (west) and latitude (south) that's the nearest fracOfDegreeHoriz left of 
    // and the nearest fracOfDegreeVert below the bounding square. Then increment toward the right
    // and toward the top by the corresponding fracOfDegree[direction] until just beyond the bounding rect.
    var kvTargetingString = 'geo_segment IN ['
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
                drawSegment(southAdj, westAdj, fracOfDegreeVert, fracOfDegreeHoriz);
                var cornerRepresentation = fracLabel
                    + (southAdj.toFixed(3) * 1000).toString()
                    + (westAdj.toFixed(3) * 1000).toString();
                kvTargetingString += cornerRepresentation + ', ';
            }
            westAdj += fracOfDegreeHoriz;
        }
        southAdj += fracOfDegreeVert;
    }
    kvTargetingString = kvTargetingString.slice(0, -2) + ']'; // Remove the last comma and space and add closing bracket
    console.log(kvTargetingString);

    let div = document.getElementById("targetingStr");
    let readMoreButton = document.getElementById("readMoreButton");

    // Truncate the text and add "Read More" button if necessary
    if (kvTargetingString.length > 150) {
        div.textContent = kvTargetingString.slice(0, 150) + "...";
        readMoreButton.style.display = "inline-block";
    } else {
        div.textContent = kvTargetingString;
        readMoreButton.style.display = "none";
    }

    // Show full text in a popup on clicking "Read More"
    readMoreButton.addEventListener("click", function () {
        alert(kvTargetingString); // You can replace this with a modal or any other way to display full text
    });

});    
