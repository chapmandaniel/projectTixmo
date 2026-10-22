#!/usr/bin/env python3
"""Fixed-target, redacted checks; transport injection is deliberately explicit.

A reviewed caller may pass existing railway-wiring-redacted.query_data to read_once.
There is no live CLI mode: the inherited transport auto-installs via npx, so it
must not be invoked until a maintained, non-installing transport is available.
No deployment/image/startup conclusion is inferred from service-level variables.
"""
import json
import re
from urllib.parse import urlsplit

PROJECT = 'c1c17660-3110-4fa8-a0bd-aca06d13a3ed'
ENVIRONMENT = 'dd8e0541-0e1d-478d-bec1-1f6bb7be1e2d'
API = '13efc131-9ae3-4305-9628-55c783286990'
DASHBOARD = '275c6d17-fb2a-4768-aa6a-489fa95bacc1'
ORIGIN = 'backend-api-production-cbfa.up.railway.app'
QUERY = ('query { api: variables(projectId: "' + PROJECT + '", environmentId: "' +
         ENVIRONMENT + '", serviceId: "' + API + '", unrendered: false) '
         'dashboard: variables(projectId: "' + PROJECT + '", environmentId: "' +
         ENVIRONMENT + '", serviceId: "' + DASHBOARD + '", unrendered: false) }')


def variable_map(value):
    if type(value) is not dict or len(value) > 256:
        raise ValueError('invalid response')
    for key, item in value.items():
        if (type(key) is not str or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,127}', key)
                or type(item) is not str or len(item) > 32768):
            raise ValueError('invalid response')
    return value


def evaluate(data):
    if type(data) is not dict or set(data) != {'api', 'dashboard'}:
        raise ValueError('invalid response')
    # Bound the whole decoded response as well as each field before inspecting it.
    if len(json.dumps(data, ensure_ascii=True)) > 2 * 1024 * 1024:
        raise ValueError('invalid response')
    api, dashboard = variable_map(data['api']), variable_map(data['dashboard'])
    value = api.get('WAITING_ROOM_MAX_CONCURRENT_REQUESTS')
    # Strip leading zeros and bound significant digits BEFORE integer conversion.
    digits = value.lstrip('0') if value is not None else ''
    valid_limit = value is None or (
        bool(re.fullmatch(r'[0-9]+', value)) and len(digits) <= 16
        and 0 < int(digits or '0') <= 9007199254740991
    )
    configured = dashboard.get('VITE_API_URL', '')
    try:
        url = urlsplit(configured)
        origin_matches = (url.scheme == 'https' and url.hostname == ORIGIN
                          and url.port in (None, 443) and url.username is None
                          and url.password is None and not url.query and not url.fragment
                          and not any(ch.isspace() for ch in configured))
    except ValueError:
        origin_matches = False
    return {
        'waitingRoomLimitAbsentOrPositiveSafeInteger': bool(valid_limit),
        'dashboardConfiguredApiOriginMatches': bool(origin_matches),
        'deploymentMetadataInspectable': False,
        'deploymentMetadataGap': 'verified_deployment_schema_and_effective_config_required',
    }


def read_once(query_data):
    """Reuse a separately reviewed transport once; never retry or print exceptions."""
    try:
        return evaluate(query_data(QUERY))
    except Exception:
        return {'status': 'failed_closed', 'rawErrorsSuppressed': True, 'retried': False}


if __name__ == '__main__':
    # Import-only read API prevents accidental credential/network acquisition.
    print('{"status":"transport_not_enabled","rawErrorsSuppressed":true}')
    raise SystemExit(1)
