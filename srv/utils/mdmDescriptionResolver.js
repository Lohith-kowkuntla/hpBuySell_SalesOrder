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
// Configuration
//-----------------------------------------------------------------------------------*

const HIT_TTL = toNumber(
    process.env.MDM_DESCRIPTION_TTL,
    15 * 60 * 1000
);

const MISS_TTL = toNumber(
    process.env.MDM_DESCRIPTION_MISS_TTL,
    5 * 60 * 1000
);

const COOLDOWN = toNumber(
    process.env.MDM_DESCRIPTION_COOLDOWN,
    60 * 1000
);

const CHUNK_SIZE = toNumber(
    process.env.MDM_DESCRIPTION_CHUNK,
    20
);

const MAX_CODES = toNumber(
    process.env.MDM_DESCRIPTION_MAX_CODES,
    1000
);

const MAX_ORDER_CODES = toNumber(
    process.env.MDM_DESCRIPTION_MAX_ORDER_CODES,
    200
);

const CASE_INSENSITIVE =
    String(process.env.MDM_DESCRIPTION_CASE_INSENSITIVE || '').toLowerCase() !== 'off';

//-----------------------------------------------------------------------------------*
// Sources
//-----------------------------------------------------------------------------------*

const SOURCES = {

    // WBS Project description
    PROJECT: {
        entity: 'ProjectVH',
        keys: ['wbselement'],
        text: 'wbsdescription'
    },

    // HP Company Code description
    COMPANY_CODE: {
        entity: 'CompanyCode',
        keys: ['companycode'],
        text: 'companycodedescription'
    },

    // Customer description
    // CUSTOMER: {
    //     entity: 'Customer',
    //     keys: ['customerid'],
    //     text: 'customername'
    // },

    // HP Buyer name
    BUYER: {
        entity: 'Buyer',
        keys: ['searchterm1'],
        text: 'buyername'
    }
};

//-----------------------------------------------------------------------------------*
// Sales Order description mappings
//-----------------------------------------------------------------------------------*

const SALES_ORDER = [

    {
        source: 'PROJECT',
        keys: ['wbsProjectCode'],
        target: 'wbsProjectCodeDescription'
    },

    {
        source: 'COMPANY_CODE',
        keys: ['hpCompanyCode'],
        target: 'hpCompanyDescription'
    },

    {
        source: 'CUSTOMER',
        keys: ['customerCode'],
        target: 'customerDescription'
    },

    {
        source: 'BUYER',
        keys: ['hpBuyerCode'],
        target: 'hpBuyerName'
    }
];

//-----------------------------------------------------------------------------------*
// Project detail mapping
//-----------------------------------------------------------------------------------*
// Sales Order fields <- MDM Project
//
// contractNumber <- customerNumber
// contractDate   <- documentDate
// businessModel  <- businessModel
// paymentTerms   <- termsOfPayment
// transitTime    <- transitTime
//-----------------------------------------------------------------------------------*

const PROJECT_DETAILS = {
    entity: 'Project',
    key: 'wbsElement',

    fields: [
        'customerNumber',
        'documentDate',
        'businessModel',
        'termsOfPayment',
        'transitTime'
    ]
};

//-----------------------------------------------------------------------------------*
// MAPPINGS
//-----------------------------------------------------------------------------------*

const MAPPINGS = {
    SalesOrder: SALES_ORDER
};

//-----------------------------------------------------------------------------------*
// Cache
//-----------------------------------------------------------------------------------*

const cache = new Map();

const codeCache = new Map();

function cached(sourceName, key) {

    const entries = cache.get(sourceName);

    if (!entries) return undefined;

    const entry = entries.get(key);

    if (!entry) return undefined;

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
    codeCache.clear();
}

//-----------------------------------------------------------------------------------*
// Connection
//-----------------------------------------------------------------------------------*

let connecting = null;
let unavailableUntil = 0;

