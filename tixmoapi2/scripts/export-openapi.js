#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
require('ts-node/register');
require('tsconfig-paths/register');
const fs = require('fs');
const path = require('path');

const { swaggerSpec } = require('../src/config/swagger');

const outPath = path.resolve(process.cwd(), 'openapi.json');
fs.writeFileSync(outPath, JSON.stringify(swaggerSpec, null, 2));

console.log(`OpenAPI spec written to ${outPath}`);

