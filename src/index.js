import maplibregl from 'maplibre-gl';
import "maplibre-gl/dist/maplibre-gl.css";

import Analytics from 'analytics';
import googleAnalytics from '@analytics/google-analytics';


import './index.css';

/* Load data */

import chains from './data/chains.json';
import country_bboxes from './data/country_bboxes.json';
import cuisines from './data/cuisines.json';
import restaurants from './data/restaurants.geojson';


if (PRODUCTION) {

    const analytics = Analytics({
        // app: 'awesome-app',
        debug: true,
        plugins: [
            googleAnalytics({
                measurementIds: ['G-G8Q3LXNDMP']
            })
        ]
    })

    analytics.page();
}

var map = new maplibregl.Map({
    container: 'map',
    style:
        'https://api.maptiler.com/maps/streets/style.json?key=' + MAPTILER_KEY,
    center: [0, 54],
    zoom: 5,
    hash: true,
    pitchWithRotate: false,
    dragRotate: false,
    touchPitch: false,
});

var mapData = undefined;

class FilterCuisineControl {
    onAdd(map) {
        this._map = map;
        // this._container = document.createElement('div');
        // this._container.className = 'maplibregl-ctrl';
        // this._container.innerHTML = '<button>Hello, world</button>';
        this._container = document.getElementById('filterCuisineControl');
        this._container.style.display = 'block';

        let cuisineSelectSection = document.getElementById('cuisineSelectSection');
        let cuisineOpenIcon = document.getElementById('cuisineOpenIcon');
        document.getElementById('cuisineToggle').addEventListener('click', function (e) {
            if (cuisineSelectSection.style.display === 'none') {
                cuisineSelectSection.style.display = 'block';
                cuisineOpenIcon.innerHTML = '&#9650;';
            } else {
                cuisineSelectSection.style.display = 'none';
                cuisineOpenIcon.innerHTML = '&#9660;';
            }
        })

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

class FilterChainsControl {
    onAdd(map) {
        this._map = map;
        // this._container = document.createElement('div');
        // this._container.className = 'maplibregl-ctrl';
        // this._container.innerHTML = '<button>Hello, world</button>';
        this._container = document.getElementById('filterChainsControl');
        this._container.style.display = 'block';
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

class JumpToCountryControl {
    onAdd(map) {
        this._map = map;
        // this._container = document.createElement('div');
        // this._container.className = 'maplibregl-ctrl';
        // this._container.innerHTML = '<button>Hello, world</button>';
        this._container = document.getElementById('jumpToCountryControl');
        this._container.style.display = 'block';
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

class InfoControl {
    onAdd(map) {
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        let button = document.createElement('button');
        button.className = 'maplibregl-ctrl-geolocate mapboxgl-ctrl-geolocate';
        button.style.fontSize = '20px';
        button.innerHTML = '&#128712;';

        button.onclick = function () {
            var infoBox = document.getElementById('infoBox');
            infoBox.style.display = 'block';

            function keyListener(e) {
                if (e.key === 'Escape') {
                    closeInfoBox();
                    e.preventDefault();
                }
            }

            function closeInfoBox() {
                infoBox.style.display = 'none';
                document.removeEventListener('keydown', keyListener);
            }

            document.getElementById('infoBoxCloser').onclick = function () {
                closeInfoBox(infoBox);
            }

            document.addEventListener('keydown', keyListener);
        }

        this._container.appendChild(button);
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
    }
}

map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'bottom-right');
// map.addControl(new maplibregl.ScaleControl());

map.addControl(
    new maplibregl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: false,
        // showUserLocation: false,
        showAccuracyCircle: false,
        fitBoundsOptions: {maxZoom: 14}
    }), 'bottom-right'
);

// map.addControl(new HelloWorldControl(), 'top-left');
map.addControl(new FilterCuisineControl(), 'top-left');
map.addControl(new FilterChainsControl(), 'top-left');
map.addControl(new JumpToCountryControl(), 'top-right');
map.addControl(new InfoControl(), 'bottom-right');


function addCountryBboxLayer(data) {
    // Create a source for countries

    features = []
    for (const country_code in data) {
        bbox = data[country_code][1]
        features.push({
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [bbox[0], bbox[1]],
                    [bbox[0], bbox[3]],
                    [bbox[2], bbox[3]],
                    [bbox[2], bbox[1]],
                    [bbox[0], bbox[1]],
                ]]
            }
        })
    }

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    map.addSource('countries', {
        type: 'geojson',
        data: geojson
    })