function standDown(what, error) {

    const first = unavailableUntil <= Date.now();

    unavailableUntil = Date.now() + COOLDOWN;

    if (first) {

        LOG.warn(
            'MDM description lookup unavailable (' +
            what +
            '): ' +
            (error && error.message ? error.message : error) +
            '. Falling back to existing values for the next ' +
            Math.round(COOLDOWN / 1000) +
            's.'
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
// Resolve descriptions
//-----------------------------------------------------------------------------------*

async function resolveDescriptions(rows, mappings, options) {

    const list = toRows(rows);

    if (!list.length || !mappings || !mappings.length) {
        return rows;
    }

    const fill = Boolean(options && options.fill);

    const wanted = new Map();

    //-------------------------------------------------------------------------*
    // Collect codes
    //-------------------------------------------------------------------------*

    for (const row of list) {

        for (const mapping of mappings) {

            /*
             * On READ, resolve only descriptions selected by the request.
             *
             * On CREATE/UPDATE with fill:true, resolve even if the description
             * element was not originally supplied.
             */
            if (
                !fill &&
                !(mapping.target in row)
            ) {
                continue;
            }

            const values = keyValues(row, mapping);

            if (!values) {
                continue;
            }

            const key = values.join(SEP);

            if (
                cached(mapping.source, key) !== undefined
            ) {
                continue;
            }

            let needed = wanted.get(mapping.source);

            if (!needed) {

                needed = new Map();

                wanted.set(
                    mapping.source,
                    needed
                );
            }

            needed.set(key, values);
        }
    }

    //-------------------------------------------------------------------------*
    // Fetch from MDM
    //-------------------------------------------------------------------------*

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

    //-------------------------------------------------------------------------*
    // Write resolved descriptions onto rows
    //-------------------------------------------------------------------------*

    for (const row of list) {

        for (const mapping of mappings) {

            if (
                !fill &&
                !(mapping.target in row)
            ) {
                continue;
            }

            const values = keyValues(
                row,
                mapping
            );

            if (!values) {
                continue;
            }

            const resolved = cached(
                mapping.source,
                values.join(SEP)
            );

            if (resolved) {

                row[mapping.target] = resolved;

                continue;
            }

            /*
             * Keep the existing value if MDM did not answer.
             *
             * Only unreadable values are removed.
             */
            if (
                isUnreadable(row[mapping.target])
            ) {
                row[mapping.target] = '';
            }
        }
    }

    return rows;
}

//-----------------------------------------------------------------------------------*
// Fetch descriptions
//-----------------------------------------------------------------------------------*
async function fetchInto(
    mdm,
    sourceName,
    requests
) {

    const source = SOURCES[sourceName];

    if (!source) {
        console.log(
            `[MDM] Unknown source: ${sourceName}`
        );
        return;
    }

    const entity =
        (mdm.entities && mdm.entities[source.entity]) ||
        source.entity;

    for (
        let start = 0;
        start < requests.length;
        start += CHUNK_SIZE
    ) {

        const chunk = requests.slice(
            start,
            start + CHUNK_SIZE
        );


        // =====================================================================
        // REQUEST LOG
        // =====================================================================

        console.log(
            `[MDM] ${sourceName} requests:`,
            JSON.stringify(chunk)
        );


        let found;

        try {

            found = await mdm.run(
                SELECT
                    .from(entity)
                    .columns(
                        source.keys.concat(
                            source.text
                        )
                    )
                    .where(
                        whereFor(
                            source,
                            chunk
                        )
                    )
            );


            // =================================================================
            // RESPONSE LOG
            // =================================================================

            console.log(
                `[MDM] ${sourceName} response:`,
                JSON.stringify(
                    found || [],
                    null,
                    2
                )
            );


        } catch (error) {

            console.error(
                `[MDM] ${sourceName} ERROR:`,
                error.message
            );

            standDown(
                source.entity,
                error
            );

            return;
        }


        // =====================================================================
        // CACHE RESPONSE
        // =====================================================================

        for (const values of chunk) {

            const match =
                (found || []).find(
                    (row) =>
                        source.keys.every(
                            (key, index) =>
                                !values[index] ||
                                asText(row[key]) ===
                                values[index]
                        )
                );


            remember(
                sourceName,
                values.join(SEP),
                match
                    ? plainText(
                        match[source.text]
                    )
                    : null
            );
        }
    }
}

//-----------------------------------------------------------------------------------*
// Project details
//-----------------------------------------------------------------------------------*

async function resolveProjectDetails(rows) {

    const list = toRows(rows);

    if (!list.length) {
        return rows;
    }

    /*
     * The SO field wbsProjectCode maps to MDM Project.wbsElement.
     */
    const projectCodes = [
        ...new Set(
            list
                .map((row) =>
                    asText(row.wbsProjectCode)
                )
                .filter(Boolean)
        )
    ];

    if (!projectCodes.length) {
        return rows;
    }

    const mdm = await connect();

    if (!mdm) {
        return rows;
    }

    const entity =
        (mdm.entities &&
            mdm.entities[PROJECT_DETAILS.entity]) ||
        PROJECT_DETAILS.entity;

    let projects;

    try {

        console.log(
            "[MDM] PROJECT_DETAILS requests:",
            JSON.stringify(projectCodes)
        );

        projects = await mdm.run(
            SELECT
                .from(entity)
                .columns(
                    PROJECT_DETAILS.key,
                    ...PROJECT_DETAILS.fields
                )
                .where(
                    projectWbsWhere(projectCodes)
                )
        );

        console.log(
            "[MDM] PROJECT_DETAILS response:",
            JSON.stringify(projects || [], null, 2)
        );

    } catch (error) {

        standDown(
            'Project details',
            error
        );

        return rows;
    }

    const projectMap = new Map();

    for (const project of projects || []) {

        const key =
            asText(
                project[PROJECT_DETAILS.key]
            );

        if (key) {
            projectMap.set(
                key,
                project
            );
        }
    }

    for (const row of list) {

        const wbs =
            asText(row.wbsProjectCode);

        if (!wbs) {
            continue;
        }

        const project =
            projectMap.get(wbs);

        if (!project) {
            continue;
        }

        /*
         * IMPORTANT:
         *
         * SO contractNumber comes from MDM customerNumber.
         */
        if (
            project.customerNumber !== undefined &&
            project.customerNumber !== null
        ) {
            row.contractNumber =
                plainText(
                    project.customerNumber
                );
        }

        if (
            project.documentDate !== undefined &&
            project.documentDate !== null
        ) {
            row.contractDate =
                project.documentDate;
        }

        if (
            project.businessModel !== undefined &&
            project.businessModel !== null
        ) {
            row.businessModel =
                plainText(
                    project.businessModel
                );
        }

        if (
            project.termsOfPayment !== undefined &&
            project.termsOfPayment !== null
        ) {
            row.paymentTerms =
                plainText(
                    project.termsOfPayment
                );
        }

        /*
         * Transit time belongs to the SO item.
         */
        if (
            Array.isArray(row.items)
        ) {

            for (const item of row.items) {

                if (
                    project.transitTime !== undefined &&
                    project.transitTime !== null
                ) {
                    item.transitTime =
                        plainText(
                            project.transitTime
                        );
                }
            }
        }
    }

    return rows;
}

//-----------------------------------------------------------------------------------*
// Project WHERE
//-----------------------------------------------------------------------------------*

function projectWbsWhere(projectCodes) {

    const xpr = [];

    for (const code of projectCodes) {

        if (xpr.length) {
            xpr.push('or');
        }

        xpr.push({
            ref: ['wbsElement']
        });

        xpr.push('=');

        xpr.push({
            val: code
        });
    }

    return xpr;
}

//-----------------------------------------------------------------------------------*
// Reverse resolution: description -> codes
//-----------------------------------------------------------------------------------*

async function resolveCodesByText(
    sourceName,
    operator,
    term
) {

    const source = SOURCES[sourceName];

    const needle = asText(term);

    if (!source || !needle) {
        return null;
    }

    const key =
        sourceName +
        SEP +
        operator +
        SEP +
        needle;

    const hit = codeCache.get(key);

    if (
        hit &&
        hit.expires > Date.now()
    ) {
        return hit.answer;
    }

    if (hit) {
        codeCache.delete(key);
    }

    const mdm = await connect();

    if (!mdm) {
        return null;
    }

    const entity =
        (mdm.entities &&
            mdm.entities[source.entity]) ||
        source.entity;

    const codeField =
        source.keys[0];

    let found;

    try {

        found = await mdm.run(
            SELECT
                .from(entity)
                .columns(codeField)
                .where(
                    textPredicate(
                        source,
                        operator,
                        needle
                    )
                )
                .limit(
                    MAX_CODES + 1
                )
        );

    } catch (error) {

        standDown(
            source.entity +
            ' (' +
            operator +
            ')',
            error
        );

        return null;
    }

    const codes = [];

    const seen = new Set();

    for (const row of found || []) {

        const code =
            asText(
                row[codeField]
            );

        if (
            !code ||
            seen.has(code)
        ) {
            continue;
        }

        seen.add(code);

        codes.push(code);
    }

    const truncated =
        codes.length > MAX_CODES;

    if (truncated) {
        codes.length = MAX_CODES;

        LOG.warn(
            'More than ' +
            MAX_CODES +
            ' ' +
            source.entity +
            ' entries match "' +
            needle +
            '".'
        );
    }

    const answer = {
        codes,
        truncated
    };

    codeCache.set(
        key,
        {
            answer,
            expires:
                Date.now() +
                (
                    codes.length
                        ? HIT_TTL
                        : MISS_TTL
                )
        }
    );

    return answer;
}

//-----------------------------------------------------------------------------------*
// MDM text predicate
//-----------------------------------------------------------------------------------*

function textPredicate(
    source,
    operator,
    needle
) {

    const field =
        CASE_INSENSITIVE
            ? {
                func: 'tolower',
                args: [
                    {
                        ref: [source.text]
                    }
                ]
            }
            : {
                ref: [source.text]
            };

    const value = {
        val:
            CASE_INSENSITIVE
                ? needle.toLowerCase()
                : needle
    };

    if (operator === 'equals') {

        return [
            field,
            '=',
            value
        ];
    }

    if (operator === 'contains') {

        return [
            {
                func: 'contains',
                args: [
                    field,
                    value
                ]
            }
        ];
    }

    if (operator === 'startswith') {

        return [
            {
                func: 'startswith',
                args: [
                    field,
                    value
                ]
            }
        ];
    }

    if (operator === 'endswith') {

        return [
            {
                func: 'endswith',
                args: [
                    field,
                    value
                ]
            }
        ];
    }

    return [
        field,
        '=',
        value
    ];
}

//-----------------------------------------------------------------------------------*
// Resolve descriptions by code
//-----------------------------------------------------------------------------------*

async function resolveTextsByCode(
    sourceName,
    codes
) {

    const wanted = [];

    const seen = new Set();

    for (const code of codes || []) {

        const value = asText(code);

        if (
            !value ||
            seen.has(value)
        ) {
            continue;
        }

        seen.add(value);

        if (
            cached(
                sourceName,
                value
            ) === undefined
        ) {
            wanted.push([value]);
        }
    }

    if (wanted.length) {

        const mdm = await connect();

        if (!mdm) {
            return null;
        }

        await fetchInto(
            mdm,
            sourceName,
            wanted
        );
    }

    const texts = new Map();

    for (const code of seen) {

        const text =
            cached(
                sourceName,
                code
            );

        if (text) {
            texts.set(
                code,
                text
            );
        }
    }

    return texts;
}

//-----------------------------------------------------------------------------------*
// WHERE builder
//-----------------------------------------------------------------------------------*

function whereFor(
    source,
    chunk
) {

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
                    {
                        ref: [key]
                    },
                    '=',
                    {
                        val: values[index]
                    }
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
// Row key handling
//-----------------------------------------------------------------------------------*

function keyValues(
    row,
    mapping
) {

    if (!row) {
        return null;
    }

    const values = [];

    for (const field of mapping.keys) {

        const value =
            asText(row[field]);

        values.push(value);
    }

    return values[0]
        ? values
        : null;
}

//-----------------------------------------------------------------------------------*
// Clear descriptions
//-----------------------------------------------------------------------------------*

function clearDescriptions(
    rows,
    mappings
) {

    const list = toRows(rows);

    if (
        !list.length ||
        !mappings ||
        !mappings.length
    ) {
        return rows;
    }

    for (const row of list) {

        for (const mapping of mappings) {

            const writesCode =
                mapping.keys.some(
                    (key) =>
                        key in row
                );

            if (writesCode) {

                row[mapping.target] = null;

            } else if (
                mapping.target in row
            ) {

                delete row[
                    mapping.target
                ];
            }
        }
    }

    return rows;
}

//-----------------------------------------------------------------------------------*
// Helpers
//-----------------------------------------------------------------------------------*

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

//-----------------------------------------------------------------------------------*
// Unreadable MDM text
//-----------------------------------------------------------------------------------*

const CIPHERTEXT = /enc:v\d+:/i;

const MASKED = /^\u2022+$/;

function isUnreadable(value) {

    const text = asText(value);

    if (!text) {
        return false;
    }

    return (
        CIPHERTEXT.test(text) ||
        MASKED.test(text)
    );
}

function plainText(value) {

    const text = asText(value);

    return isUnreadable(text)
        ? ''
        : text;
}

//-----------------------------------------------------------------------------------*
// Mapping helper
//-----------------------------------------------------------------------------------*

function mappingFor(
    mappings,
    field
) {

    if (
        !mappings ||
        !field
    ) {
        return null;
    }

    return mappings.find(
        (mapping) =>
            mapping.target === field
    ) || null;
}

//-----------------------------------------------------------------------------------*
// Number helper
//-----------------------------------------------------------------------------------*

function toNumber(
    value,
    fallback
) {

    const number = Number(value);

    return Number.isFinite(number) &&
        number > 0
        ? number
        : fallback;
}

//-----------------------------------------------------------------------------------*
// Exports
//-----------------------------------------------------------------------------------*

module.exports = {

    MDM_SERVICE_NAME,

    MAPPINGS,

    SOURCES,

    resolveDescriptions,

    resolveProjectDetails,

    clearDescriptions,

    resolveCodesByText,

    resolveTextsByCode,

    mappingFor,

    isUnreadable,

    clearCache
};