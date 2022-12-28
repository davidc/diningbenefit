#!/usr/bin/env python3
import hashlib
import json
import os
import re
import sys

from urllib.parse import quote
from urllib.request import urlretrieve

ENABLE_NOMINATIM_LOOKUPS = True

skipped_geocode_fail = 0

cuisines = set()
populated_countries = set()


def read_json(filename):
    with open(filename, 'rb') as f:
        return json.load(f)


def write_json(filename, data):
    with open(filename, 'w', encoding='UTF-8') as f:
        json.dump(data, f)


def get_data(key, url):
    cache_file = os.path.join('cache', key) + '.json'

    # TODO check if cache is too old
    if not os.path.exists(cache_file):
        urlretrieve(url, cache_file)

    return read_json(cache_file)


def fix_cuisine(cuisine):
    if cuisine == 'Österreichisch':
        return 'Austrian'
    elif cuisine == 'Italienisch':
        return 'Italian'
    elif cuisine == 'Argentinean':
        return 'Argentinian'
    elif cuisine == 'Mediterrean':
        return 'Mediterranean'
    elif cuisine == 'Latinamerican':
        return 'Latin American'
    elif cuisine == 'modern Nordic':
        return 'Modern Nordic'
    return cuisine


def add_merchant(merchant, country_name):
    global skipped_geocode_fail
    if merchant['isMerchantGroup']:
        print('%s is a merchant group' % merchant['name'])
        objs = []
        for subMerchant in merchant['merchants']:
            objs += add_merchant(subMerchant, country_name)
        return objs

    if merchant['onlineOnly']:
        return []

    # It's a single merchant

    # print(merchant['name'])

    lng_lat = None
    bits = merchant['googleMapsUrl'].split('@')
    if len(bits) >= 2:
        bits = bits[1].split(',')
        if len(bits) >= 2:
            lng_lat = (bits[1], bits[0])

    # Fix up some errors

    if merchant['name'] == '14 Hills':
        lng_lat = ('-0.0808064', '51.5122729')
    elif merchant['name'] == 'Cavo':
        lng_lat = ('-0.1298216', '51.5156015')
    elif merchant['name'] == 'Hutong':
        lng_lat = ('-0.0865353', '51.504397')
    elif merchant['name'] == 'Oblix':
        lng_lat = ('-0.0865828', '51.5042567')
    elif merchant['name'] == 'Plateau':
        lng_lat = ('-0.0166346', '51.5046937')
    elif merchant['name'] == 'Pollen Street Social':
        lng_lat = ('-0.1423298', '51.5133448')
    elif merchant['name'] == 'Savoy Grill Gordon Ramsay':
        lng_lat = ('-0.1205518', '51.5106223')
    elif merchant['name'] == 'The Ivy Bath Brasserie':
        lng_lat = ('-2.3612368', '51.3839094')

    if lng_lat is None:
        if not ENABLE_NOMINATIM_LOOKUPS:
            print('No coords found for %s, SKIPPING Nominatim' % merchant['name'], file=sys.stderr)
            skipped_geocode_fail += 1
            return []

        postcode = merchant['postcode']

        if postcode == 'W1G 6BS':  # Incorrect postcode for Benares
            postcode = 'W1J 6BS'
        elif postcode == 'EC1Y 2BJ':  # Incorrect postcode for Daffodil Mulligan
            postcode = 'EC1Y 2AS'

        lookup_name = merchant['name']

        if lookup_name == 'Coya Mayfair':
            lookup_name = 'Coya'
        elif lookup_name == 'Fiume':
            lookup_name = 'Fiume Restaurant'

        url = 'https://nominatim.openstreetmap.org/search?q=%s%%2C+%s&format=json' \
              % (quote(lookup_name), quote(postcode))

        url_hash = hashlib.md5(url.encode()).hexdigest()

        print('No coords found for %s, asking Nominatim at %s (cache %s)' % (merchant['name'], url, url_hash))
        response = get_data('nom_%s' % url_hash, url)

        if len(response) == 0:
            print('Warning: Nominatim couldn''t find coords for %s' % (merchant['name']), file=sys.stderr)
            skipped_geocode_fail += 1
            return []

        lng_lat = (response[0]['lon'], response[0]['lat'])

    cuisine = fix_cuisine(merchant['cuisine']['title'])

    feature = {
        'type': 'Feature',
        'geometry': {
            'type': 'Point',
            'coordinates': lng_lat,
        },
        'properties': {
            'name': merchant['name'],
            'address': merchant['address'] + '<br/>' + merchant['city']['title'] + '<br/>' +
                       merchant['postcode'] + '<br/>' + country_name,
            'cuisine': cuisine,
        },
    }

    if merchant['businessData']['website']:
        feature['properties']['website'] = merchant['businessData']['website']

    if 'phone' in merchant['businessData'] and merchant['businessData']['phone']:
        feature['properties']['phone'] = merchant['businessData']['phone']

    # Does it match any chain?

    for chain in chains:
        if re.search(chain['match'], merchant['name'], re.IGNORECASE):
            feature['properties']['chain'] = chain['id']
            print("%s matched chain %s" % (merchant['name'] , chain['name']))
            break

    cuisines.add(cuisine)

    return [feature]


def process_country(country_code, country_name):
    merchants = get_data('country_%s' % country_code,
                         'https://dining-offers-prod.amex.r53.tuimedia.com/api/country/%s/merchants' % country_code)

    features = []
    for merchant in merchants:
        features += add_merchant(merchant, country_name)

    if len(features) > 0:
        populated_countries.add((country_code, country_name))

    return features


def process_world():
    countries = get_data('countries', 'https://dining-offers-prod.amex.r53.tuimedia.com/api/countries')
    features = []
    for world_zone in countries:
        for country in world_zone['countries']:
            country_code = country['key']
            print(country_code)
            features += process_country(country_code, country['title'])
    return features


chains = read_json('chain_defs.json')

geojson = {
    'type': 'FeatureCollection',
    'features': process_world(),
}

write_json('../src/data/restaurants.geojson', geojson)


def generate_chain_map():
    out_chains = {}
    for chain in chains:
        out_chains[chain['id']] = chain['name']
    return out_chains


write_json('../src/data/chains.json', generate_chain_map())


# Get the bounding boxes only of countries we're interested in:

def generate_country_bboxes():
    # from https://github.com/sandstrom/country-bounding-boxes/blob/master/bounding-boxes.json
    all_bboxes = read_json('bounding-boxes.json')
    all_bboxes['HK'] = ["Hong Kong", [114.0028131, 22.1193278, 114.3228131, 22.4393278]]
    all_bboxes['SG'] = ['Singapore', [103.6920359, 1.1304753, 104.0120359, 1.4504753]]

    out_bboxes = {}

    for (country_code, country_name) in populated_countries:
        out_bboxes[country_code] = [country_name, all_bboxes[country_code][1]]

    return out_bboxes


write_json('../src/data/country_bboxes.json', generate_country_bboxes())

write_json('../src/data/cuisines.json', list(cuisines))

if skipped_geocode_fail > 0:
    print('Skipped %d restaurants due to failed geocoding' % skipped_geocode_fail, file=sys.stderr)