    map.addLayer({
        'id': 'country-bbox',
        'type': 'fill',
        'source': 'countries',
        'layout': {},
        'paint': {
            'fill-color': '#088',
            'fill-opacity': 0.8
        }
    });
    return geojson;
}

function setupCountrySelector(data) {
    var countrySelect = document.getElementById('countrySelect');
    if (countrySelect) {
        let countries = []
        for (const country_code in data) {
            let country_name = data[country_code][0];
            countries.push([country_name, country_code]);
        }
        countries.sort();
        for (const country of countries) {
            let country_name = country[0];
            let country_code = country[1];
            countrySelect.appendChild(new Option(country_name, country_code));
        }
        countrySelect.onchange = function () {

            // Get bbox of selected country
            let bbox = data[countrySelect.value][1]
            console.log(bbox)

            map.fitBounds([
                [bbox[0], bbox[1]],
                [bbox[2], bbox[3]]
            ])

            // Select nothing again
            countrySelect.value = '';
            countrySelect.blur()
        }
    }
}

var cuisine_checkboxes = {};

function setupCuisineSelector(data) {
    var cuisineSelect = document.getElementById('cuisineSelect');
    if (cuisineSelect) {
        data.sort();
        let cuisine_id = 1;
        for (const cuisine of data) {
            let div = document.createElement('div');
            let checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'cuisine_' + cuisine_id;
            checkbox.value = cuisine;
            checkbox.checked = true;
            checkbox.className = 'cuisineCheckbox';
            cuisine_checkboxes[cuisine] = checkbox;
            checkbox.addEventListener('change', (e) => {
                cuisinesChanged();
                // console.log('cuisine ' + cuisine)
                // console.log(checkbox.checked)
            })

            div.appendChild(checkbox);
            let label = document.createElement('label');
            label.htmlFor = checkbox.id
            label.innerText = cuisine;
            div.appendChild(label);
            cuisineSelect.appendChild(div);
            cuisine_id++;
        }

        cuisinesChanged();

        document.getElementById('cuisineSelectAll').addEventListener('click', function (e) {
            for (const cuisine in cuisine_checkboxes) {
                cuisine_checkboxes[cuisine].checked = true;
            }
            cuisinesChanged();
        })
        document.getElementById('cuisineSelectNone').addEventListener('click', function (e) {
            for (const cuisine in cuisine_checkboxes) {
                cuisine_checkboxes[cuisine].checked = false;
            }
            cuisinesChanged();
        })

        function cuisinesChanged() {
            for (const feature of mapData['features']) {
                let checkbox = cuisine_checkboxes[feature.properties.cuisine];
                if (checkbox.checked) {
                    delete (feature.properties.hidden);
                } else {
                    feature.properties.hidden = true;
                }
            }

            let totalCuisines = 0;
            let selectedCuisines = 0;
            for (const cuisine in cuisine_checkboxes) {
                totalCuisines++;
                selectedCuisines += cuisine_checkboxes[cuisine].checked ? 1 : 0;
            }

            let text = 'Cuisine ('

            if (selectedCuisines == 0)
                text += 'None';
            else if (selectedCuisines == totalCuisines)
                text += 'All';
            else
                text += selectedCuisines + ' of ' + totalCuisines;
            text += ' selected)';

            document.getElementById('cuisineLabel').innerText = text;

            map.getSource('restaurants').setData(mapData);
        }
    }
}

