/**
 * @typedef {Object} Ga4Header
 * @property {string} name
 *
 * @typedef {Object} Ga4Row
 * @property {{ value: string }[]} [dimensionValues]
 * @property {{ value: string }[]} [metricValues]
 *
 * @typedef {Object} Ga4RunReportResponse
 * @property {Ga4Header[]} [dimensionHeaders]
 * @property {Ga4Header[]} [metricHeaders]
 * @property {Ga4Row[]} [rows]
 * @property {number} [rowCount]
 *
 * @typedef {Object} Ga4AdaptedRow
 * @property {Record<string, string>} dimensions
 * @property {Record<string, number>} metrics
 */

export const ga4DateToIso = (value) => {
    const raw = String(value || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return raw;
};

export const isoToGa4Date = (iso) => String(iso || '').replaceAll('-', '');

export const emptyGa4Report = (dimensionNames = [], metricNames = []) => ({
    dimensionHeaders: dimensionNames.map((name) => ({ name })),
    metricHeaders: metricNames.map((name) => ({ name })),
    rows: [],
    rowCount: 0,
});

/**
 * @param {string[]} dimensionNames
 * @param {string[]} metricNames
 * @param {Record<string, string | number>[]} records
 * @returns {Ga4RunReportResponse}
 */
export const makeGa4Report = (dimensionNames, metricNames, records) => {
    const rows = (records || []).map((record) => ({
        dimensionValues: dimensionNames.map((name) => ({ value: String(record[name] ?? '') })),
        metricValues: metricNames.map((name) => ({ value: String(record[name] ?? 0) })),
    }));
    return {
        dimensionHeaders: dimensionNames.map((name) => ({ name })),
        metricHeaders: metricNames.map((name) => ({ name })),
        rows,
        rowCount: rows.length,
    };
};

/**
 * @param {Ga4RunReportResponse | null | undefined} report
 * @returns {Ga4AdaptedRow[]}
 */
export const adaptGa4Report = (report) => {
    const dimensionNames = (report?.dimensionHeaders || []).map((header) => header.name);
    const metricNames = (report?.metricHeaders || []).map((header) => header.name);
    return (report?.rows || []).map((row) => {
        /** @type {Record<string, string>} */
        const dimensions = {};
        /** @type {Record<string, number>} */
        const metrics = {};
        dimensionNames.forEach((name, index) => {
            dimensions[name] = row.dimensionValues?.[index]?.value ?? '';
        });
        metricNames.forEach((name, index) => {
            const numeric = Number(row.metricValues?.[index]?.value);
            metrics[name] = Number.isFinite(numeric) ? numeric : 0;
        });
        return { dimensions, metrics };
    });
};

export const sumMetric = (rows, name) => rows.reduce((total, row) => total + (row.metrics[name] || 0), 0);

export const weightedAverage = (rows, valueName, weightName) => {
    const weight = sumMetric(rows, weightName);
    if (!weight) return 0;
    return rows.reduce((total, row) => total + (row.metrics[valueName] || 0) * (row.metrics[weightName] || 0), 0) / weight;
};
