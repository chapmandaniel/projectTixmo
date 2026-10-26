import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('prerequisites', Path(__file__).with_name('railway-release-prerequisites.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Checks(unittest.TestCase):
    def data(self, value=None, origin=None):
        return {'api': {} if value is None else {'WAITING_ROOM_MAX_CONCURRENT_REQUESTS': value},
                'dashboard': {'VITE_API_URL': origin or 'https://' + module.ORIGIN + '/api/v1'}}

    def test_limit_matches_javascript_safe_integer_contract(self):
        for value in [None, '1', '1000', '9007199254740991', '00001', '0' * 32767 + '1']:
            with self.subTest(value_length=None if value is None else len(value)):
                self.assertTrue(module.evaluate(self.data(value))['waitingRoomLimitAbsentOrPositiveSafeInteger'])
        for value in ['', '0', '-1', '+1', ' 1', '1 ', '1.0', '1e3', '9007199254740992', '9' * 32768, '１２', '${{x.limit}}']:
            with self.subTest(value_length=len(value)):
                self.assertFalse(module.evaluate(self.data(value))['waitingRoomLimitAbsentOrPositiveSafeInteger'])

    def test_only_expected_https_origin(self):
        for suffix in ['', '/', '/api/v1', ':443/api/v1']:
            self.assertTrue(module.evaluate(self.data(origin='https://' + module.ORIGIN + suffix))['dashboardConfiguredApiOriginMatches'])
        for value in ['http://' + module.ORIGIN, 'https://evil.test', 'https://' + module.ORIGIN + '.evil.test',
                      'https://user:secret@' + module.ORIGIN, 'https://@' + module.ORIGIN,
                      'https://' + module.ORIGIN + ':444', 'https://' + module.ORIGIN + '/?secret=x',
                      'https://' + module.ORIGIN + '/#x', 'https://' + module.ORIGIN + '/\n', '${{api.URL}}']:
            self.assertFalse(module.evaluate(self.data(origin=value))['dashboardConfiguredApiOriginMatches'])

    def test_missing_dashboard_value_fails_comparison(self):
        self.assertFalse(module.evaluate({'api': {}, 'dashboard': {}})['dashboardConfiguredApiOriginMatches'])

    def test_shapes_sizes_and_types_fail_closed(self):
        for bad in [None, [], {'api': {}}, {'api': {}, 'dashboard': {}, 'extra': {}},
                    {'api': {'WAITING_ROOM_MAX_CONCURRENT_REQUESTS': True}, 'dashboard': {}},
                    {'api': {'WAITING_ROOM_MAX_CONCURRENT_REQUESTS': 1}, 'dashboard': {}},
                    {'api': {'BAD.KEY': 'x'}, 'dashboard': {}},
                    {'api': {'x': 'y' * 32769}, 'dashboard': {}},
                    {'api': {f'key{i}': 'x' for i in range(257)}, 'dashboard': {}},
                    {'api': {f'key{i}': 'x' * 32768 for i in range(70)}, 'dashboard': {}}]:
            calls = []
            result = module.read_once(lambda query: calls.append(query) or bad)
            self.assertEqual(result, {'status': 'failed_closed', 'rawErrorsSuppressed': True, 'retried': False})
            self.assertEqual(calls, [module.QUERY])

    def test_success_and_errors_never_emit_values(self):
        data = self.data('1234')
        data['api']['TOKEN'] = 'SENSITIVE_SENTINEL'
        result = module.read_once(lambda query: data)
        self.assertNotIn('SENSITIVE_SENTINEL', json.dumps(result))
        self.assertNotIn('1234', json.dumps(result))
        self.assertNotIn(module.ORIGIN, json.dumps(result))
        self.assertFalse(result['deploymentMetadataInspectable'])
        calls = []
        def fail(query):
            calls.append(query)
            raise RuntimeError('SENSITIVE_SENTINEL')
        self.assertEqual(module.read_once(fail)['status'], 'failed_closed')
        self.assertEqual(calls, [module.QUERY])


if __name__ == '__main__':
    unittest.main()