function setupMapData(data) {
    mapData = data;

    // Add a new source from our GeoJSON data and
    // set the 'cluster' option to true. GL-JS will
    // add the point_count property to your source data.
    map.addSource('restaurants', {
        type: 'geojson',
        data: data,
        filter: ['!', ['has', 'hidden']],
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
        attribution: '&copy; American Express Company',
    });

    map.addLayer({
        id: 'unclustered-restaurants',
        source: 'restaurants',
        type: 'circle',
        // type: 'symbol',
        // layout: {
        //     'icon-image': 'custom-marker',
        // },

        filter: ['!', ['has', 'point_count']],
        paint: {
            'circle-color': '#006fcf',
            'circle-radius': 5,
            // 'circle-stroke-color': '#000000',
            'circle-stroke-width': 1,
        }
    });

    map.addLayer({
        id: 'clustered-restaurants',
        source: 'restaurants',
        type: 'circle',
        // type: 'symbol',
        // layout: {
        //     'icon-image': 'custom-marker',
        // },

        filter: ['has', 'point_count'],
        paint: {
            'circle-color': '#e4a42c',
            'circle-radius': 15,
            // 'circle-stroke-color': '#000000',
            'circle-stroke-width': 1,
        }
    });

    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'restaurants',
        // filter: ['has', 'point_count'],
        layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
        }
    });

    // Click a cluster to zoom in
    map.on('mouseenter', 'clustered-restaurants', function () {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'clustered-restaurants', function () {
        map.getCanvas().style.cursor = '';
    });

    map.on('click', 'clustered-restaurants', function (e) {
        console.log(e);
        var features = map.queryRenderedFeatures(e.point, {
            layers: ['clustered-restaurants']
        });
        var clusterId = features[0].properties.cluster_id;
        map.getSource('restaurants').getClusterExpansionZoom(
            clusterId,
            function (err, zoom) {
                if (err) return;

                map.easeTo({
                    center: features[0].geometry.coordinates,
                    zoom: zoom
                });
            }
        );
    });

    // Click an unclustered point to get info

    map.on('mouseenter', 'unclustered-restaurants', function () {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'unclustered-restaurants', function () {
        map.getCanvas().style.cursor = '';
    });
    map.on('click', 'unclustered-restaurants', function (e) {
        var feature = e.features[0];
        var coordinates = feature.geometry.coordinates.slice();
        var restaurant = feature.properties;

        // Ensure that if the map is zoomed out such that
        // multiple copies of the feature are visible, the
        // popup appears over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        console.log(feature)

        var content = '<h1>' + restaurant.name + '</h1>'
            + restaurant.address + '<br/>'
            + '&#x1f374;&nbsp;' + restaurant.cuisine + '<br/>';
        if (restaurant.website) {
            let dom = restaurant.website.split("/")[2].replace("www.", "")
            content += '&#x1f310;&nbsp;<a href="' + restaurant.website + '" rel="nofollow" target="_blank">' + dom + '</a><br/>';
        }
        if (restaurant.phone)
            content += '&#128222;\n&nbsp;' + restaurant.phone + '<br/>';

        // Fly to the location of the restaurant

        map.flyTo({
            center: e.features[0].geometry.coordinates
        });


        new maplibregl.Popup({
                // offset: 25,
                className: 'restaurant-popup',
                focusAfterOpen: false
            }
        )
            .setLngLat(coordinates)
            .setHTML(content)
            .addTo(map);
    });
}

function mapLoaded() {
    // map.setLayoutProperty('country_1', 'text-field', [
    //     'get',
    //     'name:en'
    // ]);
    // map.setLayoutProperty('place_city', 'text-field', [
    //     'get',
    //     'name:en'
    // ]);

    // map.loadImage(
    //     'marker.svg',
    //     function (error, image) {
    //         if (error) throw error;
    //         map.addImage('custom-marker', image);
    //     }
    // );

    // fetch('data/restaurants.geojson')
    //     .then((response) => response.json())
    //     .then((data) => {
    //         setupMapData(data);
    //     })
    //     .catch((error) => console.log(error));
    setupMapData(restaurants);

    // Fetch the country list
    // fetch('data/country_bboxes.json')
    //     .then((response) => response.json())
    //     .then((data) => {
    //         setupCountrySelector(data);
    //     })
    //     .catch((error) => console.log(error));
    setupCountrySelector(country_bboxes);

    // Fetch the cuisine list
    // fetch('data/cuisines.json')
    //     .then((response) => response.json())
    //     .then((data) => {
    //         setupCuisineSelector(data);
    //     })
    //     .catch((error) => console.log(error));

    setupCuisineSelector(cuisines);
}

map.on('load', mapLoaded);


