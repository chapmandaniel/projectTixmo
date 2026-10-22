"""Offline regression tests. All network/database subprocesses are mocked."""
import copy
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("wiring", Path(__file__).with_name("railway-wiring-redacted.py"))
wiring = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wiring)


def valid_catalog():
    return {"serverVersion": "18.6 (Debian 18.6-package)", "databaseSizeBytes": 10368703,
            "migrations": [{"migration_name": "20251029024657_init", "checksum": "a" * 64,
                            "started_at": "2026-03-30T13:31:58+00:00", "finished_at": "2026-03-30T13:31:59+00:00",
                            "rolled_back_at": None, "applied_steps_count": 1}]}


def connection_data():
    return {"api": {"DATABASE_URL": "postgresql://fixture:NEVER_EMIT@postgres.railway.internal:5432/test"},
            "postgres": {"DATABASE_URL": "postgresql://fixture:NEVER_EMIT@postgres.railway.internal:5432/test",
                         "DATABASE_PUBLIC_URL": "postgresql://fixture:NEVER_EMIT@fixture.proxy.rlwy.net:12345/test"}}


class OfflineTests(unittest.TestCase):
    def test_error_classifier_emits_only_fixed_enums(self):
        cases = {"server certificate does not match host name NEVER_EMIT": "hostname_mismatch",
                 "SSL error: certificate verify failed NEVER_EMIT": "certificate_untrusted",
                 "self-signed certificate NEVER_EMIT": "certificate_untrusted",
                 "root certificate file NEVER_EMIT does not exist": "certificate_file_unavailable",
                 "server does not support SSL NEVER_EMIT": "tls_unavailable",
                 "password authentication failed NEVER_EMIT": "authentication_failed",
                 "permission denied NEVER_EMIT": "permission_denied",
                 "could not translate host name NEVER_EMIT": "dns_resolution_failed",
                 "timeout expired NEVER_EMIT": "connection_timeout",
                 "connection refused NEVER_EMIT": "connection_refused",
                 "canceling statement due to statement timeout NEVER_EMIT": "statement_timeout",
                 "canceling statement due to lock timeout NEVER_EMIT": "lock_timeout",
                 'relation "_prisma_migrations" does not exist NEVER_EMIT': "migration_catalog_absent",
                 "NEVER_EMIT": "unclassified_client_failure"}
        for raw, expected in cases.items():
            self.assertEqual(wiring.classify_client_error(raw), expected)
            self.assertNotIn("NEVER_EMIT", wiring.classify_client_error(raw))
        self.assertEqual(wiring.classify_client_error("x" * 65537), "diagnostic_unavailable")
        self.assertEqual(wiring.classify_client_error({"secret": "NEVER_EMIT"}), "diagnostic_unavailable")

    def test_canonical_catalog_redacts_package_suffix(self):
        data = valid_catalog()
        data["serverVersion"] = "18.6 (NEVER_EMIT)"
        out = wiring.validate_catalog(json.dumps(data))
        self.assertEqual(out["serverVersion"], "18.6")
        self.assertNotIn("NEVER_EMIT", json.dumps(out))

    def test_rejects_unbounded_wrong_typed_catalog_values(self):
        mutations = [("databaseSizeBytes", "NEVER_EMIT"), ("databaseSizeBytes", True),
                     ("databaseSizeBytes", -1), ("databaseSizeBytes", 2 ** 51),
                     ("serverVersion", "NEVER_EMIT"), ("serverVersion", "17.6"),
                     ("migrations", {}), ("migrations", [valid_catalog()["migrations"][0]] * 500)]
        for key, value in mutations:
            with self.subTest(key=key, type=type(value).__name__):
                data = valid_catalog()
                data[key] = value
                with self.assertRaises(ValueError):
                    wiring.validate_catalog(json.dumps(data))
        with self.assertRaises(ValueError):
            wiring.validate_catalog(" " * (256 * 1024 + 1))

    def test_rejects_each_invalid_ledger_field_and_duplicates(self):
        mutations = [("migration_name", "NEVER_EMIT"), ("checksum", "not_a_checksum"),
                     ("started_at", None), ("started_at", "2026-03-30T13:31:58"),
                     ("finished_at", "NEVER_EMIT"), ("rolled_back_at", {"secret": "NEVER_EMIT"}),
                     ("applied_steps_count", True), ("applied_steps_count", "NEVER_EMIT")]
        for key, value in mutations:
            with self.subTest(key=key):
                data = valid_catalog()
                data["migrations"][0][key] = value
                with self.assertRaises(ValueError):
                    wiring.validate_catalog(json.dumps(data))
        data = valid_catalog()
        data["migrations"].append(copy.deepcopy(data["migrations"][0]))
        with self.assertRaises(ValueError):
            wiring.validate_catalog(json.dumps(data))

    def test_psql_failure_nonzero_and_no_raw_error(self):
        output = io.StringIO()
        with patch.object(wiring, "query_data", return_value=connection_data()), patch.object(wiring.subprocess, "run", return_value=subprocess.CompletedProcess([], 2, "", "NEVER_EMIT")), redirect_stdout(output):
            with self.assertRaises(SystemExit) as error:
                wiring.catalog()
        self.assertEqual(error.exception.code, 1)
        self.assertNotIn("NEVER_EMIT", output.getvalue())
        self.assertEqual(json.loads(output.getvalue())["status"], "catalog_connection_or_query_failed")

    def test_target_rejection_precedes_connection(self):
        for role, key, url in [("api", "DATABASE_URL", "postgresql://fixture:pw@wrong.railway.internal:5432/test"),
                               ("postgres", "DATABASE_PUBLIC_URL", "postgresql://fixture:pw@outside.example:5432/test"),
                               ("postgres", "DATABASE_PUBLIC_URL", "http://fixture:pw@fixture.proxy.rlwy.net:12345/test"),
                               ("postgres", "DATABASE_PUBLIC_URL", "postgresql://fixture:pw@fixture.proxy.rlwy.net:12345/other")]:
            data = connection_data()
            data[role][key] = url
            with patch.object(wiring, "query_data", return_value=data), patch.object(wiring.subprocess, "run") as run:
                with self.assertRaises(ValueError):
                    wiring.catalog()
                run.assert_not_called()

    def test_fixed_tls_readonly_timeouts_and_no_password_in_arguments(self):
        output = io.StringIO()
        with patch.object(wiring, "query_data", return_value=connection_data()), patch.object(wiring.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(valid_catalog()), "")) as run, redirect_stdout(output):
            wiring.catalog()
        args, kwargs = run.call_args
        self.assertNotIn("NEVER_EMIT", repr(args))
        self.assertNotIn("NEVER_EMIT", output.getvalue())
        self.assertEqual(kwargs["env"]["PGSSLMODE"], "verify-full")
        self.assertEqual(kwargs["env"]["PGSSLROOTCERT"], "/etc/ssl/certs/ca-certificates.crt")
        self.assertEqual(kwargs["env"]["PGCONNECT_TIMEOUT"], "5")
        self.assertEqual(kwargs["timeout"], 25)
        self.assertIn("BEGIN READ ONLY;", kwargs["input"])
        self.assertIn("statement_timeout = '5s'", kwargs["input"])
        self.assertIn("lock_timeout = '1s'", kwargs["input"])
        self.assertIn("ROLLBACK;", kwargs["input"])
        self.assertNotIn("logs", kwargs["input"])

    def test_extra_service_id_cannot_escape_fixed_allowlist(self):
        edges = [{"node": {"name": role, "id": sid}} for role, sid in wiring.SERVICES.items()]
        edges.append({"node": {"name": "extra", "id": "NEVER_EMIT"}})
        data = {"project": {"services": {"edges": edges}}, "api": {"DATABASE_URL": "${{extra.DATABASE_URL}}"}, "dashboard": {}}
        result = wiring.receipt(data)
        self.assertNotIn("NEVER_EMIT", json.dumps(result))
        self.assertFalse(result["variables"][0]["allReferencesResolved"])
        self.assertFalse(result["variables"][0]["expectedServiceReference"])


if __name__ == "__main__":
    unittest.main()
