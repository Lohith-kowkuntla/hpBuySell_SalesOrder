
//-----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//-----------------------------------------------------------------------------------*
// Application Name : Sales Order
// Description      : Sales Order - MDM Common Service description resolver
//-----------------------------------------------------------------------------------*/

'use strict';

const cds = require('@sap/cds');

const LOG = cds.log('mdm-descriptions');
const MDM_SERVICE_NAME = 'hpbuysell_mdm_common_srv_dest';

const SEP = '\u0001';

//-----------------------------------------------------------------------------------*
// MDM Sources
//-----------------------------------------------------------------------------------*

const SOURCES = {

    // WBS Project Code -> WBS Description
    PROJECT: {
        entity: 'ProjectVH',
        keys: ['wbselement'],
        text: 'wbsdescription'
    },

    // HP Company Code -> HP Company Description
    COMPANY_CODE: {
        entity: 'CompanyCode',
        keys: ['companycode'],
        text: 'companycodedescription'
    },

    // Customer Code -> Customer Description
    CUSTOMER: {
        entity: 'Customer',
        keys: ['customerid'],
        text: 'customername'
    },

    // HP Buyer Code -> HP Buyer Name
    BUYER: {
        entity: 'Buyer',
        keys: ['searchterm1'],
        text: 'buyername'
    }
};

//-----------------------------------------------------------------------------------*
// Sales Order Mappings
//-----------------------------------------------------------------------------------*

const SALES_ORDER = [

    /*
     * WBS Project Code
     *
     * SalesOrder.wbsProjectCode
     *       -> ProjectVH.wbselement
     *       -> ProjectVH.wbsdescription
     */
    {
        source: 'PROJECT',
        keys: ['wbsProjectCode'],
        target: 'wbsProjectCodeDescription'
    },

    /*
     * HP Company Code
     *
     * SalesOrder.hpCompanyCode
     *       -> CompanyCode.companycode
     *       -> CompanyCode.companycodedescription
     */
    {
        source: 'COMPANY_CODE',
        keys: ['hpCompanyCode'],
        target: 'hpCompanyDescription'
    },

    /*
     * Customer Code
     *
     * SalesOrder.customerCode
     *       -> Customer.customerid
     *       -> Customer.customername
     */
    {
        source: 'CUSTOMER',
        keys: ['customerCode'],
        target: 'customerDescription'
    },

    /*
     * HP Buyer Code
     *
     * SalesOrder.hpBuyerCode
     *       -> Buyer.searchterm1
     *       -> Buyer.buyername
     */
    {
        source: 'BUYER',
        keys: ['hpBuyerCode'],
        target: 'hpBuyerName'
    }
];

const MAPPINGS = {
    SalesOrder: SALES_ORDER
};

//-----------------------------------------------------------------------------------*
// Cache
//-----------------------------------------------------------------------------------*

const HIT_TTL = 15 * 60 * 1000;
const MISS_TTL = 5 * 60 * 1000;

const cache = new Map();

function cached(sourceName, key) {
    const entries = cache.get(sourceName);

    if (!entries) {
        return undefined;
    }

    const entry = entries.get(key);

    if (!entry) {
        return undefined;
    }

    if (entry.expires <= Date.now()) {
        entries.delete(key);
        return undefined;
    }

    return entry.text;
}

function remember(sourceName, key, value) {
    let entries = cache.get(sourceName);

    if (!entries) {
        entries = new Map();
        cache.set(sourceName, entries);
    }

    entries.set(key, {
        text: value || null,
        expires: Date.now() + (value ? HIT_TTL : MISS_TTL)
    });
}

function clearCache() {
    cache.clear();
}

//-----------------------------------------------------------------------------------*
// MDM Connection
//-----------------------------------------------------------------------------------*

let connecting = null;
let unavailableUntil = 0;

function standDown(what, error) {
    const first = unavailableUntil <= Date.now();

    unavailableUntil = Date.now() + 60 * 1000;

    if (first) {
        LOG.warn(
            'MDM description lookup unavailable (' +
            what +
            '): ' +
            (error && error.message ? error.message : error) +
            '. Falling back to existing descriptions.'
        );
    }
}

async function connect() {

    if (
        String(process.env.MDM_DESCRIPTIONS || '').toLowerCase() === 'off'
    ) {
        return null;
    }

    if (Date.now() < unavailableUntil) {
        return null;
    }

    if (!connecting) {
        connecting = cds.connect
            .to(MDM_SERVICE_NAME)
            .catch((error) => {
                connecting = null;
                standDown('connect', error);
                return null;
            });
    }

    return connecting;
}

//-----------------------------------------------------------------------------------*
// Description Resolution
//-----------------------------------------------------------------------------------*

