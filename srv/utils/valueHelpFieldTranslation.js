//-----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//-----------------------------------------------------------------------------------*
// Pure, dependency-free helpers for translating an exposed Value Help entity's
// CQN ($filter/$orderby) into the real source entity's field names.
//
// A Value Help such as VH_SalesOrderType exposes "code", but the real local
// column on SalesOrders is "salesOrderType_code" (an association's flattened
// foreign key). Forwarding the client's $filter/$orderby verbatim onto the
// substituted entity - as valueHelpScope.js used to do - throws
// '"code" not found in the elements of "...SalesOrders"' the moment a client
// filters or sorts by it. Every ref has to be rewritten through fieldMap
// first.
//-----------------------------------------------------------------------------------*

"use strict";

/**
 * Thrown when a client $filter/$orderby references an exposed field that has
 * no entry in the value help's fieldMap - i.e. a field that either doesn't
 * exist at all, or exists but was deliberately left unmapped because no real
 * local column backs it (e.g. VH_Customer.customerDescription).
 */
class UnknownValueHelpFieldError extends Error {
    constructor(fieldName) {
        super(`Value help field '${fieldName}' is not mapped to a local source column`);
        this.name = "UnknownValueHelpFieldError";
        this.fieldName = fieldName;
    }
}


/**
 * Recursively rewrites every single-segment {ref:[...]} in a CQN fragment
 * (where/orderBy/func args) from exposed field names to real source column
 * names, per fieldMap.
 *
 * Handles:
 *   - plain arrays (operator-token arrays, orderBy arrays)
 *   - {ref: [name]}                      -> translated leaf reference
 *   - {ref: [a, b, ...]}                 -> left untouched (already a path
 *                                            expression, e.g. scope's own
 *                                            "salesOrder.customerCode")
 *   - {xpr: [...]}                       -> recurse into xpr
 *   - {func, args: [...]}                -> recurse into args
 *   - {list: [...]}, {val: ...}          -> left untouched (literals)
 *   - {ref: [name], sort: "asc"|"desc"}  -> translated ref, sort preserved
 *
 * @param {*} node
 * @param {Object<string,string>} fieldMap exposed field name -> source column name
 * @returns {*} a new, translated copy of node
 * @throws {UnknownValueHelpFieldError} if a single-segment ref has no mapping
 */
function translateExpr(node, fieldMap) {

    if (Array.isArray(node)) {
        return node.map((part) => translateExpr(part, fieldMap));
    }

    if (node && typeof node === "object") {

        if (Array.isArray(node.ref)) {

            if (node.ref.length === 1) {

                const sourceField = fieldMap[node.ref[0]];

                if (sourceField === undefined) {
                    throw new UnknownValueHelpFieldError(node.ref[0]);
                }

                return { ...node, ref: [sourceField] };
            }

            // multi-segment path (e.g. association navigation) - not a
            // client-supplied VH field reference, leave untouched.
            return node;
        }

        if (Array.isArray(node.xpr)) {
            return { ...node, xpr: translateExpr(node.xpr, fieldMap) };
        }

        if (Array.isArray(node.args)) {
            return { ...node, args: translateExpr(node.args, fieldMap) };
        }

        // literals ({val:...}, {list:[...]}) and anything else pass through.
        return node;
    }

    return node;
}


/**
 * Builds the CQN columns array for a query's projection, in source-column
 * terms, from a fieldMap.
 *
 * @param {Object<string,string>} fieldMap
 * @returns {Array<{ref: string[]}>}
 */
function buildSourceColumns(fieldMap) {

    return Object.values(fieldMap).map((sourceField) => ({
        ref: [sourceField]
    }));
}


/**
 * Maps a row keyed by source column names back to the exposed VH field
 * names the client expects (the inverse of fieldMap).
 *
 * @param {Object} row
 * @param {Object<string,string>} fieldMap exposed -> source
 * @returns {Object}
 */
function mapRowToOutput(row, fieldMap) {

    const output = {};

    for (const [exposedField, sourceField] of Object.entries(fieldMap)) {
        output[exposedField] = row[sourceField];
    }

    return output;
}


/**
 * Decides which reader a value help configuration should use.
 *
 * Mirrors the routing table from the fix request:
 *   source === "mdm"       -> "mdm"      (only if isMdmValueHelp is true)
 *   source === "local"      -> "local"
 *   source === "codeList"   -> "codeList"
 *   source === "static"     -> "static"
 *   anything else            -> throws (unknown/misconfigured)
 *
 * Pure decision function - no I/O - so it's unit-testable without a live
 * CAP service.
 *
 * @param {{source?: string}} config
 * @param {(name: string) => boolean} isMdmValueHelp
 * @param {string} valueHelpName
 * @returns {"mdm"|"local"|"codeList"|"static"}
 */
function resolveReader(config, isMdmValueHelp, valueHelpName) {

    if (!config || !config.source) {
        throw new Error(
            `Value help '${valueHelpName}' has no configured source`
        );
    }

    if (config.source === "mdm") {

        if (!isMdmValueHelp(valueHelpName)) {
            throw new Error(
                `Value help '${valueHelpName}' is configured with source ` +
                `'mdm' but has no corresponding MDM_VALUE_HELP_CONFIG entry`
            );
        }

        return "mdm";
    }

    if (
        config.source === "local" ||
        config.source === "codeList" ||
        config.source === "static"
    ) {
        return config.source;
    }

    throw new Error(
        `Value help '${valueHelpName}' has an unsupported source ` +
        `'${config.source}'`
    );
}


/**
 * Validates that every source column a "local" value help config declares
 * actually exists as an element of its reflected CDS entity. Called once at
 * service boot so a bad config fails loudly at startup instead of 500-ing on
 * first use.
 *
 * @param {object} csnDefinitions cds.model.definitions (or a plain map for tests)
 * @param {string} entityName fully-qualified CDS entity name
 * @param {Object<string,string>} fieldMap exposed -> source
 * @param {string} valueHelpName for the error message
 * @throws {Error} if any source column is missing
 */
function validateFieldMapAgainstCsn(csnDefinitions, entityName, fieldMap, valueHelpName) {

    const definition = csnDefinitions[entityName];

    if (!definition || !definition.elements) {
        throw new Error(
            `Value help '${valueHelpName}': source entity '${entityName}' ` +
            `was not found in the reflected CDS model`
        );
    }

    const missing = Object.values(fieldMap).filter(
        (sourceField) => !(sourceField in definition.elements)
    );

    if (missing.length) {
        throw new Error(
            `Value help '${valueHelpName}': source entity '${entityName}' ` +
            `has no element(s) [${missing.join(", ")}] - check fieldMap ` +
            `against the actual CDS model instead of assuming an ` +
            `association-generated '_code' suffix`
        );
    }
}


module.exports = {
    UnknownValueHelpFieldError,
    translateExpr,
    buildSourceColumns,
    mapRowToOutput,
    resolveReader,
    validateFieldMapAgainstCsn
};