async function resolveDescriptions(rows, mappings, options) {

    const list = toRows(rows);

    if (!list.length || !mappings || !mappings.length) {
        return rows;
    }

    const fill = Boolean(options && options.fill);

    const wanted = new Map();

    /*
     * Collect all codes that need to be resolved.
     *
     * Example:
     *
     * WBS:
     *   wbsProjectCode = "WBS001"
     *
     * Company:
     *   companyCode = "1000"
     *
     * Customer:
     *   customer = "0900046203"
     *
     * Buyer:
     *   buyerCode = "BUYER001"
     */
    for (const row of list) {

        for (const mapping of mappings) {

            /*
             * During READ, resolve only if the description was selected.
             */
            if (!fill && !(mapping.target in row)) {
                continue;
            }

            const values = keyValues(row, mapping);

            if (!values) {
                continue;
            }

            const key = values.join(SEP);

            /*
             * Already in cache.
             */
            if (cached(mapping.source, key) !== undefined) {
                continue;
            }

            let needed = wanted.get(mapping.source);

            if (!needed) {
                needed = new Map();
                wanted.set(mapping.source, needed);
            }

            needed.set(key, values);
        }
    }

    /*
     * Fetch missing descriptions.
     *
     * One MDM request per source.
     */
    if (wanted.size) {

        const mdm = await connect();

        if (mdm) {

            for (const [sourceName, needed] of wanted) {

                await fetchInto(
                    mdm,
                    sourceName,
                    Array.from(needed.values())
                );
            }
        }
    }

    /*
     * Put resolved descriptions back onto the rows.
     */
    for (const row of list) {

        for (const mapping of mappings) {

            if (!fill && !(mapping.target in row)) {
                continue;
            }

            const values = keyValues(row, mapping);

            if (!values) {
                continue;
            }

            const resolved = cached(
                mapping.source,
                values.join(SEP)
            );

            /*
             * Only replace the value when MDM returned
             * a valid description.
             */
            if (resolved) {
                row[mapping.target] = resolved;
            }
        }
    }

    return rows;
}

//-----------------------------------------------------------------------------------*
// Fetch from MDM
//-----------------------------------------------------------------------------------*/

async function fetchInto(mdm, sourceName, requests) {

    const source = SOURCES[sourceName];

    const entity =
        (mdm.entities && mdm.entities[source.entity]) ||
        source.entity;

    /*
     * Process requests in chunks.
     *
     * This avoids creating an excessively large remote query.
     */
    const CHUNK_SIZE = 20;

    for (
        let start = 0;
        start < requests.length;
        start += CHUNK_SIZE
    ) {

        const chunk = requests.slice(
            start,
            start + CHUNK_SIZE
        );

        let found;

        try {

            found = await mdm.run(
                SELECT.from(entity)
                    .columns(
                        source.keys.concat(source.text)
                    )
                    .where(
                        whereFor(source, chunk)
                    )
            );
            // log statments
            console.log(
                `[MDM] ${sourceName} requests:`,
                JSON.stringify(chunk)
            );

            console.log(
                `[MDM] ${sourceName} response:`,
                JSON.stringify(found, null, 2)
            );

        } catch (error) {

            standDown(
                source.entity,
                error
            );

            return;
        }

        /*
         * Match returned MDM rows against requested codes.
         */
        for (const values of chunk) {

            const match = (found || []).find(
                (row) =>
                    source.keys.every(
                        (key, index) =>
                            asText(row[key]) === values[index]
                    )
            );

            remember(
                sourceName,
                values.join(SEP),
                match
                    ? plainText(match[source.text])
                    : null
            );
        }
    }
}

//-----------------------------------------------------------------------------------*
// CQN WHERE Builder
//-----------------------------------------------------------------------------------*/

function whereFor(source, chunk) {

    const xpr = [];

    for (const values of chunk) {

        const group = [];

        source.keys.forEach(
            (key, index) => {

                if (!values[index]) {
                    return;
                }

                if (group.length) {
                    group.push('and');
                }

                group.push(
                    { ref: [key] },
                    '=',
                    { val: values[index] }
                );
            }
        );

        if (!group.length) {
            continue;
        }

        if (xpr.length) {
            xpr.push('or');
        }

        xpr.push({
            xpr: group
        });
    }

    return xpr;
}

//-----------------------------------------------------------------------------------*
// Helpers
//-----------------------------------------------------------------------------------*/

function keyValues(row, mapping) {

    const values = [];

    for (const field of mapping.keys) {

        values.push(
            asText(row[field])
        );
    }

    /*
     * The first key is mandatory.
     */
    return values[0] ? values : null;
}

function toRows(rows) {

    if (!rows) {
        return [];
    }

    return (
        Array.isArray(rows)
            ? rows
            : [rows]
    ).filter(Boolean);
}

function asText(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return '';
    }

    return String(value).trim();
}

function plainText(value) {
    return asText(value);
}

//-----------------------------------------------------------------------------------*
// Exports
//-----------------------------------------------------------------------------------*/

module.exports = {
    MDM_SERVICE_NAME,
    MAPPINGS,
    SOURCES,
    resolveDescriptions,
    clearCache
};

